const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const { runRulesForDepartmentEvent } = require("./automationEngine");
const { awardServiceCommission } = require("./commissionService");
const { createNotification } = require("./notificationService");
const {
    isValidDepartment,
    isValidStage,
    getInitialStage,
    hasWorkflow,
    isCommissionStage,
    getStages,
} = require("../config/departmentWorkflows");

/**
 * Lead ↔ Department service layer.
 *
 * A Lead is the customer; a LeadDepartment is one department's service on that
 * customer, with its own consultant and workflow stage. This module owns the
 * full lifecycle (allocate → assign consultant → advance stage) and all of the
 * authorization that goes with it.
 *
 * Roles (reusing the existing enum):
 *   SUPER_ADMIN = Director   — full access
 *   ADMIN       = Manager    — manages the departments they are a member of
 *   EMPLOYEE    = Consultant — works only their own assignments
 */

// ── Authorization helpers ────────────────────────────────────────────────────

/** True if the user is a member of `department` (via UserDepartment). */
async function isMemberOfDepartment(userId, department) {
    const row = await prisma.userDepartment.findUnique({
        where: { userId_department: { userId, department } },
        select: { id: true },
    });
    return Boolean(row);
}

/** The list of department codes a user belongs to (via UserDepartment). */
async function getUserDepartments(userId) {
    const rows = await prisma.userDepartment.findMany({
        where: { userId },
        select: { department: true },
    });
    return rows.map(r => r.department);
}

/** The SALES LeadDepartment for a lead (the root department), or null. */
function getSalesAssignment(leadId) {
    return prisma.leadDepartment.findUnique({
        where: { leadId_department: { leadId, department: "SALES" } },
        select: { id: true, assignedEmployeeId: true },
    });
}

/**
 * Who can allocate a lead to other departments:
 *   - Director (SUPER_ADMIN)
 *   - a Sales Manager (ADMIN who is a member of SALES)
 *   - the consultant assigned to this lead's SALES assignment
 * NOT an arbitrary Sales consultant.
 */
async function canAllocate(actor, leadId) {
    if (actor.role === "SUPER_ADMIN") return true;
    const sales = await getSalesAssignment(leadId);
    if (!sales) return false;
    if (actor.role === "ADMIN" && (await isMemberOfDepartment(actor.userId, "SALES"))) return true;
    return sales.assignedEmployeeId === actor.userId;
}

/** Director, or a Manager who is a member of the department. */
async function canManageDepartment(actor, department) {
    if (actor.role === "SUPER_ADMIN") return true;
    if (actor.role === "ADMIN") return isMemberOfDepartment(actor.userId, department);
    return false;
}

/** The assigned consultant, the department's manager, or the Director. */
async function canUpdateStage(actor, leadDept) {
    if (actor.role === "SUPER_ADMIN") return true;
    if (leadDept.assignedEmployeeId === actor.userId) return true;
    return canManageDepartment(actor, leadDept.department);
}

// ── Historical stage ledger ───────────────────────────────────────────────────

/**
 * Append one row to the LeadDepartmentStageEvent ledger — the source of truth for
 * "what happened over time" analytics. MUST be called with a transaction client
 * (`tx`) on the same transaction as the state change it records, so a stage change
 * can never exist without its event (and vice-versa).
 *
 * `fromStage = null` marks a service entering its workflow (creation/allocation).
 * `changedByUserId = null` marks a system/programmatic origin (import, webhook).
 */
function recordStageEvent(tx, { leadDepartmentId, department, fromStage = null, toStage, changedByUserId = null }) {
    return tx.leadDepartmentStageEvent.create({
        data: { leadDepartmentId, department, fromStage, toStage, changedByUserId },
    });
}

// ── Creation ─────────────────────────────────────────────────────────────────

/**
 * Create the SALES LeadDepartment for a freshly created lead, plus its first stage
 * event (null → ENQUIRY = "enquiry received"). Pass a transaction client so the
 * lead, its SALES service, and the entry event are all atomic.
 * Used exclusively by leadService.createLead — every lead enters through Sales.
 */
async function createSalesAssignment(client, leadId, assignedEmployeeId = null, changedByUserId = null) {
    const stage = getInitialStage("SALES");
    const created = await client.leadDepartment.create({
        data: {
            leadId,
            department: "SALES",
            stage,
            assignedEmployeeId,
            assignedAt: assignedEmployeeId ? new Date() : null,
        },
    });
    await recordStageEvent(client, {
        leadDepartmentId: created.id,
        department: "SALES",
        fromStage: null,
        toStage: stage,
        changedByUserId,
    });
    return created;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Allocate a lead to one or more departments (Sales-side action).
 * Creates a LeadDepartment per department (unassigned, at its initial stage).
 * Existing departments and SALES are skipped silently.
 */
async function allocateDepartments({ leadId, departments, actor }) {
    if (!Array.isArray(departments) || departments.length === 0) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "departments must be a non-empty array");
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");

    if (!(await canAllocate(actor, leadId))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot allocate departments for this lead");
    }

    // SALES is the root department, auto-created at lead creation — never re-allocated.
    const targets = [...new Set(departments)].filter(d => d !== "SALES");
    const invalid = targets.filter(d => !isValidDepartment(d));
    if (invalid.length) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department(s): ${invalid.join(", ")}`);
    }
    // A department with no configured workflow (e.g. APPLICATION_VISA) cannot be
    // allocated — there is no stage to start the assignment at.
    const unconfigured = targets.filter(d => !hasWorkflow(d));
    if (unconfigured.length) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Department(s) have no workflow configured yet: ${unconfigured.join(", ")}`);
    }

    // Only departments not already present are created (skipDuplicates semantics),
    // and only those emit a "entered workflow" stage event (null → initial stage).
    const existing = await prisma.leadDepartment.findMany({
        where: { leadId, department: { in: targets } },
        select: { department: true },
    });
    const existingSet = new Set(existing.map(e => e.department));
    const newDepartments = targets.filter(d => !existingSet.has(d));

    if (newDepartments.length) {
        // Creation + its entry events are atomic: a service can never be created
        // without the ledger row that records it entering the workflow.
        await prisma.$transaction(async (tx) => {
            await tx.leadDepartment.createMany({
                data: newDepartments.map(department => ({
                    leadId,
                    department,
                    stage: getInitialStage(department),
                })),
                skipDuplicates: true,
            });
            const created = await tx.leadDepartment.findMany({
                where: { leadId, department: { in: newDepartments } },
                select: { id: true, department: true, stage: true },
            });
            await tx.leadDepartmentStageEvent.createMany({
                data: created.map(c => ({
                    leadDepartmentId: c.id,
                    department: c.department,
                    fromStage: null,
                    toStage: c.stage,
                    changedByUserId: actor.userId,
                })),
            });
        });
    }

    await logActivity({
        leadId,
        userId: actor.userId,
        action: "DEPARTMENTS_ALLOCATED",
        metadata: { departments: targets },
    });

    // Fire DEPARTMENT_ALLOCATED for each freshly allocated service (skipDuplicates
    // means an already-existing department won't re-fire — fetch + match targets).
    const allocated = await prisma.leadDepartment.findMany({
        where: { leadId, department: { in: targets } },
    });
    for (const leadDept of allocated) {
        runRulesForDepartmentEvent("DEPARTMENT_ALLOCATED", leadDept).catch(console.error);
    }

    return getDepartmentAssignments({ leadId, actor });
}

