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
    TrendingUp, Target, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

const isManager = (role) => ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD"].includes(role);

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

const STATUS_BADGE = {
    NEW:       "info",
    CONTACTED: "indigo",
    FOLLOW_UP: "warning",
    CONVERTED: "success",
    LOST:      "error",
};

const STATUS_LABEL = {
    NEW: "New", CONTACTED: "Contacted", FOLLOW_UP: "Follow Up",
    CONVERTED: "Converted", LOST: "Lost",
};

// ─── AI Digest Card ───────────────────────────────────────────────────────────

function AIDigestCard({ followUp, overdueTasks, pendingTasks, upcomingReminders, userName }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["ai-digest", followUp, overdueTasks, pendingTasks, upcomingReminders],
        queryFn: () =>
            api.post("/ai/digest", { followUp, overdueTasks, pendingTasks, upcomingReminders, userName })
               .then(r => r.data.digest),
        staleTime: 30 * 60 * 1000,  // 30 min — won't refetch until stale
        gcTime:    60 * 60 * 1000,  // keep in memory 1 hour
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
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = "indigo" }) {
    const colors = {
        indigo: "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        amber: "bg-amber-50 text-amber-600",
        red: "bg-red-50 text-red-600",
        violet: "bg-violet-50 text-violet-600",
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

// ─── Action Queue item ────────────────────────────────────────────────────────

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
            {/* Main row */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => navigate(`/leads/${lead.id}`)}
            >
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

            {/* Inline action bar — visible on hover */}
            <div className="hidden group-hover:flex items-center gap-1.5 px-3 pb-2.5">
                {lead.phone && (
                    <a
                        href={`tel:${lead.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-colors shadow-sm"
                    >
                        <Phone className="h-3 w-3" /> Call
                    </a>
                )}
                <button
                    onClick={e => { e.stopPropagation(); navigate(`/leads/${lead.id}?wa=1`); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors shadow-sm"
                >
                    <MessageSquare className="h-3 w-3" /> WhatsApp
                </button>
                <button
                    onClick={e => { e.stopPropagation(); onSnooze(lead.id); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors shadow-sm ml-auto"
                >
                    <X className="h-3 w-3" /> Snooze 1h
                </button>
            </div>
        </div>
    );
}

// ─── Task item ────────────────────────────────────────────────────────────────

function TaskItem({ task, onComplete }) {
    const navigate = useNavigate();
    const due = dueSoonLabel(task.dueDate);
    return (
        <div
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors group cursor-pointer"
            onClick={() => navigate(`/tasks/${task.id}`)}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                className="shrink-0 text-gray-300 hover:text-emerald-500 transition-colors"
                title="Mark complete"
            >
                <Circle className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{task.title}</p>
                {task.lead && (
                    <p className="text-xs text-gray-400 truncate">{task.lead.name}</p>
                )}
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

// ─── Reminder item ────────────────────────────────────────────────────────────

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

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Snooze: leadId → expiry timestamp (1 hour from snooze)
    const [snoozed, setSnoozed] = useState({});
    const handleSnooze = (leadId) => {
        setSnoozed(prev => ({ ...prev, [leadId]: Date.now() + 3600_000 }));
        toast("Snoozed for 1 hour");
    };
    const isSnoozed = (leadId) => snoozed[leadId] && snoozed[leadId] > Date.now();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["dashboard-stats"],
        queryFn: () => api.get("/leads/stats").then(r => r.data),
    });

    const { data: leadsData, isLoading: leadsLoading } = useQuery({
        queryKey: ["leads", "action-queue"],
        queryFn: () => api.get("/leads", {
            params: { limit: 10, status: "FOLLOW_UP,CONTACTED,NEW", sortBy: "updatedAt", sortOrder: "asc" }
        }).then(r => r.data.data || r.data),
    });

    const { data: tasks, isLoading: tasksLoading } = useQuery({
        queryKey: ["tasks", "my-pending"],
        queryFn: () => api.get("/tasks").then(r => r.data.data ?? r.data),
    });

    const { data: reminders, isLoading: remindersLoading } = useQuery({
        queryKey: ["reminders", "upcoming"],
        queryFn: () => api.get("/reminders").then(r => r.data.data ?? r.data),
    });

    const completeTask = useMutation({
        mutationFn: (id) => api.patch(`/tasks/${id}`, { status: "COMPLETED" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            toast.success("Task marked complete");
        },
        onError: () => toast.error("Failed to update task"),
    });

    const { data: teamStats = [] } = useQuery({
        queryKey: ["team-stats"],
        queryFn: () => api.get("/leads/team-stats").then(r => r.data),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const isLoading = statsLoading || leadsLoading || tasksLoading || remindersLoading;
    if (isLoading) return <DashboardSkeleton />;

    const pendingTasks    = (tasks || []).filter(t => t.status === "PENDING");
    const upcomingReminders = (reminders || []).filter(r => !r.isSent).slice(0, 5);
    const actionQueue     = (leadsData || []).slice(0, 8);
    const hour            = new Date().getHours();
    const greeting        = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    return (
        <div className="space-y-5">
            {/* Header */}
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        {greeting}, {user?.name?.split(" ")[0] ?? "there"}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                </div>
                <Link
                    to="/leads"
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                    All leads <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </header>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Leads"       value={stats?.total}     sub="All time"              icon={Users}       accent="indigo" />
                <StatCard label="Follow Ups"        value={stats?.followUp}  sub="Need action"           icon={Clock}       accent="amber" />
                <StatCard label="Converted"         value={stats?.converted} sub={`${stats?.conversionRate ?? 0}% rate`} icon={CheckCircle} accent="emerald" />
                <StatCard label="Pending Tasks"     value={pendingTasks.length} sub="Assigned to me"    icon={AlertCircle} accent="red" />
            </div>

            {/* Manager: Team Performance */}
            {isManager(user?.role) && teamStats.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                            <h2 className="text-sm font-semibold text-gray-900">Team Performance</h2>
                        </div>
                        <span className="text-xs text-gray-400">{teamStats.length} members</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Converted</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {teamStats.map((member) => (
                                    <tr key={member.userId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 leading-tight">{member.name}</p>
                                                    <p className="text-[10px] text-gray-400 capitalize">{member.role.replace("_", " ").toLowerCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center px-3 py-2.5 text-sm font-semibold text-gray-700">{member.total}</td>
                                        <td className="text-center px-3 py-2.5">
                                            <span className="text-sm font-semibold text-emerald-600">{member.converted}</span>
                                        </td>
                                        <td className="text-center px-3 py-2.5">
                                            <span className="text-sm font-semibold text-amber-600">{member.followUp}</span>
                                        </td>
                                        <td className="text-center px-3 py-2.5">
                                            <span className={cn(
                                                "text-xs font-bold px-2 py-0.5 rounded-full",
                                                member.conversionRate >= 30 ? "bg-emerald-100 text-emerald-700" :
                                                member.conversionRate >= 15 ? "bg-amber-100 text-amber-700" :
                                                "bg-red-100 text-red-700"
                                            )}>
                                                {member.conversionRate}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 w-32">
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${Math.min(member.conversionRate, 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Employee: Personal KPI row */}
            {!isManager(user?.role) && stats && (
                stats.total === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 bg-white border border-gray-200 rounded-xl">
                        <Users className="h-10 w-10 text-gray-200" />
                        <p className="text-sm font-semibold text-gray-500">No leads assigned yet</p>
                        <p className="text-xs text-gray-400">Leads assigned to you will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                            <p className="text-xs text-indigo-500 font-medium">My Leads</p>
                            <p className="text-2xl font-black text-indigo-700">{stats.total}</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                            <p className="text-xs text-emerald-500 font-medium flex items-center justify-center gap-1">
                                <UserCheck className="h-3 w-3" /> Converted
                            </p>
                            <p className="text-2xl font-black text-emerald-700">{stats.converted}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                            <p className="text-xs text-amber-500 font-medium flex items-center justify-center gap-1">
                                <Target className="h-3 w-3" /> Follow-ups
                            </p>
                            <p className="text-2xl font-black text-amber-700">{stats.followUp}</p>
                        </div>
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
                            <p className="text-xs text-violet-500 font-medium">Conversion Rate</p>
                            <p className="text-2xl font-black text-violet-700">{stats.conversionRate ?? 0}%</p>
                        </div>
                    </div>
                )
            )}

            {/* 3-Column operational layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Col 1 — Action Queue */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-900">Action Queue</h2>
                        <Badge variant="warning" size="sm">{actionQueue.length}</Badge>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto">
                        {actionQueue.length > 0
                            ? actionQueue.map(lead => <ActionItem key={lead.id} lead={lead} snoozed={isSnoozed(lead.id)} onSnooze={handleSnooze} />)
                            : <p className="text-xs text-gray-400 text-center py-6">No leads need action right now</p>
                        }
                    </div>
                </div>

                {/* Col 2 — My Tasks */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-900">My Tasks</h2>
                        <Badge variant={pendingTasks.length > 0 ? "error" : "success"} size="sm">
                            {pendingTasks.length} pending
                        </Badge>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto">
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

                {/* Col 3 — Reminders + AI Digest */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Reminders */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <h2 className="text-sm font-semibold text-gray-900">Upcoming Reminders</h2>
                            <Bell className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <div className="p-3 space-y-1.5">
                            {upcomingReminders.length > 0
                                ? upcomingReminders.map(r => <ReminderItem key={r.id} reminder={r} />)
                                : <p className="text-xs text-gray-400 text-center py-4">No upcoming reminders</p>
                            }
                        </div>
                    </div>

                    {/* AI Digest */}
                    <AIDigestCard
                        followUp={stats?.followUp ?? 0}
                        overdueTasks={pendingTasks.filter(t => dueSoonLabel(t.dueDate)?.variant === "error").length}
                        pendingTasks={pendingTasks.length}
                        upcomingReminders={upcomingReminders.length}
                        userName={user?.name?.split(" ")[0] ?? ""}
                    />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
