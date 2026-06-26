-- Attendance automation settings (IST). Times are "HH:MM".
ALTER TABLE "CompanySettings"
  ADD COLUMN IF NOT EXISTS "autoAbsentEnabled"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "autoAbsentTime"       TEXT    NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS "autoCheckoutEnabled"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "autoCheckoutRunTime"  TEXT    NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS "autoCheckoutMarkTime" TEXT    NOT NULL DEFAULT '20:00';