/**
 * Assign (or reassign) a consultant to a department's service on a lead.
 * Manager-of-department (or Director) only; the consultant must be a member of
 * that department.
 */
async function assignConsultant({ leadDepartmentId, consultantId, actor }) {
    const leadDept = await prisma.leadDepartment.findUnique({ where: { id: leadDepartmentId } });
    if (!leadDept) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Department assignment not found");

    if (!(await canManageDepartment(actor, leadDept.department))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not manage this department");
    }

    const consultant = await prisma.user.findUnique({
        where: { id: consultantId },
        select: { id: true, isActive: true },
    });
    if (!consultant || !consultant.isActive) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Consultant not found or inactive");
    }
    if (!(await isMemberOfDepartment(consultantId, leadDept.department))) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Consultant does not belong to this department");
    }

    const updated = await prisma.leadDepartment.update({
        where: { id: leadDepartmentId },
        data: { assignedEmployeeId: consultantId, assignedAt: new Date() },
    });

    await logActivity({
        leadId: leadDept.leadId,
        userId: actor.userId,
        action: "CONSULTANT_ASSIGNED",
        metadata: { department: leadDept.department, consultantId },
    });

    runRulesForDepartmentEvent("ASSIGNED", updated, { consultantId }).catch(console.error);

    return updated;
}

/**
 * Bulk assign (or reassign) a consultant to multiple department services.
 * Manager-of-department (or Director) only; the consultant must be a member of
 * that department.
 */
