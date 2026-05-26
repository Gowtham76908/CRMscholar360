const prisma = require("../utils/prisma");

// GET /api/notifications
const getMyNotifications = async (req, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(notifications);
    } catch (error) {

        return next(error);
    }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
    try {
        const result = await prisma.notification.updateMany({
            where: { id: req.params.id, userId: req.user.userId },
            data: { isRead: true }
        });
        if (result.count === 0) return res.status(404).json({ message: "Notification not found" });
        res.json({ message: "Marked as read" });
    } catch (error) {

        return next(error);
    }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res, next) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: "All notifications marked as read" });
    } catch (error) {

        return next(error);
    }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
