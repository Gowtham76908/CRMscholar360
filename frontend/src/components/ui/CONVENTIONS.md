# DCRM UI Conventions

Design direction: **Calm Operational** — inspired by Linear, Attio, Stripe, Vercel.
No decorative flourishes. Every element earns its place.

---

## Spacing

| Token | Value | Use |
|---|---|---|
| `p-4` | 16px | Card inner padding |
| `p-6` | 24px | Page section padding |
| `gap-2` | 8px | Between icon and label, between tight controls |
| `gap-4` | 16px | Between form fields |
| `gap-6` | 24px | Between sections on a page |
| `space-y-4` | 16px | Vertical stack inside cards |
| `space-y-6` | 24px | Vertical stack between sections |

Sidebar width: **256px** (`w-64`). Right sidebar in split-pane: **320px** (`w-80`).

---

## Button

```jsx
import Button from "@/components/ui/Button";

<Button variant="primary" size="md">Save</Button>
<Button variant="secondary" size="md">Cancel</Button>
<Button variant="danger" size="md" loading={isPending}>Delete</Button>
<Button variant="ghost" size="sm"><Plus className="h-4 w-4" /></Button>
<Button variant="outline" size="sm">Export</Button>
```

| Variant | When to use |
|---|---|
| `primary` | The single most important action on a screen or form |
| `secondary` | Secondary action (Cancel next to a primary) |
| `ghost` | Icon-only buttons, toolbar actions, low-emphasis actions |
| `danger` | Destructive confirmation (inside a Dialog) |
| `outline` | Neutral standalone actions (Export, Filter) |

| Size | When to use |
|---|---|
| `sm` | Inside table rows, compact toolbars, inline actions |
| `md` | Default — forms, dialogs, cards |
| `lg` | Page-level primary actions (hero CTAs) |
| `icon` | Single-icon button with no label (`h-9 w-9`) |

**Rules:**
- Never more than one `primary` button visible at a time per view area.
- Destructive actions go inside a `Dialog` — never a bare `primary` button.
- `loading` prop shows Loader2 spinner and disables automatically.

---

## Badge

```jsx
import Badge from "@/components/ui/Badge";

<Badge variant="success">Converted</Badge>
<Badge variant="warning" size="sm">Pending</Badge>
<Badge variant="ai">AI Scored</Badge>
```

| Variant | Use case |
|---|---|
| `default` | Unknown / neutral status |
| `hot` | Lead score ≥ 61 or high-urgency items |
| `warm` | Lead score 31–60 |
| `cold` | Lead score < 31 |
| `success` | Completed, Converted, Active |
| `warning` | Pending, In Progress, Needs Review |
| `error` | Failed, Overdue, Rejected |
| `info` | Informational, New |
| `ai` | AI-generated content, AI suggestions |
| `indigo` | Primary status labels when indigo fits context |
| `purple` | Premium tier, special flags |
| `orange` | Campaign-related, Broadcast |
| `teal` | Integration status, synced |

**Rules:**
- Never use raw `span` with color classes in new code — always use `Badge`.
- Size `sm` for table cells and compact layouts, `md` (default) everywhere else.

---

## Dialog (Confirmation)

Replaces `window.confirm()`. Never use native browser dialogs.

```jsx
import Dialog from "@/components/ui/Dialog";

// State
const [confirmDelete, setConfirmDelete] = useState(null);

// Trigger (e.g., in a table action)
<Button variant="ghost" size="sm" onClick={() => setConfirmDelete(item)}>Delete</Button>

// Render at bottom of component return
<Dialog
  open={!!confirmDelete}
  title={`Delete "${confirmDelete?.name}"?`}
  description="This action cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  loading={deleteMut.isPending}
  onConfirm={() => { deleteMut.mutate(confirmDelete.id); setConfirmDelete(null); }}
  onCancel={() => setConfirmDelete(null)}
/>
```

| Variant | Icon | When |
|---|---|---|
| `danger` | AlertTriangle red | Delete, remove, revoke |
| `warning` | AlertTriangle amber | Non-destructive but irreversible actions |
| `info` | Info indigo | Confirmations with no risk |
| `success` | CheckCircle emerald | Confirming a positive action |

**Rules:**
- Always place the `<Dialog>` at the bottom of the JSX return, outside the main content tree.
- State variable holds the target object (not just a boolean), so the title can reference it.
- ESC and backdrop-click both cancel — this is built in.

---

## Sheet (Slide-over)

Replaces centered modals for forms, detail panels, and multi-step flows.

```jsx
import Sheet from "@/components/ui/Sheet";

<Sheet open={open} onClose={() => setOpen(false)} title="New Lead" size="md">
  <Sheet.Body>
    {/* form fields */}
  </Sheet.Body>
  <Sheet.Footer>
    <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="primary" loading={isPending} onClick={handleSubmit}>Save</Button>
  </Sheet.Footer>
</Sheet>
```

| Size | Max-width | When |
|---|---|---|
| `sm` | 448px | Simple single-field forms |
| `md` | 512px | Standard forms (default) |
| `lg` | 672px | Multi-section forms, lead edit |
| `xl` | 768px | Complex multi-step wizards |
| `full` | 100% | Full-screen detail views |

**Rules:**
- Use `Sheet` for any form that takes more than 2 fields.
- Keep `Sheet.Footer` for action buttons — never put buttons inside `Sheet.Body`.
- ESC and backdrop-click close the sheet — built in.

