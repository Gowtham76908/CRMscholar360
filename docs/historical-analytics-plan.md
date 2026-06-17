# Historical Analytics — Implementation Plan

> **Status (2026-06-17):** Phases 1–3 **implemented**. The ledger captures live
> history; the read API + service timeline + dashboard "Activity Over Time" widget
> are built and verified against seeded data. Only Phase 4 (forecasting / AI /
> executive trend models) remains deferred until real production usage accrues.

**Goal:** Move reporting from *"what exists right now"* (stage snapshots) to *"what
happened over time"* (an immutable event trail), while keeping `LeadDepartment` as
the operational source of truth.

**Three data levels** (why seeding matters):
- **L1 — empty ledger:** nothing to report.
- **L2 — seeded history:** `prisma/seed-history.js` generates realistic backdated
  progressions (default 500 leads / 90 days across departments + consultants) so
  charts, throughput, employee reports, timelines and date filters can all be built
  and validated **now**. Re-runnable; tags its leads `@seed.history` and resets that
  batch each run, leaving the main seed untouched. Run: `node prisma/seed-history.js [leads] [days]`.
- **L3 — real production data:** forecasting / leaderboards / trend models become
  trustworthy only here — hence Phase 4 stays deferred (fake data misleads forecasts).

**Approach:** A dedicated, append-only fact table — `LeadDepartmentStageEvent` —
that records every stage transition (including the initial entry into a workflow).
All analytics are derived from this ledger.

**Locked decisions**
- Table: `LeadDepartmentStageEvent`.
- Records **stage transitions only** for now.
- Fields: `leadDepartmentId`, `department`, `fromStage`, `toStage`, `changedByUserId`, `createdAt`.
- Service creation emits `null → <initial stage>` (= `ENQUIRY` everywhere today) so
  `WHERE toStage = 'ENQUIRY'` means **enquiries received**.
- Cross-department entry (allocation) also emits the entry event.
- Event writes are **atomic** with the state change (single `prisma.$transaction`).

---

## Phase 1 — Foundation: schema + event capture

Nothing user-visible. After this phase, real history starts accumulating.

### 1.1 Schema (`backend/prisma/schema.prisma`)
```prisma
model LeadDepartmentStageEvent {
  id               String         @id @default(uuid())
  leadDepartmentId String
  department       DepartmentType
  fromStage        String?        // null = service entered the workflow
  toStage          String
  changedByUserId  String?        // null = system/programmatic origin (import, webhook, scraper)
  createdAt        DateTime       @default(now())

  leadDepartment   LeadDepartment @relation(fields: [leadDepartmentId], references: [id], onDelete: Cascade)
  changedByUser    User?          @relation(fields: [changedByUserId], references: [id])

  @@index([department, createdAt])
  @@index([changedByUserId, createdAt])
  @@index([toStage, createdAt])
  @@index([leadDepartmentId])
  @@index([createdAt])          // org-wide date-range counts (no dept/stage filter)
}
```
- Add the reverse relations on `LeadDepartment` and `User`.
- `npx prisma migrate dev --name add_stage_event_ledger` (clean rebuild — no backfill).

### 1.2 Event writer helper (`backend/src/services/leadDepartmentService.js`)
A small internal helper that takes a Prisma transaction client and writes one event:
```
recordStageEvent(tx, { leadDepartmentId, department, fromStage, toStage, changedByUserId })
```

### 1.3 Wire the three choke points (all atomic)
| Function | Event emitted |
|----------|---------------|
| `createSalesAssignment` | `null → getInitialStage("SALES")` (Sales entry) |
| `allocateDepartments`   | `null → getInitialStage(dept)` per newly created department |
| `updateStage`           | `leadDept.stage → stage` (real transitions only) |

- `updateStage`: wrap the existing `leadDepartment.update` + `recordStageEvent` in
  `prisma.$transaction`. Keep the no-op guard (no event when stage is unchanged).
  Keep `logActivity`, automation, and commission hooks unchanged.
- `createSalesAssignment` already receives a transaction client (`client`) — emit
  inside the same transaction.
- `allocateDepartments` uses `createMany` (no row ids returned). Either switch to a
  loop of `create` inside `$transaction`, or fetch the freshly created rows and bulk
  `createMany` events in the same transaction. Emit one entry event per *new*
  department only (respect `skipDuplicates` semantics).

### 1.4 Phase 1 acceptance
- Creating a lead → 1 SALES entry event.
- Allocating to LOAN/FOREX/etc. → 1 entry event per new department.
- Moving a stage → 1 transition event with correct from/to.
- No-op stage set → no event.
- **★ ROLLBACK TEST (most important):** force the event insert to fail *after* the
  stage update inside the transaction → the stage update must **roll back** (stage
  unchanged, no event). Historical reporting is only trustworthy if a stage change
  can never exist without its event. This is the critical test of the whole feature.

---

## Phase 2 — Read layer: history service + API  ✅ IMPLEMENTED

