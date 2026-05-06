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

module.exports = { createReminder, getMyReminders };
