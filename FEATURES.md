# scholar360 — Complete Feature Reference

This document describes every feature in the scholar360 system — what it does, how it works, who can use it, and why it exists.

---

## 1. Authentication & User Management

### Login & Session Management
Users sign in with an email and password. On success the server issues an httpOnly auth cookie that is sent automatically with every subsequent request. The session persists across browser tabs and survives a page refresh. If the cookie expires or the server returns a 401, the app automatically fires a logout event and redirects the user back to the login screen without any manual intervention. Employees who forget their password can request a reset link by email; the link contains a short-lived token that expires after use.

### User Profile
Every user has a profile page where they can update their display name, phone number, department, and job title. They can also upload a profile photo which appears as their avatar throughout the app — in lead assignment dropdowns, chat, the leaderboard, and team tables. Password changes require entering the current password first.

### Team Management _(SUPER_ADMIN, MANAGER)_
Managers and admins can create new user accounts, assigning them a role (SUPER_ADMIN, MANAGER, TEAM_LEAD, EMPLOYEE, AGENT) and a department. Existing users can be edited to change their name, role, or department. Accounts can be deactivated (access revoked) without permanently deleting them, which preserves all their historical data — lead assignments, activities, call logs — for reporting purposes.

### User Status (Online / Offline / Break)
The system tracks whether each team member is currently working. Status changes happen automatically — checking in on the Attendance page sets the user to ONLINE; checking out sets them to OFFLINE. Users can also manually switch to BREAK. A background job watches for users who have been on break for more than one hour and automatically flips them to OFFLINE. Every status change is written to a timestamped log.

Managers see the current status as a coloured dot on every user avatar throughout the app (green = online, yellow = break, grey = offline). On the Attendance page, employees see their own "Today's Activity Timeline" — a chronological list of every status change that day with the exact timestamp and reason. This is primarily used to decide who is available when assigning or auto-distributing leads.

---

## 2. Lead Management

### Creating & Viewing Leads
A lead represents a potential customer who has expressed interest. Each lead stores contact information (name, phone, email, company, job title, LinkedIn URL, bio/notes), the source they came from (website, Facebook, referral, etc.), the enquiry type, and any custom fields the organization has defined. Only SUPER_ADMIN and MANAGER roles can create leads manually; employees work with leads assigned to them.

The leads list supports pagination and shows key details at a glance. Clicking a lead opens its full detail page which shows all stored fields, the complete activity timeline, notes, reminders, tasks linked to this lead, call logs, WhatsApp messages, and emails — everything about the customer in one place.

### Lead Status Workflow
Every lead moves through a defined lifecycle:
- **NEW** — just created, no contact yet
- **CONTACTED** — first contact has been made
- **FOLLOW_UP** — requires a follow-up action
- **CONVERTED** — the lead became a customer
- **LOST** — no longer interested or unresponsive
- **MERGED** — duplicate that was merged into another lead

Employees update the status as they work the lead. Status changes are recorded in the activity timeline so managers can see exactly how a lead progressed.

### Lead Assignment & Distribution
Leads can be assigned to individual employees by a manager, or distributed in bulk using the smart allocation algorithm. The algorithm considers each employee's current lead load, their maximum daily capacity, whether they are accepting leads, and their availability status — so the distribution is balanced rather than round-robin. Assignment history is stored, so you can always see who had the lead at any point in time.

Employees can only see and work on leads assigned to them. Managers see the full pool.

### Lead Scoring
Every lead is automatically scored based on factors derived from the enquiry details, source, and behaviour. The score is broken into bands — Hot, Warm, Cold — and displayed prominently on the lead card and detail page. The scoring explanation tells the user exactly which factors contributed to the score, so employees know where to focus their attention. Scores can be used as a filter in the leads list to surface the most valuable prospects first.