async function assignConsultantBulk({ leadDepartmentIds, consultantId, actor }) {
    if (!Array.isArray(leadDepartmentIds) || leadDepartmentIds.length === 0) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "leadDepartmentIds must be a non-empty array");
    }

    const consultant = await prisma.user.findUnique({
        where: { id: consultantId },
        select: { id: true, isActive: true },
    });
    if (!consultant || !consultant.isActive) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Consultant not found or inactive");
    }

    const results = [];

    for (const id of leadDepartmentIds) {
        const leadDept = await prisma.leadDepartment.findUnique({ where: { id } });
        if (!leadDept) continue;

        if (!(await canManageDepartment(actor, leadDept.department))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, `You do not manage the department: ${leadDept.department}`);
        }

        if (!(await isMemberOfDepartment(consultantId, leadDept.department))) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Consultant does not belong to department: ${leadDept.department}`);
        }

        const updated = await prisma.leadDepartment.update({
            where: { id },
            data: { assignedEmployeeId: consultantId, assignedAt: new Date() },
        });

        await logActivity({
            leadId: leadDept.leadId,
            userId: actor.userId,
            action: "CONSULTANT_ASSIGNED",
            metadata: { department: leadDept.department, consultantId },
        });

        runRulesForDepartmentEvent("ASSIGNED", updated, { consultantId }).catch(console.error);
        results.push(updated);
    }

    return results;
}

// ── Self-claim + manager-approved reassignment ────────────────────────────────

/** Active ADMIN (Manager) members of a department — the approvers for that
 *  department's reassignment requests. */
async function getDepartmentManagers(department) {
    const rows = await prisma.userDepartment.findMany({
        where: { department, user: { isActive: true, role: "ADMIN" } },
        select: { userId: true },
    });
    return rows.map(r => r.userId);
}

/**
 * Consultant self-claim. A department member may take an UNASSIGNED service that
 * is still at its initial (ENQUIRY) stage directly, with no manager approval.
 * Anything else (already assigned, or past enquiry) must go through
 * requestReassignment.
 */
async function claimService({ leadDepartmentId, actor }) {
    const leadDept = await prisma.leadDepartment.findUnique({ where: { id: leadDepartmentId } });
    if (!leadDept) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Department assignment not found");

    if (!(await isMemberOfDepartment(actor.userId, leadDept.department))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You are not a member of this department");
    }
    if (leadDept.assignedEmployeeId) {
        throw new ApiError(409, ERROR_CODES.DUPLICATE_ENTRY, "This lead is already assigned — request a reassignment instead");
    }
    if (leadDept.stage !== getInitialStage(leadDept.department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Only enquiry-stage leads can be self-assigned");
    }

    const updated = await prisma.leadDepartment.update({
        where: { id: leadDepartmentId },
        data: { assignedEmployeeId: actor.userId, assignedAt: new Date() },
    });

    await logActivity({
        leadId: leadDept.leadId,
        userId: actor.userId,
        action: "CONSULTANT_ASSIGNED",
        metadata: { department: leadDept.department, consultantId: actor.userId, selfClaim: true },
    });

    runRulesForDepartmentEvent("ASSIGNED", updated, { consultantId: actor.userId }).catch(console.error);

    return updated;
}

/**
 * A consultant raises a request to move a service to a different consultant —
 * either taking over an already-assigned lead, or handing their own lead to
 * someone else. The assignment does NOT change yet; the request goes to the
 * department's managers (in-app notification + a card in their department queue)
 * to approve or reject.
 */
async function requestReassignment({ leadDepartmentId, toUserId, reason = null, actor }) {
    if (!toUserId) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "toUserId is required");
    }

    const leadDept = await prisma.leadDepartment.findUnique({
        where: { id: leadDepartmentId },
        include: { lead: { select: { name: true } } },
    });
    if (!leadDept) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Department assignment not found");

    if (!(await isMemberOfDepartment(actor.userId, leadDept.department))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You are not a member of this department");
    }

    // Only the current assignee may hand the lead off; anyone in the department may
    // request to take it for themselves.
    const isCurrentAssignee = leadDept.assignedEmployeeId === actor.userId;
    const takingForSelf = toUserId === actor.userId;
    if (!isCurrentAssignee && !takingForSelf) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Only the assigned consultant can hand this lead to someone else");
    }
    if (toUserId === leadDept.assignedEmployeeId) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "That consultant is already assigned to this lead");
    }

    const target = await prisma.user.findUnique({
        where: { id: toUserId },
        select: { id: true, isActive: true, name: true },
    });
    if (!target || !target.isActive) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Target consultant not found or inactive");
    }
    if (!(await isMemberOfDepartment(toUserId, leadDept.department))) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Target consultant does not belong to this department");
    }

    // One open request per service at a time.
    const pending = await prisma.leadAssignmentRequest.findFirst({
        where: { leadDepartmentId, status: "PENDING" },
        select: { id: true },
    });
    if (pending) {
        throw new ApiError(409, ERROR_CODES.DUPLICATE_ENTRY, "A reassignment request is already pending for this lead");
    }

    const request = await prisma.leadAssignmentRequest.create({
        data: {
            leadDepartmentId,
            department: leadDept.department,
            requestedById: actor.userId,
            fromUserId: leadDept.assignedEmployeeId,
            toUserId,
            reason,
        },
        include: {
            requestedBy: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } },
        },
    });

    await logActivity({
        leadId: leadDept.leadId,
        userId: actor.userId,
        action: "REASSIGNMENT_REQUESTED",
        metadata: { department: leadDept.department, fromUserId: leadDept.assignedEmployeeId, toUserId },
    });

    // Notify every manager of the department.
    const managerIds = await getDepartmentManagers(leadDept.department);
    const link = `/department-queue?department=${leadDept.department}`;
    await Promise.all(
        managerIds.map(userId =>
            createNotification({
                userId,
                title: "Reassignment request",
                message: `${request.requestedBy.name} requested to reassign "${leadDept.lead.name}" (${leadDept.department}) to ${request.toUser.name}.`,
                type: "REASSIGNMENT_REQUEST",
                link,
            })
        )
    );

    return request;
}

/**
 * A manager (or Director) approves or rejects a pending reassignment request.
 * Approve performs the actual reassignment atomically and notifies the requester
 * and the new assignee; reject just notifies the requester.
 */
async function decideReassignment({ requestId, decision, actor }) {
    const action = String(decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(action)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "decision must be APPROVE or REJECT");
    }

    const request = await prisma.leadAssignmentRequest.findUnique({
        where: { id: requestId },
        include: {
            leadDepartment: { include: { lead: { select: { name: true } } } },
            toUser: { select: { id: true, name: true } },
        },
    });
    if (!request) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Reassignment request not found");
    if (request.status !== "PENDING") {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "This request has already been decided");
    }
    if (!(await canManageDepartment(actor, request.department))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not manage this department");
    }

    const leadDept = request.leadDepartment;
    const leadName = leadDept.lead.name;
    const link = `/leads/${leadDept.leadId}`;

    if (action === "REJECT") {
        const updated = await prisma.leadAssignmentRequest.update({
            where: { id: requestId },
            data: { status: "REJECTED", decidedById: actor.userId, decidedAt: new Date() },
        });
        await logActivity({
            leadId: leadDept.leadId,
            userId: actor.userId,
            action: "REASSIGNMENT_REJECTED",
            metadata: { department: request.department, requestId, toUserId: request.toUserId },
        });
        await createNotification({
            userId: request.requestedById,
            title: "Reassignment rejected",
            message: `Your request to reassign "${leadName}" (${request.department}) was rejected.`,
            type: "REASSIGNMENT_REJECTED",
            link,
        });
        return updated;
    }

    // APPROVE — target must still be a valid department member.
    if (!(await isMemberOfDepartment(request.toUserId, request.department))) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Target consultant no longer belongs to this department");
    }

    const { req } = await prisma.$transaction(async (tx) => {
        const ld = await tx.leadDepartment.update({
            where: { id: leadDept.id },
            data: { assignedEmployeeId: request.toUserId, assignedAt: new Date() },
        });
        const updatedReq = await tx.leadAssignmentRequest.update({
            where: { id: requestId },
            data: { status: "APPROVED", decidedById: actor.userId, decidedAt: new Date() },
        });
        return { ld, req: updatedReq };
    });

    await logActivity({
        leadId: leadDept.leadId,
        userId: actor.userId,
        action: "CONSULTANT_ASSIGNED",
        metadata: { department: request.department, consultantId: request.toUserId, viaRequest: requestId },
    });

    runRulesForDepartmentEvent("ASSIGNED", { ...leadDept, assignedEmployeeId: request.toUserId }, {
        consultantId: request.toUserId,
    }).catch(console.error);

    // Notify the requester, and the new assignee (if different from the requester).
    await createNotification({
        userId: request.requestedById,
        title: "Reassignment approved",
        message: `Your request to reassign "${leadName}" (${request.department}) to ${request.toUser.name} was approved.`,
        type: "REASSIGNMENT_APPROVED",
        link,
    });
    if (request.toUserId !== request.requestedById) {
        await createNotification({
            userId: request.toUserId,
            title: "Lead assigned to you",
            message: `"${leadName}" (${request.department}) has been assigned to you.`,
            type: "REASSIGNMENT_APPROVED",
            link,
        });
    }

    return req;
}

/** Pending reassignment requests for a department (manager / Director view). */
async function getPendingReassignmentRequests({ department, actor }) {
    if (!isValidDepartment(department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department: ${department}`);
    }
    if (!(await canManageDepartment(actor, department))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not manage this department");
    }
    return prisma.leadAssignmentRequest.findMany({
        where: { department, status: "PENDING" },
        include: {
            leadDepartment: {
                include: { lead: { select: { id: true, name: true, phone: true, email: true } } },
            },
            requestedBy: { select: { id: true, name: true } },
            fromUser: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
    });
}

/**
 * Advance/update the stage of a department's service.
 * Free movement: the assigned consultant (or dept manager / Director) may set any
 * stage that belongs to the department's workflow. No manager approval required.
 */
