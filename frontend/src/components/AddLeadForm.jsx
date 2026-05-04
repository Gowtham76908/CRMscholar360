import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2 } from "lucide-react";

const leadSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().min(10, "Phone number is required"),
    source: z.enum(["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL"]),
    enquiryType: z.enum(["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"]),
});

// Pass `lead` prop to enter edit mode; omit it for create mode
const AddLeadForm = ({ onClose, lead }) => {
    const queryClient = useQueryClient();
    const isEdit = !!lead;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(leadSchema),
        defaultValues: isEdit ? {
            name: lead.name || "",
            email: lead.email || "",
            phone: lead.phone || "",
            source: lead.source || "WEBSITE",
            enquiryType: lead.enquiryType || "PRODUCT",
        } : {},
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (isEdit) {
                return await api.patch(`/leads/${lead.id}`, data);
            }
            return await api.post("/leads", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            onClose();
        },
    });

    const onSubmit = (data) => {
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined && v !== "")
        );
        mutation.mutate(cleanData);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
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

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Source</label>
                    <select {...register("source")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
                        <option value="WEBSITE">Website</option>
                        <option value="FACEBOOK">Facebook</option>
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="GMAIL">Gmail</option>
                        <option value="PHONE_CALL">Phone Call</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Enquiry Type</label>
                    <select {...register("enquiryType")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
                        <option value="PRODUCT">Product</option>
                        <option value="SERVICES">Services</option>
                        <option value="LMS">LMS</option>
                        <option value="WHITE_LABEL">White Label</option>
                    </select>
                </div>
            </div>

            {mutation.isError && (
                <p className="text-sm text-red-600">
                    {mutation.error?.response?.data?.message || "Failed to save lead. Please try again."}
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
                    {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : isEdit ? "Save Changes" : "Save Lead"}
                </button>
            </div>
        </form>
    );
};

export default AddLeadForm;
