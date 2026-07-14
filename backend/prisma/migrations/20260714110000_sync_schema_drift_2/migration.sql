-- Second catch-up migration for schema drift from `prisma db push` usage in dev.

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'SHEETS';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEAM_LEADER';

ALTER TABLE "CompanySettings" ALTER COLUMN "companyName" SET DEFAULT 'CRM SCHOLAR PRIVATE LIMITED',
ALTER COLUMN "shortName" SET DEFAULT 'CRMS360',
ALTER COLUMN "gstin" SET DEFAULT '22AAAAA0000A1Z5',
ALTER COLUMN "address" SET DEFAULT '123, Tech Park Phase 1',
ALTER COLUMN "pincode" SET DEFAULT '600001',
ALTER COLUMN "phone" SET DEFAULT '+91 9876543210',
ALTER COLUMN "email" SET DEFAULT 'info@crmscholar360.com',
ALTER COLUMN "website" SET DEFAULT 'https://crmscholar360.com/',
ALTER COLUMN "bankName" SET DEFAULT 'ICICI Bank',
ALTER COLUMN "accountNo" SET DEFAULT '000011112222',
ALTER COLUMN "ifsc" SET DEFAULT 'ICIC0000123',
ALTER COLUMN "branch" SET DEFAULT 'Main Branch';

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "department" TEXT;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "resumeName" TEXT,
ADD COLUMN IF NOT EXISTS "resumeUrl" TEXT;

ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE TABLE IF NOT EXISTS "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ThirdPartyPortal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThirdPartyPortal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccommodationAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccommodationAgent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "Bank_name_key" ON "Bank"("name");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX "Expense_date_idx" ON "Expense"("date");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX "ThirdPartyPortal_name_key" ON "ThirdPartyPortal"("name");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX "AccommodationAgent_name_key" ON "AccommodationAgent"("name");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX "Note_userId_idx" ON "Note"("userId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
