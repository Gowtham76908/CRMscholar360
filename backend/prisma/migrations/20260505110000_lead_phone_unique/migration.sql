-- Deduplicate existing leads: for phones that appear more than once, keep the newest
-- record and null out phoneNormalized on the older ones so the unique index can be created.
UPDATE "Lead"
SET "phoneNormalized" = NULL
WHERE "phoneNormalized" IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON ("phoneNormalized") id
    FROM "Lead"
    WHERE "phoneNormalized" IS NOT NULL
    ORDER BY "phoneNormalized", "createdAt" DESC
  );

-- Drop the old non-unique index (replaced by the unique one below)
DROP INDEX IF EXISTS "Lead_phoneNormalized_idx";

-- Partial unique index: NULLs are excluded so leads without a valid phone number
-- can coexist freely, while any two leads with the same 10-digit phone are rejected.
CREATE UNIQUE INDEX "Lead_phoneNormalized_key"
    ON "Lead"("phoneNormalized")
    WHERE "phoneNormalized" IS NOT NULL;
