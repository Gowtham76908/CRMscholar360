const prisma = require("../utils/prisma");
const { wonStageFilter } = require("../config/departmentWorkflows");

// "Converted" is now a per-department outcome: a lead counts as converted if any
// of its department services has reached a won stage. There is no global status.
const WON_OR = wonStageFilter();

const getDateFilter = (from, to) => {
    if (!from && !to) return {};
    const f = {};
    if (from) f.gte = new Date(from);
    if (to)   f.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    return { createdAt: f };
};

const getLeadsBySource = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const [totals, convertedLeads] = await Promise.all([
            prisma.lead.groupBy({ by: ["source"], where: dateFilter, _count: { id: true } }),
            // Leads with at least one won service — counted once per lead, per source.
            prisma.lead.findMany({
                where: { ...dateFilter, leadDepartments: { some: { OR: WON_OR } } },
                select: { source: true },
            }),
        ]);

        const convBySource = {};
        for (const l of convertedLeads) convBySource[l.source] = (convBySource[l.source] || 0) + 1;

        const result = totals.map(r => {
            const total = r._count.id;
            const converted = convBySource[r.source] || 0;
            return {
                source: r.source,
                total,
                converted,
                conversionRate: total > 0 ? +((converted / total) * 100).toFixed(1) : 0,
            };
        }).sort((a, b) => b.total - a.total);

        res.json(result);
    } catch (error) { return next(error); }
};

const getMonthlyGrowth = async (req, res, next) => {
    try {
        const now = new Date();
        const ranges = Array.from({ length: 6 }, (_, i) => {
            const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const end   = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
            return { start, end, label: start.toLocaleString("default", { month: "short", year: "numeric" }) };
        });
        const [counts, converted] = await Promise.all([
            Promise.all(ranges.map(r => prisma.lead.count({ where: { createdAt: { gte: r.start, lt: r.end } } }))),
            // Won services reached in the month (by service updatedAt).
            Promise.all(ranges.map(r => prisma.leadDepartment.count({
                where: { updatedAt: { gte: r.start, lt: r.end }, OR: WON_OR },
            }))),
        ]);
        res.json(ranges.map((r, i) => ({ month: r.label, leads: counts[i], converted: converted[i] })));
    } catch (error) { return next(error); }
};

module.exports = { getLeadsBySource, getMonthlyGrowth };
