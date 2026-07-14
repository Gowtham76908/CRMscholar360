-- Catch-up migration for schema drift introduced by earlier `prisma db push` usage
-- against the dev database. Adds the columns/tables that schema.prisma already
-- expects but that were never captured as a migration file.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
DO $$ BEGIN
  CREATE UNIQUE INDEX "Lead_leadId_key" ON "Lead"("leadId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

ALTER TABLE "ChatMember" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "University_name_countryId_key" ON "University"("name", "countryId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "University" ADD CONSTRAINT "University_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
