import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Plus, Loader2, Play, CheckCircle, Trash2, X,
    ChevronRight, Calendar, Target, ArrowRight,
    AlertCircle, ArrowUp, Minus, ArrowDown, BarChart2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import TaskModal from "../components/TaskModal";

// ── Config ────────────────────────────────────────────────────────────────────

const PRIORITY_META = {
    CRITICAL: { cls: "text-red-600 bg-red-50 border-red-200",     icon: <AlertCircle className="h-3 w-3" /> },
    HIGH:     { cls: "text-orange-600 bg-orange-50 border-orange-200", icon: <ArrowUp  className="h-3 w-3" /> },
    MEDIUM:   { cls: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: <Minus    className="h-3 w-3" /> },
    LOW:      { cls: "text-green-700 bg-green-50 border-green-200",   icon: <ArrowDown className="h-3 w-3" /> },
};
const TYPE_EMOJI = { EPIC: "🟣", STORY: "🟢", TASK: "🔵", BUG: "🔴", SUBTASK: "⚪" };

const STATUS_BADGE = {
    PLANNING:  "bg-gray-100 text-gray-600",
    ACTIVE:    "bg-green-100 text-green-700",
    COMPLETED: "bg-blue-100 text-blue-600",
    CANCELLED: "bg-red-100 text-red-600",
};

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const initials = (name = "") => name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

// ── Sprint Form Modal ─────────────────────────────────────────────────────────

