const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const { runRulesForDepartmentEvent } = require("./automationEngine");
const { awardServiceCommission } = require("./commissionService");
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

// ── Creation ─────────────────────────────────────────────────────────────────

/**
 * Create the SALES LeadDepartment for a freshly created lead.
 * Pass a transaction client so the lead + its SALES service are atomic.
 * Used exclusively by leadService.createLead — every lead enters through Sales.
 */
function createSalesAssignment(client, leadId, assignedEmployeeId = null) {
    return client.leadDepartment.create({
        data: {
            leadId,
            department: "SALES",
            stage: getInitialStage("SALES"),
            assignedEmployeeId,
            assignedAt: assignedEmployeeId ? new Date() : null,
        },
    });
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

    await prisma.leadDepartment.createMany({
        data: targets.map(department => ({
            leadId,
            department,
            stage: getInitialStage(department),
        })),
        skipDuplicates: true, // re-allocating an existing department is a no-op
    });

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

    if (stage === leadDept.stage) return leadDept; // no-op

    const updated = await prisma.leadDepartment.update({
        where: { id: leadDepartmentId },
        data: { stage },
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

    // Single source of truth for stage transitions → fire department automation.
    runRulesForDepartmentEvent("STAGE_CHANGED", updated, {
        prevStage: leadDept.stage,
        newStage: stage,
    }).catch(console.error);

    return updated;
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
    if (filters.search) {
        where.lead = {
            OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { phone: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
            ],
        };
    }

    return where;
}

async function getDepartmentQueue({ department, actor, filters = {} }) {
    const where = await buildQueueWhere({ department, actor, filters });
    if (!where) return [];

    return prisma.leadDepartment.findMany({
        where,
        include: {
            lead: { select: { id: true, name: true, email: true, phone: true, source: true, score: true, category: true } },
            assignedEmployee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
    });
}

const LEAD_SELECT_FOR_BOARD = {
    id: true, name: true, email: true, phone: true, source: true,
    enquiryType: true, score: true, category: true, updatedAt: true,
    tasks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true },
    },
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
                        assignedEmployee: { select: { id: true, name: true, email: true } },
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
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { user: { name: "asc" } },
    });
    return rows.map(r => r.user);
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
    updateStage,
    removeDepartment,
    getDepartmentAssignments,
    // queue + membership
    getDepartmentQueue,
    getDepartmentBoardByStage,
    addMembership,
    removeMembership,
    getDepartmentMembers,
};
