import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Building, Loader2, AlertCircle } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const departmentSchema = z.object({
    name: z.string().min(2, "Department name must be at least 2 characters"),
});

const Departments = () => {
    const { user } = useAuth();
    console.log("Departments Page Mounted. User:", user);
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

    const { data: departments, isLoading, error } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get("/departments")).data,
    });

    const createMutation = useMutation({
        mutationFn: async (data) => await api.post("/departments", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["departments"] });
            setIsAdding(false);
            reset();
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to create department");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => await api.delete(`/departments/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["departments"] });
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to delete department");
        }
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(departmentSchema),
    });

    const onSubmit = (data) => {
        createMutation.mutate(data);
    };

    if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
    if (error) return <div className="text-center text-red-500 py-10">Failed to load departments.</div>;

    const filteredDepartments = departments?.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) {
        return <div className="text-center py-10">Access Denied</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
                    <p className="text-sm text-gray-500">Manage your organization's departments</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Department
                </button>
            </div>

            {isAdding && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-4 items-start">
                        <div className="flex-1">
                            <input
                                {...register("name")}
                                placeholder="Department Name (e.g. Engineering)"
                                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            {createMutation.isPending ? "Saving..." : "Save"}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsAdding(false); reset(); }}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredDepartments?.map((dept) => (
                        <li key={dept.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 group">
                            <Link to={`/departments/${dept.id}`} className="flex items-center flex-1">
                                <Building className="h-5 w-5 text-gray-400 mr-3 group-hover:text-indigo-600 transition-colors" />
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{dept.name}</h3>
                                    <p className="text-xs text-gray-500">{dept._count?.users || 0} Employees</p>
                                </div>
                            </Link>
                            <div className="flex items-center">
                                {dept._count?.users === 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm("Are you sure you want to delete this department?")) {
                                                deleteMutation.mutate(dept.id);
                                            }
                                        }}
                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete Department"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                    {filteredDepartments?.length === 0 && (
                        <li className="px-6 py-10 text-center text-gray-500">
                            No departments found.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default Departments;
