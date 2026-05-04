const prisma = require("../utils/prisma");

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
    const where = {};

    // Role-based access control
    if (role === "EMPLOYEE") {
        where.assignedToId = userId;
    } else if (filters.assignedTo) {
        where.assignedToId = filters.assignedTo;
    }

    // Exact match filters
    if (filters.status) {
        where.status = filters.status; // assuming status is string or enum
    }

    if (filters.isSearchLead !== undefined) {
        where.isSearchLead = filters.isSearchLead;
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
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
        ];
    }

    // 2. Build Order By
    const validSortFields = ["createdAt", "updatedAt"];
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
