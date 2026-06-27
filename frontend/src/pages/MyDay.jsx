import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";
import {
    CheckCircle, Circle, Bell, Phone, MessageSquare, X,
    ClipboardList, Calendar, Search, ChevronDown, Check, Users, Loader2,
    Building2, GraduationCap, FileCheck, Landmark, Home, Banknote, Briefcase,
    UserCircle2, History, ArrowRight, Trash2, SlidersHorizontal,
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

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({ task, onComplete, preferDept }) {
    const navigate = useNavigate();
    const due = dueSoonLabel(task.dueDate);
    return (
        <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200/70 border-l-[3px] border-l-amber-500 shadow-[0_1px_2px_rgb(0,0,0,0.04)] hover:shadow-[0_4px_16px_-6px_rgb(0,0,0,0.15)] hover:ring-amber-200 transition-all duration-200 group cursor-pointer"
            onClick={() => navigate(`/tasks/${task.id}`)}>
            <div className="flex items-start gap-3">
                <button onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                    className="mt-0.5 shrink-0 text-gray-300 hover:text-emerald-500 transition-colors" title="Mark complete">
                    <Circle className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{task.title}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                    {due && <Badge variant={due.variant} size="sm">{due.label}</Badge>}
                    {task.dueDate && !due && (
                        <span className="text-[11px] text-gray-400">
                            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                    )}
                </div>
            </div>
            {task.lead && (
                <div className="mt-2 pl-7">
                    <LeadIdentity lead={task.lead} preferDept={preferDept} />
                </div>
            )}
        </div>
    );
}

// ─── Reminder Item ────────────────────────────────────────────────────────────

function ReminderItem({ reminder, preferDept, onClear, clearing }) {
    const d = new Date(reminder.remindAt);
    const isToday = d.toDateString() === new Date().toDateString();
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
                    onClick={e => { e.stopPropagation(); onClear(reminder.id); }}
                    disabled={clearing}
                    title="Clear reminder"
                    className="shrink-0 -mt-0.5 -mr-0.5 p-1 rounded-md text-violet-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            {reminder.lead && (
                <Link to={`/leads/${reminder.lead.id}`} onClick={e => e.stopPropagation()} className="mt-2 pl-6 block">
                    <LeadIdentity lead={reminder.lead} preferDept={preferDept} />
                </Link>
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
    const queryClient = useQueryClient();

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

    // Complete task mutation
    const completeTask = useMutation({
        mutationFn: (id) => api.patch(`/tasks/${id}/status`, { status: "COMPLETED" }),
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ["tasks"] }); 
            toast.success("Task marked complete"); 
        },
        onError: () => toast.error("Failed to update task"),
    });

    // Reminders are cleared manually only — dismiss (not auto-expiry) removes them.
    const dismissReminder = useMutation({
        mutationFn: (id) => api.patch(`/reminders/${id}`, { dismissed: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reminders"] });
            toast.success("Reminder cleared");
        },
        onError: () => toast.error("Failed to clear reminder"),
    });
    const clearAllReminders = (ids) => {
        if (!ids.length) return;
        Promise.all(ids.map(id => api.patch(`/reminders/${id}`, { dismissed: true })))
            .then(() => {
                queryClient.invalidateQueries({ queryKey: ["reminders"] });
                toast.success("All reminders cleared");
            })
            .catch(() => toast.error("Failed to clear reminders"));
    };

    // Only gate the page on the filter-independent queries; the Action Queue card
    // shows its own loading state when the consultant filter re-fetches leads.
    const isLoading = tasksLoading || remindersLoading;
    if (isLoading) return <DashboardSkeleton />;

    const leadInDept = (lead) =>
        !department || (lead?.leadDepartments || []).some(d => d.department === department);

    const pendingTasks = (tasks || [])
        .filter(t => t.status === "PENDING")
        .filter(t => !consultant || t.assignedTo?.id === consultant.id)
        .filter(t => leadInDept(t.lead))
        .filter(t => inRange(t.dueDate, range));
    // Manual-clear only: keep reminders until the user dismisses them (don't hide
    // once they've fired / isSent).
    const upcomingReminders = (reminders || [])
        .filter(r => !r.dismissed)
        .filter(r => !consultant || r.userId === consultant.id)
        .filter(r => leadInDept(r.lead))
        .filter(r => inRange(r.remindAt, range))
        .slice(0, 5);
    const actionQueue = (leadsData || [])
        .filter(l => leadInDept(l))
        .filter(l => inRange(l.nextFollowUpAt ?? l.updatedAt, range))
        .slice(0, 8);

    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    return (
        <div className="space-y-5">
            {/* Header */}
            <header className="relative flex items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm">
                        <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-indigo-950">My Day</h1>
                        <p className="text-sm text-slate-500 mt-0.5">{today} · your tasks &amp; follow-ups</p>
                    </div>
                </div>
                <Link
                    to="/dashboard"
                    className="hidden sm:inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-semibold rounded-xl px-3.5 py-2 ring-1 ring-slate-200/80 bg-white hover:ring-indigo-200 transition-colors shadow-[0_1px_2px_rgb(0,0,0,0.04)]"
                >
                    Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
            </header>

            {/* Stats — aligned above their matching tray */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                    { label: "Follow-ups", hint: "Leads in queue", value: actionQueue.length, icon: ClipboardList, ic: "bg-indigo-50 text-indigo-600 ring-indigo-100", bar: "bg-indigo-500" },
                    { label: "Pending Tasks", hint: "Due to you", value: pendingTasks.length, icon: CheckCircle, ic: "bg-amber-50 text-amber-600 ring-amber-100", bar: "bg-amber-500" },
                    { label: "Reminders", hint: "Awaiting action", value: upcomingReminders.length, icon: Bell, ic: "bg-violet-50 text-violet-600 ring-violet-100", bar: "bg-violet-500" },
                ].map(({ label, hint, value, icon: Icon, ic, bar }) => (
                    <div key={label} className="relative flex items-center gap-4 rounded-2xl bg-white pl-5 pr-4 py-4 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgb(0,0,0,0.04)] overflow-hidden">
                        <span className={cn("absolute left-0 inset-y-0 w-1", bar)} />
                        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1", ic)}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <CountUp value={value} className="text-2xl font-black text-slate-900 leading-none tabular-nums" />
                            <p className="text-xs font-bold text-slate-600 mt-1.5 truncate">{label}</p>
                            <p className="text-[10px] text-slate-400 leading-tight truncate">{hint}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2 text-slate-500">
                    <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Filters</span>
                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 ring-1 ring-slate-200 rounded-full pl-2.5 pr-2 py-1 transition-colors">
                            Clear all <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <DateRangeFilter range={range} onChange={setRange} />
                    <DepartmentFilter selected={department} onSelect={setDepartment} />
                    <ConsultantFilter consultants={consultants} selected={consultant} onSelect={setConsultant} />
                </div>
            </div>

            {/* Trays */}
            <div className="relative">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Action Queue */}
                    <TrayColumn
                        theme="indigo"
                        icon={ClipboardList}
                        title="Action Queue"
                        subtitle="Leads needing your attention"
                        action={<Badge variant="warning" size="sm">{actionQueue.length}</Badge>}
                    >
                        {leadsLoading
                            ? (
                                <div className="flex items-center justify-center h-full py-12">
                                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                                </div>
                            )
                            : actionQueue.length > 0
                            ? actionQueue.map(lead => (
                                <ActionItem key={lead.id} lead={lead} snoozed={isSnoozed(lead.id)} onSnooze={handleSnooze} preferDept={department} />
                            ))
                            : (
                                <EmptyState
                                    icon={ClipboardList}
                                    tint="bg-indigo-50 text-indigo-300"
                                    text={consultant ? `No action items for ${consultant.name}` : "No leads need action right now"}
                                />
                            )
                        }
                    </TrayColumn>

                    {/* My Tasks */}
                    <TrayColumn
                        theme="amber"
                        icon={CheckCircle}
                        title="My Tasks"
                        subtitle="Open to-dos due to you"
                        action={
                            <Badge variant={pendingTasks.length > 0 ? "error" : "success"} size="sm">
                                {pendingTasks.length} pending
                            </Badge>
                        }
                    >
                        {pendingTasks.length > 0
                            ? pendingTasks.slice(0, 8).map(task => (
                                <TaskItem key={task.id} task={task} onComplete={(id) => completeTask.mutate(id)} preferDept={department} />
                            ))
                            : <EmptyState icon={CheckCircle} tint="bg-emerald-50 text-emerald-400" text="All tasks done! 🎉" />
                        }
                    </TrayColumn>

                    {/* Reminders */}
                    <TrayColumn
                        theme="violet"
                        icon={Bell}
                        title="Reminders"
                        subtitle="Cleared manually when done"
                        action={
                            <>
                                {upcomingReminders.length > 0 && (
                                    <button
                                        onClick={() => clearAllReminders(upcomingReminders.map(r => r.id))}
                                        disabled={dismissReminder.isPending}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                                        title="Clear all reminders"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Clear all
                                    </button>
                                )}
                                <Badge variant="ai" size="sm">{upcomingReminders.length}</Badge>
                            </>
                        }
                    >
                        {upcomingReminders.length > 0
                            ? upcomingReminders.map(r => (
                                <ReminderItem
                                    key={r.id}
                                    reminder={r}
                                    preferDept={department}
                                    onClear={(id) => dismissReminder.mutate(id)}
                                    clearing={dismissReminder.isPending}
                                />
                            ))
                            : <EmptyState icon={Bell} tint="bg-violet-50 text-violet-300" text="No reminders to show" />
                        }
                    </TrayColumn>
                </div>
            </div>

        </div>
    );
};

export default MyDay;