const SprintFormModal = ({ sprint, onClose }) => {
    const queryClient = useQueryClient();
    const isEdit = !!sprint;
    const today = new Date().toISOString().split("T")[0];
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

    const [form, setForm] = useState({
        name:      sprint?.name ?? `Sprint ${Date.now().toString().slice(-4)}`,
        goal:      sprint?.goal ?? "",
        startDate: sprint?.startDate?.split("T")[0] ?? today,
        endDate:   sprint?.endDate?.split("T")[0]   ?? twoWeeks,
    });
    const [error, setError] = useState("");
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const mutation = useMutation({
        mutationFn: (d) => isEdit ? api.put(`/sprints/${sprint.id}`, d) : api.post("/sprints", d),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sprints"] }); onClose(); },
        onError: (e) => setError(e.response?.data?.message || "Failed to save sprint"),
    });

    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.startDate || !form.endDate) return setError("Name, start and end date are required");
        if (new Date(form.startDate) >= new Date(form.endDate)) return setError("End date must be after start date");
        mutation.mutate(form);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Sprint" : "New Sprint"}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-5 space-y-4">
                    {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sprint Name *</label>
                        <input value={form.name} onChange={e => set("name", e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sprint Goal</label>
                        <textarea value={form.goal} onChange={e => set("goal", e.target.value)} rows={2}
                            placeholder="What will be achieved in this sprint?"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Date *</label>
                            <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End Date *</label>
                            <input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                        <button type="submit" disabled={mutation.isPending}
                            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? "Save" : "Create Sprint"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Backlog Task Row ──────────────────────────────────────────────────────────

const BacklogRow = ({ task, sprintId, onEdit, onDelete, sprints }) => {
    const queryClient = useQueryClient();
    const pm = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;

    const addToSprintMutation = useMutation({
        mutationFn: (sid) => api.post(`/sprints/${sid}/tasks`, { taskIds: [task.id] }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
            queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to add task to sprint"),
    });

    const removeFromSprintMutation = useMutation({
        mutationFn: () => api.delete(`/sprints/${sprintId}/tasks/${task.id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
            queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to remove task from sprint"),
    });

    const plannable = sprints.filter(s => s.status !== "COMPLETED");
    const isInSprint = !!task.sprint;
    const isOverdue = task.kanbanStatus !== "DONE" && new Date(task.dueDate) < new Date();

    return (
        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors group">
            <span className="text-base flex-shrink-0">{TYPE_EMOJI[task.type] || "🔵"}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium ${pm.cls}`}>
                        {pm.icon}{task.priority}
                    </span>
                    {task.storyPoints && (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{task.storyPoints}sp</span>
                    )}
                    {task.assignedTo && (
                        <span className="text-xs text-gray-400">{task.assignedTo.name}</span>
                    )}
                    {isOverdue && <span className="text-xs text-red-500 font-medium">⚠ Overdue</span>}
                </div>
            </div>
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"} flex-shrink-0`}>
                {fmtDate(task.dueDate)}
            </span>

            {/* Sprint actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isInSprint ? (
                    <button
                        onClick={() => removeFromSprintMutation.mutate()}
                        disabled={removeFromSprintMutation.isPending}
                        title="Remove from sprint"
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        Remove
                    </button>
                ) : (
                    plannable.length > 0 && (
                        <select
                            defaultValue=""
                            onChange={e => e.target.value && addToSprintMutation.mutate(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="">+ Sprint</option>
                            {plannable.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )
                )}
                <button onClick={() => onEdit(task)} className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <span className="text-xs text-gray-400">Edit</span>
                </button>
                <button onClick={() => onDelete(task)} className="p-1 hover:bg-red-50 rounded transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-400" />
                </button>
            </div>
        </div>
    );
};

// ── Sprint Card ───────────────────────────────────────────────────────────────

const SprintCard = ({ sprint, onEdit, onStart, onComplete, onDelete, navigateTo }) => {
    const done = sprint.tasks.filter(t => t.kanbanStatus === "DONE").length;
    const total = sprint.tasks.length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const points = sprint.tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const donePoints = sprint.tasks.filter(t => t.kanbanStatus === "DONE").reduce((s, t) => s + (t.storyPoints || 0), 0);
    const isActive = sprint.status === "ACTIVE";
    const isPlanning = sprint.status === "PLANNING";

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md ${isActive ? "border-green-200 ring-1 ring-green-100" : "border-gray-200"}`}>
            {/* Header */}
            <div className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_BADGE[sprint.status]}`}>
                            {sprint.status}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 truncate">{sprint.name}</h3>
                    </div>
                    {sprint.goal && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Target className="h-3 w-3 flex-shrink-0" />
                            {sprint.goal}
                        </p>
                    )}
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />{fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isPlanning && (
                        <button onClick={() => onStart(sprint)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors">
                            <Play className="h-3.5 w-3.5" /> Start
                        </button>
                    )}
                    {isActive && (
                        <>
                            <button onClick={() => navigateTo(`/kanban`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                                Board <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => onComplete(sprint)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">
                                <CheckCircle className="h-3.5 w-3.5" /> Complete
                            </button>
                        </>
                    )}
                    {sprint.status === "COMPLETED" && (
                        <button onClick={() => navigateTo(`/sprint-analytics/${sprint.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
                            <BarChart2 className="h-3.5 w-3.5" /> Report
                        </button>
                    )}
                    {!isActive && (
                        <button onClick={() => onEdit(sprint)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 text-xs">Edit</button>
                    )}
                    {isPlanning && (
                        <button onClick={() => onDelete(sprint)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar + stats */}
            {total > 0 && (
                <div className="px-5 pb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                        <span>{done}/{total} tasks done</span>
                        <span>{donePoints}/{points} pts</span>
                        <span className="font-semibold text-indigo-600">{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            {/* Task preview list */}
            {sprint.tasks.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3">
                    <div className="space-y-1.5">
                        {sprint.tasks.slice(0, 4).map(t => (
                            <div key={t.id} className="flex items-center gap-2 text-xs">
                                <span>{TYPE_EMOJI[t.type] || "🔵"}</span>
                                <span className="flex-1 truncate text-gray-700">{t.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    t.kanbanStatus === "DONE" ? "bg-green-50 text-green-600" :
                                    t.kanbanStatus === "IN_PROGRESS" ? "bg-blue-50 text-blue-600" :
                                    t.kanbanStatus === "BLOCKED" ? "bg-red-50 text-red-600" :
                                    "bg-gray-50 text-gray-500"
                                }`}>
                                    {t.kanbanStatus.replace("_", " ")}
                                </span>
                            </div>
                        ))}
                        {sprint.tasks.length > 4 && (
                            <p className="text-xs text-gray-400 pl-5">+{sprint.tasks.length - 4} more tasks</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const Sprints = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === "SUPER_ADMIN";

    const [sprintModal, setSprintModal] = useState(null); // null | "create" | sprint-object
    const [taskModal, setTaskModal] = useState(null);     // null | "create" | task-object
    const [activeTab, setActiveTab] = useState("sprints"); // "sprints" | "backlog"

    // ── Data ──────────────────────────────────────────────────────────────────
    const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
        queryKey: ["sprints"],
        queryFn: () => api.get("/sprints").then(r => r.data),
    });

    const { data: backlog = [], isLoading: backlogLoading } = useQuery({
        queryKey: ["backlog"],
        queryFn: () => api.get("/sprints/backlog").then(r => r.data),
        enabled: activeTab === "backlog",
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const startMutation = useMutation({
        mutationFn: (id) => api.post(`/sprints/${id}/start`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints"] }),
        onError: (e) => toast.error(e.response?.data?.message || "Failed to start sprint"),
    });

    const completeMutation = useMutation({
        mutationFn: (id) => api.post(`/sprints/${id}/complete`, { moveUnfinished: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
            queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to complete sprint"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/sprints/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to delete sprint"),
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (id) => api.delete(`/tasks/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to delete task"),
    });

    // ── Summary stats ─────────────────────────────────────────────────────────
    const activeSprint = sprints.find(s => s.status === "ACTIVE");
    const planningSprints = sprints.filter(s => s.status === "PLANNING");
    const completedSprints = sprints.filter(s => s.status === "COMPLETED");

    if (sprintsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Plan, run, and review your team's work sprints</p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTaskModal("create")}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Add Task
                        </button>
                        <button
                            onClick={() => setSprintModal("create")}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus className="h-4 w-4" /> New Sprint
                        </button>
                    </div>
                )}
            </div>

            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: "Active Sprint",    value: activeSprint ? "1" : "—",            sub: activeSprint?.name || "None running", color: "text-green-600" },
                    { label: "Planning",         value: planningSprints.length,               sub: "sprints pending",                    color: "text-indigo-600" },
                    { label: "Backlog",          value: "—",                                  sub: "open tasks",                         color: "text-orange-600" },
                    { label: "Completed Sprints",value: completedSprints.length,              sub: "all time",                           color: "text-blue-600" },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {[
                    { id: "sprints", label: "All Sprints" },
                    { id: "backlog", label: `Backlog${backlog.length ? ` (${backlog.length})` : ""}` },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            activeTab === tab.id ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Sprints list ── */}
            {activeTab === "sprints" && (
                <div className="space-y-4">
                    {sprints.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="text-5xl mb-3">🏁</div>
                            <p className="text-lg font-bold text-gray-600">No sprints yet</p>
                            <p className="text-sm text-gray-400 mt-1">Create your first sprint to start organizing work.</p>
                        </div>
                    ) : (
                        sprints.map(s => (
                            <SprintCard
                                key={s.id}
                                sprint={s}
                                onEdit={(sp) => setSprintModal(sp)}
                                onStart={(sp) => {
                                    if (confirm(`Start "${sp.name}"?`)) startMutation.mutate(sp.id);
                                }}
                                onComplete={(sp) => {
                                    if (confirm(`Complete "${sp.name}"? Unfinished tasks will move to backlog.`))
                                        completeMutation.mutate(sp.id);
                                }}
                                onDelete={(sp) => {
                                    if (confirm(`Delete "${sp.name}"? All tasks will move to backlog.`))
                                        deleteMutation.mutate(sp.id);
                                }}
                                navigateTo={navigate}
                            />
                        ))
                    )}
                </div>
            )}

            {/* ── Backlog ── */}
            {activeTab === "backlog" && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-bold text-gray-800">Backlog</h2>
                        <span className="text-xs text-gray-400">{backlog.length} tasks not in any sprint</span>
                    </div>

                    {backlogLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                    ) : backlog.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 text-sm">Backlog is empty — all tasks are in sprints.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50 px-2 py-2">
                            {backlog.map(t => (
                                <BacklogRow
                                    key={t.id}
                                    task={t}
                                    sprintId={t.sprint?.id}
                                    sprints={sprints}
                                    onEdit={(task) => setTaskModal(task)}
                                    onDelete={(task) => {
                                        if (confirm(`Delete "${task.title}"?`)) deleteTaskMutation.mutate(task.id);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Modals ── */}
            {(sprintModal === "create" || (sprintModal && typeof sprintModal === "object")) && (
                <SprintFormModal
                    sprint={sprintModal === "create" ? null : sprintModal}
                    onClose={() => setSprintModal(null)}
                />
            )}
            {(taskModal === "create" || (taskModal && typeof taskModal === "object")) && (
                <TaskModal
                    task={taskModal === "create" ? null : taskModal}
                    onClose={() => setTaskModal(null)}
                />
            )}
        </div>
    );
};

export default Sprints;