async function updateStage({ leadDepartmentId, stage, actor }) {
    const leadDept = await prisma.leadDepartment.findUnique({ where: { id: leadDepartmentId } });
    if (!leadDept) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Department assignment not found");

    if (!(await canUpdateStage(actor, leadDept))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot update this department's stage");
    }

    if (!isValidStage(leadDept.department, stage)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid stage "${stage}" for ${leadDept.department}`);
    }

    if (stage === "COMMISSION_INVOICING") {
        const u = await prisma.user.findUnique({ where: { id: actor.userId }, select: { preferences: true } });
        const permissions = u?.preferences?.permissions || {};
        const hasAccess = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN" || permissions.commissionInvoicing !== false;
        if (!hasAccess) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not have access to move leads to the Commission Invoicing stage");
        }
    }

    if (stage === leadDept.stage) return leadDept; // no-op (no event for a non-move)

    // Validation gates for SALES department stage transitions
    if (leadDept.department === "SALES") {
        await validateSalesStageMove(leadDept, leadDept.stage, stage, prisma);
    }

    // Validation gates for LOAN department stage transitions
    if (leadDept.department === "LOAN") {
        await validateLoanStageMove(leadDept, leadDept.stage, stage, prisma);
    }

    // Validation gates for FOREX department stage transitions
    if (leadDept.department === "FOREX") {
        await validateForexStageMove(leadDept, leadDept.stage, stage, prisma);
    }

    // Validation gates for ACCOMMODATION_TICKETS department stage transitions
    if (leadDept.department === "ACCOMMODATION_TICKETS") {
        await validateAccommodationStageMove(leadDept, leadDept.stage, stage, prisma);
    }

    // Validation gates for MISCELLANEOUS department stage transitions
    if (leadDept.department === "MISCELLANEOUS") {
        await validateMiscellaneousStageMove(leadDept, leadDept.stage, stage, prisma);
    }

    // Atomic: the stage update and its ledger row succeed or fail together, so a
    // stage change can never exist without the historical event that records it.
    const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.leadDepartment.update({
            where: { id: leadDepartmentId },
            data: { stage },
        });
        await recordStageEvent(tx, {
            leadDepartmentId,
            department: leadDept.department,
            fromStage: leadDept.stage,
            toStage: stage,
            changedByUserId: actor.userId,
        });
        return row;
    });

    await logActivity({
        leadId: leadDept.leadId,
        userId: actor.userId,
        action: "STAGE_UPDATED",
        metadata: { department: leadDept.department, from: leadDept.stage, to: stage },
    });

    // Reaching the department's commission stage awards a commission to this
    // service's consultant (idempotent on leadId+department). Per-department —
    // there is no global "lead converted" commission any more.
    if (isCommissionStage(updated.department, stage)) {
        await awardServiceCommission(updated);
    }

    // System Actions for SALES department transitions
    if (leadDept.department === "SALES") {
        if (stage === "UNIVERSITY_SHORTLISTING") {
            try {
                await allocateDepartments({
                    leadId: leadDept.leadId,
                    departments: ["LOAN"],
                    actor: { role: "SUPER_ADMIN", userId: actor.userId }
                });
            } catch (err) {
                console.error("Failed to auto-allocate LOAN department:", err);
            }
        }
        if (stage === "DEPOSIT_STATUS") {
            try {
                await allocateDepartments({
                    leadId: leadDept.leadId,
                    departments: ["FOREX"],
                    actor: { role: "SUPER_ADMIN", userId: actor.userId }
                });
            } catch (err) {
                console.error("Failed to auto-allocate FOREX department:", err);
            }
        }
        if (stage === "VISA_DOCUMENTATION") {
            try {
                await allocateDepartments({
                    leadId: leadDept.leadId,
                    departments: ["ACCOMMODATION_TICKETS"],
                    actor: { role: "SUPER_ADMIN", userId: actor.userId }
                });
            } catch (err) {
                console.error("Failed to auto-allocate ACCOMMODATION_TICKETS department:", err);
            }
        }
        if (stage === "COMMISSION_INVOICING") {
            try {
                const lead = await prisma.lead.findUnique({
                    where: { id: leadDept.leadId },
                    select: { name: true }
                });
                const admins = await prisma.user.findMany({
                    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
                    select: { id: true }
                });
                await Promise.all(
                    admins.map(admin =>
                        createNotification({
                            userId: admin.id,
                            title: "Accounts Alert: Send Invoice to University",
                            message: `Lead "${lead.name}" has reached Commission Invoicing stage. Please send invoice to university.`,
                            type: "ACCOUNTS_ALERT",
                            link: `/leads/${leadDept.leadId}`
                        }).catch(console.error)
                    )
                );
            } catch (err) {
                console.error("Failed to push alert to Accounts Team:", err);
            }
        }
    }

    // System Actions for LOAN department transitions
    if (leadDept.department === "LOAN" && stage === "COMMISSION_INVOICING") {
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: leadDept.leadId },
                select: { name: true }
            });
            const admins = await prisma.user.findMany({
                where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
                select: { id: true }
            });
            await Promise.all(
                admins.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: "Accounts Alert: Loan Commission Invoicing",
                        message: `Loan lead "${lead.name}" has reached Commission Invoicing stage. Please process the loan commission invoice.`,
                        type: "ACCOUNTS_ALERT",
                        link: `/leads/${leadDept.leadId}`
                    }).catch(console.error)
                )
            );
        } catch (err) {
            console.error("Failed to push loan alert to Accounts Team:", err);
        }
    }

    // System Actions for ACCOMMODATION_TICKETS department transitions
    if (leadDept.department === "ACCOMMODATION_TICKETS" && stage === "COMMISSION_INVOICING") {
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: leadDept.leadId },
                select: { name: true }
            });
            const admins = await prisma.user.findMany({
                where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
                select: { id: true }
            });
            await Promise.all(
                admins.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: "Accounts Alert: Accommodation Commission Invoicing",
                        message: `Accommodation lead "${lead.name}" has reached Commission Invoicing stage. Please process the accommodation commission invoice.`,
                        type: "ACCOUNTS_ALERT",
                        link: `/leads/${leadDept.leadId}`
                    }).catch(console.error)
                )
            );
        } catch (err) {
            console.error("Failed to push accommodation alert to Accounts Team:", err);
        }
    }

    // Single source of truth for stage transitions → fire department automation.
    runRulesForDepartmentEvent("STAGE_CHANGED", updated, {
        prevStage: leadDept.stage,
        newStage: stage,
    }).catch(console.error);

    return updated;
}

/**
 * System-triggered advance of a lead's SALES service to COMMISSION_INVOICING once
 * its commission invoice is fully paid (called from the invoice payment flow).
 *
 * Only advances when the SALES service is sitting at VISA_APPROVAL — never jumps
 * earlier stages or re-fires once already past. Reuses updateStage so the commission
 * award, accounts alert, and automation side-effects all run exactly as a manual
 * move would. Runs as a privileged system actor (the move is gated by full payment,
 * which is already true at the moment this is called).
 *
 * @returns {{ skipped: string } | object}  the updated row, or a skip reason.
 */
async function advanceSalesOnInvoicePaid(leadId, triggeredByUserId = null) {
    const sales = await prisma.leadDepartment.findUnique({
        where: { leadId_department: { leadId, department: "SALES" } },
    });
    if (!sales) return { skipped: "no_sales_service" };
    if (sales.stage !== "VISA_APPROVAL") return { skipped: `not_at_visa_approval (${sales.stage})` };

    return updateStage({
        leadDepartmentId: sales.id,
        stage: "COMMISSION_INVOICING",
        actor: { userId: triggeredByUserId, role: "SUPER_ADMIN" },
    });
}

/**
 * Remove a department's service from a lead.
 * Same authorization as allocation (Sales-side); SALES (root) cannot be removed.
 */
async function removeDepartment({ leadDepartmentId, actor }) {
    const leadDept = await prisma.leadDepartment.findUnique({ where: { id: leadDepartmentId } });
    if (!leadDept) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Department assignment not found");

    if (leadDept.department === "SALES") {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "The SALES department cannot be removed");
    }
    if (!(await canAllocate(actor, leadDept.leadId))) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot remove departments for this lead");
    }

    await prisma.leadDepartment.delete({ where: { id: leadDepartmentId } });

    await logActivity({
        leadId: leadDept.leadId,
        userId: actor.userId,
        action: "DEPARTMENT_REMOVED",
        metadata: { department: leadDept.department },
    });

    return { id: leadDepartmentId, removed: true };
}

/**
 * List a lead's department assignments, scoped to what the actor may see:
 *   - Director     — all
 *   - Manager      — departments they manage, plus anything assigned to them
 *   - Consultant   — only assignments assigned to them
 */
async function getDepartmentAssignments({ leadId, actor }) {
    const assignments = await prisma.leadDepartment.findMany({
        where: { leadId },
        include: { assignedEmployee: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
    });

    if (actor.role === "SUPER_ADMIN") return assignments;

    if (actor.role === "EMPLOYEE") {
        return assignments.filter(a => a.assignedEmployeeId === actor.userId);
    }

    // ADMIN (Manager): own departments + own assignments
    const managed = new Set(await getUserDepartments(actor.userId));
    return assignments.filter(a => managed.has(a.department) || a.assignedEmployeeId === actor.userId);
}

// ── Department queue (manager / consultant work list) ─────────────────────────

/**
 * List LeadDepartment rows for a department's queue, scoped to the actor:
 *   - Director         — any department
 *   - Manager          — only departments they are a member of
 *   - Consultant       — only their own assignments within the department
 * Optional filters: stage, assignedEmployeeId ("unassigned" → null), search.
 */
/** Shared scoping/filter logic for the department queue. Returns `null` if the
 *  actor's role has no queue access at all (caller should return an empty result). */
async function buildQueueWhere({ department, actor, filters = {} }) {
    if (!isValidDepartment(department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department: ${department}`);
    }

    const where = { department };

    if (actor.role === "EMPLOYEE") {
        where.assignedEmployeeId = actor.userId;
    } else if (actor.role === "ADMIN") {
        if (!(await isMemberOfDepartment(actor.userId, department))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not manage this department");
        }
        if (filters.assignedEmployeeId === "unassigned") {
            where.assignedEmployeeId = null;
        } else if (filters.assignedEmployeeId) {
            where.assignedEmployeeId = filters.assignedEmployeeId;
        }
    } else if (actor.role === "SUPER_ADMIN") {
        if (filters.assignedEmployeeId === "unassigned") {
            where.assignedEmployeeId = null;
        } else if (filters.assignedEmployeeId) {
            where.assignedEmployeeId = filters.assignedEmployeeId;
        }
    } else {
        return null;
    }

    if (filters.stage) where.stage = filters.stage;

    const leadFilter = {};
    if (filters.search) {
        leadFilter.OR = [
            { name: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
        ];
    }
    if (filters.source)      leadFilter.source      = filters.source;
    if (filters.category) {
        leadFilter.score = leadFilter.score || {};
        if (filters.category === "PREMIUM") {
            leadFilter.score.gte = 81;
        } else if (filters.category === "HOT") {
            leadFilter.score.gte = 61;
            leadFilter.score.lte = 80;
        } else if (filters.category === "WARM") {
            leadFilter.score.gte = 31;
            leadFilter.score.lte = 60;
        } else if (filters.category === "COLD") {
            leadFilter.score.lte = 30;
        }
    }
    if (filters.enquiryType) leadFilter.enquiryType = filters.enquiryType;

    if (filters.score_min !== undefined || filters.score_max !== undefined) {
        leadFilter.score = leadFilter.score || {};
        if (filters.score_min !== undefined) leadFilter.score.gte = parseInt(filters.score_min, 10);
        if (filters.score_max !== undefined) leadFilter.score.lte = parseInt(filters.score_max, 10);
    }

    if (filters.startDate || filters.endDate) {
        leadFilter.createdAt = {};
        if (filters.startDate) {
            leadFilter.createdAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
                end.setUTCHours(23, 59, 59, 999);
            }
            leadFilter.createdAt.lte = end;
        }
    }

    if (filters.sla) {
        const cutoffMs = filters.sla === "breach" ? 7 * 86_400_000 : 3 * 86_400_000;
        const cutoff   = new Date(Date.now() - cutoffMs);
        const slaOr = [
            { lastActivityAt: { lt: cutoff } },
            { AND: [{ lastActivityAt: null }, { updatedAt: { lt: cutoff } }] },
        ];
        leadFilter.OR = slaOr;
    }

    if (filters.country) {
        leadFilter.customFields = {
            path: ['destinationCountries'],
            string_contains: filters.country
        };
    }

    if (Object.keys(leadFilter).length > 0) {
        where.lead = leadFilter;
    }

    return where;
}

