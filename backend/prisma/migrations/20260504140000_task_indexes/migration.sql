-- Indexes to support paginated task queries: status filter, overdue date range, and employee RBAC+status combo
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "Task_assignedToId_status_idx" ON "Task"("assignedToId", "status");
