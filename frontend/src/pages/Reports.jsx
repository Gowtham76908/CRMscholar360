import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, TrendingUp, PieChart as PieIcon, Users, Shield, Loader2, Trophy, Clock, Target } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

const Reports = () => {
    const { user: currentUser } = useAuth();
    const [dateRange, setDateRange] = useState({ from: "", to: "" });
    const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

    const { data: leadsBySource, isLoading: loadingSource } = useQuery({
        queryKey: ["leads-by-source", dateRange],
        queryFn: () => api.get("/reports/leads-by-source", { params: dateRange }).then(r => r.data),
        enabled: isAdmin,
    });
    const { data: monthlyGrowth, isLoading: loadingGrowth } = useQuery({
        queryKey: ["monthly-growth"],
        queryFn: () => api.get("/reports/monthly-growth").then(r => r.data),
        enabled: isAdmin,
    });
    const { data: conversionData, isLoading: loadingConversion } = useQuery({
        queryKey: ["conversion-rate", dateRange],
        queryFn: () => api.get("/reports/conversion-rate", { params: dateRange }).then(r => r.data),
        enabled: isAdmin,
    });
    const { data: teamPerformance, isLoading: loadingTeam } = useQuery({
        queryKey: ["team-performance"],
        queryFn: () => api.get("/analytics/team-performance").then(r => r.data),
        enabled: isAdmin,
    });

    const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

    const SectionLoader = ({ className = "h-64" }) => (
        <div className={cn("flex items-center justify-center", className)}>
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
    );

    const handleExport = async (type) => {
        try {
            const response = await api.get(`/export/${type}`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `${type}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error("Export failed. Please try again.");
        }
    };

    if (!isAdmin) return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
            <p className="text-sm text-gray-500 mt-1">Only Admins can view reports.</p>
        </div>
    );

    const topPerformer = teamPerformance?.slice().sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))[0];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h1>
                    <p className="text-sm text-gray-500">Track performance, growth, and team stats</p>
                </div>
                <div className="flex gap-2">
                    <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={() => handleExport("leads")} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Leads
                    </button>
                    <button onClick={() => handleExport("tasks")} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Tasks
                    </button>
                </div>
            </div>

            {/* Key metrics */}
            {(loadingConversion || loadingTeam) ? <SectionLoader className="h-28" /> : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Leads",     value: conversionData?.totalLeads ?? 0,     icon: Users,      color: "bg-indigo-50 text-indigo-600",  sub: "All time" },
                    { label: "Converted",        value: conversionData?.convertedLeads ?? 0, icon: Target,     color: "bg-emerald-50 text-emerald-600", sub: "Closed won" },
                    { label: "Conversion Rate",  value: conversionData?.conversionRate ?? "0%", icon: TrendingUp, color: "bg-amber-50 text-amber-600",    sub: "Win rate" },
                    { label: "Top Performer",    value: topPerformer?.name?.split(" ")[0] ?? "—", icon: Trophy, color: "bg-violet-50 text-violet-600",   sub: topPerformer ? `${topPerformer.conversionRate} rate` : "N/A" },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
                            <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
                            <p className="text-[10px] text-gray-400">{sub}</p>
                        </div>
                    </div>
                ))}
            </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Leads by Source</h3>
                    <div className="h-64">
                        {loadingSource ? <SectionLoader className="h-full" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={leadsBySource} cx="50%" cy="50%" outerRadius={80} dataKey="_count.id" nameKey="source"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {leadsBySource?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Growth</h3>
                    <div className="h-64">
                        {loadingGrowth ? <SectionLoader className="h-full" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyGrowth} barSize={28}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <RechartsTooltip />
                                <Bar dataKey="leads" fill="#6366F1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Team performance */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Team Performance</h3>
                    <button onClick={() => handleExport("team-performance")} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                </div>
                {loadingTeam ? <SectionLoader className="h-40" /> : (
                <div className="divide-y divide-gray-100">
                    {teamPerformance?.map((m, i) => {
                        const rate = parseFloat(m.conversionRate) || 0;
                        return (
                            <div key={m.userId} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                {/* Rank */}
                                <span className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                                    i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-50 text-gray-400"
                                )}>{i + 1}</span>

                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {m.name?.[0]?.toUpperCase()}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                        <span>{m.totalLeads} leads</span>
                                        <span>{m.convertedLeads} converted</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.avgResponseTimeHours}h avg</span>
                                    </div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <span className={cn(
                                        "text-xs font-bold px-2.5 py-1 rounded-full",
                                        rate > 20 ? "bg-emerald-100 text-emerald-700" : rate > 10 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                                    )}>
                                        {m.conversionRate}
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{m.pendingTasks} pending tasks</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
