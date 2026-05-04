import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Tag, Plus } from "lucide-react";
import api from "../api/axios";

// ── Config ────────────────────────────────────────────────────────────────────

const PRIORITIES = [
    { value: "CRITICAL", label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
    { value: "HIGH",     label: "High",     color: "bg-orange-100 text-orange-700 border-orange-200" },
    { value: "MEDIUM",   label: "Medium",   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    { value: "LOW",      label: "Low",      color: "bg-green-100 text-green-700 border-green-200" },
];

const TYPES = [
    { value: "EPIC",    label: "Epic",    emoji: "🟣" },
    { value: "STORY",   label: "Story",   emoji: "🟢" },
    { value: "TASK",    label: "Task",    emoji: "🔵" },
    { value: "BUG",     label: "Bug",     emoji: "🔴" },
    { value: "SUBTASK", label: "Subtask", emoji: "⚪" },
];

const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

// ── TaskModal ─────────────────────────────────────────────────────────────────

/**
 * TaskModal — used for both Create and Edit.
 * Props:
 *   task         — existing task object (edit mode) or null (create mode)
 *   defaultSprint — sprintId to pre-select when creating from sprint board
 *   onClose      — close handler
 */
const TaskModal = ({ task, defaultSprint, onClose }) => {
    const queryClient = useQueryClient();
    const isEdit = !!task;

    const [form, setForm] = useState({
        title:          task?.title          ?? "",
        description:    task?.description    ?? "",
        assignedTo:     task?.assignedTo?.id ?? "",
        leadId:         task?.lead?.id       ?? "",
        sprintId:       task?.sprint?.id     ?? defaultSprint ?? "",
        dueDate:        task?.dueDate ? task.dueDate.split("T")[0] : "",
        priority:       task?.priority       ?? "MEDIUM",
        type:           task?.type           ?? "TASK",
        storyPoints:    task?.storyPoints    ?? "",
        estimatedHours: task?.estimatedHours ?? "",
        actualHours:    task?.actualHours    ?? "",
        labels:         task?.labels         ?? [],
    });
    const [labelInput, setLabelInput] = useState("");
    const [error, setError] = useState("");

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    // Data fetches
    const { data: team = [] } = useQuery({
        queryKey: ["team"],
        queryFn: () => api.get("/team").then(r => r.data),
    });
    const { data: sprints = [] } = useQuery({
        queryKey: ["sprints"],
        queryFn: () => api.get("/sprints").then(r => r.data),
    });
    const { data: leads = [] } = useQuery({
        queryKey: ["leads"],
        queryFn: () => api.get("/leads").then(r => r.data.data || r.data),
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data) => api.post("/tasks", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.message || "Failed to create task"),
    });

    // Edit mutation
    const editMutation = useMutation({
        mutationFn: (data) => api.put(`/tasks/${task.id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
            queryClient.invalidateQueries({ queryKey: ["backlog"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.message || "Failed to update task"),
    });

    const isPending = createMutation.isPending || editMutation.isPending;

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        if (!form.title.trim()) return setError("Title is required");
        if (!form.dueDate)      return setError("Due date is required");

        const payload = {
            ...form,
            assignedTo:     form.assignedTo     || null,
            leadId:         form.leadId         || null,
            sprintId:       form.sprintId       || null,
            storyPoints:    form.storyPoints    ? Number(form.storyPoints)    : null,
            estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
            actualHours:    form.actualHours    ? Number(form.actualHours)    : null,
            dueDate:        new Date(form.dueDate).toISOString(),
        };

        isEdit ? editMutation.mutate(payload) : createMutation.mutate(payload);
    };

    const addLabel = () => {
        const l = labelInput.trim();
        if (l && !form.labels.includes(l)) set("labels", [...form.labels, l]);
        setLabelInput("");
    };

    const removeLabel = (l) => set("labels", form.labels.filter(x => x !== l));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEdit ? "Edit Task" : "Create Task"}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
                    )}

                    {/* Type + Priority row */}
                    <div className="flex gap-3">
                        {/* Type */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
                            <div className="flex gap-1.5 flex-wrap">
                                {TYPES.map(t => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => set("type", t.value)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                            form.type === t.value
                                                ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                                        }`}
                                    >
                                        <span>{t.emoji}</span>{t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priority */}
                        <div className="w-40">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Priority</label>
                            <select
                                value={form.priority}
                                onChange={e => set("priority", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {PRIORITIES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
                        <input
                            value={form.title}
                            onChange={e => set("title", e.target.value)}
                            placeholder="What needs to be done?"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => set("description", e.target.value)}
                            rows={3}
                            placeholder="Add more detail..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    {/* Assignee + Sprint */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assignee</label>
                            <select
                                value={form.assignedTo}
                                onChange={e => set("assignedTo", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Unassigned</option>
                                {team.filter(m => m.isActive).map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sprint</label>
                            <select
                                value={form.sprintId}
                                onChange={e => set("sprintId", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Backlog (no sprint)</option>
                                {sprints.filter(s => s.status !== "COMPLETED").map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Due Date + Story Points + Est Hours */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Due Date *</label>
                            <input
                                type="date"
                                value={form.dueDate}
                                onChange={e => set("dueDate", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Story Points</label>
                            <div className="flex gap-1 flex-wrap">
                                {STORY_POINTS.map(sp => (
                                    <button
                                        key={sp}
                                        type="button"
                                        onClick={() => set("storyPoints", form.storyPoints === sp ? "" : sp)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                                            form.storyPoints === sp
                                                ? "bg-indigo-600 text-white border-indigo-600"
                                                : "border-gray-200 text-gray-600 hover:border-indigo-300"
                                        }`}
                                    >
                                        {sp}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Est. Hours</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={form.estimatedHours}
                                onChange={e => set("estimatedHours", e.target.value)}
                                placeholder="0"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Actual Hours (edit only) + Lead */}
                    <div className="grid grid-cols-2 gap-4">
                        {isEdit && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Actual Hours</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={form.actualHours}
                                    onChange={e => set("actualHours", e.target.value)}
                                    placeholder="0"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Linked Lead</label>
                            <select
                                value={form.leadId}
                                onChange={e => set("leadId", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">None</option>
                                {leads.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Labels */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Labels</label>
                        <div className="flex gap-2 flex-wrap mb-2">
                            {form.labels.map(l => (
                                <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                    <Tag className="h-3 w-3" />{l}
                                    <button type="button" onClick={() => removeLabel(l)} className="ml-1 hover:text-red-500">×</button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={labelInput}
                                onChange={e => setLabelInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLabel())}
                                placeholder="Add a label..."
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={addLabel}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? "Save Changes" : "Create Task"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;
