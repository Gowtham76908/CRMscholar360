const prisma = require("../utils/prisma");

const getAuditLogs = async (req, res, next) => {
    try {
        const logs = await prisma.activity.findMany({
            include: {
                user: { select: { name: true, email: true } },
                lead: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 100 // Limit to last 100 logs
        });

        res.json(logs);
    } catch (error) {
        return next(error);
    }
};

module.exports = { getAuditLogs };
