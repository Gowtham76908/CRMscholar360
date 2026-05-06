const prisma = require("../utils/prisma");
const { createNotification } = require("./notificationService");
const logger = require("../utils/logger").child({ service: "ReminderService" });

const processReminders = async () => {
    try {
        const now = new Date();

        // Fetch candidates first — cheap indexed read
        const candidates = await prisma.reminder.findMany({
            where: { remindAt: { lte: now }, isSent: false },
            select: { id: true },
        });

        if (candidates.length === 0) return;

        for (const { id } of candidates) {
            try {
                // Atomic claim: only the worker that flips isSent false→true owns this reminder.
                // If two cron ticks overlap, updateMany returns count=0 for the second one → skip.
                const claimed = await prisma.reminder.updateMany({
                    where: { id, isSent: false },
                    data:  { isSent: true },
                });

                if (claimed.count === 0) continue; // already claimed by another tick

                // Fetch full detail now that we own it
                const reminder = await prisma.reminder.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        userId: true,
                        message: true,
                        leadId: true,
                        taskId: true,
                    },
                });

                if (!reminder) continue;

                // Deep link: task detail page exists (/tasks/:id).
                // Lead has no detail page — link to list. When a lead detail route
                // is added, change this to /leads/${reminder.leadId}.
                const link = reminder.taskId
                    ? `/tasks/${reminder.taskId}`
                    : reminder.leadId
                        ? `/leads`
                        : null;

                await createNotification({
                    userId:  reminder.userId,
                    title:   "🔔 Reminder",
                    message: reminder.message,
                    type:    "REMINDER",
                    link,
                });

                logger.info({ reminderId: id, userId: reminder.userId }, "Reminder delivered");
            } catch (err) {
                // Per-reminder failure: log and continue the batch.
                // isSent was already set to true during the atomic claim — if the
                // notification failed to create, roll it back so the next tick retries.
                logger.error({ reminderId: id, err: err.message }, "Failed to deliver reminder — rolling back claim");
                await prisma.reminder.updateMany({
                    where: { id },
                    data:  { isSent: false },
                }).catch((rbErr) => logger.error({ reminderId: id, err: rbErr.message }, "Rollback failed"));
            }
        }
    } catch (error) {
        logger.error({ err: error.message }, "Reminder batch error");
    }
};

module.exports = { processReminders };
