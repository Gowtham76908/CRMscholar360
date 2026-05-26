import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Users, TrendingUp, Phone, Clock, AlertCircle,
    CheckCircle, Eye, UserPlus, MessageSquare, Loader2,
    ChevronUp, ChevronDown, Calendar,
} from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import SalestrailSection, { fmtSecs } from "../components/salestrail/SalestrailSection";
import WorkforceSection from "../components/workforce/WorkforceSection";
import WorkloadChart from "../components/workforce/WorkloadChart";
import WorkflowBoard from "../components/workforce/WorkflowBoard";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = fmtSecs;

const PERIODS = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "7d",        label: "7 Days" },
    { key: "30d",       label: "30 Days" },
    { key: "month",     label: "Month" },
    { key: "custom",    label: "Custom" },
];

const PeriodBar = ({ period, setPeriod, from, setFrom, to, setTo }) => (
    <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    period === p.key
                        ? "bg-[#F97316] text-white shadow-sm"
                        : "bg-white border border-[#E4E4E7] text-[#18181B] hover:bg-[#FFF7ED] hover:border-[#F97316] hover:text-[#F97316]"
                }`}>
                {p.label}
            </button>
        ))}
        {period === "custom" && (
            <div className="flex items-center gap-1.5 ml-1">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]" />
                <span className="text-[#71717A] text-xs">to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]" />
            </div>
        )}
    </div>
);

// ── KPI stat card ─────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, iconBg, iconColor }) => (
    <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
        <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="h-5 w-5" style={{ color: "inherit" }} />
            </div>
            <div>
                <p className="text-2xl font-bold text-[#18181B] leading-tight">{value}</p>
                <p className="text-xs text-[#71717A] font-medium">{label}</p>
            </div>
        </div>
    </div>
);

// ── performance badge indicator ───────────────────────────────────────────────
const PerfBadge = ({ score }) => {
    const pct = Math.round((score || 0) * 100);
    if (pct >= 85) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">{pct}%</span>;
    if (pct >= 50) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">{pct}%</span>;
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-medium">{pct}%</span>;
};

const LoadBadge = ({ load, max }) => {
    const pct = max > 0 ? load / max : 0;
    if (pct >= 0.8) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-medium">{load}/{max}</span>;
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-[#71717A] border border-gray-100 font-medium">{load}/{max}</span>;
};

const StatusDot = ({ status }) => {
    const map = { ONLINE: "bg-green-500", OFFLINE: "bg-gray-400", ON_LEAVE: "bg-yellow-500" };
    return <span className={`h-2 w-2 rounded-full inline-block ${map[status] || "bg-gray-400"}`} />;
};

// ── main page ─────────────────────────────────────────────────────────────────
const TeamPerformance = () => {
    const { user } = useAuth();
    const navigate  = useNavigate();
    const [period, setPeriod]   = useState("30d");
    const [from,   setFrom]     = useState("");
    const [to,     setTo]       = useState("");
    const [chartMode, setChartMode] = useState("daily");
    const [sortBy,  setSortBy]  = useState("name");
    const [sortDir, setSortDir] = useState("asc");

    if (!["SUPER_ADMIN", "MANAGER"].includes(user?.role)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-[#18181B]">Access Denied</p>
                    <p className="text-[#71717A] text-sm mt-1">Only managers can view team performance.</p>
                </div>
            </div>
        );
    }

    const pq = period === "custom" ? { period, from, to } : { period };

    const { data: kpis, isLoading: kpisLoading } = useQuery({
        queryKey: ["tp-kpis", period, from, to],
        queryFn: () => api.get("/team-performance/kpis", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: chartData = [], isLoading: chartLoading } = useQuery({
        queryKey: ["tp-chart", period, from, to, chartMode],
        queryFn: () => api.get("/team-performance/lead-chart", { params: { ...pq, mode: chartMode } }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: employees = [], isLoading: empLoading } = useQuery({
        queryKey: ["tp-employees", period, from, to],
        queryFn: () => api.get("/team-performance/employees", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: teamEmails = [] } = useQuery({
        queryKey: ["tp-team-emails"],
        queryFn: () => api.get("/team-performance/team-emails").then(r => r.data),
        staleTime: 300_000,
    });

    // Sort employees table
    const sorted = [...employees].sort((a, b) => {
        const va = a[sortBy] ?? 0;
        const vb = b[sortBy] ?? 0;
        const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return sortDir === "asc" ? cmp : -cmp;
    });

    const SortIcon = ({ col }) => {
        if (sortBy !== col) return null;
        return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
    };
    const toggleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(col); setSortDir("desc"); }
    };

    const kpiCards = [
        { label: "Assigned Leads",     value: kpis?.assignedLeads    ?? 0, icon: Users,         iconBg: "bg-[#FFF7ED]",  iconColor: "text-[#F97316]" },
        { label: "Converted Leads",    value: kpis?.convertedLeads   ?? 0, icon: CheckCircle,   iconBg: "bg-green-50",   iconColor: "text-green-600" },
        { label: "Calls Made",         value: kpis?.callsMade        ?? 0, icon: Phone,         iconBg: "bg-blue-50",    iconColor: "text-blue-600"  },
        { label: "Pending Follow-ups", value: kpis?.pendingFollowUps ?? 0, icon: AlertCircle,   iconBg: "bg-yellow-50",  iconColor: "text-yellow-600"},
        { label: "Talk Time",          value: fmt(kpis?.talkTime),         icon: Clock,         iconBg: "bg-amber-50",   iconColor: "text-amber-600" },
        { label: "Response Rate",      value: `${kpis?.responseRate ?? 0}%`, icon: TrendingUp,  iconBg: "bg-purple-50",  iconColor: "text-purple-600"},
    ];

    return (
        <div className="p-6 space-y-6 bg-[#FAFAFA] min-h-screen">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center shadow-sm border border-[#FED7AA]">
                        <Users className="h-5 w-5 text-[#F97316]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#18181B]">Team Command Center</h1>
                        <p className="text-xs text-[#71717A] mt-0.5">Overall team health and performance overview</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E4E4E7] rounded-xl text-xs text-[#71717A] shadow-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
            </div>

            {/* Period filters */}
            <PeriodBar period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />

            {/* KPI cards */}
            {kpisLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /></div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {kpiCards.map(c => (
                        <StatCard key={c.label} {...c} />
                    ))}
                </div>
            )}

            {/* Lead Analytics chart */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#F97316]" />
                        <h2 className="font-semibold text-[#18181B] text-sm">Lead Analytics</h2>
                    </div>
                    <select value={chartMode} onChange={e => setChartMode(e.target.value)}
                        className="text-xs border border-[#E4E4E7] rounded-lg px-2 py-1.5 bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#F97316]">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
                {chartLoading ? (
                    <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /></div>
                ) : chartData.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-[#71717A] text-sm">No data for this period</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }}
                                tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                            <YAxis tick={{ fontSize: 10, fill: "#71717A" }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }}
                                labelFormatter={v => new Date(v).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line dataKey="assigned"  name="Assigned"  stroke="#F97316" strokeWidth={2} dot={false} />
                            <Line dataKey="contacted" name="Contacted" stroke="#3B82F6" strokeWidth={2} dot={false} />
                            <Line dataKey="converted" name="Converted" stroke="#22C55E" strokeWidth={2} dot={false} />
                            <Line dataKey="lost"      name="Lost"      stroke="#EF4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Workforce Intelligence */}
            <WorkforceSection period={period} from={from} to={to} />

            {/* Workload Distribution */}
            <WorkloadChart />

            {/* Workflow Board */}
            <WorkflowBoard />

            {/* Salestrail team analytics */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <SalestrailSection
                    agentEmails={teamEmails.length ? teamEmails : null}
                    title="Salestrail Team Analytics"
                />
            </div>

            {/* Employee Overview Table */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-[#E4E4E7] flex items-center justify-between">
                    <h2 className="font-semibold text-[#18181B] text-sm">
                        Employee Overview <span className="text-[#71717A] font-normal ml-1">({employees.length})</span>
                    </h2>
                </div>
                {empLoading ? (
                    <div className="p-10 text-center flex flex-col items-center gap-2 text-[#71717A] text-sm">
                        <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /> Loading employees…
                    </div>
                ) : employees.length === 0 ? (
                    <div className="py-16 text-center">
                        <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-[#71717A] text-sm">No team members found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#FFF7ED] border-b border-[#E4E4E7]">
                                <tr>
                                    {[
                                        { key: "name",            label: "Employee" },
                                        { key: "availabilityStatus", label: "Status" },
                                        { key: "assignedLeads",   label: "Assigned" },
                                        { key: "convertedLeads",  label: "Converted" },
                                        { key: "callsMade",       label: "Calls" },
                                        { key: "talkTime",        label: "Talk Time" },
                                        { key: "pendingFollowUps",label: "Pending F/U" },
                                        { key: "performanceScore",label: "Perf. Score" },
                                        { key: "lastSeen",        label: "Last Active" },
                                        { key: null,              label: "Actions" },
                                    ].map(col => (
                                        <th key={col.label}
                                            onClick={() => col.key && toggleSort(col.key)}
                                            className={`px-4 py-3 text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wide whitespace-nowrap ${col.key ? "cursor-pointer hover:text-[#F97316] select-none" : ""}`}>
                                            {col.label}<SortIcon col={col.key} />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F4F4F5]">
                                {sorted.map(emp => (
                                    <tr key={emp.id} className="hover:bg-[#FFF7ED]/40 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/employee-report/${emp.id}`)}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {emp.profilePhoto ? (
                                                    <img src={emp.profilePhoto} className="h-8 w-8 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#F97316] font-semibold text-xs">
                                                        {emp.name?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-[#18181B]">{emp.name}</p>
                                                    <p className="text-[10px] text-[#71717A]">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <StatusDot status={emp.availabilityStatus} />
                                                <span className="text-xs text-[#71717A] capitalize">{emp.availabilityStatus?.toLowerCase().replace("_", " ")}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-[#18181B]">{emp.assignedLeads}</td>
                                        <td className="px-4 py-3 text-green-600 font-medium">{emp.convertedLeads}</td>
                                        <td className="px-4 py-3 font-medium text-[#18181B]">{emp.callsMade}</td>
                                        <td className="px-4 py-3 text-[#71717A]">{fmt(emp.talkTime)}</td>
                                        <td className="px-4 py-3">
                                            {emp.pendingFollowUps > 10 ? (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-medium">{emp.pendingFollowUps}</span>
                                            ) : (
                                                <span className="text-sm text-[#18181B]">{emp.pendingFollowUps}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <PerfBadge score={emp.performanceScore} />
                                                <LoadBadge load={emp.currentLeadLoad} max={emp.maxDailyLeads} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-[#71717A]">
                                            {emp.lastSeen
                                                ? new Date(emp.lastSeen).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => navigate(`/employee-report/${emp.id}`)}
                                                    className="p-1.5 rounded-lg bg-[#FFF7ED] text-[#F97316] hover:bg-[#FED7AA] border border-[#FED7AA] transition-colors"
                                                    title="View Analytics">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => navigate(`/unassigned-leads`)}
                                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-colors"
                                                    title="Assign Leads">
                                                    <UserPlus className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => navigate(`/messages`)}
                                                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 border border-green-100 transition-colors"
                                                    title="Message">
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamPerformance;
