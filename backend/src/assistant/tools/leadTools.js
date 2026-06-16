const prisma                = require("../../utils/prisma");
const { getLeads }          = require("../../services/leadService");
const { getUserDepartments } = require("../../services/leadDepartmentService");
const { DEPARTMENTS, isWonStage, isLostStage } = require("../../config/departmentWorkflows");

const summariseDepartments = (leadDepartments = []) =>
    leadDepartments.map(d => ({
        department: d.department,
        stage: d.stage,
        assignedTo: d.assignedEmployee?.name ?? null,
    }));

const search_leads = {
    name:        "search_leads",
    description: "Search leads the current user can see (RBAC-scoped). Match by name, email, or phone. Optionally filter by department and/or stage. Returns most recent matches first, including each lead's department services.",
    parameters: {
        type: "object",
        properties: {
            query:      { type: "string",  description: "Text to match against name, email, or phone." },
            department: { type: "string",  description: "Filter to a single department.", enum: DEPARTMENTS },
            stage:      { type: "string",  description: "Filter to a single workflow stage (e.g. PROSPECT, APPROVED)." },
            limit:      { type: "integer", description: "Max leads to return (1-20).", minimum: 1, maximum: 20 },
        },
        required: [],
    },
    execute: async (args, { userId, role }) => {
        const limit   = Math.min(Math.max(parseInt(args.limit, 10) || 10, 1), 20);
        const filters = {};
        if (args.department) filters.department = args.department;
        if (args.stage)      filters.stage = args.stage;
        const result  = await getLeads({
            userId, role,
            page: 1, limit,
            filters,
            search:    args.query || "",
            sortBy:    "createdAt",
            sortOrder: "desc",
        });
        const leads = result.data.map(l => ({
            id:          l.id,
            name:        l.name,
            email:       l.email,
            phone:       l.phone,
            company:     l.company,
            score:       l.score,
            departments: summariseDepartments(l.leadDepartments),
            createdAt:   l.createdAt,
        }));
        return { count: leads.length, total: result.pagination?.total ?? leads.length, leads };
    },
};

const count_leads_by_department = {
    name:        "count_leads_by_department",
    description: "Count the department services the current user can see, grouped by department with active/won/lost breakdown. Useful for per-department pipeline snapshots (there is no single global lead funnel).",
    parameters:  { type: "object", properties: {}, required: [] },
    execute: async (_args, { userId, role }) => {
        const where = {};
        if (role === "EMPLOYEE") {
            where.assignedEmployeeId = userId;
        } else if (role === "ADMIN") {
            const managed = await getUserDepartments(userId);
            where.OR = [
                ...(managed.length ? [{ department: { in: managed } }] : []),
                { assignedEmployeeId: userId },
            ];
        }
        const rows = await prisma.leadDepartment.findMany({
            where,
            select: { department: true, stage: true },
        });
        const byDepartment = {};
        for (const r of rows) {
            const d = byDepartment[r.department] || (byDepartment[r.department] = { total: 0, active: 0, won: 0, lost: 0 });
            d.total += 1;
            if (isWonStage(r.department, r.stage)) d.won += 1;
            else if (isLostStage(r.department, r.stage)) d.lost += 1;
            else d.active += 1;
        }
        const total = rows.length;
        return { total, byDepartment };
    },
};

module.exports = { search_leads, count_leads_by_department };