### Search & Filtering
The leads list has a powerful filter bar. You can search by name, phone number, or email. Filters include: lead status, source channel, assigned employee, date range (when the lead was created), score range, enquiry type, category, and SLA breach status. Multiple filters can be combined. Employees also have a "My Leads" toggle that scopes the list to only their assigned leads.

### Duplicate Management _(SUPER_ADMIN, MANAGER)_
When a new lead is created or imported, the system checks for existing leads with the same phone number or email. Detected duplicates are flagged and held on a dedicated Duplicates page. A manager can review two duplicate records side-by-side and merge them — preserving the best data from each record and redirecting all activities, notes, and history to the surviving lead. The other record is marked as MERGED.

### Lead Import / Export _(SUPER_ADMIN, MANAGER)_
Leads can be bulk-imported from a CSV or Excel file. The import flow has three stages:

1. **Preview** — the file is parsed server-side and the first five rows are shown so the user can verify the data looks correct before committing. A column mapping panel lists every column in the file alongside its auto-detected CRM field (e.g. "LinkedIn URL" → LinkedIn URL, "Bio / Notes" → Bio / Notes). Columns the system could not confidently match are flagged for manual mapping. If a column doesn't match any existing field, the user can create a new custom field on the spot and the system will add it to the CRM automatically.

2. **Allocation** — the user chooses how imported leads should be assigned: leave them unassigned, assign all to one employee, or distribute them across the team using the smart algorithm.

3. **Import** — the job runs asynchronously in the background. The UI polls for progress and shows a live status bar with stages (parsing → deduplicating → inserting → assigning → complete), counts of imported, duplicate, skipped, and failed records, and any per-row errors.

Leads can also be exported to CSV, scoped by the user's role — employees export their own leads, managers export the full team.

### Bulk Operations _(SUPER_ADMIN, MANAGER)_
From the leads list, managers can select multiple leads and apply actions in bulk: update a field (status, source, enquiry type) across all selected leads at once, assign them all to a specific employee, or run the smart-assign algorithm across the selection.

### Custom Fields
Beyond the built-in fields, organizations can define their own lead fields through the Settings → Custom Fields page. Each field gets a name, a machine-readable key, and a type (currently TEXT). Custom field values are stored per lead and appear on the lead detail page alongside the system fields. The import mapper recognizes custom fields, so imported files that contain columns matching custom field names will populate them automatically.

### Notes
Employees and managers can attach free-text notes to a lead — meeting summaries, call outcomes, research findings, anything worth recording. Notes are timestamped and attributed to the author. Multiple notes can exist on a single lead and they appear in chronological order on the lead detail page.

### Activity Timeline
Every interaction with a lead — status change, assignment, note added, email sent, call logged, WhatsApp message sent — is automatically recorded as an activity entry with a timestamp and the acting user's name. The timeline on the lead detail page gives a complete, chronological history of everything that has happened with that lead.

### AI Suggestions
Based on the lead's current status, last activity date, and history, the AI surfaces a suggested next action — for example "No contact in 5 days, consider a follow-up call" or "Lead opened your last email, good time to send a proposal." Suggestions appear on the lead detail page and can be dismissed once acted on.

### Unassigned Leads
A dedicated view shows all leads that have not been assigned to any employee yet. Managers can select some or all of them and assign them individually or run the smart-assign algorithm to distribute them across the available team.

---

## 3. Deal Management

### Deals & Pipeline
A deal represents a formal sales opportunity that has progressed beyond the initial lead stage — it has a value, a stage, and is being actively worked. Deals move through four stages: **NEW → NEGOTIATION → WON → LOST**. The pipeline board shows all deals as cards grouped by stage, giving managers a visual snapshot of where revenue is in the funnel at any moment.

Each deal stores the deal name, value (amount), the linked lead or client, the assigned employee, notes, and expected close date. Any user can create and update deals.

### Drag-and-Drop Stage Updates
On the pipeline board, deals can be dragged from one column to another to update their stage. This makes it fast to update deal progress without opening each record individually.

