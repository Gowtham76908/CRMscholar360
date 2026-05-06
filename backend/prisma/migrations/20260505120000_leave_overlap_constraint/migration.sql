-- btree_gist extends GiST to support equality operators on scalar types (text/uuid).
-- Required for mixing "userId WITH =" and "daterange WITH &&" in the same GiST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Deconflict any existing approved overlaps before adding the constraint.
-- Keeps the newest leave per overlapping group; cancels the older ones.
-- This runs as a no-op if the data is already clean.
WITH ranked AS (
    SELECT
        l.id,
        ROW_NUMBER() OVER (
            PARTITION BY l."userId"
            ORDER BY l."createdAt" DESC
        ) AS rn,
        EXISTS (
            SELECT 1 FROM "Leave" o
            WHERE o."userId" = l."userId"
              AND o.status   = 'APPROVED'
              AND o.id      != l.id
              AND o."fromDate" <= l."toDate"
              AND o."toDate"   >= l."fromDate"
        ) AS has_overlap
    FROM "Leave" l
    WHERE l.status = 'APPROVED'
)
UPDATE "Leave"
SET status = 'REJECTED'
WHERE id IN (
    SELECT id FROM ranked WHERE has_overlap AND rn > 1
);

-- Exclusion constraint: Postgres enforces that no two APPROVED leaves for the same user
-- can have overlapping date ranges. '[]' means both endpoints are inclusive.
-- Partial (WHERE status = 'APPROVED') so PENDING/REJECTED rows are unconstrained.
ALTER TABLE "Leave"
    ADD CONSTRAINT "Leave_no_approved_overlap"
    EXCLUDE USING gist (
        "userId"                          WITH =,
        daterange("fromDate", "toDate", '[]') WITH &&
    )
    WHERE (status = 'APPROVED');

-- Composite index covering the overlap query pattern used in applyLeave and approveLeave:
--   WHERE "userId" = $1 AND "status" IN ('PENDING','APPROVED')
--     AND "fromDate" <= $to AND "toDate" >= $from
CREATE INDEX "Leave_userId_status_dates_idx"
    ON "Leave"("userId", "status", "fromDate", "toDate");