---

## Toast

Replaces `alert()`. Never use native browser alerts.

```js
import { toast } from "sonner";

toast.success("Lead created");
toast.error("Failed to save changes");
toast.warning("No phone number on record");
toast("Sending...");                    // neutral
```

**Rules:**
- `success` — mutation completed successfully.
- `error` — API/network failure. Always include the error message from the response where possible.
- `warning` — user tried an action that can't proceed due to missing data (e.g., no phone number).
- Neutral `toast()` — in-progress indication only when loading state on a button isn't visible.
- Never use `toast.error` for validation — show inline field errors instead.
- Duration: 4000ms (set globally in `AppLayout`). Do not override per-call unless critical.

---

## Loading Patterns

Three patterns, each with a specific scope:

| Pattern | Component | When |
|---|---|---|
| **Skeleton** | `<LeadsSkeleton />`, `<LeadDetailSkeleton />`, `<DashboardSkeleton />` | Full-page initial load |
| **Button spinner** | `<Button loading={isPending}>` | Inline mutation in progress |
| **Inline spinner** | `<Loader2 className="h-4 w-4 animate-spin" />` | Small async areas (loading reminders, etc.) |

**Rules:**
- Never use a full-page spinner (`flex items-center justify-center h-64`) — use a Skeleton.
- Never use a Skeleton for a mutation (save, delete) — use `Button loading`.
- Add new Skeleton variants to `Skeleton.jsx` — do not inline shimmer patterns elsewhere.

---

## AI Card Patterns

AI-generated content (suggestions, score explanations, auto-replies) uses consistent visual treatment.

```jsx
// AI card container
<div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
  <div className="flex items-center gap-2 mb-2">
    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
    <span className="text-xs font-semibold text-violet-700 uppercase tracking-widest">AI Insight</span>
  </div>
  <p className="text-sm text-gray-700">{insight}</p>
</div>
```

| Use case | Accent color |
|---|---|
| Lead score explanation | `violet` |
| Smart follow-up suggestions | `violet` |
| Auto-generated reply preview | `violet` |
| Campaign AI summary | `indigo` |

**Badge variant for AI content:** always `ai` (`bg-violet-100 text-violet-700`).

**Rules:**
- AI content must be visually distinguishable from user-generated content at a glance.
- Always include a `Sparkles` icon from lucide-react as the AI signal.
- Never mix AI cards with regular content cards — group them together.

---

## Sidebar Navigation

Groups and visual hierarchy:

```
WORKSPACE
  Dashboard
  Leads
  Kanban Board

ACTIVITY
  Tasks
  Sprints
  Messages
  Attendance
  Leave

INTELLIGENCE
  Reports
  Leaderboard
  Automations

COMMUNICATION
  WA Campaigns
  WA Auto Reply

ADMIN
  Team
  Departments
  Integrations
  Settings
  Invoices & Billing
  Salestrail Calls
  LinkedIn Leads
  Search Leads
```

Group labels: `text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 mb-1`.

Active state: `bg-indigo-50 text-indigo-700` with `text-indigo-600` icon.
Inactive: `text-gray-600 hover:bg-gray-50 hover:text-gray-900`.

---

## Card Anatomy

Standard content card:

```jsx
<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
    Section Title
  </h3>
  {/* content */}
</div>
```

- Background: always `bg-white` for cards on gray page backgrounds.
- Border: `border border-gray-200`.
- Radius: `rounded-xl` for cards, `rounded-lg` for inputs and inner elements.
- Shadow: `shadow-sm` only (never `shadow-md` or higher in regular UI).
- Section headers inside cards: `text-xs font-semibold text-gray-400 uppercase tracking-widest`.

---

## Color Palette

| Role | Tailwind | Hex |
|---|---|---|
| Brand / Primary | `indigo-600` | #4F46E5 |
| Danger | `red-600` | #DC2626 |
| Warning | `amber-500` | #F59E0B |
| Success | `emerald-600` | #059669 |
| AI / Special | `violet-600` | #7C3AED |
| Text primary | `gray-900` | #111827 |
| Text secondary | `gray-500` | #6B7280 |
| Text muted | `gray-400` | #9CA3AF |
| Page background | `gray-50` | #F9FAFB |
| Card background | `white` | #FFFFFF |
| Border default | `gray-200` | #E5E7EB |
| Border subtle | `gray-100` | #F3F4F6 |

---

## Typography

| Role | Classes |
|---|---|
| Page title | `text-2xl font-bold text-gray-900 tracking-tight` |
| Section title | `text-lg font-semibold text-gray-900` |
| Card sub-heading | `text-xs font-semibold text-gray-400 uppercase tracking-widest` |
| Body text | `text-sm text-gray-700` |
| Caption / meta | `text-xs text-gray-500` |
| Micro / timestamp | `text-[10px] text-gray-400` |

---

## Do / Don't

| Do | Don't |
|---|---|
| Use `Button` component | Raw `<button>` with inline Tailwind in new files |
| Use `Badge` for status labels | Raw `<span className="px-2 rounded-full ...">` |
| Use `Dialog` for confirmations | `window.confirm()` |
| Use `Sheet` for forms | Centered modals with fixed positioning |
| Use `toast` for feedback | `alert()` |
| Use `Skeleton` for page load | Full-page spinner |
| Put action buttons in `Sheet.Footer` | Mix buttons into form body |
| Group related fields with `space-y-4` | Arbitrary margin overrides |