`backend/src/services/departmentHistoryService.js` — own actor-scoping helper
`buildEventScope` mirroring `departmentAnalyticsService.buildScope`
(Director / Manager-of-dept / Consultant-own).

### 2.1 Service functions (built)
- `getStageTimeSeries({ department?, toStage?, granularity, from, to, actor })`
  → zero-filled `[{ bucket, count }]`. Bucketing is done in JS (UTC, Monday-start
  weeks — matching `date_trunc('week')`) over a scoped `findMany`, rather than raw
  SQL. Fine at current scale; revisit with `$queryRaw`/rollups if volume demands.
- `getDepartmentThroughput({ department, from, to, actor })`
  → `groupBy toStage` → moves into each stage in range.
- `getEmployeeStageActivity({ changedByUserId, from, to, actor })`
  → per-employee `groupBy toStage`. Consultants may only query themselves.
- `getServiceTimeline(leadDepartmentId, actor)`
  → ordered events for one service (from/to label, who, when). Visibility mirrors
  the queue. Powers **Lead Details → Journey → Activity Timeline**.

### 2.2 Endpoints (actor-scoped, on the lead-departments router)
```
GET /lead-departments/reports/timeseries?department=&toStage=&granularity=&from=&to=
GET /lead-departments/reports/throughput?department=&from=&to=
GET /lead-departments/reports/employee-activity?employeeId=&department=&from=&to=
GET /lead-departments/:leadDepartmentId/timeline
```
- Lightweight inline query guards (granularity whitelist; service validates
  department/range) — matches this controller's existing GET-handler style. The
  `validate` middleware only covers `req.body`, so it isn't used for these GETs.
- Static `/reports/*` routes registered before `:id` param routes.

### 2.3 Phase 2 acceptance — verified against seeded data
- "Enquiries received this month" = timeseries with `toStage=ENQUIRY`, granularity=month.
- "Approvals this week" = `toStage=APPROVED`, granularity=week.
- Employee report returns per-stage counts for a date range.
- Timeline returns chronological progression for one service.
- All endpoints respect role scoping.

---

## Phase 3 — Frontend: real history on existing surfaces  ✅ IMPLEMENTED

- **Service stage timeline** — `StageTimeline` in
  `frontend/src/components/lead/LeadDepartmentsPanel.jsx`: each department service
  row has a "Stage history" toggle that lazy-loads `/lead-departments/:id/timeline`
  and renders the `null → ENQUIRY → FOLLOW_UP → …` progression with who/when. This
  is the Lead Details → Journey → Activity Timeline win, usable immediately.
- **Dashboard "Activity Over Time" widget** —
  `frontend/src/components/department/HistoricalActivity.jsx`, mounted in
  `Dashboard.jsx` right under the current-state KPI funnel: a range toggle
  (7d/30d/90d/1y → day/week/month bucketing), a metric-selectable time-series area
  chart (defaults to ENQUIRY = "enquiries received"), and a stage-throughput bar
  chart. Tagged **"Historical"** and captioned as distinct from the snapshot above.
- React Query hooks added to `frontend/src/hooks/useDepartments.js`:
  `useServiceTimeline`, `useStageTimeSeries`, `useDepartmentThroughput`,
  `useEmployeeStageActivity`.

Kept **visually separate** from the snapshot view — this is what satisfies
"distinguish current pipeline state vs historical workflow activity."

---

## Phase 4 — Deferred until real production usage accrues

**Do NOT build these on seeded/fake data** — forecasts and executive trend models
built on synthetic history *mislead*. Revisit once the ledger holds real usage
(rule of thumb: 30–60 days of genuine transitions).

- Conversion forecasting / predictive trends / projections.
- AI-driven analytics.
- Executive trend models.
- Employee leaderboard / rankings (build once real activity is trustworthy).
- Nightly pre-aggregated rollup tables (daily metrics per department/employee/stage)
  for KPIs/forecasting — also the moment to swap JS bucketing for `$queryRaw`
  `date_trunc` if query volume grows. Raw ledger remains the source of truth.
- Expand event types beyond stage transitions (assignment, commission, removal) if
  later needed — the table design already leaves room.

---

## Notes / boundaries
- `changedByUserId` = the actor who performed the move (correct for "work performed").
  Crediting the service's *assigned owner* regardless of actor would need a separate
  `ownerEmployeeId` field — intentionally **not** added now.
- `Activity` log stays as the human-readable lead audit trail; this table is the
  analytics engine. Different concerns, both kept.
- **Do NOT remove snapshot analytics.** `departmentAnalyticsService` stays untouched.
  Snapshot (current state) and history (activity over time) are *both* useful and
  shown side by side, e.g.:
  ```
  Current State          June Activity
  Enquiry:     45        Enquiries Received:     220
  Follow Up:   20        Applications Submitted:  80
  Application: 12        Approvals:               30
  ```
  Left = "what exists now" (snapshot). Right = "what happened in the period" (ledger).
