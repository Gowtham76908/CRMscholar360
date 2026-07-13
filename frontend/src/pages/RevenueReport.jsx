import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    IndianRupee, TrendingUp, TrendingDown, Clock, Target, Trophy,
    Banknote, Wallet, Users, Eye, AlertCircle, Loader2,
    ChevronUp, ChevronDown, BarChart2, Calendar,
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const fmtINR = (n) => {
    const v = n ?? 0;
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)}L`;
    return `₹${v.toLocaleString("en-IN")}`;
};

const SOURCE_COLORS = {
    FACEBOOK: "#1877F2", INSTAGRAM: "#E1306C", GMAIL: "#EA4335",
    WEBSITE: "#34A853", PHONE_CALL: "#F97316", LINKEDIN: "#0A66C2", SHEETS: "#0F9D58", UNKNOWN: "#9CA3AF",
};
const PIE_COLORS = ["#F97316", "#3B82F6", "#22C55E", "#A855F7", "#EF4444", "#F59E0B", "#06B6D4"];

const InsightBadge = ({ type, text }) => {
    const cfg = {
        positive: "bg-green-50 text-green-700 border-green-200",
        warning:  "bg-amber-50 text-amber-700 border-amber-200",
        danger:   "bg-red-50 text-red-600 border-red-200",
    };
    const icon = { positive: "✓", warning: "⚠", danger: "!" };
    return (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${cfg[type] || cfg.warning}`}>
            <span className="font-bold shrink-0 mt-0.5">{icon[type]}</span>
            <span>{text}</span>
        </div>
    );
};

const PERIODS = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "7d",        label: "7 Days" },
    { key: "30d",       label: "30 Days" },
    { key: "month",     label: "Month" },
    { key: "custom",    label: "Custom" },
];

