import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { Lock, Mail, Loader2, Eye, EyeOff, TrendingUp, Bot, Inbox, Users } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

const previewCards = [
    { icon: TrendingUp, label: "Lead Pipeline",  value: "Capture & score every lead",    color: "text-indigo-600", bg: "bg-indigo-50",  delay: "0s",   duration: "5s"   },
    { icon: Bot,        label: "AI Automation",  value: "Auto follow-ups & reminders",   color: "text-emerald-600",bg: "bg-emerald-50", delay: "1.2s", duration: "6s"   },
    { icon: Users,      label: "Team Activity",  value: "Tasks, sprints & attendance",   color: "text-violet-600", bg: "bg-violet-50",  delay: "0.6s", duration: "4.5s" },
    { icon: Inbox,      label: "Unified Inbox",  value: "WhatsApp, email & calls",       color: "text-sky-600",    bg: "bg-sky-50",     delay: "1.8s", duration: "5.5s" },
];

function PreviewCard({ icon: Icon, label, value, color, bg, delay, duration }) {
    return (
        <div
            className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-white/60 w-52"
            style={{ animation: `float-slow ${duration} ease-in-out infinite`, animationDelay: delay }}
        >
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={color} />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider leading-none mb-0.5">{label}</p>
                <p className="text-xs font-semibold text-zinc-700 truncate">{value}</p>
            </div>
        </div>
    );
}

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data) => {
        setIsLoading(true);
        setError("");
        const result = await login(data.email, data.password);
        setIsLoading(false);
        if (result.success) {
            navigate("/dashboard");
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen flex">
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12"
                style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 40%, #ddd6fe 100%)" }}>

                <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-30"
                    style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(60px)" }} />
                <div className="absolute bottom-[-60px] right-[-40px] w-64 h-64 rounded-full opacity-20"
                    style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)", filter: "blur(50px)" }} />

                <div className="relative z-10 flex items-center gap-2.5">
                    <img src="/DCODE.PNG" alt="D-CRM" className="h-9 w-9 object-contain" />
                    <span className="text-lg font-bold text-zinc-800 tracking-tight">D-CRM</span>
                </div>

                <div className="relative z-10 flex-1 flex flex-col justify-center">
                    <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
                        <p className="text-xs font-semibold tracking-widest uppercase text-indigo-600 mb-4">
                            Premium CRM Platform
                        </p>
                        <h1 className="text-4xl xl:text-5xl font-extrabold text-zinc-900 leading-[1.1] mb-5">
                            Manage<br />Relationships<br />
                            <span className="text-indigo-600">Smarter.</span>
                        </h1>
                        <p className="text-base text-zinc-500 leading-relaxed max-w-sm">
                            AI-powered CRM designed for high-growth teams. Automate follow-ups, track leads, and close deals faster.
                        </p>
                    </div>

                    <div className="mt-12 space-y-3">
                        {previewCards.map((card) => (
                            <PreviewCard key={card.label} {...card} />
                        ))}
                    </div>
                </div>

                <div className="relative z-10">
                    <p className="text-xs text-zinc-400">Trusted by high-growth sales teams</p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-md animate-fade-up">
                    <div className="flex lg:hidden items-center gap-2 mb-8">
                        <img src="/DCODE.PNG" alt="D-CRM" className="h-8 w-8 object-contain" />
                        <span className="text-base font-bold text-zinc-800">D-CRM</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-100/60 p-8">
                        <div className="mb-7">
                            <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Welcome back</h2>
                            <p className="text-sm text-zinc-400 mt-1">Sign in to your D-CRM workspace</p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Email address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                    <input
                                        type="email"
                                        {...register("email")}
                                        placeholder="you@company.com"
                                        className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                    />
                                </div>
                                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm font-semibold text-zinc-700">Password</label>
                                    <Link to="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        {...register("password")}
                                        placeholder="••••••••"
                                        className="w-full pl-9 pr-10 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 hover:-translate-y-px"
                                style={{
                                    background: isLoading ? "#8b5cf6" : "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                                    boxShadow: isLoading ? "none" : "0 4px 14px 0 rgba(124,58,237,0.35)",
                                }}
                            >
                                {isLoading ? <><Loader2 size={15} className="animate-spin" />Signing in…</> : "Sign in"}
                            </button>
                        </form>

                        <div className="mt-5 p-3.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <p className="text-xs font-semibold text-indigo-700 mb-1">Demo credentials</p>
                            <p className="text-xs text-indigo-600">admin@gmail.com · admin123</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
