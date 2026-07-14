-- Per-lead display override for source (e.g. a Google Sheet's custom name).
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sourceLabel" TEXT;
