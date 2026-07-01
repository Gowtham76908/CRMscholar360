import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import api from "../api/axios";
import { toast } from "sonner";
import FileDropzone from "./FileDropzone";

const taskSchema = z.object({
    title:       z.string().min(2, "Title is required"),
    description: z.string().optional(),
    dueDate:     z.string().min(1, "Due date is required"),
    assignedToId: z.string().optional(),
    leadId:      z.string().optional(),
    priority:    z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

const INPUT = "block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3 bg-gray-50/50 appearance-none transition-all";

const TaskModal = ({ task, defaultLeadId, onClose }) => {
    const queryClient = useQueryClient();
    const isEdit = !!task;
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title:        task?.title          ?? "",
            description:  task?.description    ?? "",
            dueDate:      task?.dueDate ? task.dueDate.split("T")[0] : "",
            assignedToId: task?.assignedTo?.id ?? "",
            leadId:       task?.lead?.id       ?? defaultLeadId ?? "",
            priority:     task?.priority       ?? "MEDIUM",
        },
    });

    const { data: team = [] } = useQuery({
        queryKey: ["team"],
        queryFn: () => api.get("/team").then(r => r.data),
    });
    const { data: leads = [] } = useQuery({
        queryKey: ["leads"],
        queryFn: () => api.get("/leads", { params: { limit: 100 } }).then(r => r.data.data || r.data),
    });

    const createMutation = useMutation({
        mutationFn: (data) => api.post("/tasks", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            onClose();
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to create task"),
    });

    const editMutation = useMutation({
        mutationFn: (data) => api.put(`/tasks/${task.id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", task.id] });
            onClose();
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to update task"),
    });

    const isPending = createMutation.isPending || editMutation.isPending || isUploading;

    const onSubmit = async (data) => {
        try {
            setIsUploading(true);
            let uploadedFiles = [];
            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(f => formData.append("files", f));
                const uploadRes = await api.post("/upload/task-files", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                uploadedFiles = uploadRes.data.files;
            }

            const payload = {
                ...data,
                assignedTo: data.assignedToId || null,
                leadId:     data.leadId       || null,
                dueDate:    new Date(data.dueDate).toISOString(),
                ...(uploadedFiles.length > 0 && { files: uploadedFiles }),
            };

            isEdit ? editMutation.mutate(payload) : createMutation.mutate(payload);
        } catch {
            toast.error("Error uploading files. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEdit ? "Edit Task" : "Create Task"}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Task Title</label>
                        <input
                            {...register("title")}
                            className={INPUT}
                            placeholder="e.g. Follow up with client"
                        />
                        {errors.title && <p className="text-red-500 text-xs mt-1 font-medium">{errors.title.message}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                        <textarea
                            {...register("description")}
                            rows={3}
                            className={INPUT}
                            placeholder="Additional details..."
                        />
                    </div>

                    {/* Assign To + Associate Lead */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Assign To</label>
                            <select {...register("assignedToId")} className={INPUT}>
                                <option value="">Select a member</option>
                                {team.filter(m => m.isActive).map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            {errors.assignedToId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.assignedToId.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Associate Lead</label>
                            <select {...register("leadId")} className={INPUT}>
                                <option value="">Select a lead</option>
                                {leads.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Due Date + Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
                            <input
                                type="date"
                                {...register("dueDate")}
                                className={INPUT}
                                min={new Date().toISOString().split("T")[0]}
                            />
                            {errors.dueDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.dueDate.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                            <select {...register("priority")} className={INPUT}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                            </select>
                        </div>
                    </div>

                    {/* Attachments */}
                    <FileDropzone files={files} setFiles={setFiles} />

                    {/* Footer */}
                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                        >
                            {isPending && <Loader2 className="animate-spin h-4 w-4" />}
                            {isEdit
                                ? (isPending ? "Saving..." : "Save Changes")
                                : (isPending ? "Creating..." : "Create Task")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;