### Invoice Linking
A deal can have invoices attached to it. When a deal is won, the employee can create an invoice directly from the deal detail page — the client details are pre-filled from the deal. All invoices linked to a deal are listed on the deal page, making it easy to track the financial outcome of each opportunity.

---

## 4. Invoice & Billing

### Invoice Management _(Create: SUPER_ADMIN; View: SUPER_ADMIN, MANAGER)_
The billing module handles proforma invoices and tax invoices. An invoice contains full client details (name, email, phone, billing address, GSTIN), a list of line items with quantities and unit prices, applicable taxes (CGST, SGST, IGST), a subtotal, tax total, and grand total. Each invoice has a due date, optional notes, and payment terms. Invoices move through statuses: DRAFT → SENT → PARTIALLY_PAID → PAID (or CANCELLED).

### Payment Tracking
Payments against an invoice are recorded as individual entries — each with an amount, type (CREDIT/DEBIT), and date. This allows partial payments to be tracked accurately. The invoice status updates automatically as payments are added: once the total paid equals the invoice amount it becomes PAID; if partial it shows PARTIALLY_PAID.

### Email Invoices _(SUPER_ADMIN)_
Invoices can be emailed to the client directly from the invoice detail page. The system uses the company's configured SMTP settings and sends a formatted email. Send history is tracked.

### Balance Sheet & Reporting _(SUPER_ADMIN, MANAGER)_
A balance sheet view aggregates all invoices — total billed, total collected, outstanding balance — across a time period. Invoice statistics show trends in revenue collection.

### Company Settings for Invoicing _(SUPER_ADMIN)_
Before invoices can be sent, the admin configures the company's legal name, address, GSTIN, bank account number, IFSC code, branch name, default tax rate, and default payment terms. These details are automatically applied to every new invoice. SMTP server credentials (host, port, username, password) are also configured here for email sending.

---

## 5. Task & Project Management

### Tasks _(Create: SUPER_ADMIN, MANAGER)_
Tasks represent work items that need to be completed, either as standalone to-dos or linked to a specific lead (e.g. "Call back this lead on Thursday"). Each task has a title, description, due date, priority (CRITICAL / HIGH / MEDIUM / LOW), and type (EPIC / STORY / TASK / BUG / SUBTASK for agile workflows). Tasks can also carry story points and estimated / actual hours for sprint planning.

Tasks have two parallel status systems: a simple PENDING / COMPLETED status for everyday use, and a Kanban status (BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE → BLOCKED) for teams that work in sprints.

### Kanban Board
The Kanban board shows all tasks as cards arranged in columns by their Kanban status. Cards can be dragged between columns to update their status. This gives the team a shared view of what is being worked on, what is blocked, and what is done.

### Comments & Attachments
Any team member can leave a comment on a task — useful for questions, updates, or handoff notes. Files can also be attached to tasks for reference documents, screenshots, or supporting material.

### Sprint Management _(SUPER_ADMIN, MANAGER)_
Sprints are time-boxed work cycles. Managers create a sprint with a name and date range, add tasks to its backlog, then start the sprint. During the sprint, the team works through their tasks. When the sprint ends, completed vs. incomplete tasks are recorded. Sprint analytics track velocity (story points completed per sprint) and burn-down progress, helping the team calibrate their capacity over time.

---

## 6. Attendance Tracking

### Check-in / Check-out
Employees start their workday by checking in on the Attendance page. The server records the exact timestamp and, optionally, their location. At the end of the day they check out. These timestamps feed into the monthly attendance report.

When an employee checks in, their online status is automatically set to ONLINE. When they check out, it is set to OFFLINE.

### Attendance Statuses & Admin Overrides _(SUPER_ADMIN, MANAGER)_
Each day per employee can carry one of five statuses: PRESENT, ABSENT, LEAVE, HALF_DAY, or WFH. Managers can view the full team's attendance month by month and manually correct a status if needed (for example, marking someone as WFH when they forgot to check in remotely).

