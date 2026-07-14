import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Phone, Mail, MessageSquare, CheckSquare, FileText,
    User, Clock, Zap, TrendingUp, Activity, BarChart2, Loader2,
    RefreshCw, AlertTriangle, Info, StickyNote, GitBranch,
} from "lucide-react";
import api from "../api/axios";
import Avatar from "../components/Avatar";
import { getSourceLabel } from "../utils/leadSource";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
    { id: "all",        label: "All" },
    { id: "call",       label: "Calls" },
    { id: "email",      label: "Email" },
    { id: "whatsapp",   label: "WhatsApp" },
    { id: "task",       label: "Tasks" },
    { id: "note",       label: "Notes" },
    { id: "status",     label: "Status" },
    { id: "assignment", label: "Assignments" },
];


const CHANNEL_CONFIG = {
    call:       { icon: Phone,          color: "text-green-600",   bg: "bg-green-50  border-green-200",  dot: "bg-green-500" },
    email:      { icon: Mail,           color: "text-blue-600",    bg: "bg-blue-50   border-blue-200",   dot: "bg-blue-500" },
    whatsapp:   { icon: MessageSquare,  color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
    task:       { icon: CheckSquare,    color: "text-violet-600",  bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
    note:       { icon: StickyNote,     color: "text-amber-600",   bg: "bg-amber-50  border-amber-200",  dot: "bg-amber-500" },
    status:     { icon: Activity,       color: "text-indigo-600",  bg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-500" },
    assignment: { icon: GitBranch,      color: "text-purple-600",  bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
    reminder:   { icon: Clock,          color: "text-orange-600",  bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500" },
    activity:   { icon: Zap,            color: "text-gray-500",    bg: "bg-gray-50   border-gray-200",   dot: "bg-gray-400" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const relTime = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days < 7 ? `${days}d ago` : new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const absTime = (date) =>
    new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const dayLabel = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, index }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className={`text-2xl font-black mt-1 ${color}`}>{value ?? "—"}</p>
                    {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${color.replace("text-", "bg-").replace("-600", "-50").replace("-500", "-50")}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                </div>
            </div>
        </motion.div>
    );
}

function EventCard({ event, index }) {
    const cfg = CHANNEL_CONFIG[event.channel] ?? CHANNEL_CONFIG.activity;
    const Icon = cfg.icon;

    const userObj = event.actor ? { name: event.actor, profilePhoto: event.actorPhoto } : null;

    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.4) }}
            className={`relative flex gap-3 p-3.5 rounded-xl border ${cfg.bg} transition-all hover:shadow-sm`}
        >
            <div className="relative flex-shrink-0">
                {!userObj ? (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white border border-gray-100 shadow-sm">
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                ) : (
                    <>
                        <Avatar user={userObj} size="sm" />
                        <span className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center shadow-sm bg-white`}>
                            <Icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                        </span>
                    </>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${cfg.color}`}>{event.title}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0" title={new Date(event.createdAt).toLocaleString()}>
                        {absTime(event.createdAt)}
                    </span>
                </div>
                {event.description && (
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{event.description}</p>
                )}
                {event.actor && (
                    <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-[10px] text-gray-500">{event.actor}</span>
                    </div>
                )}
                {event.channel === "call" && event.metadata?.duration > 0 && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                        <Clock className="h-3 w-3" />
                        {Math.floor(event.metadata.duration / 60)}m {event.metadata.duration % 60}s
                        {event.metadata.callStatus && <span className="px-1.5 py-0.5 rounded-full bg-white border border-gray-200 font-medium">{event.metadata.callStatus}</span>}
                    </div>
                )}
                {event.channel === "email" && event.metadata?.openedAt && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-500">
                        <CheckSquare className="h-3 w-3" /> Opened
                        {event.metadata.clickCount > 0 && ` · ${event.metadata.clickCount} click${event.metadata.clickCount > 1 ? "s" : ""}`}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function InsightBadge({ insight, index }) {
    const styles = {
        warning: { border: "border-amber-200 bg-amber-50", icon: "text-amber-500", text: "text-amber-800" },
        danger:  { border: "border-red-200 bg-red-50",   icon: "text-red-500",   text: "text-red-800" },
        info:    { border: "border-blue-200 bg-blue-50",  icon: "text-blue-500",  text: "text-blue-800" },
    };
    const s = styles[insight.level] ?? styles.info;
    const Icon = insight.level === "warning" ? AlertTriangle : Info;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${s.border}`}
        >
            <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${s.icon}`} />
            <span className={`text-xs ${s.text}`}>{insight.text}</span>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadJourney() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [filter, setFilter] = useState("all");
    const [search, setSearch]  = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [searchTimer, setSearchTimer] = useState(null);

    const handleSearchChange = (v) => {
        setSearch(v);
        if (searchTimer) clearTimeout(searchTimer);
        setSearchTimer(setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 350));
    };

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ["lead-journey", id, filter, debouncedSearch, page],
        queryFn: () =>
            api.get(`/leads/${id}/journey`, {
                params: { filter, search: debouncedSearch || undefined, page },
            }).then(r => r.data),
        keepPreviousData: true,
        staleTime: 30_000,
    });

    const lead   = data?.lead;
    const stats  = data?.stats;
    const trend  = data?.trend ?? [];
    const groups = data?.groups ?? [];
    const insights = data?.insights ?? [];
    const pagination = data?.pagination;

    const handleFilterChange = (f) => { setFilter(f); setPage(1); };

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

            {/* ── Back nav ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(`/leads/${id}`)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to lead
                </button>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                </div>
            ) : !lead ? (
                <div className="text-center py-20 text-gray-400">Lead not found</div>
            ) : (
                <>
                    {/* ── Lead header ───────────────────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h1 className="text-xl font-black text-gray-900">{lead.name}</h1>
                                    {(lead.departments ?? []).map(d => (
                                        <span key={d.department} className="text-xs font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100">
                                            {d.department?.replace(/_/g, " ")} · {d.stage?.replace(/_/g, " ")}
                                        </span>
                                    ))}
                                    {lead.score > 0 && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            Score: {lead.score}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                    {(lead.departments ?? []).some(d => d.assignedEmployee) && (
                                        <span className="flex items-center gap-1"><User className="h-3 w-3" />
                                            {(lead.departments ?? []).filter(d => d.assignedEmployee).map(d => d.assignedEmployee.name).join(", ")}
                                        </span>
                                    )}
                                    {lead.source && (
                                        <span className="flex items-center gap-1">
                                            <Zap className="h-3 w-3" />{getSourceLabel(lead)}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Created {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                    {stats?.lastContact && (
                                        <span className="flex items-center gap-1">
                                            <Activity className="h-3 w-3" />
                                            Last contact {relTime(stats.lastContact)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <Link
                                to={`/leads/${id}`}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
                            >
                                Open lead detail →
                            </Link>
                        </div>
                    </motion.div>

                    {/* ── KPI cards ──────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[
                            { label: "Total Interactions", value: stats?.totalInteractions, icon: Activity, color: "text-indigo-600" },
                            { label: "Calls",              value: stats?.calls,             icon: Phone,    color: "text-green-600" },
                            { label: "Emails",             value: stats?.emails,            icon: Mail,     color: "text-blue-600" },
                            { label: "WhatsApp",           value: stats?.whatsapp,          icon: MessageSquare, color: "text-emerald-600" },
                            { label: "Tasks",              value: stats?.tasks,             icon: CheckSquare, color: "text-violet-600" },
                            { label: "Days Active",        value: stats?.daysActive,        icon: Clock,    color: "text-amber-600" },
                            { label: "Response Rate",      value: stats?.responseRate != null ? `${stats.responseRate}%` : "—", icon: TrendingUp, color: "text-rose-600" },
                        ].map((s, i) => (
                            <StatCard key={s.label} {...s} index={i} />
                        ))}
                    </div>

                    {/* ── Insights ───────────────────────────────────────── */}
                    {insights.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                <Zap className="h-4 w-4 text-amber-500" /> Journey Insights
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {insights.map((ins, i) => <InsightBadge key={i} insight={ins} index={i} />)}
                            </div>
                        </div>
                    )}

                    {/* ── Analytics ──────────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Interaction trend */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                                <BarChart2 className="h-4 w-4 text-indigo-500" /> Interaction Trend (14 days)
                            </h3>
                            <ResponsiveContainer width="100%" height={160}>
                                <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                    <defs>
                                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#trendGrad)" name="Interactions" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Channel breakdown */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                                <Activity className="h-4 w-4 text-emerald-500" /> Channel Breakdown
                            </h3>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart
                                    data={[
                                        { name: "Calls",    value: stats?.calls ?? 0,    fill: "#22c55e" },
                                        { name: "Email",    value: stats?.emails ?? 0,   fill: "#3b82f6" },
                                        { name: "WhatsApp", value: stats?.whatsapp ?? 0, fill: "#10b981" },
                                        { name: "Tasks",    value: stats?.tasks ?? 0,    fill: "#8b5cf6" },
                                        { name: "Notes",    value: stats?.notes ?? 0,    fill: "#f59e0b" },
                                    ]}
                                    margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                                        {[
                                            { name: "Calls", fill: "#22c55e" }, { name: "Email", fill: "#3b82f6" },
                                            { name: "WhatsApp", fill: "#10b981" }, { name: "Tasks", fill: "#8b5cf6" },
                                            { name: "Notes", fill: "#f59e0b" },
                                        ].map((e, i) => (
                                            <motion.rect key={e.name} fill={e.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ── Touchpoint Summary ──────────────────────────────── */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Touchpoint Summary</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs">
                            {[
                                { label: "First Contact", value: stats?.firstContact ? new Date(stats.firstContact).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—" },
                                { label: "Last Contact",  value: stats?.lastContact  ? new Date(stats.lastContact).toLocaleDateString("en-IN",  { day: "numeric", month: "short" }) : "—" },
                                { label: "Days Active",   value: stats?.daysActive != null ? `${stats.daysActive}d` : "—" },
                                { label: "Follow-ups",    value: stats?.followUps ?? 0 },
                                { label: "Response Rate", value: stats?.responseRate != null ? `${stats.responseRate}%` : "—" },
                                { label: "Total Events",  value: pagination?.total ?? 0 },
                            ].map(item => (
                                <div key={item.label} className="text-center">
                                    <p className="text-gray-400 mb-0.5">{item.label}</p>
                                    <p className="font-bold text-gray-800 text-base">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Timeline ───────────────────────────────────────── */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* Filter + search bar */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {FILTERS.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => handleFilterChange(f.id)}
                                        className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                                            filter === f.id
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                                placeholder="Search messages, subjects, activities…"
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400"
                            />
                        </div>

                        {/* Timeline groups */}
                        <div className="p-4 space-y-6">
                            {isFetching && groups.length === 0 && (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                                </div>
                            )}

                            {groups.length === 0 && !isFetching && (
                                <div className="text-center py-10 text-gray-400 text-sm">No events found</div>
                            )}

                            <AnimatePresence mode="popLayout">
                                {groups.map((group, gi) => (
                                    <motion.div
                                        key={group.day}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                                {dayLabel(group.day)}
                                            </span>
                                            <div className="flex-1 h-px bg-gray-100" />
                                        </div>
                                        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
                                            {group.events.map((evt, ei) => (
                                                <EventCard key={evt.id} event={evt} index={gi * 10 + ei} />
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                    {pagination.total} events · Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors font-medium"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={page >= pagination.totalPages}
                                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors font-medium"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
