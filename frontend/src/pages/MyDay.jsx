import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";
import {
    CheckCircle, Circle, Bell, Phone, MessageSquare, X,
    ClipboardList, Calendar, Search, ChevronDown, Check, Users, Loader2,
    Building2, GraduationCap, FileCheck, Landmark, Home, Banknote, Briefcase,
    UserCircle2, History, ArrowRight, Plus, Hash,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import {
    DEPARTMENT_ORDER, DEPARTMENT_LABELS, departmentLabel,
    departmentStyle, humanizeStage,
} from "../lib/departments";
import { actionConfig, relTime } from "../lib/activity";
import CountUp from "../components/ui/CountUp";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dueSoonLabel = (date) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 0) return { label: "Overdue", variant: "error" };
    if (hrs < 24) return { label: "Due today", variant: "warning" };
    if (hrs < 48) return { label: "Due tomorrow", variant: "warning" };
    return null;
};

// Per-department logo (icon) for the chip.
const DEPT_ICON = {
    SALES: GraduationCap,
    APPLICATION_VISA: FileCheck,
    LOAN: Landmark,
    ACCOMMODATION_TICKETS: Home,
    FOREX: Banknote,
    MISCELLANEOUS: Briefcase,
};

// Pick the department service to surface on a card. Prefers one matching the
// active department filter, else the first.
const pickDept = (leadDepartments = [], preferDept) =>
    (preferDept && leadDepartments.find(d => d.department === preferDept)) ||
    leadDepartments[0] ||
    null;

// ─── Shared: student identity + tags (used by all three trays) ──────────────────

