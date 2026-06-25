const prisma = require("../utils/prisma");
const paginate = require("../utils/paginate");
const { signUploadUrl } = require("../utils/signedUpload");
const { createSalesAssignment, isMemberOfDepartment, getUserDepartments } = require("./leadDepartmentService");
const { getInitialStage } = require("../config/departmentWorkflows");

/**
 * The ONLY supported way to create a lead. Every lead enters through Sales, so
 * this atomically creates the Lead and its SALES LeadDepartment in one
 * transaction. Calling `prisma.lead.create` directly is forbidden — it would
 * produce an orphan lead with no department (invisible under the new model).
 *
 * @param {object} data            Prisma Lead create data (caller prepares scoring,
 *                                  phoneNormalized, etc). Do NOT pass assignedToId —
 *                                  this function owns the SALES assignment.
 * @param {object} [opts]
 * @param {string} [opts.createdByUserId]  If this user is a SALES member, the new
 *                                  lead's SALES service is self-assigned to them.
 * @param {string} [opts.salesAssigneeId]  Explicit SALES consultant to assign,
 *                                  bypassing the membership check. Used by
 *                                  prospecting sources (LinkedIn/Search) where the
 *                                  scraper claims the lead regardless of department.
 * @param {boolean} [opts.forceAssignToCreator] If true, assigns to creator regardless
 *                                  of department membership (for lead form creation).
 * @returns {Promise<object>} the created Lead
 */
async function createLead(data, { createdByUserId, salesAssigneeId, forceAssignToCreator = false } = {}) {
    // Resolve who owns the SALES service:
    //   1. an explicit assignee (prospecting self-claim), else
    //   2. force assign to creator (lead form creation), else
    //   3. the creator, but only if they actually work in Sales, else
    //   4. nobody — programmatic sources stay unassigned for a manager to allocate.
    let assigneeId = null;
    if (salesAssigneeId) {
        assigneeId = salesAssigneeId;
    } else if (forceAssignToCreator && createdByUserId) {
        assigneeId = createdByUserId;
    } else if (createdByUserId && (await isMemberOfDepartment(createdByUserId, "SALES"))) {
        assigneeId = createdByUserId;
    }
    const salesAssignee = assigneeId;

    return prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({ data });
        // changedByUserId attributes the "enquiry received" event to the creator when
        // there is one; programmatic sources (no createdByUserId) record a null actor.
        await createSalesAssignment(tx, lead.id, salesAssignee, createdByUserId || null);
        return lead;
    });
}

/**
 * Get leads with pagination, filtering, searching, and sorting
 */
