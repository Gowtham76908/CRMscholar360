const prisma = require("../utils/prisma");

const getCommissions = async (req, res) => {
    try {
        const { userId, role } = req.user;
        let where = {};

        if (role === "EMPLOYEE") {
            where.userId = userId;
        }

        const commissions = await prisma.commission.findMany({
            where,
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" }
        });

        const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0);

        res.json({ totalAmount, commissions });
    } catch (error) {
        res.status(500).json({ message: "Error fetching commissions", error: error.message });
    }
};

module.exports = { getCommissions };
