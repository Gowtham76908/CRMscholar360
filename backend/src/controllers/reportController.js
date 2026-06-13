const prisma = require("../utils/prisma");

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
        const rows = await prisma.lead.groupBy({
            by: ["source", "status"],
            where: dateFilter,
            _count: { id: true },
        });
        const map = {};
        rows.forEach(r => {
            if (!map[r.source]) map[r.source] = { source: r.source, total: 0, converted: 0 };
            map[r.source].total += r._count.id;
            if (r.status === "CONVERTED") map[r.source].converted += r._count.id;
        });
        const result = Object.values(map).map(s => ({
            ...s,
            conversionRate: s.total > 0 ? +((s.converted / s.total) * 100).toFixed(1) : 0,
        })).sort((a, b) => b.total - a.total);
        res.json(result);
    } catch (error) { return next(error); }
};

const getLeadsByEmployee = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);
        const rows = await prisma.lead.groupBy({
            by: ["assignedToId", "status"],
            where: { assignedToId: { not: null }, ...dateFilter },
            _count: { id: true },
        });
        const userIds = [...new Set(rows.map(r => r.assignedToId))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
        });
        const nameMap = Object.fromEntries(users.map(u => [u.id, u.name]));
        const map = {};
        rows.forEach(r => {
            const key = r.assignedToId;
            if (!map[key]) map[key] = { name: nameMap[key] || "Unknown", total: 0, converted: 0, lost: 0, active: 0 };
            map[key].total += r._count.id;
            if (r.status === "CONVERTED")      map[key].converted += r._count.id;
            else if (r.status === "LOST")      map[key].lost      += r._count.id;
            else                               map[key].active    += r._count.id;
        });
        const result = Object.values(map).map(e => ({
            ...e,
            conversionRate: e.total > 0 ? +((e.converted / e.total) * 100).toFixed(1) : 0,
        })).sort((a, b) => b.total - a.total);
        res.json(result);
    } catch (error) { return next(error); }
};

const getConversionRate = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);
        const [totalLeads, convertedLeads, lostLeads] = await Promise.all([
            prisma.lead.count({ where: dateFilter }),
            prisma.lead.count({ where: { ...dateFilter, status: "CONVERTED" } }),
            prisma.lead.count({ where: { ...dateFilter, status: "LOST" } }),
        ]);
        const rate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;
        res.json({ totalLeads, convertedLeads, lostLeads, conversionRate: `${rate}%` });
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
            Promise.all(ranges.map(r => prisma.lead.count({ where: { createdAt: { gte: r.start, lt: r.end }, status: "CONVERTED" } }))),
        ]);
        res.json(ranges.map((r, i) => ({ month: r.label, leads: counts[i], converted: converted[i] })));
    } catch (error) { return next(error); }
};

const getLeadsByStatus = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);
        const rows = await prisma.lead.groupBy({
            by: ["status"],
            where: dateFilter,
            _count: { id: true },
        });
        res.json(rows);
    } catch (error) { return next(error); }
};

module.exports = { getLeadsBySource, getLeadsByEmployee, getConversionRate, getMonthlyGrowth, getLeadsByStatus };