### Check-in Deadline Settings _(SUPER_ADMIN)_
The admin can configure what time counts as "on time" for each day of the week. Check-ins after the deadline can be flagged as late in the attendance report.

---

## 7. Leave Management

### Applying for Leave
Employees submit a leave request by choosing a leave type, specifying the start and end dates, and writing a reason. The system calculates the total number of working days automatically. The request sits in a PENDING state until a manager acts on it.

### Approving / Rejecting Leaves _(SUPER_ADMIN, MANAGER)_
Managers see a queue of pending leave requests. They can approve or reject each one, optionally adding a comment. When a leave is approved, the employee's attendance for those days is updated accordingly and their availability status is set to ON_LEAVE during that period, which the lead assignment algorithm respects — leaves aren't assigned to employees who are on leave.

---

## 8. Communication & Messaging

### WhatsApp Messaging
Employees can send WhatsApp messages to a lead directly from the lead detail page. The message is delivered via the Meta / WhatsApp Business API. Inbound replies from the lead appear in the same conversation thread. Message delivery statuses (SENT → DELIVERED → READ → REPLIED) are tracked in real time. A lead's WhatsApp opt-in status is stored so the team knows whether they can be messaged.

### WhatsApp Campaigns _(SUPER_ADMIN, MANAGER)_
Bulk WhatsApp campaigns let managers broadcast a message template to a large list of leads at once. A campaign is created with a chosen template and a recipient list, then started. The system sends messages progressively and tracks per-recipient statuses (sent, delivered, read, replied, failed). Campaigns can be paused and resumed. The campaign analytics page shows the aggregate delivery and engagement metrics.

### WhatsApp Auto-Replies _(SUPER_ADMIN, MANAGER)_
Auto-reply rules allow the system to respond to incoming WhatsApp messages automatically. Rules can be triggered by a keyword match in the incoming message or by a timeout — if a lead hasn't received a reply after a specified number of hours, the rule fires. Each rule specifies a template message to send (with parameter substitution). Rules can be toggled on/off without deleting them.

### Email Communication
Employees can send emails to leads from within the CRM. They can compose a message directly or choose from the shared library of email templates. The system tracks whether the recipient opened the email and whether they clicked any links, providing engagement signals that help prioritize follow-ups. All sent emails are logged on the lead's detail page.

Email templates are managed by SUPER_ADMIN and MANAGER roles — they can create, edit, and delete templates which are then available to the entire team.

### Internal Messaging (Chat)
The built-in chat system supports both group channels and one-to-one direct messages between team members. Within a conversation, messages can be replied to in threads, reacted to with emoji, edited, or soft-deleted. The online status dot on each user's avatar shows whether they are currently active. Channel members can be added or removed by the channel creator.

### Video Calling
Video calls are powered by LiveKit. A call can be started from within a chat conversation. The backend generates a secure LiveKit room token and the participant joins a full audio/video conference inside the app without needing any external tool.

---

## 9. Call Management

### Logging Calls
After a phone call with a lead, employees log it manually: call direction (inbound/outbound), duration, outcome/status, and date/time. The log entry appears in the lead's activity timeline. Call recording files (MP3, WAV, M4A, etc.) can be uploaded and attached to the log entry for future reference.

### AI Call Transcription & Analysis
Uploaded call recordings can be submitted for AI transcription. The AI returns the full transcript plus a structured analysis: a plain-English summary of what was discussed, the overall sentiment (positive/neutral/negative), the tone of the conversation, urgency level, emotional signals, call category, key conclusions, and feedback on the call quality. This analysis is stored with the call log and accessible from the lead detail page, helping managers review calls and coach employees without listening to every recording.

