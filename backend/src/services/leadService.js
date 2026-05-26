const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("./organizationService");

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
    } else if (role === "MANAGER" && !filters.assignedTo) {
        const teamIds = await getTeamMemberIds(userId);
        if (teamIds.length > 0) {
            // Show team leads plus unassigned leads the admin can claim
            where.OR = [
                { assignedToId: { in: teamIds } },
                { assignedToId: null },
            ];
        }
        // If no team yet, admin sees all (backward compat for unseeded managers)
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

    if (filters.score_min !== undefined) {
        where.score = { gte: filters.score_min };
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

    return {
        data: leads,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

module.exports = {
    getLeads
};
