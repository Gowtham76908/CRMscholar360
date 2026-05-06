import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lock, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import api from "../api/axios";

const schema = z.object({
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
});

const ResetPassword = () => {
    // Read token from URL immediately into state — never leave it in the URL bar any longer than needed
    const [searchParams] = useSearchParams();
    const [token] = useState(() => searchParams.get("token") ?? "");

    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm]   = useState(false);
    const [isLoading, setIsLoading]       = useState(false);
    const [error, setError]               = useState("");
    const [tokenExpired, setTokenExpired] = useState(false);
    const [success, setSuccess]           = useState(false);

    // Replace URL so the token isn't visible or shareable after page load
    useEffect(() => {
        window.history.replaceState({}, "", "/reset-password");
    }, []);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
    });

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center space-y-4">
                    <p className="text-red-600 font-medium">Invalid or missing reset link.</p>
                    <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500">
                        Request a new one
                    </Link>
                </div>
            </div>
        );
    }

    const onSubmit = async (data) => {
        setIsLoading(true);
        setError("");
        try {
            await api.post("/auth/reset-password", { token, password: data.password });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 2500);
        } catch (err) {
            const code = err.response?.data?.code;
            if (code === "RESET_TOKEN_INVALID") {
                setTokenExpired(true);
            } else {
                setError(err.response?.data?.message ?? "Failed to reset password. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center">
                        <img src="/DCODE.PNG" alt="D-CRM Logo" className="h-14 w-14 object-contain" />
                    </div>
                    <h2 className="mt-4 text-3xl font-extrabold text-gray-900">D-CRM</h2>
                    <p className="mt-2 text-sm text-gray-600">Choose a new password</p>
                </div>

                {tokenExpired ? (
                    <div className="space-y-4 text-center">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800 font-medium">This link has expired or is invalid.</p>
                            <p className="text-xs text-amber-700 mt-1">Reset links are valid for 15 minutes.</p>
                        </div>
                        <Link
                            to="/forgot-password"
                            className="inline-block w-full text-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                        >
                            Request a new link
                        </Link>
                    </div>
                ) : success ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <p className="text-sm text-green-800 font-medium">Password reset successfully!</p>
                        <p className="text-xs text-green-700 mt-1">Redirecting to sign in…</p>
                    </div>
                ) : (
                    <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                New Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    {...register("password")}
                                    placeholder="Min 8 chars, include a number"
                                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    {...register("confirm")}
                                    placeholder="Repeat your new password"
                                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showConfirm ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                                </button>
                            </div>
                            {errors.confirm && (
                                <p className="mt-1 text-sm text-red-600">{errors.confirm.message}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Resetting…
                                </div>
                            ) : (
                                "Reset password"
                            )}
                        </button>
                    </form>
                )}

                <div className="text-center">
                    <Link to="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to sign in
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