### Salestrail Integration
Salestrail is a mobile call-tracking app used by field sales teams. When a call is completed in Salestrail, the CRM receives a webhook with the call details — direction, duration, status, the agent's details, and (if available) a recording URL. These calls appear in a dedicated Salestrail call log with their own statistics view. This means all calls made on mobile are automatically captured in the CRM without any manual entry.

### Click-to-Call
From a lead's detail page, clicking the phone number initiates a call directly through the device's default calling app or a connected telephony system.

---

## 10. Search & Lead Discovery

### Google Search for Leads _(Import: SUPER_ADMIN, MANAGER)_
The Google Search feature lets managers find new business prospects without leaving the CRM. They enter a search query (e.g. "software companies in Chennai") and the system queries Serper's Google Search API, returning business listings with names, websites, phone numbers, and other details. The manager can select individual results and import them as new leads in one click.

### LinkedIn Lead Search _(Import: SUPER_ADMIN, MANAGER)_
Similar to Google Search but targeted at LinkedIn profiles and company pages. Search results show professional details — job titles, companies, LinkedIn URLs. Selected profiles can be imported as leads with LinkedIn URL pre-filled.

### Global Search
A search bar accessible from anywhere in the app searches across leads, deals, and tasks simultaneously, returning results from all three in a unified list. This is the fastest way to jump to any specific record without navigating through the module menus.

---

## 11. Automation & Workflows _(SUPER_ADMIN)_

### Automation Rules
Automation rules allow the CRM to take actions automatically when certain events happen — removing the need for manual follow-up on repetitive processes.

A rule has a **trigger** (the event that starts it) and a **condition set** (optional filters that must be true for the rule to fire):
- **LEAD_CREATED** — fires when a new lead is added
- **STATUS_CHANGED** — fires when a lead's status changes (e.g. to FOLLOW_UP)
- **NO_ACTIVITY** — fires when a lead has had no recorded activity for a specified number of days
- **LEAD_ASSIGNED** — fires when a lead is assigned to an employee

### Automation Actions
When a rule fires, it executes one or more actions in a defined order:
- **ASSIGN_LEAD** — automatically assigns the lead to a specific employee or uses the smart-assign algorithm
- **CHANGE_STATUS** — updates the lead's status to a specified value
- **CREATE_TASK** — creates a task linked to the lead (e.g. "Schedule a call") and assigns it to the responsible employee
- **CREATE_REMINDER** — sets a reminder for the assigned employee at a specified future time
- **SEND_NOTIFICATION** — fires an in-app notification to a user or role

Multiple actions can be chained in sequence, so a single rule can assign a lead, create a task, and send a notification all at once.

