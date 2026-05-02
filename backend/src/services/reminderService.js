const prisma = require("../utils/prisma");
// In a real app, integrate a mailer service here (e.g., nodemailer or SendGrid)
// const mailer = require("../utils/mailer");

const processReminders = async () => {
    try {
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000);

        // Find reminders that are due and haven't been sent
        const pendingReminders = await prisma.reminder.findMany({
            where: {
                remindAt: {
                    lte: now // Due now or in the past
                },
                isSent: false
            },
            include: {
                // Join user to get email/phone if needed
                // user: true 
                // lead: true
                // task: true
            }
        });

        if (pendingReminders.length === 0) return;

        console.log(`[Reminder Service] Found ${pendingReminders.length} pending reminders.`);

        for (const reminder of pendingReminders) {
            // Mock Sending Notification
            // await mailer.send({ to: user.email, subject: "Reminder", text: reminder.message });
            console.log(`[Mock Notification] To User ${reminder.userId}: ${reminder.message}`);

            // Mark as sent
            await prisma.reminder.update({
                where: { id: reminder.id },
                data: { isSent: true }
            });
        }
    } catch (error) {
        console.error("Error processing reminders:", error);
    }
};

module.exports = { processReminders };
