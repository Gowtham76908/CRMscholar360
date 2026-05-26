const cron = require("node-cron");
const { processReminders } = require("./services/reminderService");
const { runStatusAutomation } = require("./services/automationService");
const autoCheckout = require("./jobs/autoCheckout");
const autoBreakOffline = require("./jobs/autoBreakOffline");
const { notifyLeaderboardWinner, notifyTasksDueSoon, notifyOverdueTasks } = require("./services/notificationService");
const { runNoReplyTimeoutCheck } = require("./services/whatsappAutoReplyService");
const { runNoActivityRules } = require("./services/automationEngine");

async function withRetry(name, fn, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await fn();
            return;
        } catch (err) {
            if (attempt === maxAttempts) {
                console.error(`[Scheduler] ${name} failed after ${maxAttempts} attempts:`, err);
            } else {
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.warn(`[Scheduler] ${name} attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
}

const startScheduler = () => {
    console.log("[Scheduler] Starting background jobs...");

    cron.schedule("*/5 * * * *", () => withRetry("processReminders", processReminders));
    cron.schedule("*/5 * * * *", () => withRetry("autoBreakOffline", autoBreakOffline));
    cron.schedule("0 0 * * *",   () => withRetry("runStatusAutomation", runStatusAutomation));
    cron.schedule("0 22 * * *",  () => withRetry("autoCheckout", autoCheckout), { timezone: "Asia/Kolkata" });
    cron.schedule("0 9 * * *",   () => withRetry("notifyTasksDueSoon", notifyTasksDueSoon), { timezone: "Asia/Kolkata" });
    cron.schedule("0 9 * * *",   () => withRetry("notifyOverdueTasks", notifyOverdueTasks), { timezone: "Asia/Kolkata" });
    cron.schedule("0 */6 * * *", () => withRetry("runNoActivityRules", runNoActivityRules));
    cron.schedule("0 * * * *",   () => withRetry("runNoReplyTimeoutCheck", runNoReplyTimeoutCheck));
    cron.schedule("0 9 2 * *",   () => withRetry("notifyLeaderboardWinner", notifyLeaderboardWinner), { timezone: "Asia/Kolkata" });
};

module.exports = startScheduler;
