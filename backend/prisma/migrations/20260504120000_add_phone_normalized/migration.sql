-- Add phoneNormalized to User and Lead for exact-match phone lookups

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNormalized" VARCHAR(15);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phoneNormalized" VARCHAR(15);

-- Index on Lead.phoneNormalized (queried on every webhook call)
CREATE INDEX IF NOT EXISTS "Lead_phoneNormalized_idx" ON "Lead"("phoneNormalized");

-- Backfill existing rows: strip non-digits, keep last 10 characters
UPDATE "User"
SET "phoneNormalized" = RIGHT(REGEXP_REPLACE("phone", '[^0-9]', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND LENGTH(REGEXP_REPLACE("phone", '[^0-9]', '', 'g')) >= 10;

UPDATE "Lead"
SET "phoneNormalized" = RIGHT(REGEXP_REPLACE("phone", '[^0-9]', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND LENGTH(REGEXP_REPLACE("phone", '[^0-9]', '', 'g')) >= 10;
