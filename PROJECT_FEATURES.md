# DCRM — Complete Feature Reference

> Last updated: 2026-05-11  
> Stack: React + Node.js/Express + Prisma + PostgreSQL

---

## Table of Contents

1. [Working Features](#working-features)
2. [Broken / Incomplete Features](#broken--incomplete-features)
3. [Security Issues Found](#security-issues-found)
4. [Feature Dependency Map](#feature-dependency-map)

---

## Working Features

### 1. Authentication & Session Management

**How it works:**  
Users log in with email + password. The backend validates credentials, generates a JWT (7-day expiry), and returns it to the frontend. The token is stored in `AuthContext` and sent with every API request via an Axios interceptor. Protected routes are wrapped in `AppLayout` — if no token exists, the user is redirected to `/login`.

Password reset uses a tokenized email flow: user requests reset → backend sends email with a signed token → user clicks link → token validated → password updated.

**Endpoints:**
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

**Pages:** `/login`, `/forgot-password`, `/reset-password`

**Roles:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`, `EMPLOYEE`, `AGENT`

---

### 2. Lead Management

**How it works:**  
The core CRM module. Leads have a status lifecycle: `NEW → CONTACTED → FOLLOW_UP → CONVERTED / LOST`. Each lead tracks source (Facebook, Instagram, Gmail, Website, Phone Call, LinkedIn), a calculated score (0–100), and an assigned agent.

Lead scoring is calculated automatically on create/update using a utility (`leadScorer.js`) that evaluates completeness of contact info, source quality, and engagement signals.

**Features:**
- Create, edit, delete leads (admin only for create/delete)
- Assign lead to any team member
- Filter by status, source, assigned agent, date range, search term
- Bulk status update and bulk assign
- Merge two leads into one (preserves activities, tasks, calls)
- CSV import (upload file → parse → validate → batch create)
- CSV export
- Duplicate check by phone/email before create
- Activity timeline per lead (all calls, notes, status changes logged)
- Click2Call from lead list (requires agent phone in profile)
- Call recording playback inline in lead list

**Endpoints:**
- `GET /api/leads` — paginated, filterable list
- `POST /api/leads` — create
- `PUT /api/leads/:id` — update
- `PATCH /api/leads/:id/status` — status change
- `PATCH /api/leads/:id/assign` — assign
- `PATCH /api/leads/bulk-update` — bulk status
- `PATCH /api/leads/bulk-assign` — bulk assign
- `POST /api/leads/merge` — merge
- `POST /api/leads/import` — CSV import
- `GET /api/leads/export` — CSV export
- `POST /api/leads/check-duplicate` — dedupe check
- `GET /api/leads/:id` — full lead detail
- `GET /api/leads/:id/activities` — activity timeline

**Pages:** `/leads`, `/leads/:id`

---

### 3. Lead Detail Page

**How it works:**  
A full CRM workspace for a single lead. 2-column layout — main content area + sticky sidebar. Six parallel API calls load independently so the page is never fully blocked.

**Main content tabs:**
- **Timeline** — merged view of all calls, notes, activities sorted by date, grouped by day
- **Notes** — inline note creation (Ctrl+Enter to submit), note list
- **Calls** — expandable call rows with recording player, AI summary, transcript, sentiment/tone/urgency badges
- **Tasks** — linked tasks with optimistic status toggle (complete/uncomplete)

**Sidebar shows:**
- Contact info (phone, email, company, job title, LinkedIn)
- Lead score bar (Cold/Warm/Hot/Premium)
- Lead metadata (source, enquiry type, created date, first response time)
- Assigned-to card
- Reminder widget (add reminders, see upcoming/past)
- Quick stats (total calls, notes, tasks)

**Status dropdown** — inline status change from header, click-outside to close.

**Quick actions:** Call (Click2Call), WhatsApp deep-link, Email mailto, Add Note, Create Task (opens AddTaskForm modal pre-filled with leadId)

**Page:** `/leads/:id`

---

### 4. Task Management

**How it works:**  
Tasks are work items that can be standalone or linked to a lead or sprint. Each task has priority (LOW/MEDIUM/HIGH/CRITICAL), type (TASK/BUG/STORY/EPIC), story points, estimated hours, labels, and file attachments.

The list view shows paginated tasks with filter tabs (All / Pending / Completed / Overdue). Clicking a task opens the full detail page. Status can be toggled directly from the list.

When a task is assigned, the assigned user receives an in-app notification. When completed, all admins receive a completion notification.

**Endpoints:**
- `GET /api/tasks` — paginated + filtered, supports `?leadId=` for lead-scoped view
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/status` — PENDING ↔ COMPLETED
- `PATCH /api/tasks/:id/kanban` — move kanban column
- `POST /api/tasks/:id/comments`
- `DELETE /api/tasks/:id/comments/:commentId`

**Pages:** `/tasks`, `/tasks/:id`

---

### 5. Kanban Board

**How it works:**  
Drag-and-drop board with 6 columns: `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `DONE`. Dragging a card calls `PATCH /tasks/:id/kanban` with the new column. Moving to `DONE` also sets `status = COMPLETED`. Task cards show priority color, type emoji, assignee avatar, story points, due date with overdue indicator.

Clicking a card opens a detail drawer without navigating away.

**Page:** `/kanban`

---

### 6. Sprint Planning

**How it works:**  
Agile sprint management. Sprints have a lifecycle: `PLANNING → ACTIVE → COMPLETED`. Only one sprint can be `ACTIVE` at a time. Tasks are added to sprints from the backlog. When a sprint starts, unstarted tasks move to `TODO` on the Kanban board.

Sprint Analytics page shows velocity, completion rate, burndown data, and per-member contribution for a given sprint.

**Endpoints:**
- `GET /api/sprints`
- `GET /api/sprints/active`
- `GET /api/sprints/backlog`
- `POST /api/sprints`
- `POST /api/sprints/:id/start`
- `POST /api/sprints/:id/complete`
- `GET /api/sprints/:id/analytics`
- `GET /api/sprints/velocity`

**Pages:** `/sprints`, `/sprint-analytics/:id`

---

### 7. Attendance Tracking

**How it works:**  
Employees check in/out via the Attendance page. Check-in records the timestamp and optionally the GPS location. The backend validates against IST timezone — late check-ins are flagged.

The monthly calendar view shows each day's status (Present/Absent/Leave/WFH/Half Day/Holiday) with color coding. Admins can override any day's status manually.

Background jobs run automatically:
- `autoCheckout` — checks out users still marked PRESENT at end of day
- `autoBreakOffline` — marks users OFFLINE if on break for over 1 hour

**Endpoints:**
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/attendance/my`
- `GET /api/attendance/stats`
- `GET /api/attendance/all` (admin)
- `GET /api/attendance/admin/monthly-report` (admin)
- `POST /api/attendance/admin/update-status` (admin)

**Page:** `/attendance`

---

### 8. Leave Management

**How it works:**  
Employees apply for leave specifying type (CASUAL_LEAVE, SICK_LEAVE, WFH, COMP_OFF), date range, and reason. Leave requests go through an approval workflow — admins approve/reject individually.

For `COMP_OFF` leaves: balance is calculated by counting Sundays the employee was marked `PRESENT` in the current financial year (April–March), minus already approved comp-off days used. The balance check is inside a Prisma transaction to prevent race conditions.

When leave is fully approved, attendance records are automatically created for each leave day (inside the same transaction — atomic). Overlap detection prevents two approved leaves from covering the same dates.

**Endpoints:**
- `POST /api/leave/apply`
- `GET /api/leave/my`
- `GET /api/leave/stats`
- `GET /api/leave/pending` (admin)
- `GET /api/leave/all` (admin)
- `POST /api/leave/approve/:id` (admin)
- `POST /api/leave/reject/:id` (admin)

**Page:** `/leave`

---

### 9. Team Management

**How it works:**  
Admins manage workspace users. Add new users (register with email, role, initial password). Edit user roles. Toggle active/inactive (deactivated users cannot log in). Delete users.

User online status (ONLINE/OFFLINE/BREAK) is tracked in real time via `userStatusController`. The status dot on user cards reflects current status.

**Endpoints:**
- `GET /api/team`
- `POST /api/users/register` (admin)
- `PATCH /api/team/:userId` (admin)
- `PATCH /api/team/:userId/toggle` (admin)
- `DELETE /api/team/:userId` (admin)

**Page:** `/team`

---

### 10. Notifications

**How it works:**  
In-app notification system. `notificationService.createNotification()` is called from various controllers (task assigned, task completed, leave approved/rejected, leaderboard winner). The `NotificationDropdown` component in the navbar polls or is triggered to show unread count and recent notifications.

**Triggered by:** task assignment, task completion, leave approval/rejection, leaderboard results, new Facebook/Instagram lead (when Meta integration is built)

**Endpoints:**
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

---

### 11. Departments

**How it works:**  
Organizational structure. Departments can be created and assigned to users. The Department Details page shows all members of a department.

**Endpoints:**
- `GET /api/departments`
- `POST /api/departments` (admin)
- `DELETE /api/departments/:id` (admin)
- `GET /api/departments/:id`

**Pages:** `/departments`, `/departments/:id`

---

### 12. Reports & Analytics

**How it works:**  
Admin-only reporting module using `recharts` for charts. Data is fetched from dedicated report endpoints that aggregate from the DB.

**Report types:**
- Leads by source (pie chart)
- Monthly lead growth (line chart)
- Conversion rate over time
- Team performance — leads handled, conversion rate per agent
- Response time analytics — average time to first contact per lead

CSV export available for lead reports.

**Endpoints:**
- `GET /api/reports/leads-by-source`
- `GET /api/reports/leads-by-employee`
- `GET /api/reports/monthly-growth`
- `GET /api/reports/conversion-rate`
- `GET /api/analytics/team-performance`
- `GET /api/analytics/response-time`

**Page:** `/reports`

---

### 13. Leaderboard

**How it works:**  
Monthly points-based ranking of all employees. Points calculated from:
- Attendance punctuality (early check-in bonus)
- Task completions
- Lead conversions

Top 3 get a podium display. Navigate month by month. At month-end, the winner gets a congratulatory in-app notification when they next log in.

**Endpoint:** `GET /api/analytics/leaderboard?month=YYYY-MM`

**Page:** `/leaderboard`

---

### 14. Invoice & Billing

**How it works:**  
Full invoice management for B2B sales. Two invoice types: `PROFORMA` and `TAX_INVOICE`. Auto-incrementing invoice numbers per type.

Line items have quantity, unit price, tax rate. Tax is split into CGST+SGST (intra-state) or IGST (inter-state) based on company GSTIN settings. Payment tracking records partial payments with date and mode. Invoice status auto-updates: DRAFT → SENT → PARTIALLY_PAID → PAID based on payment amounts vs total.

Balance sheet endpoint aggregates total invoiced, collected, outstanding.

Company details (GSTIN, bank account, address) pulled from `CompanySettings`.

**Endpoints:**
- `POST /api/invoices`
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `PATCH /api/invoices/:id`
- `DELETE /api/invoices/:id`
- `POST /api/invoices/:id/payments`
- `DELETE /api/invoices/:id/payments/:paymentId`
- `POST /api/invoices/:id/send-email`
- `GET /api/invoices/balance-sheet`

**Page:** `/invoices`

---

### 15. Salestrail Call Integration

**How it works:**  
Salestrail is an external call-tracking app used by field agents. It pushes call data to this CRM via a webhook (`POST /api/webhooks/salestrail`) authenticated with Basic Auth.

The CRM parses the Salestrail payload (handles multiple field name variants), normalizes the phone number, tries to match the call to an existing lead, and stores it in `SalestrailCall`. The frontend shows a history view with charts (monthly call volume bar chart) and playback.

**Endpoint:** `POST /api/webhooks/salestrail` (webhook receiver, Basic Auth protected)

**Page:** `/salestrail`

---

### 16. Search Leads (Serper/Google)

**How it works:**  
Prospecting tool. Admin types a business search query (e.g. "real estate agents Mumbai"). The backend calls the Serper API (Google Search API) for both Places results and web results. Emails and phone numbers are extracted from snippets using regex. Results are presented as selectable cards. Admins select leads and bulk-import them into the CRM.

**Requires:** `SERPER_API_KEY` env variable

**Endpoints:**
- `POST /api/search-leads` — query and return results
- `POST /api/search-leads/import` — import selected leads

**Page:** `/search-leads`

---

### 17. LinkedIn Lead Discovery

**How it works:**  
Same architecture as Search Leads but specifically searches LinkedIn profiles/companies via the Serper API. Extracts name, company, job title, biodata from LinkedIn search snippets. Emails and phones are extracted from associated web results using a contact map built across organic results.

**Requires:** `SERPER_API_KEY` env variable

**Page:** `/linkedin-leads`

---

### 18. Click2Call (Greeter Integration)

**How it works:**  
Agents can call a lead directly from the CRM. Clicking the phone button in the leads list or lead detail page triggers `POST /api/calls/click2call`. The backend calls the Greeter API with the agent's phone number and the customer's number. Greeter bridges the call. A `CallLog` record is created immediately with status `INITIATED` and updated when Greeter sends the result back via webhook.

**Requires:** `GREETER_USER_ID`, `GREETER_API_URL`, `GREETER_NUMBER` env variables. Agent must have a phone number set in their profile.

---

### 19. User Settings

**How it works:**  
Each user can update their own profile (name, phone, profile photo), change password, and manage notification preferences. Admins can view audit logs (all activities logged in the `Activity` model). Session management shows active devices/tokens and allows remote logout.

**Page:** `/settings`

---

### 20. Reminders

**How it works:**  
Reminders can be set against a lead or a task with a message and a future `remindAt` timestamp. A background scheduler (`reminderService.js`) polls for reminders due in the current window and sends in-app notifications to the reminder owner.

Currently, the reminder deep-link in notifications goes to `/leads` (the list). Now that `/leads/:id` exists, this should be updated to `/leads/${reminder.leadId}`.

**Endpoints:**
- `POST /api/reminders`
- `GET /api/reminders?leadId=`

---

## Broken / Incomplete Features

---

### ❌ 1. Messages / Team Chat — Wired to Stream.io but NOT functional without credentials

**Status:** UI fully built, backend controller exists, but requires paid Stream.io credentials.

**What's there:**
- Full Stream Chat + Stream Video SDK integrated in `Messages.jsx`
- Backend `chatController.js` generates Stream user tokens and upserts users into Stream
- Group channels, direct messages, video calls, read receipts all built

**Why it's broken:**
- `STREAM_API_KEY` and `STREAM_SECRET_KEY` are not set in `.env`
- Without credentials the `getStreamClient()` call throws `MISSING STREAM CREDENTIALS`
- The frontend will crash on load with an unhandled Stream SDK error

**Fix needed:**
1. Create a Stream.io account (free tier available for testing)
2. Add `STREAM_API_KEY` and `STREAM_SECRET_KEY` to `.env`
3. Wire the chat token endpoint into the frontend (currently not called on mount)

---

### ❌ 2. Integrations Page — Toggle-only UI, no real integrations

**Status:** Page exists and API works, but all integrations are fake toggle switches.

**What's there:**
- `integrationController.js` seeds 5 integration records (Facebook, Instagram, Gmail, Website, Phone)
- Frontend shows them with enable/disable toggle
- `PATCH /integrations/:id/toggle` flips `isConnected` boolean

**Why it's broken:**
- Toggling "connected" on Facebook does nothing — there is no OAuth, no token, no webhook subscription
- The `isConnected` flag is purely cosmetic — flipping it does not actually connect to Meta, Gmail, or any other service
- No real data flows through any integration channel

**Fix needed:**
- Facebook + Instagram: implement the Meta Lead Ads OAuth flow (full architecture described in this session)
- Gmail: implement Gmail OAuth (Google Cloud Console, gmail.readonly scope, watch/push notifications)
- Website Contact Form: generate a unique webhook URL per workspace, provide embed code
- Phone Logs: this is already handled by Salestrail webhook separately

---

### ❌ 3. Reminder Deep-links Point to Wrong URL

**Status:** Functional bug — notifications for reminders navigate to `/leads` (list) instead of the specific lead.

**Location:** `backend/src/services/reminderService.js` line ~47

**What's wrong:**
```js
// current (wrong)
link: `/leads`

// should be
link: `/leads/${reminder.leadId}`
```

**Fix:** One-line change in `reminderService.js`.

---

### ❌ 4. Invoice Security — No Role Guard on GET Routes

**Status:** Financial data exposed to all authenticated users including Employees/Agents.

**What's wrong:**
- `GET /api/invoices` and `GET /api/invoices/:id` have no role middleware
- Any logged-in EMPLOYEE or AGENT can fetch all company invoices via the API directly
- Only create/update/delete have role checks

**Fix needed:**
```js
router.get("/", auth, roleMiddleware(["ADMIN", "SUPER_ADMIN"]), invoiceController.getInvoices);
router.get("/:id", auth, roleMiddleware(["ADMIN", "SUPER_ADMIN"]), invoiceController.getInvoiceById);
```

---

### ❌ 5. Invoice Payment — Status Regression Bug

**Status:** Deleting a payment incorrectly resets invoice status to `SENT` regardless of actual state.

**Location:** `invoiceController.js` — `deletePayment` handler

**What's wrong:**
```js
// current — always hardcodes "SENT"
await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });

// should recalculate based on remaining payments vs total
```

**Fix needed:** After deleting a payment, recalculate `amountPaid` from remaining payments and derive the correct status (DRAFT/SENT/PARTIALLY_PAID/PAID/CANCELLED).

---

### ❌ 6. Task Ownership — No Auth on Status/Kanban PATCH

**Status:** Any authenticated user can mark any task complete or move any card on the Kanban board, regardless of whether they are the assignee or an admin.

**Location:**
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/kanban`

**What's wrong:** No ownership check — `taskController.js` updates any task ID passed without verifying `assignedToId === userId` or `role === ADMIN`.

**Fix needed:** Add check: if `role` is `EMPLOYEE` or `AGENT`, verify `task.assignedToId === userId` before allowing the update.

---

### ❌ 7. Webhook Endpoint — No Secret Validation

**Status:** The generic webhook receiver (`POST /api/webhooks/leads`) accepts any payload without verifying origin.

**Location:** `webhookController.js`

**What's wrong:**
- No HMAC signature verification
- Any external party who discovers the URL can inject fake leads

**Fix needed:** Add `x-webhook-secret` header check against a `WEBHOOK_SECRET` env variable, or implement HMAC-SHA256 signature verification matching how the webhook sender signs requests.

---

### ❌ 8. JWT Secret — Hardcoded Default

**Status:** Security vulnerability — default secret in `.env` is `supersecretkey`.

**Fix needed:** Generate a proper secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Replace `JWT_SECRET` in `.env` with the generated value.

---

### ❌ 9. Leaderboard — Timezone Bug in Punctuality Calculation

**Status:** Punctuality bonus uses local server timezone instead of IST.

**Location:** `leaderboardController.js` — punctuality check uses `ci.getHours()` (local TZ)

**What's wrong:**
```js
// current — server local time (wrong if server is UTC)
ci.getHours() < 9

// should be
new Date(ci.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours() < 9
```

**Impact:** On UTC servers (production Linux), 9:00 IST = 3:30 UTC — everyone appears late, nobody gets punctuality points.

---

### ❌ 10. Search Leads / LinkedIn Leads — Require Paid API Key

**Status:** Both pages work correctly in code but silently fail without a Serper API key.

**What's wrong:**
- `SERPER_API_KEY` not set → Axios call to `google.serper.dev` returns 401
- Frontend shows empty results with no explanation

**Fix needed:**
1. Add `SERPER_API_KEY` to `.env` (paid service, ~$50/mo for 50k queries)
2. Add a frontend fallback message when the endpoint returns an auth error

---

### ❌ 11. Click2Call — Fails Silently Without Greeter Credentials

**Status:** The call button appears for all users but fails without Greeter config.

**What's wrong:**
- `GREETER_USER_ID`, `GREETER_API_URL`, `GREETER_NUMBER` not set → Axios throws
- The frontend shows no error — the call button just stops responding
- Additionally, agents with no phone in their profile get a backend error but the frontend does not surface it clearly

**Fix needed:**
- Add env variable validation on startup
- Frontend should show a toast with the error message from the API response

---

### ❌ 12. Facebook / Instagram Lead Ads — Not Implemented

**Status:** The Meta integration is completely absent from the backend.

**What's there:**
- Integration toggle on the Integrations page (cosmetic only)
- `source: FACEBOOK` and `source: INSTAGRAM` exist as enum values in the Lead model

**What's missing:**
- Meta Developer App setup
- OAuth flow (`/api/meta/auth-url`, `/api/meta/oauth/callback`)
- Token exchange + encryption
- Page webhook subscription
- `POST /api/webhooks/meta` receiver with signature verification
- Lead ingestion pipeline
- `MetaIntegration` and `MetaWebhookEvent` database models
- Frontend OAuth connect/disconnect UI

**Full architecture** for this is documented in this project's conversation history.

---

### ⚠️ 13. Email Sending — Depends on SMTP Config

**Status:** Works if SMTP is configured, silently fails otherwise.

**Used for:** Password reset emails, invoice send-by-email

**What's needed:** `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` in `.env`

**Impact if missing:** Forgot password flow breaks (email never arrives). Invoice email silently fails.

---

### ⚠️ 14. Commission Tracking — Backend Exists, No Frontend UI

**Status:** `commissionController.js` and `commissionService.js` exist with full CRUD. The `Commission` model is in schema. But there is no frontend page or component that displays or manages commissions.

---

### ⚠️ 15. Automation Rules — Service Exists, Not Wired

**Status:** `automationService.js` exists (trigger-action rule engine). No routes, no frontend UI, no controller exposes it.

---

## Security Issues Found

| Severity | Issue | Location |
|----------|-------|----------|
| 🔴 Critical | JWT_SECRET is `supersecretkey` | `.env` |
| 🔴 Critical | Invoice GET routes have no role guard | `invoiceController.js` |
| 🔴 High | Webhook receiver has no signature check | `webhookController.js` |
| 🔴 High | Task status/kanban PATCH has no ownership check | `taskController.js` |
| 🟡 Medium | Invoice payment delete causes status regression | `invoiceController.js` |
| 🟡 Medium | Meta tokens (when built) must be AES-256 encrypted at rest | — |

---

## Feature Dependency Map

```
Click2Call ──────── requires ──► GREETER_* env vars + agent phone in profile
Search Leads ────── requires ──► SERPER_API_KEY
LinkedIn Leads ──── requires ──► SERPER_API_KEY
Messages/Chat ───── requires ──► STREAM_API_KEY + STREAM_SECRET_KEY
Email features ──── requires ──► EMAIL_HOST/PORT/USER/PASS (SMTP)
Facebook/IG Leads ─ requires ──► Meta Developer App + OAuth flow (not built)
Salestrail Calls ── requires ──► SALESTRAIL_USER + SALESTRAIL_PASS + external app
Attendance jobs ─── requires ──► Background scheduler running (cron/node-cron)
Reminders ──────── requires ──► Background scheduler running
```

---

## Summary Count

| Category | Count |
|----------|-------|
| Fully working features | 20 |
| Broken (needs credentials/config) | 4 |
| Broken (code bugs) | 5 |
| Missing entirely | 2 |
| Security issues | 6 |
| Backend-only (no UI) | 2 |
