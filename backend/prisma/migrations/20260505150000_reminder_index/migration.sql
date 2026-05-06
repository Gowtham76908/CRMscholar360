-- Index for the every-5-min reminder poll.
-- Query: WHERE remindAt <= now AND isSent = false
-- Without this, the scheduler scans the full Reminder table every 5 minutes.
CREATE INDEX IF NOT EXISTS "Reminder_remindAt_isSent_idx"
    ON "Reminder"("remindAt", "isSent");
