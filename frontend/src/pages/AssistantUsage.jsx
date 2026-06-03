import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Bot, Activity, Coins, Users, AlertTriangle, Loader2, Shield, Settings as SettingsIcon, ExternalLink,
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis,
    Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

const PRESETS = [
    { id: "7d",  label: "7 days",  days: 7  },
    { id: "30d", label: "30 days", days: 30 },
    { id: "90d", label: "90 days", days: 90 },
];

const isoDay = (d) => d.toISOString().slice(0, 10);
const todayIso = () => isoDay(new Date());
const daysAgoIso = (n) => isoDay(new Date(Date.now() - n * 86_400_000));

const formatNumber = (n) => (n ?? 0).toLocaleString();

const KPI = ({ label, value, icon: Icon, accent = "indigo", sub }) => {
    const palettes = {
        indigo:  "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        amber:   "bg-amber-50 text-amber-600",
        red:     "bg-red-50 text-red-500",
        violet:  "bg-violet-50 text-violet-600",
    };
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", palettes[accent])}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
                <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 truncate">{sub}</p>}
            </div>
        </div>
    );
};

export default function AssistantUsage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

    const [preset, setPreset] = useState("30d");
    const [from, setFrom]     = useState(daysAgoIso(30));
    const [to, setTo]         = useState(todayIso());

    const applyPreset = (id) => {
        const p = PRESETS.find((x) => x.id === id);
        if (!p) return;
        setPreset(id);
        setFrom(daysAgoIso(p.days));
        setTo(todayIso());
    };

    const onCustom = (which, val) => {
        setPreset("custom");
        if (which === "from") setFrom(val);
        else setTo(val);
    };

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["assistant-usage", from, to],
        queryFn:  () => api.get("/assistant-usage", { params: { from, to } }).then((r) => r.data),
        enabled:  isAdmin,
        staleTime: 30_000,
    });

    const errorRatePct = useMemo(() => {
        const r = data?.summary?.errorRate ?? 0;
        return `${(r * 100).toFixed(1)}%`;
    }, [data]);

    if (!isAdmin) return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
            <p className="text-sm text-gray-500 mt-1">Only Admins and Managers can view AI usage.</p>
        </div>
    );

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>;

    const summary  = data?.summary  || { totalRequests: 0, totalTokens: 0, activeUsers: 0, errorRate: 0 };
    const perDay   = data?.perDay   || [];
    const topUsers = data?.topUsers || [];
    const topTools = data?.topTools || [];
    const settings = data?.settings || { enabled: true, rateLimit: 30, maxHistoryTurns: 6 };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <Bot className="h-6 w-6 text-indigo-500" /> AI Usage
                        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                    </h1>
                    <p className="text-sm text-gray-500">How your team is using the AI assistant</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex bg-gray-100 rounded-xl p-1">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p.id)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                                    preset === p.id ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <input type="date" value={from} onChange={(e) => onCustom("from", e.target.value)}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="date" value={to} onChange={(e) => onCustom("to", e.target.value)}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
            </div>

            {/* KPI row + current-config card */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <KPI label="Total Requests" value={formatNumber(summary.totalRequests)} icon={Activity} accent="indigo" sub="In selected window" />
                <KPI label="Total Tokens"   value={formatNumber(summary.totalTokens)}   icon={Coins}    accent="amber"   sub="Prompt + completion" />
                <KPI label="Active Users"   value={formatNumber(summary.activeUsers)}   icon={Users}    accent="emerald" sub="Distinct askers" />
                <KPI label="Error Rate"     value={errorRatePct}                         icon={AlertTriangle} accent={summary.errorRate > 0.1 ? "red" : "violet"} sub="Non-success share" />

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5"><SettingsIcon className="h-3.5 w-3.5" /> Current config</p>
                        <ul className="text-[11px] text-gray-700 mt-2 space-y-0.5">
                            <li>Enabled: <span className={cn("font-semibold", settings.enabled ? "text-emerald-600" : "text-red-500")}>{settings.enabled ? "ON" : "OFF"}</span></li>
                            <li>Rate limit: <span className="font-semibold">{settings.rateLimit}</span>/min</li>
                            <li>History turns: <span className="font-semibold">{settings.maxHistoryTurns}</span></li>
                        </ul>
                    </div>
                    <Link to="/settings?tab=ai-assistant" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 mt-3">
                        Manage <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Requests per day</h3>
                    <div className="h-64">
                        {perDay.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-400">No activity in this window</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={perDay}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <RechartsTooltip />
                                    <Line type="monotone" dataKey="requests" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Tokens per day</h3>
                    <div className="h-64">
                        {perDay.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-400">No activity in this window</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={perDay} barSize={20}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="tokens" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Tables row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900">Top Tools</h3>
                        <p className="text-[11px] text-gray-400">Which CRM tools the assistant reaches for most</p>
                    </div>
                    {topTools.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">No tool calls yet</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {topTools.map((t) => (
                                <div key={t.tool} className="px-5 py-2.5 flex items-center justify-between text-sm">
                                    <span className="font-medium text-gray-700">{t.tool}</span>
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{formatNumber(t.count)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900">Top Users</h3>
                        <p className="text-[11px] text-gray-400">Who's using the assistant most</p>
                    </div>
                    {topUsers.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">No users yet</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 tracking-wide">
                                <tr>
                                    <th className="px-5 py-2 text-left font-semibold">User</th>
                                    <th className="px-5 py-2 text-right font-semibold">Requests</th>
                                    <th className="px-5 py-2 text-right font-semibold">Tokens</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {topUsers.map((u) => (
                                    <tr key={u.userId} className="hover:bg-gray-50">
                                        <td className="px-5 py-2.5 font-medium text-gray-700 truncate">{u.name}</td>
                                        <td className="px-5 py-2.5 text-right text-gray-700">{formatNumber(u.requests)}</td>
                                        <td className="px-5 py-2.5 text-right text-gray-500">{formatNumber(u.tokens)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