### Automation Logs
Every time a rule fires, the result is recorded: whether it succeeded, was skipped (because the conditions weren't met), or failed (with an error message). The logs page lets admins verify that rules are working as intended and diagnose any failures.

---

## 12. Reporting & Analytics

### Dashboard
The dashboard is the first page a user sees after logging in. For employees it shows their personal workload: overdue follow-ups that need immediate attention, upcoming tasks and reminders for today, recent activity on their leads, and an AI-generated daily digest that summarises what they should focus on. For managers and admins, the dashboard adds team-level KPI cards (total leads, today's activities, revenue metrics, invoice totals), a Deal Pipeline snapshot (count and total value by stage), SLA warning indicators, and team performance summaries.

### Lead Reports _(SUPER_ADMIN, MANAGER)_
Lead reports break down the lead funnel by source (which channels — Facebook, Instagram, website, referral, etc. — are generating the most leads), by employee (which team members are handling the most leads and converting at the highest rate), and by time period (monthly growth trends). A conversion funnel chart shows what percentage of leads move from each status to the next, surfacing where prospects are dropping off.

### Employee Reports _(SUPER_ADMIN, MANAGER)_
The employee report page gives a full picture of one team member's performance. It includes: current online status and lead load, KPI cards (leads assigned, converted, lost, pending), task completion rate, a breakdown of their communication activity (emails sent, calls logged, WhatsApp messages), their personal conversion funnel, revenue generated, invoice collection trends, and any manager notes written about them. This page is also accessible to the employee themselves so they can see their own metrics.

### Team Performance _(SUPER_ADMIN, MANAGER)_
The Team Performance page aggregates metrics across the entire team. It includes a workforce overview (active leads, pending follow-ups, average response time, average conversion time, aging leads), a lead distribution chart showing how leads are spread across employees, a workload analysis view, a workflow board showing leads grouped by status, revenue metrics broken down by employee / source / manager, and response time analytics. A Salestrail section shows call statistics from the mobile integration.

### Leaderboard
The leaderboard ranks all employees by three metrics: total leads handled, conversion rate, and revenue generated. It's visible to all users — not just managers — so employees can see how they compare to their teammates, which creates healthy competitive motivation.

### Deal Pipeline Snapshot (Dashboard)
On the manager/admin dashboard, a dedicated "Deal Pipeline" section shows a four-column summary of the current deal funnel — one card per stage (NEW, NEGOTIATION, WON, LOST) displaying the count of deals and their total combined value. A win rate chip shows the overall WON/(WON+LOST) ratio. Clicking any stage card navigates directly to the Deals page filtered to that stage.

---

## 13. Notifications & Reminders

### Reminders
Employees can set reminders linked to a specific lead, a task, or standalone (for anything not in the CRM). Each reminder fires at a chosen date and time, appearing in the user's notification feed and on their dashboard. Reminders that have been acted on can be dismissed. Optionally, reminders can be mirrored to Google Calendar so they appear alongside the user's existing calendar events.

### In-App Notifications
The notification bell in the top bar collects all system notifications for the logged-in user: new lead assignments, automation rule firings, task completions, leave approvals/rejections, and more. Unread notifications are highlighted. Clicking a notification navigates directly to the relevant record.

---

## 14. Admin & Settings

### Department Management _(SUPER_ADMIN)_
The admin can create named departments (e.g. Sales, Support, Pre-sales) and assign users to them. Departments help organise the team view and can be used as a filter in reports to compare performance across different parts of the organisation.

### Company Settings _(SUPER_ADMIN)_
The central settings page controls:
- **Company identity** — name, address, phone, email, GSTIN, bank details
- **Invoice defaults** — default tax rate, default payment terms and notes
- **Email / SMTP** — server host, port, credentials for sending invoices and automated emails
- **SLA thresholds** — how many hours before a lead without contact triggers a warning, and how many before it triggers a breach alert
- **AI assistant** — enable/disable the AI chat assistant, set a per-minute rate limit, configure how many conversation turns of history the AI remembers
- **Attendance deadlines** — the cut-off time for each day of the week that determines whether a check-in is on time

### Audit Logs
Every significant action in the system — user creation, lead deletion, invoice status change, permission change — is written to an immutable audit log with the acting user, timestamp, and details of what changed. This provides an accountability trail for compliance and internal review.

### Custom Fields Settings
The custom fields manager shows all fields available on a lead: the ten built-in system fields (Name, Phone, Email, Company, Source, Enquiry Type, Bio/Notes, Job Title, LinkedIn URL, Category) and any custom fields the organization has added. New fields can be created here with a display name, a machine key, and a type. Field order can be adjusted, which controls the order they appear on the lead detail page and in the import mapper.

---

## 15. Integrations

### Integration Hub _(Configuration: SUPER_ADMIN)_
The integrations page lists every third-party platform the CRM can connect to, with a status indicator (connected / disconnected / error) and a last-sync timestamp for each. Admins can connect or disconnect each integration without touching any code. Error messages from failed syncs are surfaced here so they can be diagnosed quickly.

### Supported Platforms
- **Facebook** — new lead form submissions automatically create leads in the CRM in real time via webhook
- **Instagram** — same as Facebook, for Instagram lead ads
- **Gmail** — email tracking and sending using the user's own Gmail account
- **Google Calendar** — reminder sync so CRM reminders appear in the user's calendar
- **Google Ads** — inbound webhook for leads from Google Ads campaigns
- **LinkedIn** — lead sync from LinkedIn Lead Gen Forms
- **Salestrail** — call data webhook from the Salestrail mobile app (described in Call Management)
- **WhatsApp / Meta** — inbound and outbound WhatsApp messaging via the Meta Business API
- **Custom Webhooks** — generic webhook endpoint for any other source

### Integration Logs
Every event received or sent via an integration is logged: connection events, sync start/complete/failure, webhook receipts, token refreshes, and auth failures. This log is the first place to look when an integration stops delivering leads.

---

## 16. AI Assistant & Intelligence

### AI Chat Assistant
An AI chat panel (powered by Claude) is accessible from within the CRM. Employees can ask it questions about their leads, get suggested email drafts, ask for advice on how to handle a particular situation, or request summaries. The assistant is context-aware — it knows it's operating inside a CRM and gives relevant, practical answers. The admin can configure the rate limit (requests per minute per user) and how many turns of conversation history the AI retains.

### AI Usage Analytics _(SUPER_ADMIN, MANAGER)_
The admin can see a breakdown of how the AI assistant is being used across the team: which users are using it most, how many requests per day, token consumption, success vs. error rates, and average response latency. This helps manage costs and understand where the AI is adding the most value.

### AI Lead Suggestions
On each lead's detail page, the AI analyses the lead's activity history and current status and surfaces a concrete suggested next action. For example, if a lead was last contacted six days ago and their status is FOLLOW_UP, the AI might suggest sending a check-in message. Suggestions can be dismissed once acted on.

### AI Daily Digest
Each morning the dashboard displays an AI-generated digest personalised to the logged-in user. It summarises overdue follow-ups, flags the highest-priority leads, lists tasks due today, and highlights any unusual patterns — such as a lead that has gone cold after several positive interactions. The digest replaces the need to manually scan through leads and tasks to build a work plan.

---

## 17. Workforce & Performance Intelligence

### Employee Performance Profile
Each employee has a computed performance profile that the system maintains automatically. It includes:
- **Performance score** — a composite 0–100 score made up of four sub-scores: lead effectiveness (conversion rate), response quality (how quickly they respond to new leads), follow-up discipline (how consistently they follow up on time), and attendance reliability
- **Current lead load** — how many active leads they currently hold vs. their daily capacity
- **Response speed** — average time from lead assignment to first contact
- **Lead acceptance toggle** — employees can pause new lead assignments when they are at capacity or unavailable

This profile is used by the smart-assign algorithm when distributing leads, and is visible to managers on the Employee Report page.

### Manager Notes _(SUPER_ADMIN, MANAGER)_
Managers can write private notes about an employee — observations from a 1-on-1, performance feedback, coaching points. Notes are attributed to the author and timestamped. They are visible on the Employee Report page to other managers and admins but not to the employee themselves.

### Commission Tracking
When a lead is converted, a commission amount can be recorded against the responsible employee. The system stores one commission record per user per lead. Commission data feeds into the revenue analytics and can be used to calculate payouts.

---

## 18. Role-Based Access Control

The system enforces three role levels. Each role has a specific scope of access:

| Role | Access Level |
|------|-------------|
| **SUPER_ADMIN** | Full access to everything — all leads, all settings, all reports, user management, company configuration, billing |
| **ADMIN** | Full team visibility — can see all team leads, run reports, assign and import leads, create tasks, approve leaves, manage templates and automation |
| **EMPLOYEE** | Can see and work only their own assigned leads, log activities, send messages, and view their own reports |

Access is enforced at every API endpoint (server-side) and reflected in the UI — restricted buttons and pages are hidden or disabled for roles that don't have permission.

---

_Last updated: 2026-06-13_
