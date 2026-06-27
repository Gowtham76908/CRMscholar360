import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import FileDropzone from "./FileDropzone";
import { toast } from "sonner";

const taskSchema = z.object({
    title: z.string().min(2, "Title is required"),
    description: z.string().optional(),
    dueDate: z.string().min(1, "Due date is required"),
    assignedToId: z.string().min(1, "Assignee is required"),
    leadId: z.string().optional(),
});

// A custom searchable select component with a click-outside listener
const SearchableSelect = ({ label, options, placeholder, value, onChange, disabled, error }) => {
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options?.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const selectedOption = options?.find(opt => opt.value === value);

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-gray-700 font-semibold mb-1">{label}</label>
            <div className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 bg-gray-50/50 transition-all text-left disabled:opacity-50"
                >
                    <span className={selectedOption ? "text-gray-900 font-medium" : "text-gray-400"}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <span className="text-gray-400 text-xs">▼</span>
                </button>

                {isOpen && !disabled && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-250 rounded-xl shadow-xl max-h-60 overflow-y-auto p-2 space-y-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-550"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="space-y-1">
                            {filteredOptions.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">No options found</p>
                            ) : (
                                filteredOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${
                                            value === opt.value ? "bg-indigo-50 text-indigo-600 font-bold" : "text-gray-700"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-red-500 text-xs mt-1 font-medium">{error.message}</p>}
        </div>
    );
};

const AddTaskForm = ({ onClose, leadId: initialLeadId }) => {
    const queryClient = useQueryClient();
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            leadId: initialLeadId || "",
            assignedToId: "",
        }
    });

    const assignedToId = watch("assignedToId");
    const leadId = watch("leadId");

    // Explicitly register Hook Form virtual fields
    useEffect(() => {
        register("assignedToId");
        register("leadId");
    }, [register]);

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
            toast.error(error.response?.data?.message || "Failed to create task");
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
                leadId: initialLeadId || data.leadId || null, // Fix React Hook Form disabled field omission bug
            });
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("Error uploading files. Please try again.");
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
                <SearchableSelect
                    label="Assign To"
                    placeholder="Select a member"
                    options={team?.filter(m => m.isActive).map(member => ({ value: member.id, label: member.name })) || []}
                    value={assignedToId}
                    onChange={(val) => setValue("assignedToId", val, { shouldValidate: true })}
                    error={errors.assignedToId}
                />

                <SearchableSelect
                    label="Associate Lead"
                    placeholder="Select a lead"
                    options={leads?.map(lead => ({ value: lead.id, label: lead.name })) || []}
                    value={leadId}
                    onChange={(val) => setValue("leadId", val, { shouldValidate: true })}
                    error={errors.leadId}
                />

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
