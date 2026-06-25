import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";
import {
    CheckCircle, Circle, Bell, Phone, MessageSquare, X,
    ClipboardList, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

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
                    {lead.leadDepartments?.[0] && (
                        <Badge variant="indigo" size="sm">{lead.leadDepartments[0].stage?.replace(/_/g, " ")}</Badge>
                    )}
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

    // Fetch action queue (leads needing follow-up)
    const { data: leadsData, isLoading: leadsLoading } = useQuery({
        queryKey: ["leads", "action-queue"],
        queryFn: () => api.get("/leads", {
            params: { limit: 10, status: "FOLLOW_UP,CONTACTED,NEW", sortBy: "updatedAt", sortOrder: "asc" }
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

    const isLoading = leadsLoading || tasksLoading || remindersLoading;
    if (isLoading) return <DashboardSkeleton />;

    const pendingTasks = (tasks || []).filter(t => t.status === "PENDING");
    const upcomingReminders = (reminders || []).filter(r => !r.isSent).slice(0, 5);
    const actionQueue = (leadsData || []).slice(0, 8);

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-5">
                <div className="flex items-center gap-3">
                    <Calendar className="h-7 w-7 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-black text-indigo-950">My Day</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Your tasks and follow-up actions for today</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link 
                        to="/dashboard" 
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                    >
                        View Dashboard →
                    </Link>
                </div>
            </header>

            {/* Tasks & Follow-up Actions Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-lg font-bold text-indigo-950">Tasks & Follow-up Actions</h2>
                </div>
                
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

                    {/* Reminders */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <h2 className="text-sm font-semibold text-gray-900">Reminders</h2>
                            <Bell className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
                            {upcomingReminders.length > 0
                                ? upcomingReminders.map(r => <ReminderItem key={r.id} reminder={r} />)
                                : <p className="text-xs text-gray-400 text-center py-6">No upcoming reminders</p>
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-6 flex items-center justify-around">
                <div className="text-center">
                    <p className="text-3xl font-black text-indigo-950">{actionQueue.length}</p>
                    <p className="text-xs text-gray-600 font-medium mt-1">Follow-ups</p>
                </div>
                <div className="h-12 w-px bg-indigo-200"></div>
                <div className="text-center">
                    <p className="text-3xl font-black text-indigo-950">{pendingTasks.length}</p>
                    <p className="text-xs text-gray-600 font-medium mt-1">Pending Tasks</p>
                </div>
                <div className="h-12 w-px bg-indigo-200"></div>
                <div className="text-center">
                    <p className="text-3xl font-black text-indigo-950">{upcomingReminders.length}</p>
                    <p className="text-xs text-gray-600 font-medium mt-1">Reminders</p>
                </div>
            </div>
        </div>
    );
};

export default MyDay;
