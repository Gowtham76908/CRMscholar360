import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Download, Users, Shield, Loader2, Trophy,
    Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

const STAGE_CONFIG = [
    { key: "NEW",        label: "New",        bg: "bg-indigo-500",  text: "text-indigo-600"  },
    { key: "CONTACTED",  label: "Contacted",  bg: "bg-blue-500",    text: "text-blue-600"    },
    { key: "FOLLOW_UP",  label: "Follow-up",  bg: "bg-amber-400",   text: "text-amber-600"   },
    { key: "CONVERTED",  label: "Converted",  bg: "bg-emerald-500", text: "text-emerald-600" },
    { key: "LOST",       label: "Lost",       bg: "bg-red-400",     text: "text-red-500"     },
];

const SOURCE_COLORS = {
    FACEBOOK: "#1877F2", INSTAGRAM: "#E1306C", GMAIL: "#EA4335",
    WEBSITE: "#34A853", PHONE_CALL: "#F97316", LINKEDIN: "#0A66C2",
};

const pct = (n, d) => d > 0 ? +((n / d) * 100).toFixed(1) : 0;

const SectionLoader = ({ className = "h-64" }) => (
    <div className={cn("flex items-center justify-center", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
    </div>
);

const Reports = () => {
    const { user: currentUser } = useAuth();
    const [dateRange, setDateRange] = useState({ from: "", to: "" });
    const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

    const params = {
        ...(dateRange.from && { from: dateRange.from }),
        ...(dateRange.to   && { to:   dateRange.to   }),
    };

    const { data: conversionData, isLoading: loadingConversion } = useQuery({
        queryKey: ["conversion-rate", dateRange],
        queryFn: () => api.get("/reports/conversion-rate", { params }).then(r => r.data),
        enabled: isAdmin,
    });
    const { data: statusData = [], isLoading: loadingStatus } = useQuery({
        queryKey: ["leads-by-status", dateRange],
        queryFn: () => api.get("/reports/leads-by-status", { params }).then(r => r.data),
        enabled: isAdmin,
    });
    const { data: sourceData = [], isLoading: loadingSource } = useQuery({
        queryKey: ["leads-by-source", dateRange],
        queryFn: () => api.get("/reports/leads-by-source", { params }).then(r => r.data),
        enabled: isAdmin,
    });
    const { data: monthlyGrowth = [], isLoading: loadingGrowth } = useQuery({
        queryKey: ["monthly-growth"],
        queryFn: () => api.get("/reports/monthly-growth").then(r => r.data),
        enabled: isAdmin,
    });
    const { data: teamPerformance = [], isLoading: loadingTeam } = useQuery({
        queryKey: ["team-performance"],
        queryFn: () => api.get("/analytics/team-performance").then(r => r.data),
        enabled: isAdmin,
    });

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

    const total = conversionData?.totalLeads ?? 0;
    const statusMap = Object.fromEntries(statusData.map(r => [r.status, r._count.id]));
    const maxStageCount = Math.max(...STAGE_CONFIG.map(s => statusMap[s.key] || 0), 1);

    const activeTeam = teamPerformance
        .filter(m => m.totalLeads > 0)
        .sort((a, b) => b.totalLeads - a.totalLeads);
    const maxTeamLeads = Math.max(...activeTeam.map(m => m.totalLeads), 1);
    const maxTeamRate  = Math.max(...activeTeam.map(m => parseFloat(m.conversionRate) || 0), 1);
    const topPerformer = [...teamPerformance].sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))[0];

    const maxSourceTotal = Math.max(...sourceData.map(s => s.total), 1);

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h1>
                    <p className="text-sm text-gray-500">Track performance, growth, and team stats</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input type="date" value={dateRange.from}
                        onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="date" value={dateRange.to}
                        onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {dateRange.from || dateRange.to ? (
                        <button onClick={() => setDateRange({ from: "", to: "" })}
                            className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
                            Clear
                        </button>
                    ) : null}
                    <button onClick={() => handleExport("leads")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Leads
                    </button>
                    <button onClick={() => handleExport("tasks")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Tasks
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            {loadingConversion ? <SectionLoader className="h-28" /> : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: "Total Leads",
                        value: conversionData?.totalLeads ?? 0,
                        icon: Users,
                        color: "bg-indigo-50 text-indigo-600",
                        sub: "In selected range",
                    },
                    {
                        label: "Converted",
                        value: conversionData?.convertedLeads ?? 0,
                        icon: CheckCircle2,
                        color: "bg-emerald-50 text-emerald-600",
                        sub: conversionData?.conversionRate ?? "0%",
                    },
                    {
                        label: "Lost",
                        value: conversionData?.lostLeads ?? 0,
                        icon: XCircle,
                        color: "bg-red-50 text-red-500",
                        sub: `${pct(conversionData?.lostLeads, total)}% of total`,
                    },
                    {
                        label: "Top Performer",
                        value: topPerformer?.name?.split(" ")[0] ?? "—",
                        icon: Trophy,
                        color: "bg-violet-50 text-violet-600",
                        sub: topPerformer ? `${topPerformer.conversionRate} conv.` : "N/A",
                    },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
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

            {/* Pipeline Funnel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Pipeline Funnel</h3>
                    <span className="text-xs text-gray-400">{total} total leads</span>
                </div>
                {loadingStatus ? <SectionLoader className="h-36" /> : (
                <div className="space-y-2.5">
                    {STAGE_CONFIG.map(stage => {
                        const count  = statusMap[stage.key] || 0;
                        const share  = pct(count, total);
                        const barW   = pct(count, maxStageCount);
                        return (
                            <div key={stage.key} className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-500 w-[72px] text-right shrink-0">
                                    {stage.label}
                                </span>
                                <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-lg flex items-center px-3 transition-all duration-700", stage.bg)}
                                        style={{ width: `${Math.max(barW, 1.5)}%` }}>
                                        {barW > 12 && (
                                            <span className="text-white text-xs font-semibold">{count}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 w-20 justify-end">
                                    {barW <= 12 && (
                                        <span className="text-xs font-medium text-gray-700">{count}</span>
                                    )}
                                    <span className={cn("text-xs font-semibold w-10 text-right", stage.text)}>
                                        {share}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}
            </div>

            {/* Source Quality + Monthly Growth */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Source Quality */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900">Source Quality</h3>
                        <span className="text-[10px] text-gray-400 font-medium">Conv. rate →</span>
                    </div>
                    {loadingSource ? <SectionLoader className="h-48" /> : sourceData.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-10">No source data</p>
                    ) : (
                    <div className="space-y-3.5">
                        {sourceData.map(row => {
                            const cr       = row.conversionRate ?? 0;
                            const dotColor = SOURCE_COLORS[row.source] ?? "#9CA3AF";
                            const crColor  = cr >= 20 ? "text-emerald-600" : cr >= 10 ? "text-amber-600" : "text-red-500";
                            return (
                                <div key={row.source} className="flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                                    <span className="text-xs font-medium text-gray-700 w-24 shrink-0 capitalize">
                                        {row.source.replace(/_/g, " ").toLowerCase()}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                            <span>{row.total} leads</span>
                                            <span>{row.converted} won</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${pct(row.total, maxSourceTotal)}%`,
                                                    background: dotColor,
                                                    opacity: 0.7,
                                                }} />
                                        </div>
                                    </div>
                                    <span className={cn("text-xs font-bold w-12 text-right shrink-0", crColor)}>
                                        {cr}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    )}
                </div>

                {/* Monthly Growth */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Growth</h3>
                    <div className="h-52">
                        {loadingGrowth ? <SectionLoader className="h-full" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyGrowth} barSize={16} barCategoryGap="35%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontSize: 12 }} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="leads"     name="Total"     fill="#6366F1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="converted" name="Converted" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Team Performance */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Team Performance</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {activeTeam.length} member{activeTeam.length !== 1 ? "s" : ""} with assigned leads
                        </p>
                    </div>
                    <button onClick={() => handleExport("team-performance")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                </div>

                {loadingTeam ? <SectionLoader className="h-40" /> : activeTeam.length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400">
                        No leads have been assigned to team members yet.
                    </div>
                ) : (
                <div className="divide-y divide-gray-100">
                    {activeTeam.map((m, i) => {
                        const rate       = parseFloat(m.conversionRate) || 0;
                        const leadBarW   = pct(m.totalLeads, maxTeamLeads);
                        const rateBarW   = pct(rate, maxTeamRate);
                        const rateBadge  = rate > 20
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : rate > 10
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : rate > 0
                            ? "text-blue-600 bg-blue-50 border-blue-200"
                            : "text-gray-400 bg-gray-100 border-gray-200";
                        const rateBar    = rate > 20 ? "bg-emerald-500" : rate > 10 ? "bg-amber-400" : "bg-indigo-300";

                        return (
                            <div key={m.userId} className="px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                                <div className="flex items-start gap-3">
                                    {/* Rank */}
                                    <span className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1",
                                        i === 0 ? "bg-amber-100 text-amber-700"
                                        : i === 1 ? "bg-slate-100 text-slate-500"
                                        : i === 2 ? "bg-orange-100 text-orange-500"
                                        : "bg-gray-50 text-gray-400"
                                    )}>{i + 1}</span>

                                    {/* Avatar */}
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                        {m.name?.[0]?.toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        {/* Name + badge */}
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border shrink-0", rateBadge)}>
                                                {m.conversionRate}
                                            </span>
                                        </div>

                                        {/* Lead volume bar */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-16 shrink-0 text-[10px] text-gray-400">Leads</div>
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-400 rounded-full transition-all duration-700"
                                                    style={{ width: `${leadBarW}%` }} />
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-600 w-8 text-right shrink-0">
                                                {m.totalLeads}
                                            </span>
                                        </div>

                                        {/* Conversion rate bar */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-16 shrink-0 text-[10px] text-gray-400">Conv. rate</div>
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={cn("h-full rounded-full transition-all duration-700", rateBar)}
                                                    style={{ width: `${rateBarW}%` }} />
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-600 w-8 text-right shrink-0">
                                                {m.convertedLeads}w
                                            </span>
                                        </div>

                                        {/* Stats row */}
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {m.avgResponseTimeHours}h avg
                                            </span>
                                            <span>·</span>
                                            {m.overdueTasks > 0 ? (
                                                <span className="flex items-center gap-1 text-red-500 font-medium">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {m.overdueTasks} overdue
                                                </span>
                                            ) : (
                                                <span>{m.pendingTasks} pending task{m.pendingTasks !== 1 ? "s" : ""}</span>
                                            )}
                                        </div>
                                    </div>
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
