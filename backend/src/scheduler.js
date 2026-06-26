const cron = require("node-cron");
const prisma = require("./utils/prisma");
const { nowIST } = require("./utils/istTime");
const { processReminders } = require("./services/reminderService");
const autoCheckout = require("./jobs/autoCheckout");
const autoBreakOffline = require("./jobs/autoBreakOffline");
const autoMarkAbsent = require("./jobs/autoMarkAbsent");
const { notifyLeaderboardWinner, notifyTasksDueSoon, notifyOverdueTasks } = require("./services/notificationService");
const { runNoReplyTimeoutCheck } = require("./services/whatsappAutoReplyService");
const { runNoActivityRules } = require("./services/automationEngine");
const logger = require("./utils/logger");

async function withRetry(name, fn, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await fn();
            return;
        } catch (err) {
            if (attempt === maxAttempts) {
                logger.error({ err }, `[Scheduler] ${name} failed after ${maxAttempts} attempts`);
            } else {
                const delay = 1000 * Math.pow(2, attempt - 1);
                logger.warn(`[Scheduler] ${name} attempt ${attempt} failed, retrying in ${delay}ms: ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
}

// Current IST wall-clock time as "HH:MM" (nowIST encodes IST in UTC accessors).
const istHHMM = () => {
    const d = nowIST();
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

// Attendance automation runs on admin-configurable times (CompanySettings, IST).
// We tick every minute and fire each job when the current IST time matches its
// configured time — this honors live settings changes without a restart, which a
// fixed cron expression (registered once at boot) cannot do.
async function attendanceAutomationTick() {
    const s = await prisma.companySettings.findFirst({
        select: {
            autoAbsentEnabled: true, autoAbsentTime: true,
            autoCheckoutEnabled: true, autoCheckoutRunTime: true, autoCheckoutMarkTime: true,
        },
    });
    if (!s) return;
    const now = istHHMM();

    if (s.autoAbsentEnabled !== false && s.autoAbsentTime === now) {
        await withRetry("autoMarkAbsent", autoMarkAbsent);
    }
    if (s.autoCheckoutEnabled !== false && s.autoCheckoutRunTime === now) {
        await withRetry("autoCheckout", () => autoCheckout(s.autoCheckoutMarkTime));
    }
}

const startScheduler = () => {
    logger.info("[Scheduler] Starting background jobs...");

    cron.schedule("*/5 * * * *", () => withRetry("processReminders", processReminders));
    cron.schedule("*/5 * * * *", () => withRetry("autoBreakOffline", autoBreakOffline));
    // NOTE: leads are no longer auto-marked LOST after 7 days. Going-cold leads are
    // surfaced as a pull-based follow-up suggestion (followUpSuggestionService →
    // detectNoActivity), so reps get nudged without notification spam or losing the lead.
    // Auto-mark-absent and auto-checkout fire from this per-minute tick at the
    // times configured in Company Settings (see attendanceAutomationTick).
    cron.schedule("* * * * *", () => attendanceAutomationTick().catch(err =>
        logger.error({ err }, "[Scheduler] attendanceAutomationTick failed")));
    cron.schedule("0 9 * * *",   () => withRetry("notifyTasksDueSoon", notifyTasksDueSoon), { timezone: "Asia/Kolkata" });
    cron.schedule("0 9 * * *",   () => withRetry("notifyOverdueTasks", notifyOverdueTasks), { timezone: "Asia/Kolkata" });
    cron.schedule("0 */6 * * *", () => withRetry("runNoActivityRules", runNoActivityRules));
    cron.schedule("0 * * * *",   () => withRetry("runNoReplyTimeoutCheck", runNoReplyTimeoutCheck));
    cron.schedule("0 9 2 * *",   () => withRetry("notifyLeaderboardWinner", notifyLeaderboardWinner), { timezone: "Asia/Kolkata" });
};

module.exports = startScheduler;
