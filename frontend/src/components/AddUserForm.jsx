import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

// Add User Schema
const addUserSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    phone: z.string().min(10, "Phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "EMPLOYEE"]),
    jobTitle: z.string().optional(),
});

const AddUserForm = ({ onClose }) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(addUserSchema),
        defaultValues: {
            role: "EMPLOYEE"
        }
    });

    const mutation = useMutation({
        mutationFn: async (newUser) => {
            return await api.post("/team", newUser);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["team"] });
            onClose();
        },
        onError: (err) => {
            // error is shown inline via mutation.isError below
            console.error("[AddUserForm]", err.response?.data?.message || err.message);
        },
    });



    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                    {...register("name")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                />
                {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                        type="email"
                        {...register("email")}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                    {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                        {...register("phone")}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                    {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        {...register("password")}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 top-1 pr-3 flex items-center"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                    {...register("role")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                    <option value="EMPLOYEE">Consultant</option>
                    {user?.role === "SUPER_ADMIN" && (
                        <>
                            <option value="ADMIN">Manager</option>
                            <option value="SUPER_ADMIN">Director</option>
                        </>
                    )}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Job Title / Designation</label>
                <input
                    {...register("jobTitle")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="e.g. Senior Developer, Sales Manager"
                />
            </div>

            {mutation.isError && (
                <p className="text-sm text-red-600">
                    {mutation.error?.response?.data?.message || "Failed to create user. Please try again."}
                </p>
            )}

            <div className="flex justify-end pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                    {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Create User"}
                </button>
            </div>
        </form>
    );
};

export default AddUserForm;
