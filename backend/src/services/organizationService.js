const prisma = require("../utils/prisma");
const { terminalStageFilter } = require("../config/departmentWorkflows");

const TERMINAL_OR = terminalStageFilter();

/**
 * Returns all employee IDs directly managed by managerId.
 */
async function getTeamMemberIds(managerId) {
    const employees = await prisma.user.findMany({
        where: { managerId, isActive: true },
        select: { id: true },
    });
    return employees.map((e) => e.id);
}

/**
 * Returns full employee records for a manager's team, enriched with
 * assigned lead count, task count, and call count.
 */
async function getTeamWithStats(managerId) {
    const employees = await prisma.user.findMany({
        where: { managerId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            department: true,
            jobTitle: true,
            onlineStatus: true,
            createdAt: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
            _count: {
                select: {
                    tasks: true,
                },
            },
        },
        orderBy: { name: "asc" },
    });
    return employees;
}

/**
 * Returns the full org tree for SUPER_ADMIN: all users with manager info and stats.
 */
async function getFullOrgWithStats() {
    return prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            department: true,
            jobTitle: true,
            onlineStatus: true,
            createdAt: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
            _count: {
                select: {
                    tasks: true,
                },
            },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
    });
}

/**
 * Validates a proposed managerId assignment:
 * - Cannot assign self as manager
 * - Cannot create circular hierarchy (employee becoming manager of their own manager)
 * - Manager must exist and be ADMIN or SUPER_ADMIN
 */
async function validateManagerAssignment(userId, managerId) {
    if (userId === managerId) {
        return { ok: false, message: "A user cannot be their own manager" };
    }

    const manager = await prisma.user.findUnique({ where: { id: managerId } });
    if (!manager) {
        return { ok: false, message: "Manager not found" };
    }
    if (!["SUPER_ADMIN", "ADMIN"].includes(manager.role)) {
        return { ok: false, message: "Manager must have ADMIN or SUPER_ADMIN role" };
    }

    // Detect circular hierarchy: walk up from managerId — if we hit userId, it's circular
    let current = manager;
    while (current.managerId) {
        if (current.managerId === userId) {
            return { ok: false, message: "Circular hierarchy detected" };
        }
        current = await prisma.user.findUnique({ where: { id: current.managerId } });
        if (!current) break;
    }

    return { ok: true };
}

/**
 * Org stats for the management dashboard cards.
 * SUPER_ADMIN gets global stats; ADMIN gets team-scoped stats.
 */
async function getOrgStats(userId, role) {
    if (role === "SUPER_ADMIN") {
        const [totalEmployees, activeEmployees, assignedLeads, pendingLeads] =
            await prisma.$transaction([
                prisma.user.count({ where: { role: "EMPLOYEE" } }),
                prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
                prisma.leadDepartment.count({ where: { assignedEmployeeId: { not: null } } }),
                prisma.leadDepartment.count({ where: { NOT: { OR: TERMINAL_OR } } }),
            ]);
        return { totalEmployees, activeEmployees, assignedLeads, pendingLeads };
    }

    // ADMIN: scoped to their team
    const teamIds = await getTeamMemberIds(userId);
    const [totalEmployees, activeEmployees, assignedLeads, pendingLeads] =
        await prisma.$transaction([
            prisma.user.count({ where: { managerId: userId } }),
            prisma.user.count({ where: { managerId: userId, isActive: true } }),
            prisma.leadDepartment.count({ where: { assignedEmployeeId: { in: teamIds } } }),
            prisma.leadDepartment.count({
                where: { assignedEmployeeId: { in: teamIds }, NOT: { OR: TERMINAL_OR } },
            }),
        ]);
    return { totalEmployees, activeEmployees, assignedLeads, pendingLeads };
}

module.exports = {
    getTeamMemberIds,
    getTeamWithStats,
    getFullOrgWithStats,
    validateManagerAssignment,
    getOrgStats,
};
