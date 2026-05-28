const prisma                = require("../../utils/prisma");
const { getLeads }          = require("../../services/leadService");
const { getTeamMemberIds }  = require("../../services/organizationService");

const LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"];

const search_leads = {
    name:        "search_leads",
    description: "Search leads the current user can see (RBAC-scoped). Match by name, email, or phone. Optionally filter by status. Returns most recent matches first.",
    parameters: {
        type: "object",
        properties: {
            query:  { type: "string",  description: "Text to match against name, email, or phone." },
            status: { type: "string",  description: "Filter to a single status.", enum: LEAD_STATUSES },
            limit:  { type: "integer", description: "Max leads to return (1-20).", minimum: 1, maximum: 20 },
        },
        required: [],
    },
    execute: async (args, { userId, role }) => {
        const limit   = Math.min(Math.max(parseInt(args.limit, 10) || 10, 1), 20);
        const filters = args.status ? { status: args.status } : {};
        const result  = await getLeads({
            userId, role,
            page: 1, limit,
            filters,
            search:    args.query || "",
            sortBy:    "createdAt",
            sortOrder: "desc",
        });
        const leads = result.data.map(l => ({
            id:         l.id,
            name:       l.name,
            email:      l.email,
            phone:      l.phone,
            company:    l.company,
            status:     l.status,
            score:      l.score,
            assignedTo: l.assignedTo?.name ?? null,
            createdAt:  l.createdAt,
        }));
        return { count: leads.length, total: result.pagination?.total ?? leads.length, leads };
    },
};

const count_leads_by_status = {
    name:        "count_leads_by_status",
    description: "Count leads the current user can see, grouped by status (NEW, CONTACTED, FOLLOW_UP, CONVERTED, LOST). Useful for pipeline snapshots.",
    parameters:  { type: "object", properties: {}, required: [] },
    execute: async (_args, { userId, role }) => {
        const where = { status: { not: "MERGED" } };
        if (role === "EMPLOYEE") {
            where.assignedToId = userId;
        } else if (role === "MANAGER") {
            const teamIds = await getTeamMemberIds(userId);
            if (teamIds.length > 0) {
                where.OR = [{ assignedToId: { in: teamIds } }, { assignedToId: null }];
            }
        }
        const rows = await prisma.lead.groupBy({
            by: ["status"],
            where,
            _count: { _all: true },
        });
        const byStatus = Object.fromEntries(LEAD_STATUSES.map(s => [s, 0]));
        for (const r of rows) if (byStatus[r.status] !== undefined) byStatus[r.status] = r._count._all;
        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
        return { total, byStatus };
    },
};

module.exports = { search_leads, count_leads_by_status };
