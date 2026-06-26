-- Link invoices directly to a lead (for commission-invoicing workflow & consultant revenue).
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_leadId_idx" ON "Invoice"("leadId");
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
