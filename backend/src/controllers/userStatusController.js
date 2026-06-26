const prisma = require("../utils/prisma");

// Update current user's online status
const updateMyStatus = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { status } = req.body;

        if (!["ONLINE", "OFFLINE", "BREAK"].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be ONLINE, OFFLINE, or BREAK" });
        }

        const updateData = { 
            onlineStatus: status,
            lastSeen: new Date()
        };
        if (status === "BREAK") {
            updateData.breakStartedAt = new Date();
        } else {
            updateData.breakStartedAt = null;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                onlineStatus: true,
                breakStartedAt: true
            }
        });

        // Sync with EmployeeProfile availabilityStatus
        const empStatus = status === "ONLINE" ? "ONLINE" : "OFFLINE";
        await prisma.employeeProfile.updateMany({
            where: { employeeId: userId },
            data: { availabilityStatus: empStatus }
        });

        // Log the status change
        await prisma.userStatusLog.create({
            data: {
                userId,
                status,
                note: req.body.note || `Status changed to ${status}`
            }
        });

        res.json({ message: "Status updated", user });
    } catch (error) {

        return next(error);
    }
};

// Get all active users with their current online status
const getAllUsersStatus = async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                jobTitle: true,
                profilePhoto: true,
                onlineStatus: true,
                lastSeen: true,
                breakStartedAt: true
            },
            orderBy: [
                { onlineStatus: "asc" },
                { name: "asc" }
            ]
        });
        res.json(users);
    } catch (error) {

        return next(error);
    }
};

// Get today's status logs for current user
const getMyTodayLogs = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const today = new Date();
        const startOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const logs = await prisma.userStatusLog.findMany({
            where: {
                userId,
                changedAt: { gte: startOfDay, lt: endOfDay }
            },
            orderBy: { changedAt: "asc" }
        });

        res.json(logs);
    } catch (error) {

        return next(error);
    }
};

// Get specific user's last seen time
const getLastSeen = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastSeen: true, onlineStatus: true }
        });

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {

        return next(error);
    }
};

module.exports = { updateMyStatus, getAllUsersStatus, getMyTodayLogs, getLastSeen };
