import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Plus, Loader2, Filter, ChevronDown, X, Send,
    Calendar, Clock, Tag, User, Link2, Trash2, Edit3,
    AlertCircle, ArrowUp, Minus, ArrowDown
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import TaskModal from "../components/TaskModal";

// ── Config ────────────────────────────────────────────────────────────────────

const COLUMNS = [
    { id: "TODO",        label: "To Do",       color: "bg-gray-100",   dot: "bg-gray-400"   },
    { id: "IN_PROGRESS", label: "In Progress", color: "bg-blue-50",    dot: "bg-blue-500"   },
    { id: "IN_REVIEW",   label: "In Review",   color: "bg-purple-50",  dot: "bg-purple-500" },
    { id: "BLOCKED",     label: "Blocked",     color: "bg-red-50",     dot: "bg-red-500"    },
    { id: "DONE",        label: "Done",        color: "bg-green-50",   dot: "bg-green-500"  },
];

const PRIORITY_META = {
    CRITICAL: { label: "Critical", icon: <AlertCircle className="h-3 w-3" />, cls: "text-red-600 bg-red-50 border-red-200" },
    HIGH:     { label: "High",     icon: <ArrowUp     className="h-3 w-3" />, cls: "text-orange-600 bg-orange-50 border-orange-200" },
    MEDIUM:   { label: "Medium",   icon: <Minus       className="h-3 w-3" />, cls: "text-yellow-700 bg-yellow-50 border-yellow-200" },
    LOW:      { label: "Low",      icon: <ArrowDown   className="h-3 w-3" />, cls: "text-green-700 bg-green-50 border-green-200" },
};

const TYPE_EMOJI = { EPIC: "🟣", STORY: "🟢", TASK: "🔵", BUG: "🔴", SUBTASK: "⚪" };

// ── Helpers ───────────────────────────────────────────────────────────────────

const isOverdue = (task) =>
    task.kanbanStatus !== "DONE" && new Date(task.dueDate) < new Date();

const initials = (name = "") =>
    name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// ── Task Card ─────────────────────────────────────────────────────────────────

