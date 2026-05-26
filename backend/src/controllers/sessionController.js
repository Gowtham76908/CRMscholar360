const prisma = require("../utils/prisma");

// In real app, this would be called on login
const createSession = async (userId, device) => {
    try {
        await prisma.session.create({
            data: { userId, device: device || "Unknown" }
        });
    } catch (error) {
        console.error("Session creation error:", error);
    }
};

const getActiveSessions = async (req, res, next) => {
    try {
        const { role } = req.user;
        if (role !== "SUPER_ADMIN") return res.status(403).json({ message: "Forbidden" });

        const sessions = await prisma.session.findMany({
            include: { user: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" }
        });

        res.json(sessions);
    } catch (error) {
        return next(error);
    }
};

const logoutAllSessions = async (req, res, next) => {
    try {
        const { userId } = req.body; // Target user to force logout
        if (!userId) return res.status(400).json({ message: "User ID required" });

        await prisma.session.deleteMany({
            where: { userId }
        });

        res.json({ message: "Logged out all sessions for user" });
    } catch (error) {
        return next(error);
    }
};

module.exports = { createSession, getActiveSessions, logoutAllSessions };
