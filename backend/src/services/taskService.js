const prisma = require("../utils/prisma");

const taskInclude = {
    lead: { select: { id: true, name: true, phone: true, email: true } },
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
        : ["EMPLOYEE", "AGENT"].includes(role)
            ? { assignedToId: userId }
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

    return {
        data: tasks,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            stats: {
                pending: pendingCount,
                completed: completedCount,
                overdue: overdueCount,
            }
        }
    };
};

module.exports = { getTasks };
