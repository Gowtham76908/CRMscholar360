const prisma = require("../utils/prisma");

// Team Performance Metrics
const getTeamPerformance = async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: "EMPLOYEE" },
            include: {
                leads: { select: { status: true, firstResponseAt: true, createdAt: true } },
                tasks: { select: { status: true, dueDate: true } }
            }
        });

        const performance = users.map(user => {
            const totalLeads = user.leads.length;
            const convertedLeads = user.leads.filter(l => l.status === "CONVERTED").length;
            const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

            const pendingTasks = user.tasks.filter(t => t.status === "PENDING").length;
            const overdueTasks = user.tasks.filter(t => t.status === "PENDING" && new Date(t.dueDate) < new Date()).length;

            // Avg Response Time (in hours)
            // Simplified: average of (firstResponseAt - createdAt)
            let totalResponseTimeMs = 0;
            let responseCount = 0;
            user.leads.forEach(l => {
                if (l.firstResponseAt) {
                    totalResponseTimeMs += (new Date(l.firstResponseAt) - new Date(l.createdAt));
                    responseCount++;
                }
            });
            const avgResponseTimeHours = responseCount > 0 ? (totalResponseTimeMs / (1000 * 60 * 60) / responseCount).toFixed(1) : 0;

            return {
                userId: user.id,
                name: user.name,
                totalLeads,
                convertedLeads,
                conversionRate: `${conversionRate}%`,
                pendingTasks,
                overdueTasks,
                avgResponseTimeHours
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
