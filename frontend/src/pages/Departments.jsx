import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Building2, Loader2, Users, ChevronRight } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const departmentSchema = z.object({
    name: z.string().min(2, "Department name must be at least 2 characters"),
});

const DEPT_COLORS = [
    "from-indigo-400 to-indigo-600",
    "from-violet-400 to-violet-600",
    "from-emerald-400 to-emerald-600",
    "from-amber-400 to-amber-600",
    "from-rose-400 to-rose-600",
    "from-cyan-400 to-cyan-600",
    "from-fuchsia-400 to-fuchsia-600",
    "from-teal-400 to-teal-600",
];

const Departments = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

    const { data: departments, isLoading, error } = useQuery({
        queryKey: ["departments"],
        queryFn: () => api.get("/departments").then(r => r.data),
    });

    const createMutation = useMutation({
        mutationFn: (data) => api.post("/departments", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["departments"] }); setIsAdding(false); reset(); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to create department"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/departments/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
        onError: (err) => toast.error(err.response?.data?.message || "Failed to delete department"),
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(departmentSchema),
    });

    if (!isAdmin) return <div className="text-center py-20 text-gray-500">Access Denied</div>;
    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>;
    if (error) return <div className="text-center py-20 text-red-500">Failed to load departments.</div>;

    const filtered = departments?.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Departments</h1>
                    <p className="text-sm text-gray-500">{departments?.length ?? 0} departments in your organisation</p>
                </div>
                <button
                    onClick={() => setIsAdding(v => !v)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Add Department
                </button>
            </div>

            {/* Add form */}
            {isAdding && (
                <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">New Department</h2>
                    <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="flex gap-3 items-start">
                        <div className="flex-1">
                            <input
                                {...register("name")}
                                placeholder="e.g. Engineering, Sales, Support…"
                                autoFocus
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                            {createMutation.isPending ? "Saving…" : "Save"}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsAdding(false); reset(); }}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Search */}
            {(departments?.length ?? 0) > 4 && (
                <input
                    type="text"
                    placeholder="Search departments…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full sm:w-72 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            )}

            {/* Department cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((dept, i) => (
                    <div
                        key={dept.id}
                        className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex flex-col"
                    >
                        {/* Gradient top bar */}
                        <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${DEPT_COLORS[i % DEPT_COLORS.length]}`} />

                        <div className="p-4 flex items-center gap-4 flex-1">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${DEPT_COLORS[i % DEPT_COLORS.length]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate text-sm group-hover:text-indigo-600 transition-colors">{dept.name}</h3>
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                                    <Users className="h-3 w-3" />
                                    <span>{dept._count?.users ?? 0} member{dept._count?.users !== 1 ? "s" : ""}</span>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 pb-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                            <Link
                                to={`/departments/${dept.id}`}
                                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                View members <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                            {dept._count?.users === 0 && (
                                <button
                                    onClick={() => { if (confirm("Delete this department?")) deleteMutation.mutate(dept.id); }}
                                    disabled={deleteMutation.isPending}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-3 py-16 text-center text-gray-400">
                        <Building2 className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="font-medium text-sm">No departments found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Departments;