const RevenueReport = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [period,       setPeriod]       = useState("30d");
    const [from,         setFrom]         = useState("");
    const [to,           setTo]           = useState("");
    const [revTrendMode, setRevTrendMode] = useState("daily");
    const [collTrendMode, setCollTrendMode] = useState("daily");
    const [revSortBy,    setRevSortBy]    = useState("revenueGenerated");
    const [revSortDir,   setRevSortDir]   = useState("desc");
    
    // Employee table local filter states
    const [empSearch,          setEmpSearch]          = useState("");
    const [selectedDept,       setSelectedDept]       = useState("");
    const [selectedConsultant, setSelectedConsultant] = useState("");

    if (!["SUPER_ADMIN", "ADMIN"].includes(user?.role)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-[#18181B]">Access Denied</p>
                    <p className="text-[#71717A] text-sm mt-1">Only managers can view revenue reports.</p>
                </div>
            </div>
        );
    }

    const pq = period === "custom" ? { period, from, to } : { period };

    const { data: revKPIs, isLoading: revKPIsLoading } = useQuery({
        queryKey: ["rev-kpis", period, from, to],
        queryFn: () => api.get("/team-performance/revenue-kpis", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revTrend = [] } = useQuery({
        queryKey: ["rev-trend", period, from, to, revTrendMode],
        queryFn: () => api.get("/team-performance/revenue-trend", { params: { ...pq, mode: revTrendMode } }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revByEmployee = [] } = useQuery({
        queryKey: ["rev-by-employee", period, from, to],
        queryFn: () => api.get("/team-performance/revenue-by-employee", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revBySource = [] } = useQuery({
        queryKey: ["rev-by-source", period, from, to],
        queryFn: () => api.get("/team-performance/revenue-by-source", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revByManager = [] } = useQuery({
        queryKey: ["rev-by-manager", period, from, to],
        queryFn: () => api.get("/team-performance/revenue-by-manager", { params: pq }).then(r => r.data),
        staleTime: 30_000,
        enabled: user?.role === "SUPER_ADMIN",
    });

    const { data: collTrend = [] } = useQuery({
        queryKey: ["rev-coll-trend", period, from, to, collTrendMode],
        queryFn: () => api.get("/team-performance/invoice-collection-trend", { params: { ...pq, mode: collTrendMode } }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revEmployees = [], isLoading: revEmpLoading } = useQuery({
        queryKey: ["rev-employees", period, from, to],
        queryFn: () => api.get("/team-performance/revenue-employees", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const filteredEmployees = revEmployees.filter(emp => {
        // Search filter (name or email)
        if (empSearch) {
            const term = empSearch.toLowerCase();
            const matchesName = emp.name?.toLowerCase().includes(term);
            const matchesEmail = emp.email?.toLowerCase().includes(term);
            if (!matchesName && !matchesEmail) return false;
        }

        // Department filter
        if (selectedDept) {
            const userDepts = (emp.userDepartments || []).map(ud => ud.department);
            const isMember = userDepts.includes(selectedDept) || emp.department === selectedDept;
            if (!isMember) return false;
        }

        // Consultant filter
        if (selectedConsultant) {
            if (emp.id !== selectedConsultant) return false;
        }

        return true;
    });

    const sortedRevEmp = [...filteredEmployees].sort((a, b) => {
        const va = a[revSortBy] ?? 0;
        const vb = b[revSortBy] ?? 0;
        const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return revSortDir === "asc" ? cmp : -cmp;
    });

    const toggleRevSort = (col) => {
        if (revSortBy === col) setRevSortDir(d => d === "asc" ? "desc" : "asc");
        else { setRevSortBy(col); setRevSortDir("desc"); }
    };

    return (
        <div className="p-6 space-y-6 bg-[#FAFAFA] min-h-screen">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shadow-sm border border-emerald-200">
                        <IndianRupee className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#18181B]">Revenue Report</h1>
                        <p className="text-xs text-[#71717A] mt-0.5">Revenue intelligence, collection trends, and deal analytics</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E4E4E7] rounded-xl text-xs text-[#71717A] shadow-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
            </div>

            {/* Period filters */}
            <div className="flex flex-wrap items-center gap-2">
                {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                            period === p.key
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-white border border-[#E4E4E7] text-[#18181B] hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700"
                        }`}>
                        {p.label}
                    </button>
                ))}
                {period === "custom" && (
                    <div className="flex items-center gap-1.5 ml-1">
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                            className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                        <span className="text-[#71717A] text-xs">to</span>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)}
                            className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                )}
            </div>

            {/* Revenue KPI cards */}
            {revKPIsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                        { label: "Pipeline Value",   value: fmtINR(revKPIs?.pipelineValue),     icon: Target,       bg: "bg-blue-50",    color: "text-blue-600"   },
                        { label: "Won Revenue",      value: fmtINR(revKPIs?.wonRevenue),         icon: Trophy,       bg: "bg-emerald-50", color: "text-emerald-600"},
                        { label: "Realized Revenue", value: fmtINR(revKPIs?.realizedRevenue),    icon: IndianRupee,  bg: "bg-green-50",   color: "text-green-600"  },
                        { label: "Pending Revenue",  value: fmtINR(revKPIs?.pendingRevenue),     icon: Clock,        bg: "bg-amber-50",   color: "text-amber-600"  },
                        { label: "Collected",        value: fmtINR(revKPIs?.collectedRevenue),   icon: Wallet,       bg: "bg-indigo-50",  color: "text-indigo-600" },
                        { label: "Outstanding",      value: fmtINR(revKPIs?.outstandingRevenue), icon: TrendingDown, bg: "bg-red-50",     color: "text-red-600"    },
                        { label: "Avg Deal Size",    value: fmtINR(revKPIs?.avgDealSize),        icon: BarChart2,    bg: "bg-purple-50",  color: "text-purple-600" },
                        { label: "Win Rate",         value: `${revKPIs?.winRate ?? 0}%`,         icon: TrendingUp,   bg: "bg-[#FFF7ED]",  color: "text-[#F97316]"  },
                    ].map(c => (
                        <div key={c.label} className="bg-white rounded-2xl border border-[#E4E4E7] p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-2 ${c.bg}`}>
                                <c.icon className={`h-4 w-4 ${c.color}`} />
                            </div>
                            <p className="text-lg font-bold text-[#18181B] leading-tight">{c.value}</p>
                            <p className="text-[10px] text-[#71717A] font-medium mt-0.5">{c.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Insights */}
            {revKPIs?.insights?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {revKPIs.insights.map((ins, i) => <InsightBadge key={i} {...ins} />)}
                </div>
            )}

            {/* Revenue Trend */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Revenue Trend</h3>
                    </div>
                    <select value={revTrendMode} onChange={e => setRevTrendMode(e.target.value)}
                        className="text-xs border border-[#E4E4E7] rounded-lg px-2 py-1.5 bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                {revTrend.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-[#71717A] text-sm">No revenue data for this period</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={revTrend} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => fmtINR(v)} width={70} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} formatter={v => fmtINR(v)} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line dataKey="collected" name="Collected" stroke="#22C55E" strokeWidth={2} dot={false} />
                            <Line dataKey="invoiced"  name="Invoiced"  stroke="#3B82F6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Revenue by Employee + Revenue by Source */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="h-4 w-4 text-blue-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Revenue by Employee</h3>
                    </div>
                    {revByEmployee.length === 0 ? (
                        <div className="h-44 flex items-center justify-center text-[#71717A] text-sm">No data</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={revByEmployee.slice(0, 8)} margin={{ top: 4, right: 8, left: -8, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => fmtINR(v)} width={70} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} formatter={v => fmtINR(v)} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="wonRevenue" name="Won Revenue" fill="#22C55E" radius={[4,4,0,0]} />
                                <Bar dataKey="collected"  name="Collected"   fill="#3B82F6" radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="h-4 w-4 text-purple-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Revenue by Lead Source</h3>
                    </div>
                    {revBySource.length === 0 ? (
                        <div className="h-44 flex items-center justify-center text-[#71717A] text-sm">No data</div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="60%" height={200}>
                                <PieChart>
                                    <Pie data={revBySource} dataKey="amount" nameKey="source" cx="50%" cy="50%" outerRadius={80} label={false}>
                                        {revBySource.map((entry, i) => (
                                            <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} formatter={v => fmtINR(v)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-1.5">
                                {revBySource.map((entry, i) => (
                                    <div key={entry.source} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 rounded-sm shrink-0"
                                                style={{ background: SOURCE_COLORS[entry.source] || PIE_COLORS[i % PIE_COLORS.length] }} />
                                            <span className="text-[#18181B] font-medium capitalize">{entry.source.replace("_", " ")}</span>
                                        </div>
                                        <span className="text-[#71717A] font-semibold">{fmtINR(entry.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Revenue by Manager (SUPER_ADMIN only) */}
            {user?.role === "SUPER_ADMIN" && revByManager.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Trophy className="h-4 w-4 text-amber-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Revenue by Manager</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={revByManager} margin={{ top: 4, right: 8, left: -8, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} angle={-20} textAnchor="end" />
                            <YAxis tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => fmtINR(v)} width={70} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} formatter={v => fmtINR(v)} />
                            <Bar dataKey="wonRevenue" name="Won Revenue" fill="#F59E0B" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Invoice Collection Trend */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-indigo-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Invoice Collection Trend</h3>
                    </div>
                    <select value={collTrendMode} onChange={e => setCollTrendMode(e.target.value)}
                        className="text-xs border border-[#E4E4E7] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
                {collTrend.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-[#71717A] text-sm">No invoice data for this period</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={collTrend} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                            <defs>
                                <linearGradient id="gPaid"    x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} /><stop offset="95%" stopColor="#22C55E" stopOpacity={0} /></linearGradient>
                                <linearGradient id="gPartial" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient>
                                <linearGradient id="gOut"     x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}  /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => fmtINR(v)} width={70} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} formatter={v => fmtINR(v)} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Area dataKey="paid"        name="Paid"        stroke="#22C55E" fill="url(#gPaid)"    strokeWidth={2} />
                            <Area dataKey="partial"     name="Partial"     stroke="#F59E0B" fill="url(#gPartial)" strokeWidth={2} />
                            <Area dataKey="outstanding" name="Outstanding" stroke="#EF4444" fill="url(#gOut)"     strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Team Revenue Performance Table */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-[#E4E4E7] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-semibold text-[#18181B] text-sm">Team Revenue Performance</h3>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                            className="px-3 py-1.5 border border-[#E4E4E7] rounded-xl text-xs bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 shadow-sm"
                        />

                        {/* Department Dropdown */}
                        <select
                            value={selectedDept}
                            onChange={(e) => {
                                setSelectedDept(e.target.value);
                                setSelectedConsultant("");
                            }}
                            className="border border-[#E4E4E7] rounded-xl px-2.5 py-1.5 text-xs bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-sm"
                        >
                            <option value="">All Departments</option>
                            <option value="SALES">Sales</option>
                            <option value="APPLICATION_VISA">Application & Visa</option>
                            <option value="LOAN">Loan</option>
                            <option value="ACCOMMODATION_TICKETS">Accommodation & Tickets</option>
                            <option value="FOREX">Forex</option>
                            <option value="MISCELLANEOUS">Miscellaneous</option>
                        </select>

                        {/* Consultant/Employee Selector Dropdown */}
                        <select
                            value={selectedConsultant}
                            onChange={(e) => setSelectedConsultant(e.target.value)}
                            className="border border-[#E4E4E7] rounded-xl px-2.5 py-1.5 text-xs bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-sm max-w-[160px]"
                        >
                            <option value="">All Consultants</option>
                            {Array.from(new Set(
                                revEmployees
                                    .filter(e => {
                                        if (!selectedDept) return true;
                                        const depts = (e.userDepartments || []).map(ud => ud.department);
                                        return depts.includes(selectedDept) || e.department === selectedDept;
                                    })
                                    .map(e => JSON.stringify({ id: e.id, name: e.name }))
                            ))
                            .map(str => JSON.parse(str))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {revEmpLoading ? (
                    <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
                ) : sortedRevEmp.length === 0 ? (
                    <div className="py-12 text-center text-[#71717A] text-sm">No revenue data</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50 border-b border-[#E4E4E7]">
                                <tr>
                                    {[
                                        { key: "name",              label: "Employee" },
                                        { key: "dealsWon",          label: "Deals Won" },
                                        { key: "revenueGenerated",  label: "Revenue Generated" },
                                        { key: "collectedRevenue",  label: "Collected" },
                                        { key: "avgDealSize",       label: "Avg Deal Size" },
                                        { key: "winRate",           label: "Win Rate" },
                                        { key: "outstandingAmount", label: "Outstanding" },
                                        { key: "contribution",      label: "Contribution" },
                                    ].map(col => (
                                        <th key={col.key} onClick={() => toggleRevSort(col.key)}
                                            className="px-4 py-3 text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-emerald-700 select-none">
                                            {col.label}
                                            {revSortBy === col.key
                                                ? (revSortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)
                                                : null}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F4F4F5]">
                                {sortedRevEmp.map(emp => (
                                    <tr key={emp.id} className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/employee-report/${emp.id}`)}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {emp.profilePhoto ? (
                                                    <img src={emp.profilePhoto} className="h-7 w-7 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="h-7 w-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-xs font-bold">
                                                        {emp.name?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-[#18181B] text-xs">{emp.name}</p>
                                                    <p className="text-[10px] text-[#71717A]">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-[#18181B]">{emp.dealsWon}</td>
                                        <td className="px-4 py-3 font-semibold text-emerald-700">{fmtINR(emp.revenueGenerated)}</td>
                                        <td className="px-4 py-3 text-blue-600 font-medium">{fmtINR(emp.collectedRevenue)}</td>
                                        <td className="px-4 py-3 text-[#71717A]">{fmtINR(emp.avgDealSize)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${emp.winRate >= 50 ? "bg-green-50 text-green-700" : emp.winRate >= 25 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                                                {emp.winRate}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-red-500 font-medium">{fmtINR(emp.outstandingAmount)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-16 bg-[#F4F4F5] rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(emp.contribution, 100)}%` }} />
                                                </div>
                                                <span className="text-[11px] text-[#71717A]">{emp.contribution}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => navigate(`/employee-report/${emp.id}`)}
                                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                                title="View Report">
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
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

export default RevenueReport;
