const prisma = require("../utils/prisma");

const getAuditLogs = async (req, res) => {
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
        res.status(500).json({ message: "Error fetching audit logs", error: error.message });
    }
};

module.exports = { getAuditLogs };