async function getDepartmentQueue({ department, actor, filters = {} }) {
    const where = await buildQueueWhere({ department, actor, filters });
    if (!where) return [];

    return prisma.leadDepartment.findMany({
        where,
        include: {
            lead: { select: LEAD_SELECT_FOR_BOARD },
            assignedEmployee: { select: { id: true, name: true, email: true, profilePhoto: true } },
        },
        orderBy: { updatedAt: "desc" },
    });
}

const LEAD_SELECT_FOR_BOARD = {
    id: true, leadId: true, name: true, email: true, phone: true, source: true, sourceLabel: true,
    enquiryType: true, score: true, category: true, updatedAt: true, customFields: true,
    tasks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true },
    },
    leadDepartments: {
        select: {
            id: true,
            department: true,
            stage: true,
            assignedEmployeeId: true,
            assignedEmployee: {
                select: {
                    id: true,
                    name: true,
                    profilePhoto: true,
                }
            }
        }
    }
};

/**
 * Per-stage-paginated variant for the Leads Board view — same scoping as
 * getDepartmentQueue, but instead of paging the department's leads as one flat
 * list (which starves columns: ordering by updatedAt means one busy stage can
 * fill the whole page while every other column sits empty), this pages EACH
 * stage independently, so every column gets up to `perStage` leads on every
 * page regardless of how lopsided the department's stage distribution is.
 */
