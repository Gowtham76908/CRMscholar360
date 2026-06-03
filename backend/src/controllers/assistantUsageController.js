const prisma = require("../utils/prisma");
const { getAssistantSettings } = require("../assistant/settingsCache");

const DAY_MS = 86_400_000;

// Parses ?from / ?to. Defaults to last 30 full days ending today (inclusive).
const _parseRange = (q) => {
    const now = new Date();
    const to  = q.to ? new Date(q.to)   : now;
    const from = q.from ? new Date(q.from) : new Date(now.getTime() - 30 * DAY_MS);
    // Push `to` to end-of-day so the user's selected end date is fully included
    to.setHours(23, 59, 59, 999);
    return { from, to };
};

const getUsage = async (req, res, next) => {
    try {
        const { from, to } = _parseRange(req.query);

        const whereWindow = { createdAt: { gte: from, lte: to } };

        const [
            totalRequests,
            tokenSum,
            successCount,
            distinctUsersRows,
            perDayRaw,
            topUsersRaw,
            topToolsRaw,
            settings,
        ] = await Promise.all([
            prisma.assistantRequestLog.count({ where: whereWindow }),
            prisma.assistantRequestLog.aggregate({
                where: whereWindow,
                _sum:  { totalTokens: true },
            }),
            prisma.assistantRequestLog.count({ where: { ...whereWindow, status: "SUCCESS" } }),
            prisma.assistantRequestLog.findMany({
                where:    whereWindow,
                select:   { userId: true },
                distinct: ["userId"],
            }),
            prisma.$queryRaw`
                SELECT
                    to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date,
                    count(*)::int AS requests,
                    COALESCE(sum("totalTokens"), 0)::int AS tokens
                FROM "AssistantRequestLog"
                WHERE "createdAt" BETWEEN ${from} AND ${to}
                GROUP BY 1
                ORDER BY 1 ASC
            `,
            prisma.assistantRequestLog.groupBy({
                by:       ["userId"],
                where:    whereWindow,
                _count:   { _all: true },
                _sum:     { totalTokens: true },
                orderBy:  { _count: { userId: "desc" } },
                take:     10,
            }),
            prisma.assistantRequestLog.groupBy({
                by:       ["primaryTool"],
                where:    { ...whereWindow, primaryTool: { not: null } },
                _count:   { _all: true },
                orderBy:  { _count: { primaryTool: "desc" } },
                take:     10,
            }),
            getAssistantSettings(),
        ]);

        const totalTokens = tokenSum._sum.totalTokens || 0;
        const activeUsers = distinctUsersRows.length;
        const errorRate   = totalRequests === 0 ? 0 : (totalRequests - successCount) / totalRequests;

        // Hydrate top users with names
        let topUsers = [];
        if (topUsersRaw.length > 0) {
            const userIds = topUsersRaw.map((r) => r.userId);
            const users   = await prisma.user.findMany({
                where:  { id: { in: userIds } },
                select: { id: true, name: true },
            });
            const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));
            topUsers = topUsersRaw.map((r) => ({
                userId:   r.userId,
                name:     nameById[r.userId] || "Unknown",
                requests: r._count._all,
                tokens:   r._sum.totalTokens || 0,
            }));
        }

        const topTools = topToolsRaw.map((r) => ({
            tool:  r.primaryTool,
            count: r._count._all,
        }));

        res.json({
            range: { from: from.toISOString(), to: to.toISOString() },
            summary: {
                totalRequests,
                totalTokens,
                activeUsers,
                errorRate,
            },
            perDay:   perDayRaw,
            topUsers,
            topTools,
            settings,
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = { getUsage };