const getLeads = async ({
    userId,
    role,
    page = 1,
    limit = 20,
    filters = {},
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc"
}) => {
    // 1. Build Where Clause
    // Merged leads (absorbed into another lead) are excluded from all normal views.
    const where = { mergedIntoId: null };

    // Role-based visibility — multi-department model.
    // A lead is visible when the actor is assigned to, or manages, one of its
    // department services (LeadDepartment). Expressed as a single `leadDepartments.some`
    // relation filter (`visScope`) so it composes with the filters below.
    //   EMPLOYEE (Consultant)  — leads where they are the assigned consultant on some service
    //   TEAM_LEADER            — leads with a service in a department they belong to,
    //                            plus anything assigned directly to them
    //   ADMIN (Manager)        — leads with a service in a department they belong to,
    //                            plus anything assigned directly to them
    //   SUPER_ADMIN (Director) — everything
    const visScope = {};
    const managed = (role === "ADMIN" || role === "TEAM_LEADER") ? await getUserDepartments(userId) : [];
    const managedSet = new Set(managed);

    if (filters.mine) {
        visScope.assignedEmployeeId = userId;
    } else if (role === "EMPLOYEE") {
        // Consultants see their own assignments PLUS claimable services: unassigned
        // leads still at a department's initial (enquiry) stage in a department they
        // belong to — so they can pick them up directly from the Leads page.
        const myDepts = await getUserDepartments(userId);
        const claimable = myDepts
            .map((d) => ({ department: d, stage: getInitialStage(d) }))
            .filter((b) => b.stage) // skip departments with no configured workflow
            .map((b) => ({ department: b.department, assignedEmployeeId: null, stage: b.stage }));
        visScope.OR = [{ assignedEmployeeId: userId }, ...claimable];
    } else if (role === "ADMIN" || role === "TEAM_LEADER") {
        if (filters.assignedTo) {
            // Manager/Team Leader filtering to a single consultant — constrained to the departments
            // they manage so it can't be used to read another department's leads.
            visScope.department = { in: managed };
            visScope.assignedEmployeeId = filters.assignedTo;
        } else if (managed.length) {
            visScope.OR = [
                { department: { in: managed } },
                { assignedEmployeeId: userId },
            ];
        } else {
            // Manager/Team Leader with no department membership: only their own assignments.
            visScope.assignedEmployeeId = userId;
        }
    } else if (filters.assignedTo) {
        // Director (or other) filtering to a specific consultant.
        visScope.assignedEmployeeId = filters.assignedTo;
    }

    // Narrow to a department / stage — must refine the SAME service row, and may
    // only narrow visibility, never widen it.
    if (filters.department) {
        if (role === "SUPER_ADMIN" || role === "EMPLOYEE" || filters.mine) {
            visScope.department = filters.department;
        } else if ((role === "ADMIN" || role === "TEAM_LEADER") && managedSet.has(filters.department)) {
            // A managed department is a subset of the visible scope — safe to pin.
            visScope.department = filters.department;
        }
        // ADMIN/TEAM_LEADER filtering by an unmanaged department: ignored (would widen/leak).
    }
    if (filters.stage) {
        visScope.stage = filters.stage;
    }

    if (Object.keys(visScope).length > 0) {
        where.leadDepartments = { some: visScope };
    }

    if (filters.isSearchLead !== undefined) {
        where.isSearchLead = filters.isSearchLead;
    }

    if (filters.score_min !== undefined || filters.score_max !== undefined) {
        where.score = {};
        if (filters.score_min !== undefined) where.score.gte = filters.score_min;
        if (filters.score_max !== undefined) where.score.lte = filters.score_max;
    }

    if (filters.source)      where.source      = filters.source;
    if (filters.category)    where.category    = filters.category;
    if (filters.enquiryType) where.enquiryType = filters.enquiryType;

    // SLA filter: leads with no activity beyond N days. "Active" now means the lead
    // still has at least one department service (terminal handling is per-stage).
    if (filters.sla) {
        const cutoffMs = filters.sla === "breach" ? 7 * 86_400_000 : 3 * 86_400_000;
        const cutoff   = new Date(Date.now() - cutoffMs);
        const slaOr = [
            { lastActivityAt: { lt: cutoff } },
            { AND: [{ lastActivityAt: null }, { updatedAt: { lt: cutoff } }] },
        ];
        // Merge with any existing OR scope (e.g. manager team filter)
        if (where.OR) {
            where.AND = [...(where.AND || []), { OR: where.OR }, { OR: slaOr }];
            delete where.OR;
        } else {
            where.OR = slaOr;
        }
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
            where.createdAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            // If the time is exactly midnight UTC, assume it's a date-only input and set to end of day
            if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
                end.setUTCHours(23, 59, 59, 999);
            }
            where.createdAt.lte = end;
        }
    }

    // Search filter (Case-insensitive)
    // Use AND to preserve any existing where.OR scope (e.g. manager team filter)
    if (search) {
        const searchOr = [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
        ];
        if (where.OR) {
            where.AND = [{ OR: where.OR }, { OR: searchOr }];
            delete where.OR;
        } else {
            where.OR = searchOr;
        }
    }

    // 2. Build Order By
    const validSortFields = ["createdAt", "updatedAt", "score", "name"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderDirection = sortOrder === "asc" ? "asc" : "desc";
    const orderBy = { [orderByField]: orderDirection };

    // 3. Pagination limits
    const skip = (page - 1) * limit;

    // 4. Execute Queries (Transaction to prevent race conditions on count vs fetch)
    const [total, leads] = await prisma.$transaction([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            // Optimization: Only fetch required nested relations to reduce payload
            include: {
                // Department services drive stage/consultant display in the list.
                leadDepartments: {
                    select: {
                        id: true, department: true, stage: true, assignedEmployeeId: true,
                        assignedEmployee: { select: { id: true, name: true, email: true, profilePhoto: true } },
                    },
                },
                // Avoid N+1 and bloated responses: only fetch latest 1 call log
                callLogs: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { id: true, duration: true, createdAt: true, recordingUrl: true }
                }
            }
        })
    ]);

    // Recordings are in a gated dir; sign the URL so the list's quick-play <audio> works.
    for (const lead of leads) {
        if (lead.callLogs) {
            lead.callLogs = lead.callLogs.map(c =>
                c.recordingUrl ? { ...c, recordingUrl: signUploadUrl(c.recordingUrl) } : c
            );
        }
    }

    return paginate(leads, total, page, limit);
};

module.exports = {
    getLeads,
    createLead
};
