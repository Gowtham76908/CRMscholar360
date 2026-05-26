const prisma = require("../utils/prisma");
const {
    getTeamWithStats,
    getFullOrgWithStats,
    validateManagerAssignment,
    getOrgStats,
} = require("../services/organizationService");

/**
 * GET /organization/team
 * SUPER_ADMIN: entire org
 * ADMIN: own employees
 */
const getOrgTeam = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const members =
            role === "SUPER_ADMIN"
                ? await getFullOrgWithStats()
                : await getTeamWithStats(userId); // MANAGER sees own team
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * GET /organization/team/:id
 * Returns one employee's profile with their lead/task/call stats.
 * Access is guarded by requireHierarchyAccess middleware on the route.
 */
const getEmployeeProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                department: true,
                jobTitle: true,
                onlineStatus: true,
                createdAt: true,
                managerId: true,
                manager: { select: { id: true, name: true, email: true } },
                employees: {
                    select: { id: true, name: true, role: true, isActive: true },
                },
                _count: {
                    select: { leads: true, tasks: true },
                },
            },
        });

        if (!employee) return res.status(404).json({ message: "Employee not found" });

        const [assignedLeads, pendingLeads, callCount] = await prisma.$transaction([
            prisma.lead.count({ where: { assignedToId: id } }),
            prisma.lead.count({
                where: { assignedToId: id, status: { in: ["NEW", "FOLLOW_UP"] } },
            }),
            prisma.callLog.count({ where: { userId: id } }),
        ]);

        res.json({ ...employee, assignedLeads, pendingLeads, callCount });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * GET /organization/stats
 * Returns dashboard card stats scoped by role.
 */
const getStats = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const stats = await getOrgStats(userId, role);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * PATCH /organization/team/:id/manager
 * Assign or change an employee's manager.
 * Body: { managerId: string | null }
 */
const setManager = async (req, res) => {
    try {
        const { id } = req.params;
        const { managerId } = req.body;
        const { role: requesterRole } = req.user;

        if (requesterRole !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only SUPER_ADMIN can reassign managers" });
        }

        if (managerId) {
            const validation = await validateManagerAssignment(id, managerId);
            if (!validation.ok) return res.status(400).json({ message: validation.message });
        }

        const updated = await prisma.user.update({
            where: { id },
            data: { managerId: managerId || null },
            select: { id: true, name: true, managerId: true, manager: { select: { id: true, name: true } } },
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * GET /organization/managers
 * Returns all users eligible to be managers (ADMIN + SUPER_ADMIN).
 */
const getManagers = async (req, res) => {
    try {
        const managers = await prisma.user.findMany({
            where: { role: { in: ["SUPER_ADMIN", "MANAGER"] }, isActive: true },
            select: { id: true, name: true, email: true, role: true, department: true },
            orderBy: { name: "asc" },
        });
        res.json(managers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getOrgTeam, getEmployeeProfile, getStats, setManager, getManagers };
