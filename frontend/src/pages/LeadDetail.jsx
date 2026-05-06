import { useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
    ArrowLeft, Phone, Mail, MessageSquare, Plus, CheckCircle, Circle,
    Calendar, User, Loader2, PhoneCall, FileText, Activity,
    ChevronDown, ChevronRight, Play, Clock, AlertCircle,
} from "lucide-react";
import { Modal } from "../components/Modal";
import AddTaskForm from "../components/AddTaskForm";
import LeadSidebar from "../components/lead/LeadSidebar";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"];

const STATUS_STYLE = {
    NEW:       "bg-blue-100 text-blue-800 border-blue-200",
    CONTACTED: "bg-indigo-100 text-indigo-800 border-indigo-200",
    FOLLOW_UP: "bg-amber-100 text-amber-800 border-amber-200",
    CONVERTED: "bg-green-100 text-green-800 border-green-200",
    LOST:      "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABEL = {
    NEW: "New", CONTACTED: "Contacted", FOLLOW_UP: "Follow Up",
    CONVERTED: "Converted", LOST: "Lost",
};

const SOURCE_LABEL = {
    FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GMAIL: "Gmail",
    WEBSITE: "Website", PHONE_CALL: "Phone Call", LINKEDIN: "LinkedIn",
};

const ACTION_CONFIG = {
    LEAD_CREATED:   { icon: "✦", color: "text-blue-500",   bg: "bg-blue-50 border-blue-100",   label: "Lead created" },
    LEAD_UPDATED:   { icon: "✎", color: "text-gray-500",   bg: "bg-gray-50 border-gray-100",   label: "Lead updated" },
    STATUS_CHANGED: { icon: "⇄", color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100",label: "Status changed" },
    CALL_MADE:      { icon: "📞", color: "text-green-500",  bg: "bg-green-50 border-green-100", label: "Call made" },
    NOTE_ADDED:     { icon: "📝", color: "text-amber-500",  bg: "bg-amber-50 border-amber-100", label: "Note added" },
    TASK_CREATED:   { icon: "☑", color: "text-teal-500",   bg: "bg-teal-50 border-teal-100",   label: "Task created" },
    TASK_COMPLETED: { icon: "✓", color: "text-green-600",  bg: "bg-green-50 border-green-100", label: "Task completed" },
    REMINDER_SET:   { icon: "⏰", color: "text-orange-500", bg: "bg-orange-50 border-orange-100",label: "Reminder set" },
    ASSIGNED:       { icon: "→", color: "text-violet-500", bg: "bg-violet-50 border-violet-100",label: "Assigned" },
    DEFAULT:        { icon: "·", color: "text-gray-400",   bg: "bg-gray-50 border-gray-100",   label: "Activity" },
};

const TABS = [
    { id: "timeline", label: "Timeline",     icon: Activity },
    { id: "notes",    label: "Notes",        icon: FileText },
    { id: "calls",    label: "Call History", icon: PhoneCall },
    { id: "tasks",    label: "Tasks",        icon: CheckCircle },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relTime = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const dayLabel = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDuration = (secs) => {
    if (!secs) return "—";
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
};

const initials = (name = "") =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDropdown({ leadId, currentStatus }) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (status) => api.patch(`/leads/${leadId}`, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            setOpen(false);
        },
    });

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:opacity-80 ${STATUS_STYLE[currentStatus]}`}
            >
                {STATUS_LABEL[currentStatus]}
                <ChevronDown className="h-3 w-3" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                        {STATUS_OPTIONS.map(s => (
                            <button
                                key={s}
                                onClick={() => mutation.mutate(s)}
                                disabled={mutation.isPending}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors hover:bg-gray-50
                                    ${s === currentStatus ? "opacity-40 cursor-default" : ""}`}
                            >
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${STATUS_STYLE[s]}`}>
                                    {STATUS_LABEL[s]}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function TimelineItem({ item }) {
    const cfg = ACTION_CONFIG[item.action] ?? ACTION_CONFIG.DEFAULT;
    return (
        <div className="flex gap-3">
            <div className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-sm ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}
            </div>
            <div className="flex-1 min-w-0 pb-4 border-b border-gray-100 last:border-0">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">{cfg.label}</p>
                        {item.user?.name && (
                            <p className="text-xs text-gray-500">by {item.user.name}</p>
                        )}
                        {item.metadata?.newStatus && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                {item.metadata.prevStatus} → {item.metadata.newStatus}
                            </p>
                        )}
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{relTime(item.createdAt)}</span>
                </div>
            </div>
        </div>
    );
}

function CallItem({ call }) {
    const [expanded, setExpanded] = useState(false);
    const statusColor = {
        COMPLETED: "bg-green-100 text-green-700",
        MISSED: "bg-red-100 text-red-700",
        INITIATED: "bg-blue-100 text-blue-700",
    }[call.callStatus] ?? "bg-gray-100 text-gray-600";

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                        <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{call.callType ?? "Outbound"}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                {call.callStatus ?? "—"}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtDuration(call.duration)}
                            </span>
                            <span>{relTime(call.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>

            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50 space-y-3">
                    {call.recordingUrl && (
                        <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                            <Play className="h-3 w-3" /> Play Recording
                        </a>
                    )}
                    {call.summary && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">AI Summary</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{call.summary}</p>
                        </div>
                    )}
                    {call.plainText && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Transcript</p>
                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{call.plainText}</p>
                        </div>
                    )}
                    {call.sentiment && (
                        <div className="flex gap-4 text-xs">
                            {call.sentiment && <span className="text-gray-500">Sentiment: <strong className="text-gray-800">{call.sentiment}</strong></span>}
                            {call.tone && <span className="text-gray-500">Tone: <strong className="text-gray-800">{call.tone}</strong></span>}
                            {call.urgency && <span className="text-gray-500">Urgency: <strong className="text-gray-800">{call.urgency}</strong></span>}
                        </div>
                    )}
                    {!call.recordingUrl && !call.summary && !call.plainText && (
                        <p className="text-xs text-gray-400">No additional details available.</p>
                    )}
                </div>
            )}
        </div>
    );
}

function TaskRow({ task, leadId }) {
    const queryClient = useQueryClient();
    const toggle = useMutation({
        mutationFn: ({ id, status }) => api.patch(`/tasks/${id}/status`, { status }),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ["lead-tasks", leadId] });
            const prev = queryClient.getQueryData(["lead-tasks", leadId]);
            queryClient.setQueryData(["lead-tasks", leadId], (old) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map(t => t.id === id ? { ...t, status } : t) };
            });
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(["lead-tasks", leadId], ctx.prev);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] }),
    });

    const overdue = task.status !== "COMPLETED" && new Date(task.dueDate) < new Date();

    return (
        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-all group">
            <button
                onClick={() => toggle.mutate({ id: task.id, status: task.status === "PENDING" ? "COMPLETED" : "PENDING" })}
                disabled={toggle.isPending}
                className={`flex-shrink-0 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50
                    ${task.status === "COMPLETED" ? "text-green-500" : "text-gray-300 group-hover:text-indigo-400"}`}
            >
                {toggle.isPending
                    ? <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    : task.status === "COMPLETED"
                        ? <CheckCircle className="h-5 w-5" />
                        : <Circle className="h-5 w-5" />}
            </button>
            <div className="flex-1 min-w-0">
                <Link to={`/tasks/${task.id}`}
                    className={`text-sm font-semibold truncate block hover:text-indigo-600 transition-colors
                        ${task.status === "COMPLETED" ? "line-through text-gray-400" : "text-gray-900"}`}>
                    {task.title}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500">
                    <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-semibold" : ""}`}>
                        <Calendar className="h-3 w-3" />
                        {overdue ? "Overdue · " : ""}
                        {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    {task.assignedTo && (
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assignedTo.name}
                        </span>
                    )}
                </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                ${task.status === "COMPLETED" ? "bg-green-50 text-green-700" : overdue ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                {task.status === "COMPLETED" ? "Done" : overdue ? "Overdue" : "Pending"}
            </span>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

    const [activeTab, setActiveTab] = useState("timeline");
    const [noteText, setNoteText] = useState("");
    const [showTaskModal, setShowTaskModal] = useState(false);
    const noteRef = useRef(null);

    // ─── Queries (all parallel) ───────────────────────────────────────────────
    const { data: lead, isLoading: leadLoading, error: leadError } = useQuery({
        queryKey: ["lead", id],
        queryFn: () => api.get(`/leads/${id}`).then(r => r.data),
    });

    const { data: activities = [] } = useQuery({
        queryKey: ["lead-activities", id],
        queryFn: () => api.get(`/leads/${id}/activities`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: notes = [], isLoading: notesLoading } = useQuery({
        queryKey: ["lead-notes", id],
        queryFn: () => api.get(`/notes/leads/${id}/notes`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: callsData, isLoading: callsLoading } = useQuery({
        queryKey: ["lead-calls", id],
        queryFn: () => api.get(`/call-logs/${id}`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: tasksData, isLoading: tasksLoading } = useQuery({
        queryKey: ["lead-tasks", id],
        queryFn: () => api.get("/tasks", { params: { leadId: id, limit: 100 } }).then(r => r.data),
        enabled: !!lead,
    });

    const { data: reminders = [], isLoading: remindersLoading } = useQuery({
        queryKey: ["lead-reminders", id],
        queryFn: () => api.get("/reminders", { params: { leadId: id } }).then(r => r.data),
        enabled: !!lead,
    });

    const calls = Array.isArray(callsData) ? callsData : (callsData?.data ?? []);
    const tasks = tasksData?.data ?? [];

    // ─── Mutations ────────────────────────────────────────────────────────────
    const addNote = useMutation({
        mutationFn: (content) => api.post(`/notes/leads/${id}/notes`, { content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-notes", id] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
            setNoteText("");
        },
    });

    const handleNoteSubmit = (e) => {
        e.preventDefault();
        if (!noteText.trim()) return;
        addNote.mutate(noteText.trim());
    };

    // ─── Timeline: merge activities + notes + calls ───────────────────────────
    const timelineGroups = useMemo(() => {
        const items = [
            ...activities.map(a => ({ ...a, _type: "activity", _date: new Date(a.createdAt) })),
            ...notes.map(n => ({ ...n, _type: "note", action: "NOTE_ADDED", _date: new Date(n.createdAt) })),
            ...calls.map(c => ({ ...c, _type: "call", action: "CALL_MADE", _date: new Date(c.createdAt) })),
        ].sort((a, b) => b._date - a._date);

        const groups = new Map();
        items.forEach(item => {
            const key = dayLabel(item._date);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });
        return [...groups.entries()];
    }, [activities, notes, calls]);

    // ─── Initiating call via click2call ──────────────────────────────────────
    const initiateCall = useMutation({
        mutationFn: () => api.post("/call-logs/click2call", {
            leadId: id,
            customerNumber: lead?.phone,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-calls", id] });
        },
    });

    // ─── Loading / error states ───────────────────────────────────────────────
    if (leadLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (leadError || !lead) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-gray-600 font-medium">Lead not found</p>
                <Link to="/leads" className="text-sm text-indigo-600 hover:underline">← Back to Leads</Link>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Back nav */}
            <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium">
                <ArrowLeft className="h-4 w-4" /> Leads
            </Link>

            {/* ── Lead Header ───────────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-lg font-black text-white">{initials(lead.name)}</span>
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-xl font-black text-gray-900 truncate">{lead.name}</h1>
                            <StatusDropdown leadId={id} currentStatus={lead.status} />
                            {lead.category && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wide">
                                    {lead.category}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            {lead.company && <span className="font-medium text-gray-700">{lead.company}</span>}
                            {lead.jobTitle && <span>{lead.jobTitle}</span>}
                            <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded-full font-medium text-gray-600">
                                {SOURCE_LABEL[lead.source] ?? lead.source}
                            </span>
                            {lead.enquiryType && (
                                <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded-full font-medium text-gray-600">
                                    {lead.enquiryType}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                            {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                                    <Phone className="h-3 w-3" /> {lead.phone}
                                </a>
                            )}
                            {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                                    <Mail className="h-3 w-3" /> {lead.email}
                                </a>
                            )}
                            {lead.assignedTo && (
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" /> {lead.assignedTo.name}
                                </span>
                            )}
                            {activities.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Last activity {relTime(activities[0]?.createdAt)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick action bar */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                    {lead.phone && (
                        <button
                            onClick={() => initiateCall.mutate()}
                            disabled={initiateCall.isPending || !lead.phone}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                            {initiateCall.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Phone className="h-3.5 w-3.5" />}
                            Call
                        </button>
                    )}
                    {lead.phone && (
                        <a
                            href={`https://wa.me/${lead.phone?.replace(/\D/g, "")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                        >
                            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                    )}
                    {lead.email && (
                        <a href={`mailto:${lead.email}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all">
                            <Mail className="h-3.5 w-3.5" /> Email
                        </a>
                    )}
                    <button
                        onClick={() => { setActiveTab("notes"); noteRef.current?.focus(); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                    >
                        <FileText className="h-3.5 w-3.5" /> Note
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setShowTaskModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" /> Task
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main 2-col layout ──────────────────────────────────────────── */}
            <div className="flex gap-5 items-start">
                {/* Left: tabbed content */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Tab bar */}
                    <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                        {TABS.map(({ id: tabId, label, icon: Icon }) => (
                            <button
                                key={tabId}
                                onClick={() => setActiveTab(tabId)}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all
                                    ${activeTab === tabId
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* ── TIMELINE tab ───────────────────────────────────────── */}
                    {activeTab === "timeline" && (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Activity Timeline</h2>
                            {timelineGroups.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
                            ) : (
                                <div className="space-y-5">
                                    {timelineGroups.map(([day, items]) => (
                                        <div key={day}>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <span>{day}</span>
                                                <span className="flex-1 h-px bg-gray-100" />
                                            </div>
                                            <div className="space-y-1">
                                                {items.map((item) => (
                                                    item._type === "call" ? (
                                                        <div key={item.id} className="flex gap-3">
                                                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-green-600 text-xs">
                                                                📞
                                                            </div>
                                                            <div className="flex-1 pb-3 border-b border-gray-100 last:border-0">
                                                                <div className="flex items-start justify-between">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-gray-800">
                                                                            {item.callType ?? "Call"} · {fmtDuration(item.duration)}
                                                                        </p>
                                                                        {item.callStatus && (
                                                                            <p className="text-xs text-gray-500">{item.callStatus}</p>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[11px] text-gray-400">{relTime(item.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : item._type === "note" ? (
                                                        <div key={item.id} className="flex gap-3">
                                                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-xs">
                                                                📝
                                                            </div>
                                                            <div className="flex-1 pb-3 border-b border-gray-100 last:border-0">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-semibold text-gray-800 mb-0.5">Note</p>
                                                                        <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                                                                    </div>
                                                                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{relTime(item.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <TimelineItem key={item.id} item={item} />
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── NOTES tab ──────────────────────────────────────────── */}
                    {activeTab === "notes" && (
                        <div className="space-y-3">
                            {/* Inline add note */}
                            <form onSubmit={handleNoteSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
                                <textarea
                                    ref={noteRef}
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleNoteSubmit(e); }}
                                    placeholder="Add a note… (Ctrl+Enter to save)"
                                    rows={3}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400"
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={addNote.isPending || !noteText.trim()}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-all"
                                    >
                                        {addNote.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                        Save Note
                                    </button>
                                </div>
                            </form>

                            {/* Notes list */}
                            {notesLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                            ) : notes.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
                                    No notes yet. Add one above.
                                </div>
                            ) : (
                                notes.map(note => (
                                    <div key={note.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                                        <p className="text-[11px] text-gray-400 mt-2">
                                            {new Date(note.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            {" · "}
                                            {new Date(note.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ── CALLS tab ──────────────────────────────────────────── */}
                    {activeTab === "calls" && (
                        <div className="space-y-2.5">
                            {callsLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                            ) : calls.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
                                    No call history for this lead.
                                </div>
                            ) : (
                                calls.map(call => <CallItem key={call.id} call={call} />)
                            )}
                        </div>
                    )}

                    {/* ── TASKS tab ──────────────────────────────────────────── */}
                    {activeTab === "tasks" && (
                        <div className="space-y-2.5">
                            {isAdmin && (
                                <button
                                    onClick={() => setShowTaskModal(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-500 rounded-xl text-sm font-semibold transition-all"
                                >
                                    <Plus className="h-4 w-4" /> Add Task
                                </button>
                            )}
                            {tasksLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                            ) : tasks.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
                                    No tasks linked to this lead.
                                </div>
                            ) : (
                                tasks.map(task => <TaskRow key={task.id} task={task} leadId={id} />)
                            )}
                        </div>
                    )}
                </div>

                {/* Right: sticky sidebar */}
                <div className="w-72 flex-shrink-0 sticky top-6">
                    <LeadSidebar
                        lead={lead}
                        reminders={reminders}
                        remindersLoading={remindersLoading}
                        leadId={id}
                    />
                </div>
            </div>

            {/* Create Task Modal */}
            <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="Create Task">
                <AddTaskForm
                    leadId={id}
                    onClose={() => {
                        setShowTaskModal(false);
                        queryClient.invalidateQueries({ queryKey: ["lead-tasks", id] });
                    }}
                />
            </Modal>
        </div>
    );
}
