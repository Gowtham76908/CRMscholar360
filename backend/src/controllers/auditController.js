const prisma = require("../utils/prisma");

const getAuditLogs = async (req, res, next) => {
    try {
        // Date-scoped view: ?date=YYYY-MM-DD returns that calendar day's logs.
        // Defaults to today when omitted. A single day is naturally bounded, so
        // no take limit is needed.
        const base = req.query.date ? new Date(req.query.date) : new Date();
        if (isNaN(base.getTime())) {
            return res.status(400).json({ message: "Invalid date" });
        }
        const start = new Date(base); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 1);

        const logs = await prisma.activity.findMany({
            where: { createdAt: { gte: start, lt: end } },
            include: {
                user: { select: { name: true, email: true } },
                lead: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        res.json(logs);
    } catch (error) {
        return next(error);
    }
};

module.exports = { getAuditLogs };
