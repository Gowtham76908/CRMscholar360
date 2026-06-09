const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("./organizationService");
const paginate = require("../utils/paginate");
const { signUploadUrl } = require("../utils/signedUpload");

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
    // MERGED leads are terminal (absorbed into another lead) — exclude from all normal views
    const where = { status: { not: "MERGED" } };

    // Role-based visibility:
    // EMPLOYEE    — own leads only
    // MANAGER     — team leads (employees where managerId = userId); falls back to all if no team
    // SUPER_ADMIN — everything
    if (role === "EMPLOYEE" || filters.mine) {
        where.assignedToId = userId;
    } else if (role === "MANAGER") {
        const teamIds = await getTeamMemberIds(userId);
        if (teamIds.length > 0) {
            if (filters.assignedTo) {
                // A manager may filter to a single member, but ONLY within their own
                // team — never another team's. An out-of-team id is clamped back to
                // the team scope so it can't be used to read foreign leads.
                where.OR = teamIds.includes(filters.assignedTo)
                    ? [{ assignedToId: filters.assignedTo }]
                    : [{ assignedToId: { in: teamIds } }, { assignedToId: null }];
            } else {
                // Show team leads plus unassigned leads the manager can claim
                where.OR = [
                    { assignedToId: { in: teamIds } },
                    { assignedToId: null },
                ];
            }
        } else if (filters.assignedTo) {
            // Unseeded manager (no team rows): honour the explicit filter. This is a
            // misconfiguration anyway; the IDOR fix above covers all seeded managers.
            where.assignedToId = filters.assignedTo;
        }
        // If no team yet and no filter, sees all (backward compat for unseeded managers)
    } else if (filters.assignedTo) {
        where.assignedToId = filters.assignedTo;
    }

    // Exact match filters — support comma-separated multi-value (e.g. "FOLLOW_UP,CONTACTED")
    if (filters.status) {
        const statuses = filters.status.split(",").map(s => s.trim()).filter(Boolean);
        where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
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

    // SLA filter: leads with no activity beyond N days (only active statuses qualify)
    if (filters.sla) {
        const cutoffMs = filters.sla === "breach" ? 7 * 86_400_000 : 3 * 86_400_000;
        const cutoff   = new Date(Date.now() - cutoffMs);
        where.status   = { in: ["NEW", "CONTACTED", "FOLLOW_UP"] };
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
    const validSortFields = ["createdAt", "updatedAt", "score", "name", "status"];
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
                assignedTo: { 
                    select: { id: true, name: true, email: true } 
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
    getLeads
};
