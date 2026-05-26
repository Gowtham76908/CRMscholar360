import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";
import {
    CheckCircle, Circle, Clock, ArrowRight, Sparkles,
    Users, AlertCircle, Bell, Phone, MessageSquare, X,
    TrendingUp, Target, UserCheck, IndianRupee, Receipt,
    Wallet, BarChart2, Trophy, Banknote, TrendingDown, KanbanSquare,
    CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

const isSuperAdmin = (role) => role === "SUPER_ADMIN";
const isManager    = (role) => role === "SUPER_ADMIN" || role === "MANAGER";

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

const fmtINR = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
    return `₹${v.toLocaleString("en-IN")}`;
};

const STATUS_BADGE = {
    NEW: "info", CONTACTED: "indigo", FOLLOW_UP: "warning",
    CONVERTED: "success", LOST: "error",
};
const STATUS_LABEL = {
    NEW: "New", CONTACTED: "Contacted", FOLLOW_UP: "Follow Up",
    CONVERTED: "Converted", LOST: "Lost",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, accent = "indigo" }) {
    const colors = {
        indigo:  "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        amber:   "bg-amber-50 text-amber-600",
        red:     "bg-red-50 text-red-600",
        violet:  "bg-violet-50 text-violet-600",
        sky:     "bg-sky-50 text-sky-600",
        rose:    "bg-rose-50 text-rose-600",
    };
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colors[accent]}`}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-black text-gray-900 leading-tight">{value ?? "—"}</p>
                {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── AI Digest ────────────────────────────────────────────────────────────────

function AIDigestCard({ followUp, overdueTasks, pendingTasks, upcomingReminders, userName }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["ai-digest", followUp, overdueTasks, pendingTasks, upcomingReminders],
        queryFn: () =>
            api.post("/ai/digest", { followUp, overdueTasks, pendingTasks, upcomingReminders, userName })
               .then(r => r.data.digest),
        staleTime: 30 * 60 * 1000,
        gcTime:    60 * 60 * 1000,
        retry: false,
    });

    return (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-widest">AI Digest</span>
                {data && <span className="ml-auto text-[10px] text-violet-400">AI</span>}
            </div>
            {isLoading ? (
                <div className="flex items-center gap-2">
                    {[0, 150, 300].map(d => (
                        <div key={d} className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                </div>
            ) : isError ? (
                <p className="text-xs text-violet-700">
                    {followUp > 0 && <><span className="font-semibold">{followUp} leads</span> need follow-up. </>}
                    {overdueTasks > 0 && <><span className="font-semibold">{overdueTasks} tasks</span> are overdue. </>}
                    {followUp === 0 && overdueTasks === 0 && "Your workload looks clear. Great job!"}
                </p>
            ) : (
                <p className="text-xs text-violet-800 leading-relaxed">{data}</p>
            )}
        </div>
    );
}

// ─── Action Queue Item ────────────────────────────────────────────────────────

function ActionItem({ lead, snoozed, onSnooze }) {
    const navigate = useNavigate();
    const due = dueSoonLabel(lead.nextFollowUpAt ?? lead.updatedAt);
    if (snoozed) return null;
    return (
        <div className={cn(
            "group rounded-lg border transition-all",
            due?.variant === "error"
                ? "border-red-100 bg-red-50/30 hover:border-red-200"
                : "border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30"
        )}>
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-700">
                    {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.phone || lead.email || "No contact"}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {due && <Badge variant={due.variant} size="sm">{due.label}</Badge>}
                    <Badge variant={STATUS_BADGE[lead.status]} size="sm">{STATUS_LABEL[lead.status]}</Badge>
                </div>
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
        </div>
    );
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({ task, onComplete }) {
    const navigate = useNavigate();
    const due = dueSoonLabel(task.dueDate);
    return (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors group cursor-pointer"
            onClick={() => navigate(`/tasks/${task.id}`)}>
            <button onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                className="shrink-0 text-gray-300 hover:text-emerald-500 transition-colors" title="Mark complete">
                <Circle className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{task.title}</p>
                {task.lead && <p className="text-xs text-gray-400 truncate">{task.lead.name}</p>}
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
    );
}

// ─── Reminder Item ────────────────────────────────────────────────────────────

function ReminderItem({ reminder }) {
    const d = new Date(reminder.remindAt);
    const isToday = d.toDateString() === new Date().toDateString();
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <Bell className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">{reminder.message}</p>
                {reminder.lead && (
                    <Link to={`/leads/${reminder.lead.id}`} className="text-xs text-indigo-500 hover:underline truncate block">
                        {reminder.lead.name}
                    </Link>
                )}
            </div>
            <span className="text-[11px] font-semibold text-amber-600 shrink-0">
                {isToday
                    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, to, linkLabel = "View all →", accent = "indigo" }) {
    const colors = { indigo: "text-indigo-500", emerald: "text-emerald-500", amber: "text-amber-500" };
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${colors[accent]}`} />
                <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            </div>
            {to && (
                <Link to={to} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    {linkLabel}
                </Link>
            )}
        </div>
    );
}

