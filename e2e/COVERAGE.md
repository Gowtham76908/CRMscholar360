# E2E Coverage Report

**Suite status:** ✅ 89 / 89 passing (default, non-mutating) across `chromium` + `mobile`.
**Mutating CRUD:** 2 specs, opt-in (`@mutating`), excluded by default for shared-DB safety.
**Generated for:** Scholar360 CRM — 4 roles (SUPER_ADMIN, ADMIN, TEAM_LEADER, EMPLOYEE), ~50 routes.

---

## ✅ Covered

### Authentication (`tests/auth`)
- Login form renders; heading + fields present.
- **Valid login for all 4 roles** → lands on `/dashboard`.
- Negative: wrong password → server error banner; unknown email → error.
- Validation: malformed email blocked (native + zod); short password → zod message.
- Password show/hide toggle.
- Forgot-password link navigation.
- **Unauthenticated access** to 6 protected routes → redirect to `/login`.
- **Logout** via profile menu → `/login`; back-nav to protected route bounces.
- **Session expiration**: API `401` → `auth:logout` → redirect; direct-event teardown.

### Authorization / RBAC (`tests/rbac`)
- Per-role nav visibility: managers see **Analytics** mode; EMPLOYEE does not.
- All roles see CRM + Workload modes.

### Navigation (`tests/navigation`)
- **Smoke over 34 static routes** (SUPER_ADMIN): no auth bounce, no ErrorBoundary
  crash, no false 404, no uncaught exceptions.
- 404 page renders for unknown authed routes + offers a way back.
- Broken-link scan: no `href="#"`/empty anchors; dashboard internal links resolve.
- Console-error budget on core pages (known React dev warnings annotated, not gating).

### Dashboard (`tests/dashboard`)
- Per-role dashboard loads without crash, `<main>` present.

### Leads (`tests/leads`)
- List renders rows; **search** updates URL query + resets to page 1.
- **Empty state** on nonsense search.
- **Pagination** via Next control (skips if single page).
- Search-Leads tab active state via URL.
- **CRUD (@mutating, opt-in):** create via API → verify in UI search + detail;
  required-field validation returns `400`; self-cleans via Prisma.

### Cross-cutting (`tests/cross-cutting`)
- **Mobile viewport** (Pixel 7): bottom nav shown, desktop rail hidden, no
  horizontal overflow, mobile nav navigates.
- **Accessibility basics**: document title, single `main` landmark, images have
  `alt`, buttons have an accessible name/icon.
- **Loading state**: slow leads request shows skeleton.
- **Network failure**: 500 / offline degrade gracefully (no crash).

---

## ⚠️ Partially covered / thin

- **CRUD depth**: only Leads create is exercised (via API). Update/delete and the
  multi-step Add-Lead *form wizard* (phone widgets) are not yet driven through the UI.
- **Filters**: only search + tab; the advanced filter panel (source/category/SLA/
  date/department) is not asserted.
- **Toast notifications**: `sonner` toasts are configured but not explicitly asserted
  (blocked by mutating actions being off by default).
- **RBAC** verifies nav gating; it does **not** yet assert per-route API `403`s or
  that manager-only *actions* (merge, import, invoices) are hidden for EMPLOYEE.

---

## ❌ Not yet covered (backlog)

| Area | Why deferred |
|------|--------------|
| Deals / Deal pipeline drag-drop, Kanban DnD | `@dnd-kit` drag interactions |
| Tasks / Sprints CRUD, TaskDetail | mutating; needs disposable DB |
| Invoices & Billing create/payment flow | mutating + financial data |
| Attendance / Leave apply–approve workflow | mutating, multi-role handoff |
| WhatsApp campaigns, Automations, Inbox/Messages | realtime (socket.io/LiveKit) |
| Integrations / Google OAuth | external 3rd-party auth |
| File **upload** (lead import xlsx) / **download/export** | fixture files + mutating |
| Department queue/board/staffing workflows | mutating, complex state machine |
| Reports / RevenueReport / EmployeeReport charts | data assertions on `recharts` |
| Forgot/Reset password end-to-end (email token) | requires SMTP capture |
| Cross-browser (firefox/webkit) | only chromium + mobile-chrome configured |

---

## How to extend

1. Add a page object under `e2e/pages/` for the screen.
2. Put mutating flows behind the `@mutating` tag and clean up in `afterAll`.
3. For new roles/permissions, extend `fixtures/roles.js` and the RBAC specs.
4. Enable firefox/webkit by adding projects in `playwright.config.js`.
