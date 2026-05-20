const cron = require("node-cron");
const { processReminders } = require("./services/reminderService");
const { runStatusAutomation } = require("./services/automationService");
const autoCheckout = require("./jobs/autoCheckout");
const autoBreakOffline = require("./jobs/autoBreakOffline");
const { notifyLeaderboardWinner, notifyTasksDueSoon, notifyOverdueTasks } = require("./services/notificationService");
const { runNoReplyTimeoutCheck } = require("./services/whatsappAutoReplyService");
const { runNoActivityRules } = require("./services/automationEngine");

const startScheduler = () => {
    console.log("[Scheduler] Starting background jobs...");

    // Check Reminders every 5 minutes
    cron.schedule("*/5 * * * *", () => {
        processReminders().catch(err =>
            console.error("[Scheduler] processReminders failed:", err)
        );
    });

    // Auto-offline users who've been on break for more than 1 hour (runs every 5 minutes)
    cron.schedule("*/5 * * * *", () => {
        autoBreakOffline().catch(err =>
            console.error("[Scheduler] autoBreakOffline failed:", err)
        );
    });

    // Run Status Automation every day at midnight
    cron.schedule("0 0 * * *", () => {
        runStatusAutomation().catch(err =>
            console.error("[Scheduler] runStatusAutomation failed:", err)
        );
    });

    // Auto-checkout at 10:00 PM IST daily
    cron.schedule("0 22 * * *", () => {
        console.log("[Scheduler] Running auto-checkout job...");
        autoCheckout().catch(err =>
            console.error("[Scheduler] autoCheckout failed:", err)
        );
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

    // No-activity automation rules — runs every 6 hours
    cron.schedule("0 */6 * * *", () => {
        runNoActivityRules().catch(err =>
            console.error("[Scheduler] runNoActivityRules failed:", err)
        );
    });

    // WhatsApp No-Reply timeout follow-ups — runs every hour
    cron.schedule("0 * * * *", () => {
        console.log("[Scheduler] Running WhatsApp no-reply timeout check...");
        runNoReplyTimeoutCheck().catch(err =>
            console.error("[Scheduler] WhatsApp no-reply timeout check failed:", err)
        );
    });

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
