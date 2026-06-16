const prisma = require("../utils/prisma");
const { isWonStage } = require("../config/departmentWorkflows");

// Team Performance Metrics — a user's "leads" are their department services now.
const getTeamPerformance = async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: { in: ["EMPLOYEE", "ADMIN"] } },
            include: {
                tasks: { select: { status: true, dueDate: true } },
            },
        });

        // Department services assigned to these users, with the lead's response timing.
        const services = await prisma.leadDepartment.findMany({
            where: { assignedEmployeeId: { in: users.map(u => u.id) } },
            select: {
                assignedEmployeeId: true, department: true, stage: true,
                lead: { select: { firstResponseAt: true, createdAt: true } },
            },
        });

        const byUser = new Map();
        for (const s of services) {
            const u = byUser.get(s.assignedEmployeeId) || { total: 0, won: 0, respMs: 0, respCount: 0 };
            u.total += 1;
            if (isWonStage(s.department, s.stage)) u.won += 1;
            if (s.lead?.firstResponseAt) {
                u.respMs += new Date(s.lead.firstResponseAt) - new Date(s.lead.createdAt);
                u.respCount += 1;
            }
            byUser.set(s.assignedEmployeeId, u);
        }

        const performance = users.map(user => {
            const u = byUser.get(user.id) || { total: 0, won: 0, respMs: 0, respCount: 0 };
            const conversionRate = u.total > 0 ? ((u.won / u.total) * 100).toFixed(1) : 0;
            const pendingTasks = user.tasks.filter(t => t.status === "PENDING").length;
            const overdueTasks = user.tasks.filter(t => t.status === "PENDING" && new Date(t.dueDate) < new Date()).length;
            const avgResponseTimeHours = u.respCount > 0 ? (u.respMs / (1000 * 60 * 60) / u.respCount).toFixed(1) : 0;

            return {
                userId: user.id,
                name: user.name,
                totalLeads: u.total,
                convertedLeads: u.won,
                conversionRate: `${conversionRate}%`,
                pendingTasks,
                overdueTasks,
                avgResponseTimeHours,
            };
        });

        res.json(performance);
    } catch (error) {
        return next(error);
    }
};

// Response Time Analytics
const getResponseTimeAnalytics = async (req, res, next) => {
    try {
        // Aggregate average response time
        const leadsWithResponse = await prisma.lead.findMany({
            where: { firstResponseAt: { not: null } },
            select: { createdAt: true, firstResponseAt: true }
        });

        if (leadsWithResponse.length === 0) return res.json({ avgResponseTime: 0 });

        const totalMs = leadsWithResponse.reduce((acc, lead) => {
            return acc + (new Date(lead.firstResponseAt) - new Date(lead.createdAt));
        }, 0);

        const avgHours = (totalMs / (1000 * 60 * 60) / leadsWithResponse.length).toFixed(2);

        res.json({ avgResponseTimeHours: avgHours, baseSize: leadsWithResponse.length });
    } catch (error) {
        return next(error);
    }
};

module.exports = { getTeamPerformance, getResponseTimeAnalytics };
