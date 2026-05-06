-- Drop the old composite index — superseded by the partial index below
DROP INDEX IF EXISTS "Leave_userId_status_fromDate_toDate_idx";
DROP INDEX IF EXISTS "Leave_userId_leaveType_status_fromDate_toDate_idx";

-- Partial index for the comp-off balance query only.
-- Covers: WHERE userId = ANY(...) AND leaveType = 'COMP_OFF' AND status = 'APPROVED'
--           AND fromDate <= now AND toDate >= fyStart
-- The WHERE predicate filters at index build time so the index only contains
-- COMP_OFF/APPROVED rows — smaller, faster, and never grows with unrelated leave types.
CREATE INDEX IF NOT EXISTS "Leave_compoff_approved_idx"
    ON "Leave"("userId", "fromDate", "toDate")
    WHERE "leaveType" = 'COMP_OFF' AND "status" = 'APPROVED';

-- Verify with (replace <userId> with a real id):
-- EXPLAIN ANALYZE
--   SELECT "userId",
--          SUM(GREATEST(0, EXTRACT(DAY FROM (LEAST("toDate", NOW()::date) - GREATEST("fromDate", '2025-04-01'::date)))::int + 1))::int AS used
--   FROM "Leave"
--   WHERE "userId" = '<userId>'
--     AND "leaveType" = 'COMP_OFF'
--     AND "status"    = 'APPROVED'
--     AND "fromDate" <= NOW()
--     AND "toDate"   >= '2025-04-01'
--   GROUP BY "userId";
-- Expected: "Index Scan using Leave_compoff_approved_idx"