async function getDepartmentBoardByStage({ department, actor, filters = {}, page = 1, perStage = 10 }) {
    const where = await buildQueueWhere({ department, actor, filters });
    const stages = getStages(department);
    if (!where || stages.length === 0) {
        return { page, perStage, total: 0, totalPages: 1, columns: {} };
    }

    const skip = (page - 1) * perStage;
    const perStageResults = await Promise.all(
        stages.map(async (stage) => {
            const stageWhere = { ...where, stage };
            const [total, rows] = await Promise.all([
                prisma.leadDepartment.count({ where: stageWhere }),
                prisma.leadDepartment.findMany({
                    where: stageWhere,
                    skip,
                    take: perStage,
                    orderBy: { updatedAt: "desc" },
                    include: {
                        lead: { select: LEAD_SELECT_FOR_BOARD },
                        assignedEmployee: { select: { id: true, name: true, email: true, profilePhoto: true } },
                    },
                }),
            ]);
            return [stage, { rows, total, totalPages: Math.max(1, Math.ceil(total / perStage)) }];
        })
    );

    const columns = Object.fromEntries(perStageResults);
    const total = perStageResults.reduce((sum, [, c]) => sum + c.total, 0);
    // The pager's range covers the deepest column — paging forward keeps
    // advancing the columns that still have more rows; exhausted columns just
    // render empty rather than capping how far you can page overall.
    const totalPages = Math.max(1, ...perStageResults.map(([, c]) => c.totalPages));

    return { page, perStage, total, totalPages, columns };
}

// ── Membership management (Director sets up department staffing) ───────────────

/** Add a user to a department. Director only (enforced at the route). */
async function addMembership({ userId, department, actor }) {
    if (!isValidDepartment(department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department: ${department}`);
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "User not found");

    const membership = await prisma.userDepartment.upsert({
        where: { userId_department: { userId, department } },
        create: { userId, department },
        update: {},
    });

    await logActivity({
        userId: actor.userId,
        action: "DEPARTMENT_MEMBERSHIP_ADDED",
        metadata: { targetUserId: userId, department },
    });

    return membership;
}

/** Remove a user from a department. Director only (enforced at the route). */
async function removeMembership({ userId, department, actor }) {
    await prisma.userDepartment.deleteMany({ where: { userId, department } });

    await logActivity({
        userId: actor.userId,
        action: "DEPARTMENT_MEMBERSHIP_REMOVED",
        metadata: { targetUserId: userId, department },
    });

    return { userId, department, removed: true };
}

/** List the active members of a department (for assignment dropdowns). */
async function getDepartmentMembers(department) {
    if (!isValidDepartment(department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department: ${department}`);
    }
    const rows = await prisma.userDepartment.findMany({
        where: { department, user: { isActive: true } },
        include: { user: { select: { id: true, name: true, email: true, role: true, profilePhoto: true } } },
        orderBy: { user: { name: "asc" } },
    });
    return rows.map(r => r.user);
}

async function validateSalesStageMove(leadDept, currentStage, targetStage, txOrPrisma = prisma) {
    if (currentStage === targetStage) return;

    // Determine if moving forward or backward in the workflow
    const stages = getStages(leadDept.department);
    const currentIndex = stages.indexOf(currentStage);
    const targetIndex = stages.indexOf(targetStage);
    const isMovingForward = targetIndex > currentIndex;

    // Skip validation when moving backwards (to previous stages)
    if (!isMovingForward) {
        return;
    }

    // Load lead to check its customFields, resumeUrl, etc.
    const lead = await txOrPrisma.lead.findUnique({
        where: { id: leadDept.leadId },
        select: { id: true, nextFollowUpAt: true, resumeUrl: true, customFields: true }
    });
    if (!lead) return;

    const cf = lead.customFields || {};

    if (currentStage === "ENQUIRY") {
        const noteCount = await txOrPrisma.note.count({ where: { leadId: leadDept.leadId } });
        const reminderCount = await txOrPrisma.reminder.count({ where: { leadId: leadDept.leadId } });
        if (noteCount === 0 && reminderCount === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Enquiry stage: Must add at least one note or reminder first.");
        }
    }

    // Verify that a resume is uploaded before moving out of Follow-Up stage
    if (currentStage === "FOLLOW_UP") {
        if (!lead.resumeUrl) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Follow-Up stage: Resume must be uploaded first.");
        }
    }

    if (currentStage === "PROSPECT") {
        const firstName = cf.firstName;
        const lastName = cf.lastName;
        const hasProfile = (firstName !== undefined && firstName !== null && String(firstName).trim() !== "") ||
                            (lastName !== undefined && lastName !== null && String(lastName).trim() !== "");
        if (!hasProfile) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Prospect stage: Student Profile must be created first.");
        }
    }

    if (currentStage === "UNIVERSITY_SHORTLISTING") {
        const country = cf.univ_country;
        const name = cf.univ_name;
        const course = cf.univ_course;
        const link = cf.univ_link;
        const hasCountry = country !== undefined && country !== null && String(country).trim() !== "";
        const hasName = name !== undefined && name !== null && String(name).trim() !== "";
        const hasCourse = course !== undefined && course !== null && String(course).trim() !== "";
        const hasLink = link !== undefined && link !== null && String(link).trim() !== "";

        const firstName = cf.firstName;
        const lastName = cf.lastName;
        const hasProfile = (firstName !== undefined && firstName !== null && String(firstName).trim() !== "") ||
                            (lastName !== undefined && lastName !== null && String(lastName).trim() !== "");

        if (!hasProfile) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of University Shortlisting stage: Student Profile must be created first.");
        }

        if (!hasCountry || !hasName || !hasCourse || !hasLink) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of University Shortlisting stage: Target university details (Country, Name, Course, Link) must be filled.");
        }
    }

    if (currentStage === "AWAITING_STATUS") {
        const list = cf.shortlisted_universities || [];
        const hasConfirmed = Array.isArray(list) && list.some(u =>
            u?.confirmed === true || u?.confirmed === "true"
        );
        if (!hasConfirmed) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Awaiting Status stage: at least one university must be marked as Confirmed before progressing.");
        }
    }

    if (currentStage === "APPLICATION") {
        const list = cf.shortlisted_universities || [];
        if (list.length === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Application Process stage: At least one target university must be shortlisted.");
        }
        const allCompleted = list.every(u => u.completed === true || u.completed === "true" || u.status === "Completed");
        if (!allCompleted) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Application Process stage: All target universities must have their application status marked 'Completed'.");
        }
    }

    if (currentStage === "DEPOSIT_STATUS") {
        const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
        if (!filled(cf.deposit_amount) || !filled(cf.payment_mode) || !filled(cf.payment_date)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Deposit Payment stage: Deposit amount, mode of payment and date of payment are required.");
        }
    }

    if (currentStage === "VISA_DOCUMENTATION") {
        const hasDate = cf.visa_appointment_date !== undefined && cf.visa_appointment_date !== null && String(cf.visa_appointment_date).trim() !== "";
        if (cf.visa_manager_approved !== true && cf.visa_manager_approved !== "true") {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Visa Documentation stage: Manager approval checkbox must be ticked.");
        }
        if (!hasDate) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Visa Documentation stage: Visa Appointment Date must be filled.");
        }
    }

    if (currentStage === "VISA_STATUS") {
        const hasDate = cf.visa_appointment_date !== undefined && cf.visa_appointment_date !== null && String(cf.visa_appointment_date).trim() !== "";
        const isApproved = cf.embassy_result === "Approved";
        if (!hasDate) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Visa Status stage: Visa Appointment Date must be filled.");
        }
        if (isApproved) {
            const hasPassport = cf.approved_visa_passport !== undefined && cf.approved_visa_passport !== null && String(cf.approved_visa_passport).trim() !== "";
            const hasFlightDate = cf.flight_departure_date !== undefined && cf.flight_departure_date !== null && String(cf.flight_departure_date).trim() !== "";
            if (!hasPassport || !hasFlightDate) {
                throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Visa Status stage: Approved Visa Passport Page and Flight Departure Date must be filled when Visa is Approved.");
            }
        } else if (cf.embassy_result !== "Refused") {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Visa Status stage: Embassy Result must be Approved or Refused.");
        }
    }

    // Commission Invoicing requires a fully-paid commission invoice for this lead.
    // The normal path auto-advances here when the last payment lands; this guards a
    // manual move so it can't reach Commission Invoicing (and award commission /
    // revenue) before the money is actually collected.
    if (targetStage === "COMMISSION_INVOICING") {
        // The Sales pipeline requires a paid SALES invoice. General (null) invoices are
        // a separate, manually-created bucket and do NOT satisfy the Sales pipeline, nor
        // does any other department's invoice.
        const paidInvoice = await txOrPrisma.invoice.count({
            where: { leadId: leadDept.leadId, department: "SALES", status: "PAID", deletedAt: null },
        });
        if (paidInvoice === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move to Commission Invoicing: create a Sales invoice for this lead and collect full payment first.");
        }
    }
}

