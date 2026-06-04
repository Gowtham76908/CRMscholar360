const prisma = require("../utils/prisma");

const getCommissions = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        let where = {};

        if (role === "EMPLOYEE") {
            where.userId = userId;
        }

        // Commission has no `user` relation in the schema (only a scalar userId),
        // so we resolve names with a separate lookup and attach them.
        const rows = await prisma.commission.findMany({
            where,
            orderBy: { createdAt: "desc" }
        });

        const userIds = [...new Set(rows.map((c) => c.userId))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
        });
        const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

        const commissions = rows.map((c) => ({ ...c, user: { name: nameById[c.userId] ?? null } }));
        const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0);

        res.json({ totalAmount, commissions });
    } catch (error) {
        return next(error);
    }
};

module.exports = { getCommissions };
