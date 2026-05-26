const prisma = require("../utils/prisma");

const createReminder = async (req, res) => {
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
        res.status(500).json({ message: "Error creating reminder", error: error.message });
    }
};

const getMyReminders = async (req, res) => {
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
        res.status(500).json({ message: "Error fetching reminders", error: error.message });
    }
};

const dismissReminder = async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;

        const reminder = await prisma.reminder.findUnique({ where: { id } });
        if (!reminder) return res.status(404).json({ message: "Reminder not found" });
        if (reminder.userId !== userId) return res.status(403).json({ message: "Access denied" });

        const updated = await prisma.reminder.update({
            where: { id },
            data: { dismissed: true },
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Error dismissing reminder", error: error.message });
    }
};

module.exports = { createReminder, getMyReminders, dismissReminder };