/**
 * Validation gates for LOAN department stage transitions (mirrors
 * validateSalesStageMove). Only forward moves are gated; moving back is free.
 *
 * Loan bank records live on lead.customFields.loan_banks — an array of bank
 * objects the consultant fills from the Loan panel (LeadLoanPanel). Each entry
 * carries a `status` (Pending/Accepted/Rejected) and, when Accepted, its
 * sanctioned loan details.
 */
async function validateLoanStageMove(leadDept, currentStage, targetStage, txOrPrisma = prisma) {
    if (currentStage === targetStage) return;

    // Parking (Archive) or rejecting is allowed from any stage — these are
    // off-pipeline outcomes, not steps that require the documentation to be complete.
    if (targetStage === "ARCHIVE" || targetStage === "REJECTED") return;

    const stages = getStages(leadDept.department);
    const currentIndex = stages.indexOf(currentStage);
    const targetIndex = stages.indexOf(targetStage);
    const isMovingForward = targetIndex > currentIndex;

    // Moving backward (correcting a stage) is always allowed.
    if (!isMovingForward) return;

    const lead = await txOrPrisma.lead.findUnique({
        where: { id: leadDept.leadId },
        select: { id: true, customFields: true },
    });
    if (!lead) return;

    const cf = lead.customFields || {};
    const banks = Array.isArray(cf.loan_banks) ? cf.loan_banks : [];

    // Enquiry → Loan Documentation: must have engaged the lead at least once.
    if (currentStage === "ENQUIRY") {
        const noteCount = await txOrPrisma.note.count({ where: { leadId: leadDept.leadId } });
        const reminderCount = await txOrPrisma.reminder.count({ where: { leadId: leadDept.leadId } });
        if (noteCount === 0 && reminderCount === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Enquiry stage: Must add at least one note or reminder first.");
        }
    }

    // Loan Documentation → Awaiting Approval: at least one bank must be recorded
    // with its mandatory fields filled (kept in sync with LoanBankModal's required
    // fields). A bank row missing any of these isn't considered "documented".
    if (currentStage === "LOAN_DOCUMENTATION") {
        const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
        const isComplete = (b) =>
            filled(b?.bank_name) && filled(b?.loan_type) && filled(b?.documents_submitted_date);
        if (!banks.some(isComplete)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Loan Documentation stage: Add at least one bank with Bank, Loan Type, and Documents Submitted Date filled.");
        }
    }

    // Awaiting Approval → Approved: at least one bank accepted, each accepted
    // bank must carry its sanctioned amount so the loan details are complete.
    if (currentStage === "AWAITING_APPROVAL") {
        const accepted = banks.filter(b => b?.status === "Accepted");
        if (accepted.length === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Awaiting Approval stage: Mark at least one bank as Accepted first.");
        }
        const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
        const missingAmount = accepted.some(b => !filled(b.sanctioned_amount));
        if (missingAmount) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Awaiting Approval stage: Every accepted bank must have its sanctioned amount filled.");
        }
    }

    // Commission Invoicing requires a fully-paid LOAN invoice for this lead — a
    // general or other-department invoice doesn't satisfy the loan pipeline.
    if (targetStage === "COMMISSION_INVOICING") {
        const paidInvoice = await txOrPrisma.invoice.count({
            where: { leadId: leadDept.leadId, department: "LOAN", status: "PAID", deletedAt: null },
        });
        if (paidInvoice === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move to Commission Invoicing: create a Loan invoice for this lead and collect full payment first.");
        }
    }
}

