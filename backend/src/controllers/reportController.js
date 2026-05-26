const prisma = require("../utils/prisma");

const getDateFilter = (from, to) => {
    if (!from || !to) return {};
    return {
        createdAt: {
            gte: new Date(from),
            lte: new Date(to) // Should ideally be end of day
        }
    };
};

const getLeadsBySource = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const groupBySource = await prisma.lead.groupBy({
            by: ["source"],
            where: { ...dateFilter },
            _count: {
                id: true
            }
        });

        res.json(groupBySource);
    } catch (error) {
        return next(error);
    }
};

const getLeadsByEmployee = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const leads = await prisma.lead.findMany({
            where: { ...dateFilter },
            select: { assignedToId: true }
        });

        // Manual aggregation since Prisma groupBy doesn't easily join user names
        const counts = {};
        leads.forEach(l => {
            const id = l.assignedToId || "Unassigned";
            counts[id] = (counts[id] || 0) + 1;
        });

        // Enrich with User Names
        const result = [];
        for (const [id, count] of Object.entries(counts)) {
            let name = "Unassigned";
            if (id !== "Unassigned") {
                const user = await prisma.user.findUnique({ where: { id } });
                if (user) name = user.name;
            }
            result.push({ name, count });
        }

        res.json(result);
    } catch (error) {
        return next(error);
    }
};

const getConversionRate = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const totalLeads = await prisma.lead.count({ where: { ...dateFilter } });
        const convertedLeads = await prisma.lead.count({
            where: { ...dateFilter, status: "CONVERTED" }
        });

        const rate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0;

        res.json({ totalLeads, convertedLeads, conversionRate: `${rate}%` });
    } catch (error) {
        return next(error);
    }
};

const getMonthlyGrowth = async (req, res, next) => {
    try {
        // Last 6 months growth
        const now = new Date();
        const result = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            const count = await prisma.lead.count({
                where: {
                    createdAt: {
                        gte: date,
                        lt: nextMonth
                    }
                }
            });

            result.push({
                month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
                leads: count
            });
        }

        res.json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getLeadsBySource,
    getLeadsByEmployee,
    getConversionRate,
    getMonthlyGrowth
};