function LeadIdentity({ lead, preferDept }) {
    if (!lead) return null;
    const dept = pickDept(lead.leadDepartments, preferDept);
    const consultant = dept?.assignedEmployee?.name;
    const DeptIcon = dept ? (DEPT_ICON[dept.department] || Briefcase) : null;
    return (
        <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
                <span className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-indigo-700">
                    {lead.name?.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-gray-900 truncate">{lead.name}</span>
                {lead.leadId && (
                    <span
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 shrink-0 text-[10px] font-mono font-bold uppercase tracking-tight text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md pl-1 pr-1.5 py-0.5 select-all"
                    >
                        <Hash className="h-2.5 w-2.5 text-indigo-400" />
                        {lead.leadId}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {lead.phone && (
                    <span className="inline-flex items-center gap-1 truncate">
                        <Phone className="h-3 w-3 text-gray-400" /> {lead.phone}
                    </span>
                )}
                {consultant && (
                    <span className="inline-flex items-center gap-1 truncate">
                        <UserCircle2 className="h-3 w-3 text-gray-400" /> {consultant}
                    </span>
                )}
            </div>
            {dept && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                        departmentStyle(dept.department)
                    )}>
                        {DeptIcon && <DeptIcon className="h-3 w-3" />}
                        {departmentLabel(dept.department)}
                    </span>
                    {dept.stage && (
                        <Badge variant="indigo" size="sm">{humanizeStage(dept.stage)}</Badge>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Action Queue Item ────────────────────────────────────────────────────────

function ActionItem({ lead, snoozed, onSnooze, preferDept }) {
    const navigate = useNavigate();
    const [showHistory, setShowHistory] = useState(false);
    const due = dueSoonLabel(lead.nextFollowUpAt ?? lead.updatedAt);
    const history = lead.activities || [];
    if (snoozed) return null;
    return (
        <div className={cn(
            "group rounded-xl bg-white ring-1 border-l-[3px] transition-all duration-200",
            "shadow-[0_1px_2px_rgb(0,0,0,0.04)] hover:shadow-[0_4px_16px_-6px_rgb(0,0,0,0.15)]",
            due?.variant === "error"
                ? "ring-red-100 border-l-red-400 hover:ring-red-200"
                : "ring-slate-200/70 border-l-indigo-500 hover:ring-indigo-200"
        )}>
            <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                <div className="flex-1 min-w-0">
                    <LeadIdentity lead={lead} preferDept={preferDept} />
                </div>
                {due && <Badge variant={due.variant} size="sm">{due.label}</Badge>}
            </div>
            <div className="hidden group-hover:flex items-center gap-1.5 px-3 pb-2.5">
                {lead.phone && (
                    <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-colors shadow-sm">
                        <Phone className="h-3 w-3" /> Call
                    </a>
                )}
                <button onClick={e => { e.stopPropagation(); navigate(`/leads/${lead.id}?wa=1`); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors shadow-sm">
                    <MessageSquare className="h-3 w-3" /> WhatsApp
                </button>
                <button onClick={e => { e.stopPropagation(); onSnooze(lead.id); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors shadow-sm ml-auto">
                    <X className="h-3 w-3" /> Snooze 1h
                </button>
            </div>

            {/* Recent history */}
            <div className="border-t border-gray-100 px-3 py-2">
                <button
                    onClick={e => { e.stopPropagation(); setShowHistory(s => !s); }}
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
                >
                    <span className="inline-flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        Recent history
                    </span>
                    {history.length > 0 && (
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-180")} />
                    )}
                </button>

                {/* Latest line (collapsed preview) */}
                {!showHistory && history[0] && (
                    <p className="mt-1.5 text-[11px] text-gray-500 truncate">
                        <span className="mr-1">{actionConfig(history[0].action).icon}</span>
                        {actionConfig(history[0].action).label}
                        <span className="text-gray-400"> · {relTime(history[0].createdAt)}</span>
                    </p>
                )}

                {/* Expanded list */}
                {showHistory && (
                    history.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                            {history.map(a => {
                                const cfg = actionConfig(a.action);
                                return (
                                    <li key={a.id} className="flex items-start gap-2 text-[11px]">
                                        <span className="shrink-0">{cfg.icon}</span>
                                        <span className="flex-1 min-w-0 text-gray-600">
                                            {cfg.label}
                                            {a.user?.name && <span className="text-gray-400"> by {a.user.name}</span>}
                                        </span>
                                        <span className="shrink-0 text-gray-400">{relTime(a.createdAt)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="mt-2 text-[11px] text-gray-400">No history yet</p>
                    )
                )}

                <button
                    onClick={e => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                    View full history <ArrowRight className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}

// ─── Comment & Close box ────────────────────────────────────────────────────────
// Inline composer shown when closing a task / lead reminder from a tray. The
// comment is posted to the lead's activity before the item is resolved, so it
// stays visible on the Lead Detail timeline after it disappears from My Day.

function CommentBox({ value, onChange, onSubmit, onCancel, pending, hint, scheduleAt, onScheduleChange, canSchedule, requireSchedule }) {
    const scheduleMissing = requireSchedule && canSchedule && !scheduleAt;
    return (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
            <textarea
                autoFocus
                rows={2}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(); }}
                placeholder="Add a comment before closing…"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 resize-none"
            />
            {canSchedule && (
                <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase mb-1">
                        <Calendar className="h-3 w-3" /> Schedule next call{" "}
                        {requireSchedule
                            ? <span className="text-red-500 font-bold normal-case">(required)</span>
                            : <span className="text-gray-400 font-medium normal-case">(optional)</span>}
                    </label>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={e => onScheduleChange(e.target.value)}
                            className={cn(
                                "flex-1 px-2.5 py-1.5 text-xs border rounded-lg outline-none bg-white focus:ring-2",
                                scheduleMissing
                                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                                    : "border-gray-200 focus:border-indigo-400 focus:ring-indigo-100"
                            )}
                        />
                        {scheduleAt && !requireSchedule && (
                            <button type="button" onClick={() => onScheduleChange("")}
                                title="Clear scheduled call"
                                className="shrink-0 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {scheduleMissing && (
                        <p className="mt-1 text-[10px] font-medium text-red-500">Pick a date &amp; time for the next call to close this task.</p>
                    )}
                </div>
            )}
            {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
            <div className="flex justify-end gap-1.5">
                <button type="button" onClick={onCancel}
                    className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 rounded-md transition-colors">
                    Cancel
                </button>
                <button type="button" onClick={onSubmit} disabled={pending || !value.trim() || scheduleMissing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-md shadow-xs disabled:opacity-50 transition-colors">
                    {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {scheduleAt ? "Comment, Schedule & Close" : "Comment & Close"}
                </button>
            </div>
        </div>
    );
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({ task, onComplete, completing, preferDept }) {
    const navigate = useNavigate();
    const [commenting, setCommenting] = useState(false);
    const [comment, setComment] = useState("");
    const [scheduleAt, setScheduleAt] = useState("");

    const submit = () => {
        if (!comment.trim()) { toast.warning("Please add a comment before closing"); return; }
        if (task.lead && !scheduleAt) { toast.warning("Please schedule the next call before closing"); return; }
        onComplete({ id: task.id, leadId: task.lead?.id ?? null, comment: comment.trim(), nextCallAt: scheduleAt || null });
    };

    return (
        <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200/70 border-l-[3px] border-l-amber-500 shadow-[0_1px_2px_rgb(0,0,0,0.04)] hover:shadow-[0_4px_16px_-6px_rgb(0,0,0,0.15)] hover:ring-amber-200 transition-all duration-200 group cursor-pointer"
            onClick={() => navigate(task.lead?.id ? `/leads/${task.lead.id}` : `/tasks/${task.id}`)}>
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{task.title}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2.5">
                    {task.dueDate && (
                        <span className="text-[11px] text-gray-400">
                            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setCommenting(c => !c); }}
                        className={cn(
                            "p-1 rounded-md transition-colors",
                            commenting ? "text-emerald-600 bg-emerald-50" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                        )}
                        title="Add comment & close">
                        <Check className="h-4 w-4" />
                    </button>
                </div>
            </div>
            {task.lead && (
                <div className="mt-2 pl-0">
                    <LeadIdentity lead={task.lead} preferDept={preferDept} />
                </div>
            )}
            {commenting && (
                <CommentBox
                    value={comment}
                    onChange={setComment}
                    onSubmit={submit}
                    onCancel={() => { setCommenting(false); setComment(""); setScheduleAt(""); }}
                    pending={completing}
                    scheduleAt={scheduleAt}
                    onScheduleChange={setScheduleAt}
                    canSchedule={!!task.lead}
                    requireSchedule={!!task.lead}
                    hint={task.lead ? "Saved to the lead's activity, then the task is closed." : "Saved as a task comment, then the task is closed."}
                />
            )}
        </div>
    );
}

// ─── Reminder Item ────────────────────────────────────────────────────────────

function ReminderItem({ reminder, preferDept, onClear, clearing }) {
    const d = new Date(reminder.remindAt);
    const isToday = d.toDateString() === new Date().toDateString();
    const [commenting, setCommenting] = useState(false);
    const [comment, setComment] = useState("");
    const [scheduleAt, setScheduleAt] = useState("");
    const leadId = reminder.leadId ?? reminder.lead?.id ?? null;

    const submit = () => {
        if (!comment.trim()) { toast.warning("Please add a comment before closing"); return; }
        onClear({ id: reminder.id, leadId, comment: comment.trim(), nextCallAt: scheduleAt || null });
    };

    return (
        <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200/70 border-l-[3px] border-l-violet-500 shadow-[0_1px_2px_rgb(0,0,0,0.04)] hover:shadow-[0_4px_16px_-6px_rgb(0,0,0,0.15)] hover:ring-violet-200 transition-all duration-200">
            <div className="flex items-start gap-3">
                <Bell className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                <p className="flex-1 min-w-0 text-sm text-gray-800 font-medium truncate">{reminder.message}</p>
                <span className="text-[11px] font-semibold text-violet-600 shrink-0">
                    {isToday
                        ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                        : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
                <button
                    onClick={e => { e.stopPropagation(); setCommenting(c => !c); }}
                    disabled={clearing}
                    title="Add comment & close"
                    className={cn(
                        "shrink-0 -mt-0.5 -mr-0.5 p-1 rounded-md transition-colors disabled:opacity-50",
                        commenting ? "text-emerald-600 bg-emerald-50" : "text-violet-400 hover:text-emerald-600 hover:bg-emerald-50"
                    )}
                >
                    <Check className="h-3.5 w-3.5" />
                </button>
            </div>
            {reminder.lead && (
                <Link to={`/leads/${reminder.lead.id}`} onClick={e => e.stopPropagation()} className="mt-2 pl-6 block">
                    <LeadIdentity lead={reminder.lead} preferDept={preferDept} />
                </Link>
            )}
            {commenting && (
                <CommentBox
                    value={comment}
                    onChange={setComment}
                    onSubmit={submit}
                    onCancel={() => { setCommenting(false); setComment(""); setScheduleAt(""); }}
                    pending={clearing}
                    scheduleAt={scheduleAt}
                    onScheduleChange={setScheduleAt}
                    canSchedule={!!leadId}
                    hint="Saved to the lead's activity, then the reminder is closed."
                />
            )}
        </div>
    );
}

// ─── Consultant Filter (searchable dropdown) ───────────────────────────────────

function ConsultantFilter({ consultants, selected, onSelect }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const filtered = consultants.filter(c =>
        c.name?.toLowerCase().includes(query.trim().toLowerCase())
    );

    const choose = (c) => { onSelect(c); setOpen(false); setQuery(""); };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "inline-flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-xl border bg-white text-sm font-semibold transition-colors shadow-sm",
                    selected
                        ? "border-indigo-200 text-indigo-700"
                        : "border-gray-200/70 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                )}
            >
                <Users className="h-4 w-4 text-indigo-500" />
                <span className="max-w-[10rem] truncate">{selected ? selected.name : "All Consultants"}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200/70 bg-white shadow-lg shadow-gray-200/50 z-30 overflow-hidden">
                    {/* Search box */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search consultant…"
                                className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none placeholder:text-gray-400"
                            />
                        </div>
                    </div>
                    {/* Options */}
                    <div className="max-h-64 overflow-y-auto p-1">
                        <button
                            onClick={() => choose(null)}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                            <span className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                <Users className="h-3.5 w-3.5 text-gray-500" />
                            </span>
                            <span className="flex-1 text-left font-semibold text-gray-700">All Consultants</span>
                            {!selected && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                        </button>
                        {filtered.map(c => (
                            <button
                                key={c.id}
                                onClick={() => choose(c)}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                            >
                                <span className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-700">
                                    {c.name?.charAt(0).toUpperCase()}
                                </span>
                                <span className="flex-1 text-left min-w-0">
                                    <span className="block font-semibold text-gray-800 truncate">{c.name}</span>
                                    {c.role && <span className="block text-[10px] text-gray-400 truncate">{c.role.replace(/_/g, " ")}</span>}
                                </span>
                                {selected?.id === c.id && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-6">No consultants found</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Department Filter ──────────────────────────────────────────────────────────

function DepartmentFilter({ selected, onSelect }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "inline-flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-xl border bg-white text-sm font-semibold transition-colors shadow-sm",
                    selected
                        ? "border-indigo-200 text-indigo-700"
                        : "border-gray-200/70 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                )}
            >
                <Building2 className="h-4 w-4 text-indigo-500" />
                <span className="max-w-[10rem] truncate">{selected ? departmentLabel(selected) : "All Departments"}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200/70 bg-white shadow-lg shadow-gray-200/50 z-30 overflow-hidden p-1">
                    <button
                        onClick={() => { onSelect(null); setOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="flex-1 text-left font-semibold text-gray-700">All Departments</span>
                        {!selected && <Check className="h-4 w-4 text-indigo-600" />}
                    </button>
                    {DEPARTMENT_ORDER.map(code => {
                        const Icon = DEPT_ICON[code] || Briefcase;
                        return (
                            <button
                                key={code}
                                onClick={() => { onSelect(code); setOpen(false); }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                            >
                                <Icon className="h-4 w-4 text-indigo-500" />
                                <span className="flex-1 text-left font-semibold text-gray-800 truncate">{DEPARTMENT_LABELS[code]}</span>
                                {selected === code && <Check className="h-4 w-4 text-indigo-600" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Date Range Filter ──────────────────────────────────────────────────────────

const RANGE_MODES = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
];

// Returns [start, end] Date bounds for the active range, or null when "all".
const rangeBounds = (range) => {
    if (!range || range.mode === "all") return null;
    const now = new Date();
    if (range.mode === "today") {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        return [start, end];
    }
    if (range.mode === "week") {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999);
        return [start, end];
    }
    if (range.mode === "custom" && range.from && range.to) {
        const start = new Date(range.from); start.setHours(0, 0, 0, 0);
        const end = new Date(range.to); end.setHours(23, 59, 59, 999);
        return [start, end];
    }
    return null;
};

const inRange = (date, range) => {
    const bounds = rangeBounds(range);
    if (!bounds) return true;
    if (!date) return false;
    const t = new Date(date).getTime();
    return t >= bounds[0].getTime() && t <= bounds[1].getTime();
};

function DateRangeFilter({ range, onChange }) {
    return (
        <div className="inline-flex items-center gap-1 h-9 px-1 rounded-xl border border-gray-200/70 bg-white shadow-sm">
            <Calendar className="h-4 w-4 text-indigo-500 ml-1.5" />
            {RANGE_MODES.map(m => (
                <button
                    key={m.key}
                    onClick={() => onChange({ mode: m.key })}
                    className={cn(
                        "px-2.5 h-7 rounded-lg text-xs font-semibold transition-colors",
                        range.mode === m.key
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                    )}
                >
                    {m.label}
                </button>
            ))}
            <input
                type="date"
                value={range.mode === "custom" ? (range.from || "") : ""}
                onChange={e => onChange({ mode: "custom", from: e.target.value, to: range.to || e.target.value })}
                className="h-7 px-1.5 rounded-lg text-xs text-gray-600 border border-transparent hover:border-gray-200 outline-none"
                title="From"
            />
            <span className="text-gray-300 text-xs">–</span>
            <input
                type="date"
                value={range.mode === "custom" ? (range.to || "") : ""}
                onChange={e => onChange({ mode: "custom", from: range.from || e.target.value, to: e.target.value })}
                className="h-7 px-1.5 rounded-lg text-xs text-gray-600 border border-transparent hover:border-gray-200 outline-none mr-0.5"
                title="To"
            />
        </div>
    );
}

// ─── Tray Column (premium themed card) ──────────────────────────────────────────

const TRAY_THEME = {
    indigo: { accent: "bg-indigo-500", icon: "bg-indigo-50 text-indigo-600 ring-indigo-100" },
    amber:  { accent: "bg-amber-500",  icon: "bg-amber-50 text-amber-600 ring-amber-100" },
    violet: { accent: "bg-violet-500", icon: "bg-violet-50 text-violet-600 ring-violet-100" },
    rose:   { accent: "bg-rose-500",   icon: "bg-rose-50 text-rose-600 ring-rose-100" },
};

function TrayColumn({ theme = "indigo", icon: Icon, title, subtitle, action, children }) {
    const t = TRAY_THEME[theme];
    return (
        <section className={cn(
            "relative flex flex-col rounded-2xl bg-white overflow-hidden",
            "ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgb(0,0,0,0.04),0_8px_24px_-12px_rgb(0,0,0,0.12)]",
            "transition-shadow hover:shadow-[0_2px_6px_rgb(0,0,0,0.05),0_14px_32px_-12px_rgb(0,0,0,0.16)]",
        )}>
            {/* Top accent bar */}
            <div className={cn("h-1 w-full", t.accent)} />
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ring-1", t.icon)}>
                        <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-slate-900 leading-tight truncate">{title}</h2>
                        {subtitle && <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">{action}</div>
            </div>
            {/* Body */}
            <div className="relative p-3 space-y-2 min-h-[32rem] max-h-[36rem] overflow-y-auto bg-slate-50/40">
                {children}
            </div>
        </section>
    );
}

function EmptyState({ icon: Icon, text, tint = "bg-gray-50 text-gray-300" }) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner", tint)}>
                <Icon className="h-7 w-7" />
            </div>
            <p className="text-xs text-gray-400 max-w-[14rem]">{text}</p>
        </div>
    );
}

// ─── My Day Page ──────────────────────────────────────────────────────────────

const MyDay = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    useEffect(() => {
        localStorage.setItem("last-leads-path", location.pathname + location.search);
    }, [location]);

    // Snooze state
    const [snoozed, setSnoozed] = useState({});
    const handleSnooze = (leadId) => {
        setSnoozed(prev => ({ ...prev, [leadId]: Date.now() + 3_600_000 }));
        toast("Snoozed for 1 hour");
    };
    const isSnoozed = (leadId) => snoozed[leadId] && snoozed[leadId] > Date.now();

    // Filters
    const [consultant, setConsultant] = useState(null);
    const [department, setDepartment] = useState(null);
    const [range, setRange] = useState({ mode: "all" });
    const hasFilters = consultant || department || range.mode !== "all";
    const clearFilters = () => { setConsultant(null); setDepartment(null); setRange({ mode: "all" }); };

    // Personal Reminder Form State
    const [showAddReminder, setShowAddReminder] = useState(false);
    const [reminderMessage, setReminderMessage] = useState("");
    const [reminderDateTime, setReminderDateTime] = useState("");

    const { data: consultants = [] } = useQuery({
        queryKey: ["team", "consultants"],
        queryFn: () => api.get("/team").then(r => {
            const list = r.data?.members || r.data || [];
            return (Array.isArray(list) ? list : [])
                .filter(u => u.isActive !== false)
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }),
        staleTime: 300_000,
    });

    // Fetch action queue (leads needing follow-up) — scoped to the active filters
    const { data: leadsData, isLoading: leadsLoading } = useQuery({
        queryKey: ["leads", "action-queue", consultant?.id ?? "all", department ?? "all"],
        queryFn: () => api.get("/leads", {
            params: {
                limit: 10, status: "FOLLOW_UP,CONTACTED,NEW", sortBy: "updatedAt", sortOrder: "asc",
                ...(consultant ? { assignedTo: consultant.id } : {}),
                ...(department ? { department } : {}),
            }
        }).then(r => r.data.data || r.data),
        staleTime: 120_000,
    });

    // Fetch pending tasks
    const { data: tasks, isLoading: tasksLoading } = useQuery({
        queryKey: ["tasks", "my-pending"],
        queryFn: () => api.get("/tasks").then(r => r.data.data ?? r.data),
        staleTime: 120_000,
    });

    // Fetch upcoming reminders
    const { data: reminders, isLoading: remindersLoading } = useQuery({
        queryKey: ["reminders", "upcoming"],
        queryFn: () => api.get("/reminders").then(r => r.data.data ?? r.data),
        staleTime: 120_000,
    });

    // Complete task mutation — records the closing comment on the lead's activity
    // (or, for lead-less tasks, as a task comment) before marking it complete.
    const completeTask = useMutation({
        mutationFn: async ({ id, leadId, comment, nextCallAt }) => {
            if (comment && leadId) {
                await api.post(`/leads/${leadId}/notes`, { content: comment });
            } else if (comment) {
                await api.post(`/tasks/${id}/comments`, { content: comment });
            }
            if (nextCallAt && leadId) {
                await api.post("/reminders", {
                    leadId,
                    message: comment || "Follow-up call",
                    remindAt: new Date(nextCallAt).toISOString(),
                });
            }
            return api.patch(`/tasks/${id}/status`, { status: "COMPLETED" });
        },
        onSuccess: (_data, { nextCallAt }) => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["reminders"] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities"] });
            queryClient.invalidateQueries({ queryKey: ["lead-notes"] });
            toast.success(nextCallAt ? "Task closed · next call scheduled" : "Comment added · task closed");
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update task"),
    });

    // A lead reminder is closed by logging the comment on the lead, then marking
    // it successful (resolves & hides it from Upcoming/Overdue).
    const dismissReminder = useMutation({
        mutationFn: async ({ id, leadId, comment, nextCallAt }) => {
            if (comment && leadId) {
                await api.post(`/leads/${leadId}/notes`, { content: comment });
            }
            if (nextCallAt && leadId) {
                await api.post("/reminders", {
                    leadId,
                    message: comment || "Follow-up call",
                    remindAt: new Date(nextCallAt).toISOString(),
                });
            }
            return api.patch(`/reminders/${id}`, { outcome: "SUCCESSFUL" });
        },
        onSuccess: (_data, { nextCallAt }) => {
            queryClient.invalidateQueries({ queryKey: ["reminders"] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities"] });
            queryClient.invalidateQueries({ queryKey: ["lead-notes"] });
            toast.success(nextCallAt ? "Reminder closed · next call scheduled" : "Comment added · reminder closed");
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update reminder"),
    });
    const clearAllReminders = (ids) => {
        if (!ids.length) return;
        Promise.all(ids.map(id => api.patch(`/reminders/${id}`, { outcome: "SUCCESSFUL" })))
            .then(() => {
                queryClient.invalidateQueries({ queryKey: ["reminders"] });
                toast.success("All reminders marked successful");
            })
            .catch((err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update reminders"));
    };

    // Personal reminders: create mutation
    const createReminder = useMutation({
        mutationFn: (data) => api.post("/reminders", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reminders"] });
            toast.success("Reminder added");
            setShowAddReminder(false);
            setReminderMessage("");
            setReminderDateTime("");
        },
        onError: (err) => {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to add reminder");
        }
    });

    // Personal reminders: dismiss mutation (no success/unsuccessful outcome)
    const dismissPersonalReminder = useMutation({
        mutationFn: (id) => api.patch(`/reminders/${id}`, { dismissed: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reminders"] });
            toast.success("Reminder cleared");
        },
        onError: () => toast.error("Failed to clear reminder"),
    });

    // Only gate the page on the filter-independent queries; the Action Queue card
    // shows its own loading state when the consultant filter re-fetches leads.
    const isLoading = tasksLoading || remindersLoading;
    if (isLoading) return <DashboardSkeleton />;

    const leadInDept = (lead) =>
        !department || (lead?.leadDepartments || []).some(d => d.department === department);

    // Base scope (consultant + department). Open = not yet completed/resolved.
    const tasksScoped = (tasks || [])
        .filter(t => t.status === "PENDING")
        .filter(t => !consultant || t.assignedTo?.id === consultant.id)
        .filter(t => leadInDept(t.lead));
    const remindersScoped = (reminders || [])
        .filter(r => !r.dismissed && r.outcome !== "SUCCESSFUL")
        .filter(r => !consultant || r.userId === consultant.id)
        .filter(r => leadInDept(r.lead));

    const now = Date.now();
    const isPast = (d) => d && new Date(d).getTime() < now;
    const byDate = (a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : Infinity;
        const tb = b.date ? new Date(b.date).getTime() : Infinity;
        return ta - tb;
    };

    // Upcoming: not completed and due/remind time has NOT passed yet, and within range (excludes personal reminders).
    const upcomingItems = [
        ...tasksScoped
            .filter(t => !isPast(t.dueDate))
            .map(t => ({ kind: "task", item: t, date: t.dueDate })),
        ...remindersScoped
            .filter(r => r.leadId && !isPast(r.remindAt))
            .map(r => ({ kind: "reminder", item: r, date: r.remindAt })),
    ]
    .filter(item => inRange(item.date, range))
    .sort(byDate);

    // Overdue: not completed and due/remind time has passed (excludes personal reminders).
    const overdueItems = [
        ...tasksScoped
            .filter(t => isPast(t.dueDate))
            .map(t => ({ kind: "task", item: t, date: t.dueDate })),
        ...remindersScoped
            .filter(r => r.leadId && isPast(r.remindAt))
            .map(r => ({ kind: "reminder", item: r, date: r.remindAt })),
    ].sort(byDate);

    // Personal Reminders: no associated lead
    const personalReminders = (remindersScoped || [])
        .filter(r => !r.leadId)
        .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));

    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    return (
        <div className="space-y-5">
            {/* Unified toolbar — title, stats & filters on one line */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgb(0,0,0,0.04)]">
                {/* My Day title (in place of the old "Filters" label) */}
                <div className="flex items-center gap-3 shrink-0">
                    <span className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                        <Calendar className="h-5 w-5 text-white" />
                    </span>
                    <div>
                        <h1 className="text-lg md:text-xl font-black tracking-tight text-indigo-950 leading-none">My Day</h1>
                        <p className="text-[11px] text-slate-500 mt-1 leading-none">{today}</p>
                    </div>
                </div>

                {/* Stats + filters + actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {[
                        { label: "Overdue", value: overdueItems.length, icon: Bell, ic: "bg-rose-50 text-rose-600 ring-rose-100/80" },
                        { label: "Upcoming", value: upcomingItems.length, icon: CheckCircle, ic: "bg-amber-50 text-amber-600 ring-amber-100/80" },
                    ].map(({ label, value, icon: Icon, ic }) => (
                        <div key={label} className="flex items-center gap-2 rounded-xl bg-slate-50/70 px-2.5 py-1.5 ring-1 ring-slate-200/80">
                            <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ring-1", ic)}>
                                <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="text-left">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">{label}</p>
                                <CountUp value={value} className="text-sm font-black text-slate-900 leading-none tabular-nums" />
                            </div>
                        </div>
                    ))}

                    <span className="hidden sm:block h-6 w-px bg-slate-200" />

                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 ring-1 ring-slate-200 rounded-full pl-2.5 pr-2 py-1.5 transition-colors">
                            Clear <X className="h-3 w-3" />
                        </button>
                    )}
                    <DateRangeFilter range={range} onChange={setRange} />
                    <DepartmentFilter selected={department} onSelect={setDepartment} />
                    <ConsultantFilter consultants={consultants} selected={consultant} onSelect={setConsultant} />
                </div>
            </div>

            {/* Trays */}
            <div className="relative">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Overdue — passed their time, never marked successful */}
                    <TrayColumn
                        theme="rose"
                        icon={Bell}
                        title="Overdue"
                        subtitle="Unsuccessful — past due"
                        action={<Badge variant="error" size="sm">{overdueItems.length}</Badge>}
                    >
                        {overdueItems.length > 0
                            ? overdueItems.map(entry => (
                                entry.kind === "task"
                                    ? <TaskItem key={`task-${entry.item.id}`} task={entry.item} onComplete={(payload) => completeTask.mutate(payload)} completing={completeTask.isPending} preferDept={department} />
                                    : <ReminderItem
                                        key={`rem-${entry.item.id}`}
                                        reminder={entry.item}
                                        preferDept={department}
                                        onClear={(payload) => dismissReminder.mutate(payload)}
                                        clearing={dismissReminder.isPending}
                                    />
                            ))
                            : <EmptyState icon={Bell} tint="bg-rose-50 text-rose-300" text="No overdue items" />
                        }
                    </TrayColumn>

                    {/* Upcoming — tasks & reminders not yet due */}
                    <TrayColumn
                        theme="amber"
                        icon={CheckCircle}
                        title="Upcoming"
                        subtitle="Not completed · due date not passed"
                        action={
                            <Badge variant={upcomingItems.length > 0 ? "error" : "success"} size="sm">
                                {upcomingItems.length}
                            </Badge>
                        }
                    >
                        {upcomingItems.length > 0
                            ? upcomingItems.map(entry => (
                                entry.kind === "task"
                                    ? <TaskItem key={`task-${entry.item.id}`} task={entry.item} onComplete={(payload) => completeTask.mutate(payload)} completing={completeTask.isPending} preferDept={department} />
                                    : <ReminderItem
                                        key={`rem-${entry.item.id}`}
                                        reminder={entry.item}
                                        preferDept={department}
                                        onClear={(payload) => dismissReminder.mutate(payload)}
                                        clearing={dismissReminder.isPending}
                                    />
                            ))
                            : <EmptyState icon={CheckCircle} tint="bg-emerald-50 text-emerald-400" text="Nothing upcoming 🎉" />
                        }
                    </TrayColumn>

                    {/* My Reminders — personal reminders */}
                    <TrayColumn
                        theme="violet"
                        icon={Bell}
                        title="My Reminders"
                        subtitle="Personal reminders"
                        action={
                            <button 
                                onClick={() => setShowAddReminder(!showAddReminder)} 
                                className="p-1 rounded-lg bg-violet-50 text-violet-650 hover:bg-violet-105 transition-colors focus:outline-none cursor-pointer"
                                title="Add personal reminder"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        }
                    >
                        {showAddReminder && (
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (!reminderMessage.trim() || !reminderDateTime) {
                                        toast.warning("Message and date/time are required");
                                        return;
                                    }
                                    createReminder.mutate({
                                        message: reminderMessage,
                                        remindAt: new Date(reminderDateTime).toISOString(),
                                    });
                                }}
                                className="p-3 bg-violet-50/40 border border-violet-100/80 rounded-xl space-y-2.5"
                            >
                                <div>
                                    <label className="block text-[9px] font-bold text-violet-700 uppercase mb-1">Message</label>
                                    <input 
                                        type="text" 
                                        placeholder="What to remind..." 
                                        value={reminderMessage}
                                        onChange={e => setReminderMessage(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-violet-200 rounded-lg outline-none bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-violet-700 uppercase mb-1">Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={reminderDateTime}
                                        onChange={e => setReminderDateTime(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-violet-200 rounded-lg outline-none bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                    />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAddReminder(false)}
                                        className="px-2.5 py-1 text-[10px] font-semibold text-violet-600 hover:bg-violet-100/50 rounded-md"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={createReminder.isPending}
                                        className="px-2.5 py-1 text-[10px] font-semibold bg-violet-600 text-white hover:bg-violet-700 rounded-md shadow-xs disabled:opacity-50"
                                    >
                                        {createReminder.isPending ? "Adding..." : "Add"}
                                    </button>
                                </div>
                            </form>
                        )}

                        {personalReminders.length > 0
                            ? personalReminders.map(reminder => {
                                const d = new Date(reminder.remindAt);
                                const isToday = d.toDateString() === new Date().toDateString();
                                return (
                                    <div key={reminder.id} className="p-3 rounded-xl bg-white ring-1 ring-slate-200/70 border-l-[3px] border-l-violet-500 shadow-[0_1px_2px_rgb(0,0,0,0.04)] flex items-center justify-between gap-3 group">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-gray-800 font-medium break-words leading-snug">{reminder.message}</p>
                                            <span className="text-[10px] font-semibold text-violet-600 mt-1.5 block">
                                                {isToday
                                                    ? `Today at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                                                    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => dismissPersonalReminder.mutate(reminder.id)}
                                            disabled={dismissPersonalReminder.isPending}
                                            title="Clear reminder"
                                            className="shrink-0 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                );
                            })
                            : !showAddReminder && <EmptyState icon={Bell} tint="bg-violet-50 text-violet-300" text="No personal reminders" />
                        }
                    </TrayColumn>
                </div>
            </div>

        </div>
    );
};

export default MyDay;
