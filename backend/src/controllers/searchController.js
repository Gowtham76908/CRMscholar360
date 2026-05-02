const prisma = require("../utils/prisma");

const globalSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ leads: [], tasks: [], users: [] });
        }

        const searchQuery = {
            contains: q,
            mode: 'insensitive'
        };

        // Parallel search across models
        const [leads, tasks, users] = await Promise.all([
            prisma.lead.findMany({
                where: {
                    OR: [
                        { name: searchQuery },
                        { email: searchQuery },
                        { phone: searchQuery }
                    ]
                },
                take: 5
            }),
            prisma.task.findMany({
                where: {
                    title: searchQuery
                },
                take: 5
            }),
            prisma.user.findMany({
                where: {
                    OR: [
                        { name: searchQuery },
                        { email: searchQuery }
                    ]
                },
                take: 5,
                select: { id: true, name: true, email: true, department: true }
            })
        ]);

        res.json({ leads, tasks, users });
    } catch (error) {
        res.status(500).json({ message: "Error performing search", error: error.message });
    }
};

module.exports = { globalSearch };