const TaskCard = ({ task, onDragStart, onClick }) => {
    const pm = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;
    const overdue = isOverdue(task);

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onClick={() => onClick(task)}
            className="bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group select-none"
        >
            {/* Header: Type + Priority */}
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs">{TYPE_EMOJI[task.type] || "🔵"} <span className="text-[10px] text-gray-400 font-medium">{task.type}</span></span>
                <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded border text-[10px] font-medium ${pm.cls}`}>
                    {pm.icon}{pm.label}
                </span>
            </div>

            {/* Title */}
            <p className="text-xs font-semibold text-gray-800 leading-tight mb-1.5 group-hover:text-indigo-700 transition-colors line-clamp-2">
                {task.title}
            </p>

            {/* Labels */}
            {task.labels?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                    {task.labels.slice(0, 3).map(l => (
                        <span key={l} className="px-1 py-0.2 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium">{l}</span>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-1">
                <div className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? "text-red-500" : "text-gray-400"}`}>
                    <Calendar className="h-3 w-3 shrink-0" />
                    {overdue ? "Overdue · " : ""}{fmtDate(task.dueDate)}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {task.storyPoints && (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">{task.storyPoints}pt</span>
                    )}
                    {task.assignedTo && (
                        <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-bold" title={task.assignedTo.name}>
                            {initials(task.assignedTo.name)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Task Detail Drawer ────────────────────────────────────────────────────────

const TaskDrawer = ({ task, onClose, onEdit, onDelete }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [comment, setComment] = useState("");
    const isAdmin = user?.role === "SUPER_ADMIN";

    const commentMutation = useMutation({
        mutationFn: () => api.post(`/tasks/${task.id}/comments`, { content: comment }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
            setComment("");
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to add comment"),
    });

    const deleteCommentMutation = useMutation({
        mutationFn: (cid) => api.delete(`/tasks/${task.id}/comments/${cid}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to delete comment"),
    });

    const pm = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div
                className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{TYPE_EMOJI[task.type]}</span>
                        <span className="text-xs font-semibold text-gray-400 uppercase">{task.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <>
                                <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                                    <Edit3 className="h-4 w-4 text-gray-500" />
                                </button>
                                <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Title */}
                    <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${pm.cls}`}>
                            {pm.icon}{pm.label}
                        </span>
                        {task.sprint && (
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-semibold">
                                🏃 {task.sprint.name}
                            </span>
                        )}
                        {isOverdue(task) && (
                            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100 text-xs font-semibold">
                                ⚠ Overdue
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    {task.description && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
                        </div>
                    )}

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <MetaItem icon={<User className="h-3.5 w-3.5" />} label="Assignee" value={task.assignedTo?.name || "Unassigned"} />
                        <MetaItem icon={<Calendar className="h-3.5 w-3.5" />} label="Due Date" value={fmtDate(task.dueDate)} highlight={isOverdue(task)} />
                        {task.storyPoints && <MetaItem icon={<span className="text-xs">SP</span>} label="Story Points" value={`${task.storyPoints} pts`} />}
                        {task.estimatedHours && <MetaItem icon={<Clock className="h-3.5 w-3.5" />} label="Estimated" value={`${task.estimatedHours}h`} />}
                        {task.actualHours && <MetaItem icon={<Clock className="h-3.5 w-3.5" />} label="Actual" value={`${task.actualHours}h`} />}
                        {task.lead && <MetaItem icon={<Link2 className="h-3.5 w-3.5" />} label="Lead" value={task.lead.name} />}
                    </div>

                    {/* Labels */}
                    {task.labels?.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Tag className="h-3 w-3" /> Labels</p>
                            <div className="flex flex-wrap gap-1.5">
                                {task.labels.map(l => (
                                    <span key={l} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium">{l}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Comments ({task.comments?.length || 0})</p>
                        <div className="space-y-3 mb-4">
                            {(task.comments || []).map(c => (
                                <div key={c.id} className="flex gap-2.5">
                                    <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                                        {initials(c.user?.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-gray-700">{c.user?.name}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-gray-400">{fmtDate(c.createdAt)}</span>
                                                {(c.user?.id === user?.id || isAdmin) && (
                                                    <button
                                                        onClick={() => deleteCommentMutation.mutate(c.id)}
                                                        className="p-0.5 hover:text-red-500 text-gray-300 transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-0.5">{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Comment input */}
                        <div className="flex gap-2">
                            <div className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {initials(user?.name)}
                            </div>
                            <div className="flex-1 flex gap-2">
                                <input
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && comment.trim() && commentMutation.mutate()}
                                    placeholder="Write a comment..."
                                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={() => comment.trim() && commentMutation.mutate()}
                                    disabled={!comment.trim() || commentMutation.isPending}
                                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetaItem = ({ icon, label, value, highlight }) => (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">{icon}{label}</p>
        <p className={`text-sm font-semibold ${highlight ? "text-red-600" : "text-gray-800"}`}>{value}</p>
    </div>
);

// ── Main Board ────────────────────────────────────────────────────────────────

const Kanban = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === "SUPER_ADMIN";

    const [filterAssignee, setFilterAssignee] = useState("ALL");
    const [filterPriority, setFilterPriority] = useState("ALL");
    const [filterType, setFilterType] = useState("ALL");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [drawerTask, setDrawerTask] = useState(null);
    const dragTaskId = useRef(null);
    const [dragOverCol, setDragOverCol] = useState(null);

    // ── Data ──────────────────────────────────────────────────────────────────

    const { data: activeSprint, isLoading: sprintLoading } = useQuery({
        queryKey: ["activeSprint"],
        queryFn: () => api.get("/sprints/active").then(r => r.data),
        refetchInterval: 30000,
    });

    const { data: team = [] } = useQuery({
        queryKey: ["team"],
        queryFn: () => api.get("/team").then(r => r.data),
    });

    // ── Mutations ─────────────────────────────────────────────────────────────

    const kanbanMutation = useMutation({
        mutationFn: ({ id, kanbanStatus }) => api.patch(`/tasks/${id}/kanban`, { kanbanStatus }),
        onMutate: async ({ id, kanbanStatus }) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ["activeSprint"] });
            const prev = queryClient.getQueryData(["activeSprint"]);
            queryClient.setQueryData(["activeSprint"], old => {
                if (!old) return old;
                return {
                    ...old,
                    tasks: old.tasks.map(t => t.id === id ? { ...t, kanbanStatus } : t)
                };
            });
            return { prev };
        },
        onError: (_, __, ctx) => queryClient.setQueryData(["activeSprint"], ctx.prev),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["activeSprint"] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/tasks/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
            setDrawerTask(null);
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to delete task"),
    });

    // ── Drag & Drop ───────────────────────────────────────────────────────────

    const handleDragStart = (e, taskId) => {
        dragTaskId.current = taskId;
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e, colId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverCol(colId);
    };

    const handleDrop = (e, colId) => {
        e.preventDefault();
        setDragOverCol(null);
        if (!dragTaskId.current) return;
        kanbanMutation.mutate({ id: dragTaskId.current, kanbanStatus: colId });
        dragTaskId.current = null;
    };

    // ── Filter ────────────────────────────────────────────────────────────────

    const tasks = activeSprint?.tasks || [];

    const filtered = tasks.filter(t => {
        if (filterAssignee !== "ALL" && t.assignedTo?.id !== filterAssignee) return false;
        if (filterPriority !== "ALL" && t.priority !== filterPriority) return false;
        if (filterType !== "ALL" && t.type !== filterType) return false;
        return true;
    });

    const byCol = (colId) => filtered.filter(t => t.kanbanStatus === colId);
    const totalDone = tasks.filter(t => t.kanbanStatus === "DONE").length;
    const progress = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0;

    // Sync drawer task with latest data
    const liveDrawerTask = drawerTask
        ? tasks.find(t => t.id === drawerTask.id) ?? drawerTask
        : null;

    // ── Render ────────────────────────────────────────────────────────────────

    if (sprintLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!activeSprint) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                <div className="text-5xl">🏄</div>
                <div>
                    <p className="text-lg font-bold text-gray-700">No active sprint</p>
                    <p className="text-sm text-gray-400 mt-1">Go to <strong>Sprints</strong> to create and start a sprint.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* ── Top bar ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            ACTIVE SPRINT
                        </span>
                        <h1 className="text-2xl font-bold text-gray-900">{activeSprint.name}</h1>
                    </div>
                    {activeSprint.goal && <p className="text-sm text-gray-500 mt-0.5">🎯 {activeSprint.goal}</p>}
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-40 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-500">{progress}% done</span>
                        </div>
                        <span className="text-xs text-gray-400">{fmtDate(activeSprint.startDate)} → {fmtDate(activeSprint.endDate)}</span>
                        <span className="text-xs text-gray-400">{tasks.length} tasks</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filters */}
                    <select
                        value={filterAssignee}
                        onChange={e => setFilterAssignee(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="ALL">All Assignees</option>
                        {team.filter(m => m.isActive).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>

                    <select
                        value={filterPriority}
                        onChange={e => setFilterPriority(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="ALL">All Priorities</option>
                        <option value="CRITICAL">🔴 Critical</option>
                        <option value="HIGH">🟠 High</option>
                        <option value="MEDIUM">🟡 Medium</option>
                        <option value="LOW">🟢 Low</option>
                    </select>

                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="ALL">All Types</option>
                        <option value="EPIC">🟣 Epic</option>
                        <option value="STORY">🟢 Story</option>
                        <option value="TASK">🔵 Task</option>
                        <option value="BUG">🔴 Bug</option>
                        <option value="SUBTASK">⚪ Subtask</option>
                    </select>

                    {isAdmin && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus className="h-4 w-4" /> Create Task
                        </button>
                    )}
                </div>
            </div>

            {/* ── Board ── */}
            <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
                {COLUMNS.map(col => {
                    const colTasks = byCol(col.id);
                    const isDragTarget = dragOverCol === col.id;

                    return (
                        <div
                            key={col.id}
                            className="flex-shrink-0 w-72 flex flex-col"
                            onDragOver={e => handleDragOver(e, col.id)}
                            onDragLeave={() => setDragOverCol(null)}
                            onDrop={e => handleDrop(e, col.id)}
                        >
                            {/* Column header */}
                            <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 ${col.color}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                                    <span className="text-sm font-bold text-gray-700">{col.label}</span>
                                </div>
                                <span className="text-xs font-bold text-gray-500 bg-white/70 rounded-full px-2 py-0.5">
                                    {colTasks.length}
                                </span>
                            </div>

                            {/* Drop zone */}
                            <div
                                className={`flex-1 space-y-2 min-h-[120px] rounded-xl transition-all overflow-y-auto pr-1 ${isDragTarget ? "bg-indigo-50 border-2 border-dashed border-indigo-300 p-2" : "p-0"}`}
                                style={{ maxHeight: "calc(100vh - 220px)" }}
                            >
                                {colTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onDragStart={handleDragStart}
                                        onClick={setDrawerTask}
                                    />
                                ))}
                                {colTasks.length === 0 && !isDragTarget && (
                                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                                        <p className="text-xs text-gray-300 font-medium">Drop tasks here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modals ── */}
            {showCreateModal && (
                <TaskModal
                    defaultSprint={activeSprint.id}
                    onClose={() => setShowCreateModal(false)}
                />
            )}
            {editingTask && (
                <TaskModal
                    task={editingTask}
                    onClose={() => setEditingTask(null)}
                />
            )}
            {liveDrawerTask && (
                <TaskDrawer
                    task={liveDrawerTask}
                    onClose={() => setDrawerTask(null)}
                    onEdit={() => { setEditingTask(liveDrawerTask); setDrawerTask(null); }}
                    onDelete={() => {
                        if (confirm(`Delete "${liveDrawerTask.title}"?`))
                            deleteMutation.mutate(liveDrawerTask.id);
                    }}
                />
            )}
        </div>
    );
};

export default Kanban;
