import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import api from "../api/axios";

const schema = z.object({
    email: z.string().email("Enter a valid email address"),
});

const ForgotPassword = () => {
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data) => {
        setIsLoading(true);
        try {
            await api.post("/auth/forgot-password", { email: data.email });
        } catch {
            // Intentionally silent — backend always returns 200 to prevent enumeration
        } finally {
            setIsLoading(false);
            setSubmitted(true);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center">
                        <img src="/SCHOLAR360.PNG" alt="scholar360 Logo" className="h-14 w-14 object-contain" />
                    </div>
                    <h2 className="mt-4 text-3xl font-extrabold text-gray-900">scholar360</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {submitted ? "Check your email" : "Reset your password"}
                    </p>
                </div>

                {submitted ? (
                    <div className="space-y-4 text-center">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-800">
                                If that email is registered, you'll receive a reset link shortly. Check your inbox and spam folder — the link expires in <strong>15 minutes</strong>.
                            </p>
                        </div>
                        <p className="text-xs text-gray-500">
                            Didn't get it? Check your spam folder or request a new link.
                        </p>
                        <button
                            onClick={() => setSubmitted(false)}
                            className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                        >
                            Try a different email
                        </button>
                    </div>
                ) : (
                    <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    {...register("email")}
                                    placeholder="you@example.com"
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
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
                                    Sending link...
                                </div>
                            ) : (
                                "Send reset link"
                            )}
                        </button>
                    </form>
                )}

                <div className="text-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to sign in
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
