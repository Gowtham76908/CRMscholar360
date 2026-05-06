ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "resetToken"       TEXT,
    ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMPTZ;

-- Index for fast token lookup on reset-password route
CREATE INDEX IF NOT EXISTS "User_resetToken_idx" ON "User"("resetToken") WHERE "resetToken" IS NOT NULL;
