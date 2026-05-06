-- Atomic invoice number counter — one row per prefix, incremented with INSERT ... ON CONFLICT DO UPDATE
-- This eliminates the read-then-write race that caused duplicate invoice numbers.
CREATE TABLE "InvoiceCounter" (
  "prefix"       TEXT    PRIMARY KEY,
  "currentValue" INTEGER NOT NULL DEFAULT 0
);

-- Seed from existing invoices so the counter starts at the current high-water mark.
-- REGEXP_REPLACE extracts the trailing digits after the last dash: "HXZ-PRO-7" → 7, "HXZ-3" → 3.
INSERT INTO "InvoiceCounter" ("prefix", "currentValue")
SELECT
  CASE
    WHEN "invoiceType" = 'PROFORMA' THEN
      REGEXP_REPLACE("invoiceNumber", '-\d+$', '')
    ELSE
      REGEXP_REPLACE("invoiceNumber", '-\d+$', '')
  END AS "prefix",
  MAX(CAST(REGEXP_REPLACE("invoiceNumber", '^.*-(\d+)$', '\1') AS INTEGER)) AS "currentValue"
FROM "Invoice"
WHERE "invoiceNumber" ~ '-\d+$'
GROUP BY 1
ON CONFLICT ("prefix") DO UPDATE
  SET "currentValue" = GREATEST("InvoiceCounter"."currentValue", EXCLUDED."currentValue");
