const prisma = require("../utils/prisma");
const paginate = require("../utils/paginate");

const taskInclude = {
    lead: {
        select: {
            id: true, name: true, phone: true, email: true,
            leadDepartments: {
                select: {
                    id: true, department: true, stage: true,
                    assignedEmployee: { select: { id: true, name: true } },
                },
            },
        },
    },
    assignedTo: { select: { id: true, name: true, email: true } },
    sprint: { select: { id: true, name: true, status: true } },
    files: true,
    comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" }
    }
};

const getTasks = async ({ userId, role, page, limit, filter, leadId }) => {
    // leadId scope: caller's lead access was already verified in the controller
    const rbacWhere = leadId
        ? { leadId }
        : role === "EMPLOYEE"
            ? { assignedToId: userId }
            : role === "ADMIN"
                ? { assignedTo: { managerId: userId } }
                : {};

    // Filter on top of RBAC
    const filterWhere = { ...rbacWhere };
    if (filter === "PENDING") {
        filterWhere.status = "PENDING";
    } else if (filter === "COMPLETED") {
        filterWhere.status = "COMPLETED";
    } else if (filter === "OVERDUE") {
        filterWhere.status = "PENDING";
        filterWhere.dueDate = { lt: new Date() };
    }

    const skip = (page - 1) * limit;

    // All five queries in one atomic transaction
    const [total, tasks, pendingCount, completedCount, overdueCount] =
        await prisma.$transaction([
            prisma.task.count({ where: filterWhere }),
            prisma.task.findMany({
                where: filterWhere,
                skip,
                take: limit,
                include: taskInclude,
                orderBy: [{ dueDate: "asc" }]
            }),
            // Stats always reflect the full RBAC scope, not the current filter
            prisma.task.count({ where: { ...rbacWhere, status: "PENDING" } }),
            prisma.task.count({ where: { ...rbacWhere, status: "COMPLETED" } }),
            prisma.task.count({ where: { ...rbacWhere, status: "PENDING", dueDate: { lt: new Date() } } }),
        ]);

    return paginate(tasks, total, page, limit, {
        stats: { pending: pendingCount, completed: completedCount, overdue: overdueCount },
    });
};

// Lightweight payload for the calendar grid — chips only need title/status/dates,
// not comments or files. No pagination: a month of tasks is small and the grid
// needs every task in the range at once.
const calendarInclude = {
    lead: { select: { id: true, name: true } },
    assignedTo: { select: { id: true, name: true } },
};

const getTasksForCalendar = async ({ userId, role, from, to }) => {
    const rbacWhere = role === "EMPLOYEE"
        ? { assignedToId: userId }
        : role === "ADMIN"
            ? { assignedTo: { managerId: userId } }
            : {};

    const tasks = await prisma.task.findMany({
        where: { ...rbacWhere, dueDate: { gte: from, lte: to } },
        include: calendarInclude,
        orderBy: [{ dueDate: "asc" }],
    });
    return tasks;
};

module.exports = { getTasks, getTasksForCalendar };
