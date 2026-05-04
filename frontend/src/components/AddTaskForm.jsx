import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import FileDropzone from "./FileDropzone";

const taskSchema = z.object({
    title: z.string().min(2, "Title is required"),
    description: z.string().optional(),
    dueDate: z.string().min(1, "Due date is required"),
    assignedToId: z.string().min(1, "Assignee is required"),
    leadId: z.string().optional(),
});

const AddTaskForm = ({ onClose, leadId: initialLeadId }) => {
    const queryClient = useQueryClient();
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            leadId: initialLeadId || "",
        }
    });

    // Fetch potential assignees (Team members)
    const { data: team } = useQuery({
        queryKey: ["team"],
        queryFn: async () => {
            const res = await api.get("/team");
            return res.data;
        },
    });

    // Fetch leads for selection
    const { data: leads } = useQuery({
        queryKey: ["leads"],
        queryFn: async () => {
            const res = await api.get("/leads", { params: { limit: 100 } });
            return res.data.data || res.data;
        },
    });

    const mutation = useMutation({
        mutationFn: async (newTask) => {
            return await api.post("/tasks", newTask);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            onClose();
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to create task");
        }
    });

    const onSubmit = async (data) => {
        try {
            setIsUploading(true);
            let uploadedFiles = [];

            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(file => formData.append("files", file));
                
                const uploadRes = await api.post("/upload/task-files", formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                uploadedFiles = uploadRes.data.files;
            }

            mutation.mutate({
                ...data,
                dueDate: new Date(data.dueDate).toISOString(),
                files: uploadedFiles,
                assignedTo: data.assignedToId,
                leadId: data.leadId || null, // Convert empty string to null
            });
        } catch (error) {
            console.error("Submission error:", error);
            alert("Error uploading files. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold mb-1">Task Title</label>
                <input
                    {...register("title")}
                    className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3 bg-gray-50/50 transition-all"
                    placeholder="e.g. Follow up with client"
                />
                {errors.title && <p className="text-red-500 text-xs mt-1 font-medium">{errors.title.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold mb-1">Description</label>
                <textarea
                    {...register("description")}
                    rows={3}
                    className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3 bg-gray-50/50 transition-all"
                    placeholder="Additional details..."
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 font-semibold mb-1">Assign To</label>
                    <select
                        {...register("assignedToId")}
                        className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3 bg-gray-50/50 appearance-none transition-all"
                    >
                        <option value="">Select a member</option>
                        {team?.filter(m => m.isActive).map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                    {errors.assignedToId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.assignedToId.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 font-semibold mb-1">Associate Lead</label>
                    <select
                        {...register("leadId")}
                        className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3 bg-gray-50/50 appearance-none transition-all"
                        disabled={!!initialLeadId}
                    >
                        <option value="">Select a lead</option>
                        {leads?.map(lead => (
                            <option key={lead.id} value={lead.id}>
                                {lead.name}
                            </option>
                        ))}
                    </select>
                    {errors.leadId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.leadId.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 font-semibold mb-1">Due Date</label>
                    <input
                        type="date"
                        {...register("dueDate")}
                        className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3 bg-gray-50/50 transition-all"
                        min={new Date().toISOString().split("T")[0]}
                    />
                    {errors.dueDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.dueDate.message}</p>}
                </div>
            </div>

            <FileDropzone files={files} setFiles={setFiles} />

            <div className="flex justify-end pt-6 gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending || isUploading}
                    className="inline-flex justify-center items-center px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all"
                >
                    {mutation.isPending || isUploading ? (
                        <>
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            {isUploading ? "Uploading files..." : "Creating..."}
                        </>
                    ) : "Create Task"}
                </button>
            </div>
        </form>
    );
};

export default AddTaskForm;
