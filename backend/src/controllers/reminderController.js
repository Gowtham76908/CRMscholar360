const prisma = require("../utils/prisma");

const createReminder = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { leadId, taskId, remindAt, message } = req.body;

        const reminder = await prisma.reminder.create({
            data: {
                userId, // Remind the creator? or passed userId? usually remind oneself
                leadId,
                taskId,
                remindAt: new Date(remindAt),
                message
            }
        });

        res.status(201).json(reminder);
    } catch (error) {
        return next(error);
    }
};

const getMyReminders = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { leadId } = req.query;
        const where = { userId };
        if (leadId) where.leadId = leadId;
        const reminders = await prisma.reminder.findMany({
            where,
            orderBy: { remindAt: "asc" }
        });
        res.json(reminders);
    } catch (error) {
        return next(error);
    }
};

const dismissReminder = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;

        const reminder = await prisma.reminder.findUnique({ where: { id } });
        if (!reminder) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Reminder not found");
        if (reminder.userId !== userId) throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");

        const updated = await prisma.reminder.update({
            where: { id },
            data: { dismissed: true },
        });
        res.json(updated);
    } catch (error) {
        return next(error);
    }
};

module.exports = { createReminder, getMyReminders, dismissReminder };