async function validateMiscellaneousStageMove(leadDept, currentStage, targetStage, txOrPrisma = prisma) {
    if (currentStage === targetStage) return;

    const stages = getStages(leadDept.department);
    const currentIndex = stages.indexOf(currentStage);
    const targetIndex = stages.indexOf(targetStage);
    const isMovingForward = targetIndex > currentIndex;

    if (!isMovingForward) return;

    const lead = await txOrPrisma.lead.findUnique({
        where: { id: leadDept.leadId },
        select: { id: true, customFields: true },
    });
    if (!lead) return;

    const cf = lead.customFields || {};

    // Enquiry → On Progress: must have specified Types of Services.
    if (currentStage === "ENQUIRY") {
        const serviceType = cf.misc_service_type;
        if (!serviceType || String(serviceType).trim() === "") {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Enquiry stage: 'Types of Services' custom field must be specified first.");
        }
    }

    // Commission Invoicing requires a fully-paid Miscellaneous invoice for this
    // lead — a general or other-department invoice doesn't satisfy this pipeline.
    if (targetStage === "COMMISSION_INVOICING") {
        const paidInvoice = await txOrPrisma.invoice.count({
            where: { leadId: leadDept.leadId, department: "MISCELLANEOUS", status: "PAID", deletedAt: null },
        });
        if (paidInvoice === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move to Commission Invoicing: create a Miscellaneous invoice for this lead and collect full payment first.");
        }
    }
}

async function validateAccommodationStageMove(leadDept, currentStage, targetStage, txOrPrisma = prisma) {
    if (currentStage === targetStage) return;

    if (targetStage === "ARCHIVE" || targetStage === "REJECTED") return;

    const stages = getStages(leadDept.department);
    const currentIndex = stages.indexOf(currentStage);
    const targetIndex = stages.indexOf(targetStage);
    const isMovingForward = targetIndex > currentIndex;

    if (!isMovingForward) return;

    const lead = await txOrPrisma.lead.findUnique({
        where: { id: leadDept.leadId },
        select: { id: true, customFields: true },
    });
    if (!lead) return;

    const cf = lead.customFields || {};
    const bookings = Array.isArray(cf.accommodation_bookings) ? cf.accommodation_bookings : [];

    // Enquiry → On Progress: must have engaged the lead at least once.
    if (currentStage === "ENQUIRY") {
        const noteCount = await txOrPrisma.note.count({ where: { leadId: leadDept.leadId } });
        const reminderCount = await txOrPrisma.reminder.count({ where: { leadId: leadDept.leadId } });
        if (noteCount === 0 && reminderCount === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Enquiry stage: Must add at least one note or reminder first.");
        }
    }

    // On Progress → Awaiting Confirmation: must have at least one booking recorded with mandatory fields filled.
    if (currentStage === "ON_PROGRESS") {
        const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
        const isComplete = (b) =>
            filled(b?.agent_name) && filled(b?.booking_type) && filled(b?.booking_ref) && filled(b?.details_submitted_date);
        if (!bookings.some(isComplete)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of On Progress stage: Add at least one booking with Agent/Company, Booking Type, Booking Ref, and Request Date filled.");
        }
    }

    // Awaiting Confirmation → Booking Confirmed: at least one booking confirmed, each confirmed booking must have its booking cost filled.
    if (currentStage === "AWAITING_CONFIRMATION") {
        const confirmed = bookings.filter(b => b?.status === "Confirmed");
        if (confirmed.length === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Awaiting Confirmation stage: Mark at least one booking as Confirmed first.");
        }
        const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
        const missingCost = confirmed.some(b => !filled(b.booking_cost));
        if (missingCost) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Awaiting Confirmation stage: Every confirmed booking must have its Booking Cost filled.");
        }
    }

    // Commission Invoicing requires a fully-paid Accommodation invoice for this
    // lead — a general or other-department invoice doesn't satisfy this pipeline.
    if (targetStage === "COMMISSION_INVOICING") {
        const paidInvoice = await txOrPrisma.invoice.count({
            where: { leadId: leadDept.leadId, department: "ACCOMMODATION_TICKETS", status: "PAID", deletedAt: null },
        });
        if (paidInvoice === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move to Commission Invoicing: create an Accommodation invoice for this lead and collect full payment first.");
        }
    }
}

async function validateForexStageMove(leadDept, currentStage, targetStage, txOrPrisma = prisma) {
    if (currentStage === targetStage) return;

    if (targetStage === "ARCHIVE" || targetStage === "REJECTED") return;

    const stages = getStages(leadDept.department);
    const currentIndex = stages.indexOf(currentStage);
    const targetIndex = stages.indexOf(targetStage);
    const isMovingForward = targetIndex > currentIndex;

    if (!isMovingForward) return;

    const lead = await txOrPrisma.lead.findUnique({
        where: { id: leadDept.leadId },
        select: { id: true, customFields: true },
    });
    if (!lead) return;

    const cf = lead.customFields || {};
    const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
    const isPdf = (v) => {
        if (!filled(v)) return false;
        return String(v).toLowerCase().endsWith(".pdf");
    };

    // 1. Enquiry → On Progress: must have date, amount, service company name filled
    if (currentStage === "ENQUIRY") {
        if (!filled(cf.forex_date) || !filled(cf.forex_amount) || !filled(cf.forex_service_company)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of Enquiry stage: Date, Amount, and Service Company Name must be filled.");
        }
    }

    // 2. On Progress → Process Completed: must have receipt and swift copy (both must be PDF)
    if (currentStage === "ON_PROGRESS") {
        if (!isPdf(cf.forex_receipt)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of On Progress stage: Receipt must be uploaded and must be in PDF format.");
        }
        if (!isPdf(cf.forex_swift_copy)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move lead out of On Progress stage: SWIFT Copy must be uploaded and must be in PDF format.");
        }
    }

    // 3. Process Completed → Commission Invoicing: must have paid Forex invoice
    if (targetStage === "COMMISSION_INVOICING") {
        const paidInvoice = await txOrPrisma.invoice.count({
            where: { leadId: leadDept.leadId, department: "FOREX", status: "PAID", deletedAt: null },
        });
        if (paidInvoice === 0) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot move to Commission Invoicing: Create a Forex invoice for this lead and collect full payment first.");
        }
    }
}

module.exports = {
    // authorization
    isMemberOfDepartment,
    getUserDepartments,
    canAllocate,
    canManageDepartment,
    canUpdateStage,
    // creation
    createSalesAssignment,
    // lifecycle
    allocateDepartments,
    assignConsultant,
    assignConsultantBulk,
    claimService,
    requestReassignment,
    decideReassignment,
    getPendingReassignmentRequests,
    getDepartmentManagers,
    updateStage,
    advanceSalesOnInvoicePaid,
    removeDepartment,
    getDepartmentAssignments,
    // queue + membership
    getDepartmentQueue,
    getDepartmentBoardByStage,
    addMembership,
    removeMembership,
    getDepartmentMembers,
};
