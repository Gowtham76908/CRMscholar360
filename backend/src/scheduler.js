const cron = require("node-cron");
const { processReminders } = require("./services/reminderService");
const { runStatusAutomation } = require("./services/automationService");
const autoCheckout = require("./jobs/autoCheckout");
const autoBreakOffline = require("./jobs/autoBreakOffline");
const { notifyLeaderboardWinner, notifyTasksDueSoon, notifyOverdueTasks } = require("./services/notificationService");

const startScheduler = () => {
    console.log("[Scheduler] Starting background jobs...");

    // Check Reminders every 5 minutes
    cron.schedule("*/5 * * * *", () => {
        processReminders();
    });

    // Auto-offline users who've been on break for more than 1 hour (runs every 5 minutes)
    cron.schedule("*/5 * * * *", () => {
        autoBreakOffline();
    });

    // Run Status Automation every day at midnight
    cron.schedule("0 0 * * *", () => {
        runStatusAutomation();
    });

    // Auto-checkout at 10:00 PM IST daily
    cron.schedule("0 22 * * *", () => {
        console.log("[Scheduler] Running auto-checkout job...");
        autoCheckout();
    }, {
        timezone: "Asia/Kolkata"
    });

    // Notify assignees of tasks due within the next 24 hours — runs daily at 9 AM IST
    cron.schedule("0 9 * * *", () => {
        console.log("[Scheduler] Checking tasks due soon...");
        notifyTasksDueSoon().catch(err =>
            console.error("[Scheduler] Task due-soon notification failed:", err)
        );
    }, { timezone: "Asia/Kolkata" });

    // Notify assignees of overdue tasks — runs daily at 9 AM IST
    cron.schedule("0 9 * * *", () => {
        console.log("[Scheduler] Checking overdue tasks...");
        notifyOverdueTasks().catch(err =>
            console.error("[Scheduler] Overdue task notification failed:", err)
        );
    }, { timezone: "Asia/Kolkata" });

    // Notify the previous month's leaderboard #1 winner on the 2nd of every month at 9 AM IST
    // (Backup for the winner if they didn't log in on the 1st)
    cron.schedule("0 9 2 * *", () => {
        console.log("[Scheduler] Running leaderboard winner notification...");
        notifyLeaderboardWinner().catch(err =>
            console.error("[Scheduler] Leaderboard winner notification failed:", err)
        );
    }, {
        timezone: "Asia/Kolkata"
    });
};

module.exports = startScheduler;
