import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { toast } from "sonner";
import { Loader2, CheckCircle, Circle, Plus, Calendar, User } from "lucide-react";
import { Modal } from "../components/Modal";
import AddTaskForm from "../components/AddTaskForm";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const getPages = (current, total) => {
    const delta = 2;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const result = [1];
    if (current > delta + 2) result.push("...");
    const start = Math.max(2, current - delta);
    const end = Math.min(total - 1, current + delta);
    for (let i = start; i <= end; i++) result.push(i);
    if (current < total - delta - 1) result.push("...");
    result.push(total);
    return result;
};

const Tasks = () => {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const limit = 20;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const { user } = useAuth();
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

    const { data: tasksData, isLoading, error } = useQuery({
        queryKey: ["tasks", page, filter],
        queryFn: async () => {
            const res = await api.get("/tasks", { params: { page, limit, filter } });
            return res.data;
        },
    });

    const tasks = tasksData?.data || [];
    const meta = tasksData?.meta || { total: 0, totalPages: 0, stats: { pending: 0, completed: 0, overdue: 0 } };

    const pageButtons = useMemo(() => getPages(page, meta.totalPages), [page, meta.totalPages]);
    const goTo = useCallback((p) => setPage(Math.max(1, Math.min(meta.totalPages, p))), [meta.totalPages]);

    const handleFilterChange = (f) => {
        setFilter(f);
        setPage(1);
    };

    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => api.patch(`/tasks/${id}/status`, { status }),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const prev = queryClient.getQueriesData({ queryKey: ["tasks"] });
            queryClient.setQueriesData({ queryKey: ["tasks"] }, (old) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map(t => t.id === id ? { ...t, status } : t),
                };
            });
            return { prev };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prev) ctx.prev.forEach(([key, val]) => queryClient.setQueryData(key, val));
            toast.error(err.response?.data?.message || "Failed to update task status");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    });

    const handleStatusToggle = (task) => {
        const newStatus = task.status === "PENDING" ? "COMPLETED" : "PENDING";
        statusMutation.mutate({ id: task.id, status: newStatus });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                <p className="text-red-600 font-bold">Failed to load tasks</p>
                <p className="text-red-400 text-sm mt-1">{error.response?.data?.message || error.message}</p>
                <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
                    <p className="text-sm text-gray-500">Track your follow-ups and to-dos</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Task
                    </button>
                )}
            </div>

            {/* Stats Cards — always reflect full scope, not current filter/page */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Pending Tasks</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">{meta.stats.pending}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Completed</div>
                    <div className="mt-1 text-2xl font-bold text-green-600">{meta.stats.completed}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Overdue</div>
                    <div className="mt-1 text-2xl font-bold text-red-600">{meta.stats.overdue}</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-1">
                {["ALL", "PENDING", "COMPLETED", "OVERDUE"].map((f) => (
                    <button
                        key={f}
                        onClick={() => handleFilterChange(f)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                            ${filter === f ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* Task List */}
            <div className="space-y-3">
                {tasks.map((task) => (
                    <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStatusToggle(task); }}
                                disabled={statusMutation.isPending && statusMutation.variables?.id === task.id}
                                title={task.status === "COMPLETED" ? "Mark as Pending" : "Mark as Completed"}
                                className={`mt-1 flex-shrink-0 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${task.status === "COMPLETED" ? "text-green-500" : "text-gray-300 group-hover:text-indigo-500"}`}
                            >
                                {statusMutation.isPending && statusMutation.variables?.id === task.id
                                    ? <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                                    : task.status === "COMPLETED"
                                        ? <CheckCircle className="h-6 w-6" />
                                        : <Circle className="h-6 w-6" />
                                }
                            </button>
                            <Link to={`/tasks/${task.id}`} className="min-w-0 flex-1 group/link">
                                <h3 className={`font-bold text-gray-900 truncate group-hover/link:text-indigo-600 transition-colors ${task.status === "COMPLETED" ? "line-through text-gray-400" : ""}`}>
                                    {task.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                    <div className={`flex items-center gap-1.5 ${new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "text-red-500" : ""}`}>
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "Overdue · " : ""}
                                        {new Date(task.dueDate).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-gray-400" />
                                        {task.assignedTo?.name || "Unassigned"}
                                    </div>
                                    {task.lead && (
                                        <Link
                                            to={`/leads/${task.lead.id}`}
                                            onClick={e => e.stopPropagation()}
                                            className="flex items-center gap-1.5 hover:underline"
                                        >
                                            <span className="text-gray-400">Lead:</span>
                                            <span className="text-indigo-600">{task.lead.name}</span>
                                        </Link>
                                    )}
                                    {task.files?.length > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                            <span>{task.files.length}</span>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${task.status === "COMPLETED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                                {task.status === "COMPLETED" ? "Completed" : "Pending"}
                            </span>
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="text-center py-10 text-gray-500">No tasks found.</div>
                )}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{meta.total === 0 ? 0 : (page - 1) * limit + 1}</span> to{" "}
                        <span className="font-medium">{Math.min(page * limit, meta.total)}</span> of{" "}
                        <span className="font-medium">{meta.total}</span> tasks
                    </p>
                    <nav className="inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                            onClick={() => goTo(page - 1)}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            ← Prev
                        </button>
                        {pageButtons.map((p, i) =>
                            p === "..." ? (
                                <span key={`e${i}`} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => goTo(p)}
                                    aria-current={page === p ? "page" : undefined}
                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                        page === p ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600" : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        )}
                        <button
                            onClick={() => goTo(page + 1)}
                            disabled={page >= meta.totalPages}
                            className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next →
                        </button>
                    </nav>
                </div>
            )}

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Create New Task">
                <AddTaskForm onClose={() => setIsAddModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default Tasks;
