const prisma = require("../utils/prisma");

// GET /api/notifications
const getMyNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
    try {
        const result = await prisma.notification.updateMany({
            where: { id: req.params.id, userId: req.user.userId },
            data: { isRead: true }
        });
        if (result.count === 0) return res.status(404).json({ message: "Notification not found" });
        res.json({ message: "Marked as read" });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ message: "Failed to update notification" });
    }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all as read:", error);
        res.status(500).json({ message: "Failed to update notifications" });
    }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
