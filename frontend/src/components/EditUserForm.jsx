import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

const editUserSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
    phone: z.string().optional(),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER", "EMPLOYEE"]),
    jobTitle: z.string().optional(),
});

const EditUserForm = ({ user, onClose }) => {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue
    } = useForm({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            name: user.name,
            email: user.email,
            password: "",
            phone: user.phone || "",
            role: user.role,
            jobTitle: user.jobTitle || ""
        }
    });

    // Populate form if user prop changes (though generic modal unmounts usually)
    useEffect(() => {
        if (user) {
            setValue("name", user.name);
            setValue("email", user.email);
            setValue("password", "");
            setValue("phone", user.phone);
            setValue("role", user.role);
            setValue("jobTitle", user.jobTitle);
        }
    }, [user, setValue]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            return await api.patch(`/team/${user.id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["team"] });
            toast.success("User updated successfully");
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Failed to update user");
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
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                    type="email"
                    {...register("email")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Password (leave blank to keep current)</label>
                <input
                    type="password"
                    {...register("password")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                    {...register("phone")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                    {...register("role")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                    <option value="EMPLOYEE">Consultant</option>
                    <option value="TEAM_LEADER">Team Leader</option>
                    <option value="ADMIN">Manager</option>
                    <option value="SUPER_ADMIN">Director</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Job Title / Designation</label>
                <input
                    {...register("jobTitle")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="e.g. Senior Developer"
                />
            </div>

            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {mutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                </button>
            </div>
        </form>
    );
};

export default EditUserForm;