// ─── Team Table (Manager/Admin) ───────────────────────────────────────────────

function TeamTable({ data, navigate }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-900">My Team — Lead Performance</h2>
                </div>
                <Link to="/team-performance" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    Full report →
                </Link>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Converted</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Win Rate</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.map((m) => (
                            <tr key={m.userId} className="hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => navigate(`/employee-report/${m.userId}`)}>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 leading-tight">{m.name}</p>
                                            <p className="text-[10px] text-gray-400 capitalize">{m.role.replace("_", " ").toLowerCase()}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-center px-3 py-2.5 text-sm font-semibold text-gray-700">{m.total}</td>
                                <td className="text-center px-3 py-2.5 text-sm font-semibold text-emerald-600">{m.converted}</td>
                                <td className="text-center px-3 py-2.5 text-sm font-semibold text-amber-600">{m.followUp}</td>
                                <td className="text-center px-3 py-2.5">
                                    <span className={cn(
                                        "text-xs font-bold px-2 py-0.5 rounded-full",
                                        m.conversionRate >= 30 ? "bg-emerald-100 text-emerald-700" :
                                        m.conversionRate >= 15 ? "bg-amber-100 text-amber-700" :
                                        "bg-red-100 text-red-700"
                                    )}>
                                        {m.conversionRate}%
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 w-32">
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${Math.min(m.conversionRate, 100)}%` }} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Operational Panel (Action Queue + Tasks + Reminders) ────────────────────

function OperationalPanel({ actionQueue, pendingTasks, upcomingReminders, isSnoozed, handleSnooze, completeTask, stats, user }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Action Queue */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900">Action Queue</h2>
                    <Badge variant="warning" size="sm">{actionQueue.length}</Badge>
                </div>
                <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
                    {actionQueue.length > 0
                        ? actionQueue.map(lead => (
                            <ActionItem key={lead.id} lead={lead} snoozed={isSnoozed(lead.id)} onSnooze={handleSnooze} />
                        ))
                        : <p className="text-xs text-gray-400 text-center py-6">No leads need action right now</p>
                    }
                </div>
            </div>

            {/* My Tasks */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900">My Tasks</h2>
                    <Badge variant={pendingTasks.length > 0 ? "error" : "success"} size="sm">
                        {pendingTasks.length} pending
                    </Badge>
                </div>
                <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
                    {pendingTasks.length > 0
                        ? pendingTasks.slice(0, 8).map(task => (
                            <TaskItem key={task.id} task={task} onComplete={(id) => completeTask.mutate(id)} />
                        ))
                        : (
                            <div className="flex flex-col items-center justify-center py-8 gap-2">
                                <CheckCircle className="h-8 w-8 text-emerald-300" />
                                <p className="text-xs text-gray-400">All tasks done!</p>
                            </div>
                        )
                    }
                </div>
            </div>

            {/* Reminders + AI */}
            <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-900">Reminders</h2>
                        <Bell className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <div className="p-3 space-y-1.5">
                        {upcomingReminders.length > 0
                            ? upcomingReminders.map(r => <ReminderItem key={r.id} reminder={r} />)
                            : <p className="text-xs text-gray-400 text-center py-4">No upcoming reminders</p>
                        }
                    </div>
                </div>
                <AIDigestCard
                    followUp={stats?.followUp ?? 0}
                    overdueTasks={pendingTasks.filter(t => dueSoonLabel(t.dueDate)?.variant === "error").length}
                    pendingTasks={pendingTasks.length}
                    upcomingReminders={upcomingReminders.length}
                    userName={user?.name?.split(" ")[0] ?? ""}
                />
            </div>
        </div>
    );
}

// ─── Deal Pipeline Section ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
    { id: "NEW",         label: "New",         bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   amt: "text-blue-600"   },
    { id: "NEGOTIATION", label: "Negotiation", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", amt: "text-orange-600" },
    { id: "WON",         label: "Won",         bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  amt: "text-green-600"  },
    { id: "LOST",        label: "Lost",        bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    amt: "text-red-500"    },
];

function DealPipelineSection({ pipeline }) {
    const navigate = useNavigate();
    const cols = pipeline.columns ?? {};
    const kpi  = pipeline.kpi ?? {};

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <KanbanSquare className="h-4 w-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-900">Deal Pipeline</h2>
                    {kpi.totalDeals > 0 && (
                        <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {kpi.totalDeals} deals
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {kpi.winRate != null && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {kpi.winRate}% win rate
                        </span>
                    )}
                    <Link to="/deals" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                        All deals →
                    </Link>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
                {PIPELINE_STAGES.map(s => {
                    const deals = cols[s.id] ?? [];
                    const total = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
                    return (
                        <button key={s.id}
                            onClick={() => navigate(`/deals?stage=${s.id}`)}
                            className={`flex flex-col items-center justify-center py-5 gap-1 transition-colors hover:${s.bg} group`}
                        >
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${s.text}`}>{s.label}</span>
                            <span className="text-2xl font-black text-gray-900 group-hover:scale-105 transition-transform">{deals.length}</span>
                            <span className={`text-xs font-semibold ${s.amt}`}>{fmtINR(total)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Overdue Follow-ups Widget ────────────────────────────────────────────────

function OverdueFollowUpsWidget({ leads }) {
    if (!leads?.length) return null;

    const daysOverdue = (date) => {
        const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
        return d <= 0 ? "Today" : d === 1 ? "1 day overdue" : `${d} days overdue`;
    };

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-red-500" />
                    <h2 className="text-sm font-semibold text-gray-900">Overdue Follow-ups</h2>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                        {leads.length}
                    </span>
                </div>
                <Link to="/leads?status=FOLLOW_UP" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    View all →
                </Link>
            </div>
            <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-50">
                {leads.map(lead => (
                    <Link
                        key={lead.id}
                        to={`/leads/${lead.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-red-50/40 transition-colors"
                    >
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xs font-bold text-red-700">
                            {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                            <p className="text-xs text-gray-400 truncate">{lead.phone || lead.email || "No contact"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                {daysOverdue(lead.nextFollowUpAt)}
                            </span>
                            {lead.assignedTo && (
                                <span className="text-[10px] text-gray-400">{lead.assignedTo.name}</span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
    const { user } = useAuth();
    const navigate  = useNavigate();
    const queryClient = useQueryClient();

    const [snoozed, setSnoozed] = useState({});
    const handleSnooze = (leadId) => {
        setSnoozed(prev => ({ ...prev, [leadId]: Date.now() + 3_600_000 }));
        toast("Snoozed for 1 hour");
    };
    const isSnoozed = (leadId) => snoozed[leadId] && snoozed[leadId] > Date.now();

    // ── Shared queries ─────────────────────────────────────────────────────────
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["dashboard-stats"],
        queryFn: () => api.get("/leads/stats").then(r => r.data),
        staleTime: 120_000,
    });

    const { data: leadsData, isLoading: leadsLoading } = useQuery({
        queryKey: ["leads", "action-queue"],
        queryFn: () => api.get("/leads", {
            params: { limit: 10, status: "FOLLOW_UP,CONTACTED,NEW", sortBy: "updatedAt", sortOrder: "asc" }
        }).then(r => r.data.data || r.data),
        staleTime: 120_000,
    });

    const { data: tasks, isLoading: tasksLoading } = useQuery({
        queryKey: ["tasks", "my-pending"],
        queryFn: () => api.get("/tasks").then(r => r.data.data ?? r.data),
        staleTime: 120_000,
    });

    const { data: reminders, isLoading: remindersLoading } = useQuery({
        queryKey: ["reminders", "upcoming"],
        queryFn: () => api.get("/reminders").then(r => r.data.data ?? r.data),
        staleTime: 120_000,
    });

    // ── Manager / Admin queries ────────────────────────────────────────────────
    const { data: teamStats = [] } = useQuery({
        queryKey: ["team-stats"],
        queryFn: () => api.get("/leads/team-stats").then(r => r.data),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const { data: revKPIs = {} } = useQuery({
        queryKey: ["dash-rev-kpis"],
        queryFn: () => api.get("/team-performance/revenue-kpis").then(r => r.data ?? {}),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const { data: pipeline = { columns: {}, kpi: {} } } = useQuery({
        queryKey: ["dash-pipeline"],
        queryFn: () => api.get("/deals/pipeline").then(r => r.data),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const { data: overdueLeads = [] } = useQuery({
        queryKey: ["overdue-followups"],
        queryFn: () => api.get("/leads/overdue-followups").then(r => r.data),
        staleTime: 60_000,
        retry: false,
    });

    // ── Employee own revenue query ─────────────────────────────────────────────
    const { data: myRevKPIs } = useQuery({
        queryKey: ["dash-my-rev-kpis", user?.id],
        queryFn: () => api.get(`/employee-report/${user.id}/revenue-kpis`).then(r => r.data),
        enabled: !isManager(user?.role) && !!user?.id,
        staleTime: 60_000,
        retry: false,
    });

    const completeTask = useMutation({
        mutationFn: (id) => api.patch(`/tasks/${id}`, { status: "COMPLETED" }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task marked complete"); },
        onError: () => toast.error("Failed to update task"),
    });

    const isLoading = statsLoading || leadsLoading || tasksLoading || remindersLoading;
    if (isLoading) return <DashboardSkeleton />;

    const pendingTasks      = (tasks || []).filter(t => t.status === "PENDING");
    const upcomingReminders = (reminders || []).filter(r => !r.isSent).slice(0, 5);
    const actionQueue       = (leadsData || []).slice(0, 8);
    const hour              = new Date().getHours();
    const greeting          = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const operationalProps = {
        actionQueue, pendingTasks, upcomingReminders,
        isSnoozed, handleSnooze, completeTask, stats, user,
    };

    // ══════════════════════════════════════════════════════════════════════════
    // SUPER ADMIN VIEW
    // ══════════════════════════════════════════════════════════════════════════
    if (isSuperAdmin(user?.role)) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <header className="flex items-end justify-between">
                    <div>
                        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-0.5">Super Admin</p>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            {greeting}, {user?.name?.split(" ")[0] ?? "there"}
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                    </div>
                    <Link to="/team-performance" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        Full analytics <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </header>

                {/* My Lead KPIs */}
                <section>
                    <SectionHeader icon={Users} title="Organisation — Lead Overview" to="/leads" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KPICard label="Total Leads"     value={stats?.total}        sub="All time"                             icon={Users}       accent="indigo" />
                        <KPICard label="Follow-ups"      value={stats?.followUp}     sub="Need action"                          icon={Clock}       accent="amber" />
                        <KPICard label="Converted"       value={stats?.converted}    sub={`${stats?.conversionRate ?? 0}% rate`} icon={CheckCircle} accent="emerald" />
                        <KPICard label="My Pending Tasks" value={pendingTasks.length} sub="Assigned to me"                      icon={AlertCircle} accent="red" />
                    </div>
                </section>

                {/* Revenue KPIs */}
                <section>
                    <SectionHeader icon={IndianRupee} title="Organisation — Revenue Overview" to="/team-performance" accent="emerald" />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <KPICard label="Pipeline Value"   value={fmtINR(revKPIs.pipelineValue)}   sub="Active deals"         icon={BarChart2}    accent="indigo" />
                            <KPICard label="Won Revenue"      value={fmtINR(revKPIs.wonRevenue)}      sub="Closed deals"         icon={Trophy}       accent="emerald" />
                            <KPICard label="Collected"        value={fmtINR(revKPIs.collectedRevenue)} sub="Payments received"   icon={Wallet}       accent="sky" />
                            <KPICard label="Outstanding"      value={fmtINR(revKPIs.outstandingRevenue)} sub="Yet to collect"   icon={TrendingDown} accent="red" />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                            <KPICard label="Realized Revenue" value={fmtINR(revKPIs.realizedRevenue)} sub="Credit payments"      icon={IndianRupee}  accent="emerald" />
                            <KPICard label="Pending Revenue"  value={fmtINR(revKPIs.pendingRevenue)}  sub="Invoiced, unpaid"     icon={Receipt}      accent="amber" />
                            <KPICard label="Avg Deal Size"    value={fmtINR(revKPIs.avgDealSize)}     sub="Won deals"            icon={Banknote}     accent="violet" />
                            <KPICard label="Win Rate"         value={`${revKPIs.winRate ?? 0}%`}      sub={`${revKPIs.wonCount ?? 0} of ${revKPIs.totalDeals ?? 0} deals`} icon={Target} accent="indigo" />
                        </div>
                    </section>

                {/* Deal Pipeline */}
                <DealPipelineSection pipeline={pipeline} />

                {/* Team Table */}
                {teamStats.length > 0 && <TeamTable data={teamStats} navigate={navigate} />}

                {/* Overdue Follow-ups */}
                <OverdueFollowUpsWidget leads={overdueLeads} />

                {/* Operational */}
                <OperationalPanel {...operationalProps} />
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MANAGER VIEW
    // ══════════════════════════════════════════════════════════════════════════
    if (isManager(user?.role)) {
        const teamTotal     = teamStats.reduce((s, m) => s + m.total, 0);
        const teamConverted = teamStats.reduce((s, m) => s + m.converted, 0);
        const teamFollowUp  = teamStats.reduce((s, m) => s + m.followUp, 0);
        const teamWinRate   = teamTotal > 0 ? Math.round((teamConverted / teamTotal) * 100) : 0;

        return (
            <div className="space-y-6">
                {/* Header */}
                <header className="flex items-end justify-between">
                    <div>
                        <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-0.5">Manager</p>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            {greeting}, {user?.name?.split(" ")[0] ?? "there"}
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                    </div>
                    <Link to="/team-performance" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        Full team report <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </header>

                {/* Team Lead KPIs — aggregated across all assigned employees */}
                <section>
                    <SectionHeader icon={Users} title="Team Lead Overview" to="/leads" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KPICard label="Team Total Leads"  value={teamTotal}             sub={`Across ${teamStats.length} members`}   icon={Users}       accent="indigo" />
                        <KPICard label="Team Converted"    value={teamConverted}         sub={`${teamWinRate}% team win rate`}        icon={CheckCircle} accent="emerald" />
                        <KPICard label="Team Follow-ups"   value={teamFollowUp}          sub="Need attention"                        icon={Clock}       accent="amber" />
                        <KPICard label="My Pending Tasks"  value={pendingTasks.length}   sub="Assigned to me"                        icon={AlertCircle} accent="red" />
                    </div>
                </section>

                {/* Team Revenue KPIs */}
                <section>
                    <SectionHeader icon={IndianRupee} title="Team Revenue Overview" to="/team-performance" accent="emerald" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KPICard label="Pipeline Value"   value={fmtINR(revKPIs.pipelineValue)}      sub="Active deals"                                                    icon={BarChart2}    accent="indigo" />
                        <KPICard label="Won Revenue"      value={fmtINR(revKPIs.wonRevenue)}         sub="Closed deals"                                                    icon={Trophy}       accent="emerald" />
                        <KPICard label="Collected"        value={fmtINR(revKPIs.collectedRevenue)}   sub="Payments received"                                               icon={Wallet}       accent="sky" />
                        <KPICard label="Outstanding"      value={fmtINR(revKPIs.outstandingRevenue)} sub="Yet to collect"                                                  icon={TrendingDown} accent="red" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                        <KPICard label="Realized Revenue" value={fmtINR(revKPIs.realizedRevenue)}   sub="Credit payments"                                                 icon={IndianRupee}  accent="emerald" />
                        <KPICard label="Pending Revenue"  value={fmtINR(revKPIs.pendingRevenue)}    sub="Invoiced, unpaid"                                                icon={Receipt}      accent="amber" />
                        <KPICard label="Avg Deal Size"    value={fmtINR(revKPIs.avgDealSize)}       sub="Won deals"                                                       icon={Banknote}     accent="violet" />
                        <KPICard label="Win Rate"         value={`${revKPIs.winRate ?? 0}%`}        sub={`${revKPIs.wonCount ?? 0} of ${revKPIs.totalDeals ?? 0} deals`} icon={Target}       accent="indigo" />
                    </div>
                </section>

                {/* Deal Pipeline */}
                <DealPipelineSection pipeline={pipeline} />

                {/* Team Performance Table */}
                {teamStats.length > 0 && <TeamTable data={teamStats} navigate={navigate} />}

                {/* Overdue Follow-ups */}
                <OverdueFollowUpsWidget leads={overdueLeads} />

                {/* Operational — manager's own action queue + tasks + reminders */}
                <section>
                    <SectionHeader icon={Clock} title="My Workload" />
                    <OperationalPanel {...operationalProps} />
                </section>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EMPLOYEE VIEW
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-xs font-semibold text-violet-500 uppercase tracking-widest mb-0.5">Sales Rep</p>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        {greeting}, {user?.name?.split(" ")[0] ?? "there"}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                </div>
                <Link to="/leads" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    My leads <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </header>

            {/* My Lead KPIs */}
            <section>
                <SectionHeader icon={Users} title="My Leads" />
                {stats?.total === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 bg-white border border-gray-200 rounded-xl">
                        <Users className="h-10 w-10 text-gray-200" />
                        <p className="text-sm font-semibold text-gray-500">No leads assigned yet</p>
                        <p className="text-xs text-gray-400">Leads assigned to you will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KPICard label="My Total Leads"   value={stats?.total}        sub="All time"                             icon={Users}       accent="indigo" />
                        <KPICard label="Converted"        value={stats?.converted}    sub={`${stats?.conversionRate ?? 0}% rate`} icon={UserCheck}   accent="emerald" />
                        <KPICard label="Need Follow-up"   value={stats?.followUp}     sub="Waiting on me"                        icon={Target}      accent="amber" />
                        <KPICard label="My Pending Tasks" value={pendingTasks.length} sub="Assigned to me"                       icon={AlertCircle} accent="red" />
                    </div>
                )}
            </section>

            {/* My Revenue KPIs */}
            {myRevKPIs && (
                <section>
                    <SectionHeader icon={IndianRupee} title="My Revenue" accent="emerald" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KPICard label="My Revenue"       value={fmtINR(myRevKPIs.revenueGenerated)} sub="Won deals"          icon={Trophy}       accent="emerald" />
                        <KPICard label="Collected"        value={fmtINR(myRevKPIs.collectedRevenue)} sub="Payments received"  icon={Wallet}       accent="sky" />
                        <KPICard label="Outstanding"      value={fmtINR(myRevKPIs.outstandingRevenue)} sub="Yet to collect"  icon={TrendingDown} accent="red" />
                        <KPICard label="My Contribution"  value={`${myRevKPIs.contributionPct ?? 0}%`} sub="Of team total"  icon={BarChart2}    accent="violet" />
                    </div>
                </section>
            )}

            {/* Overdue Follow-ups */}
            <OverdueFollowUpsWidget leads={overdueLeads} />

            {/* Operational */}
            <OperationalPanel {...operationalProps} />
        </div>
    );
};

export default Dashboard;
