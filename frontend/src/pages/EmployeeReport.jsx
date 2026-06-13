import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Users, Phone, Mail, MessageSquare, CheckSquare, Clock,
    TrendingUp, Activity, FileText, AlertCircle, ArrowLeft,
    Loader2, Star, Target, Calendar, Send, Trash2,
    IndianRupee, Trophy, Wallet, TrendingDown, BarChart2, Banknote,
} from "lucide-react";
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import FasterqSection, { fmtSecs } from "../components/fasterq/FasterqSection";
import ProductivitySection from "../components/workforce/ProductivitySection";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = fmtSecs;

const fmtINR = (n) => {
    const v = n ?? 0;
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)}L`;
    return `₹${v.toLocaleString("en-IN")}`;
};

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
                }`}>{p.label}</button>
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

// ── mini stat tile ────────────────────────────────────────────────────────────
const Tile = ({ icon: Icon, label, value, iconBg = "bg-[#FFF7ED]", iconColor = "text-[#F97316]", highlight }) => (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default ${highlight ? "border-[#F97316]" : "border-[#E4E4E7]"}`}>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p className="text-xl font-bold text-[#18181B] leading-tight">{value}</p>
        <p className="text-[11px] text-[#71717A] font-medium mt-0.5">{label}</p>
    </div>
);

// ── progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ label, value, color = "bg-[#F97316]", tooltip }) => {
    const pct = Math.round((value ?? 0) * 100);
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-[#18181B] font-medium">{label}</span>
                <span className="text-[#71717A] font-semibold">{pct}%</span>
            </div>
            {tooltip && <p className="text-[11px] text-[#71717A] mb-1.5">{tooltip}</p>}
            <div className="h-2 bg-[#F4F4F5] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ── section wrapper ───────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, children }) => (
    <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#F4F4F5]">
            <div className="h-7 w-7 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-[#F97316]" />
            </div>
            <h2 className="font-semibold text-[#18181B]">{title}</h2>
        </div>
        {children}
    </div>
);

const activityIcon = (action) => {
    const a = (action || "").toLowerCase();
    if (a.includes("call"))       return <Phone className="h-3.5 w-3.5 text-blue-500" />;
    if (a.includes("email"))      return <Mail className="h-3.5 w-3.5 text-purple-500" />;
    if (a.includes("whatsapp"))   return <MessageSquare className="h-3.5 w-3.5 text-green-500" />;
    if (a.includes("task"))       return <CheckSquare className="h-3.5 w-3.5 text-[#F97316]" />;
    if (a.includes("assign"))     return <Target className="h-3.5 w-3.5 text-[#F97316]" />;
    if (a.includes("attend"))     return <Calendar className="h-3.5 w-3.5 text-amber-500" />;
    return <Activity className="h-3.5 w-3.5 text-[#71717A]" />;
};

// ── main page ─────────────────────────────────────────────────────────────────
const EmployeeReport = () => {
    const { id: employeeId } = useParams();
    const { user }           = useAuth();
    const navigate           = useNavigate();
    const qc                 = useQueryClient();

    const [period,    setPeriod]    = useState("30d");
    const [from,      setFrom]      = useState("");
    const [to,        setTo]        = useState("");
    const [chartMode, setChartMode] = useState("daily");
    const [noteText,  setNoteText]  = useState("");

    if (!["SUPER_ADMIN", "ADMIN"].includes(user?.role)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-[#18181B]">Access Denied</p>
                </div>
            </div>
        );
    }

    const pq = period === "custom" ? { period, from, to } : { period };

    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ["er-profile", employeeId],
        queryFn:  () => api.get(`/employee-report/${employeeId}/profile`).then(r => r.data),
    });

    const { data: kpis, isLoading: kpisLoading } = useQuery({
        queryKey: ["er-kpis", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/kpis`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: chartData = [] } = useQuery({
        queryKey: ["er-chart", employeeId, period, from, to, chartMode],
        queryFn:  () => api.get(`/employee-report/${employeeId}/lead-chart`, { params: { ...pq, mode: chartMode } }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: tasks } = useQuery({
        queryKey: ["er-tasks", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/tasks`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: activities = [] } = useQuery({
        queryKey: ["er-activities", employeeId, period],
        queryFn:  () => api.get(`/employee-report/${employeeId}/activities`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: comm } = useQuery({
        queryKey: ["er-comm", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/communication`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revenueKPIs } = useQuery({
        queryKey: ["er-revenue-kpis", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/revenue-kpis`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: revTrendData = [] } = useQuery({
        queryKey: ["er-revenue-trend", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/revenue-trend`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: invCollTrend = [] } = useQuery({
        queryKey: ["er-inv-coll-trend", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/invoice-collection-trend`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: notes = [], isLoading: notesLoading } = useQuery({
        queryKey: ["er-notes", employeeId],
        queryFn:  () => api.get(`/employee-report/${employeeId}/notes`).then(r => r.data),
    });

    const addNoteMut = useMutation({
        mutationFn: (content) => api.post(`/employee-report/${employeeId}/notes`, { content }).then(r => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["er-notes", employeeId] }); setNoteText(""); },
    });

    const deleteNoteMut = useMutation({
        mutationFn: (noteId) => api.delete(`/employee-report/notes/${noteId}`).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["er-notes", employeeId] }),
    });

    const ep = profile?.employeeProfile;

    const kpiTiles = [
        { icon: Users,       label: "Assigned Leads",  value: kpis?.assignedLeads    ?? 0,          iconBg: "bg-[#FFF7ED]", iconColor: "text-[#F97316]"  },
        { icon: Target,      label: "Contacted",       value: kpis?.contactedLeads   ?? 0,          iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
        { icon: CheckSquare, label: "Converted",       value: kpis?.convertedLeads   ?? 0,          iconBg: "bg-green-50",  iconColor: "text-green-600", highlight: true },
        { icon: AlertCircle, label: "Lost",            value: kpis?.lostLeads        ?? 0,          iconBg: "bg-red-50",    iconColor: "text-red-500"    },
        { icon: Phone,       label: "Calls Made",      value: kpis?.callsMade        ?? 0,          iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
        { icon: Mail,        label: "Emails Sent",     value: kpis?.emailsSent       ?? 0,          iconBg: "bg-purple-50", iconColor: "text-purple-600" },
        { icon: TrendingUp,  label: "Response Rate",   value: `${kpis?.responseRate  ?? 0}%`,       iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
        { icon: Star,        label: "Conversion Rate", value: `${kpis?.conversionRate ?? 0}%`,      iconBg: "bg-green-50",  iconColor: "text-green-600", highlight: true },
    ];

    const statusColor = { ONLINE: "bg-green-500", OFFLINE: "bg-gray-400", ON_LEAVE: "bg-yellow-500" };

    if (profileLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-64 text-center">
                <div>
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-[#18181B]">Employee not found or access denied.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-[#FAFAFA] min-h-screen">

            {/* Back button */}
            <button onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#F97316] transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {/* Employee header card */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative shrink-0">
                        {profile.profilePhoto ? (
                            <img src={profile.profilePhoto} className="h-16 w-16 rounded-2xl object-cover border-2 border-[#FED7AA]" alt="" />
                        ) : (
                            <div className="h-16 w-16 rounded-2xl bg-[#FFF7ED] border-2 border-[#FED7AA] flex items-center justify-center text-[#F97316] font-bold text-xl">
                                {profile.name?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${statusColor[ep?.availabilityStatus] || "bg-gray-400"}`} />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-[#18181B]">{profile.name}</h1>
                        <p className="text-sm text-[#71717A]">{profile.jobTitle || profile.role} {profile.department ? `· ${profile.department}` : ""}</p>
                        {profile.manager && (
                            <p className="text-xs text-[#71717A] mt-0.5">Reports to: <span className="font-medium text-[#18181B]">{profile.manager.name}</span></p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                        {[
                            { label: "Attendance",    value: `${profile.attendanceDays ?? 0} days`, icon: Calendar, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Active Leads",  value: `${ep?.currentLeadLoad ?? 0}`, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Perf. Score",  value: `${Math.round((ep?.performanceScore ?? 0.5) * 100)}%`, icon: Star, color: "text-[#F97316]", bg: "bg-[#FFF7ED]" },
                            { label: "Status",        value: (ep?.availabilityStatus || "OFFLINE").replace("_", " "), icon: Activity, color: "text-green-600", bg: "bg-green-50" },
                        ].map(m => (
                            <div key={m.label} className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7] text-center">
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${m.bg}`}>
                                    <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                                </div>
                                <p className="text-sm font-bold text-[#18181B]">{m.value}</p>
                                <p className="text-[10px] text-[#71717A]">{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Period filters */}
            <PeriodBar period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />

            {/* KPI tiles grid */}
            {kpisLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /></div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {kpiTiles.map(t => <Tile key={t.label} {...t} />)}
                </div>
            )}

            {/* ── Revenue KPI tiles ─────────────────────────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <h2 className="font-semibold text-[#18181B]">Revenue Performance</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                        { icon: Trophy,       label: "Revenue Generated", value: fmtINR(revenueKPIs?.revenueGenerated), bg: "bg-emerald-50",  color: "text-emerald-600", highlight: true },
                        { icon: CheckSquare,  label: "Won Deals",         value: revenueKPIs?.wonDeals ?? 0,             bg: "bg-green-50",    color: "text-green-600"  },
                        { icon: Target,       label: "Pipeline Value",    value: fmtINR(revenueKPIs?.pipelineValue),     bg: "bg-blue-50",     color: "text-blue-600"   },
                        { icon: BarChart2,    label: "Avg Deal Size",     value: fmtINR(revenueKPIs?.avgDealSize),       bg: "bg-purple-50",   color: "text-purple-600" },
                        { icon: Wallet,       label: "Collected Revenue", value: fmtINR(revenueKPIs?.collectedRevenue),  bg: "bg-indigo-50",   color: "text-indigo-600" },
                        { icon: TrendingDown, label: "Outstanding",       value: fmtINR(revenueKPIs?.outstandingRevenue),bg: "bg-red-50",      color: "text-red-500"    },
                        { icon: TrendingUp,   label: "Contribution %",    value: `${revenueKPIs?.contribution ?? 0}%`,   bg: "bg-[#FFF7ED]",   color: "text-[#F97316]"  },
                    ].map(t => <Tile key={t.label} {...t} />)}
                </div>

                {/* Revenue Trend */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Revenue Trend</h3>
                    </div>
                    {revTrendData.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-[#71717A] text-sm">No revenue data for this period</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={revTrendData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
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

                {/* Invoice Collection Trend */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Banknote className="h-4 w-4 text-indigo-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Invoice Collection Trend</h3>
                    </div>
                    {invCollTrend.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-[#71717A] text-sm">No invoice data for this period</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={invCollTrend} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                                <defs>
                                    <linearGradient id="erGPaid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} /><stop offset="95%" stopColor="#22C55E" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="erGPartial" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="erGOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => v.slice(5)} />
                                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} tickFormatter={v => fmtINR(v)} width={70} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} formatter={v => fmtINR(v)} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Area dataKey="paid"        name="Paid"        stroke="#22C55E" fill="url(#erGPaid)"    strokeWidth={2} />
                                <Area dataKey="partial"     name="Partial"     stroke="#F59E0B" fill="url(#erGPartial)" strokeWidth={2} />
                                <Area dataKey="outstanding" name="Outstanding" stroke="#EF4444" fill="url(#erGOut)"     strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            {/* ── end Revenue Performance ────────────────────────────────── */}

            {/* Fasterq analytics (scoped to this employee) */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <FasterqSection
                    agentEmails={profile.email ? [profile.email] : null}
                    hideTopAgents={true}
                    title={`Fasterq Analytics — ${profile.name}`}
                />
            </div>

            {/* Communication Analytics */}
            <Section icon={Mail} title="Communication Analytics">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Emails Sent",       value: comm?.emailsSent      ?? kpis?.emailsSent      ?? 0 },
                        { label: "WhatsApp Sent",     value: comm?.whatsappSent    ?? kpis?.whatsappSent    ?? 0 },
                        { label: "Replies Received",  value: comm?.whatsappReplied ?? kpis?.whatsappReplies ?? 0 },
                        { label: "Response Rate",     value: `${comm?.responseRate ?? 0}%` },
                    ].map(m => (
                        <div key={m.label} className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7] text-center">
                            <p className="text-2xl font-bold text-[#18181B]">{m.value}</p>
                            <p className="text-xs text-[#71717A] mt-0.5">{m.label}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Productivity Analytics */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <ProductivitySection employeeId={employeeId} period={period} from={from} to={to} />
            </div>

            {/* Lead Analytics chart */}
            <Section icon={TrendingUp} title="Lead Analytics">
                <div className="flex justify-end mb-2">
                    <select value={chartMode} onChange={e => setChartMode(e.target.value)}
                        className="text-xs border border-[#E4E4E7] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
                {chartData.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-[#71717A] text-sm">No data for this period</div>
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }}
                                tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                            <YAxis tick={{ fontSize: 10, fill: "#71717A" }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line dataKey="assigned"  name="Assigned"  stroke="#F97316" strokeWidth={2} dot={false} />
                            <Line dataKey="contacted" name="Contacted" stroke="#3B82F6" strokeWidth={2} dot={false} />
                            <Line dataKey="converted" name="Converted" stroke="#22C55E" strokeWidth={2} dot={false} />
                            <Line dataKey="lost"      name="Lost"      stroke="#EF4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </Section>

            {/* Task Analytics */}
            <Section icon={CheckSquare} title="Task Analytics">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Assigned",        value: tasks?.total         ?? 0 },
                        { label: "Completed",       value: tasks?.completed     ?? 0 },
                        { label: "Pending",         value: tasks?.pending       ?? 0 },
                        { label: "Completion Rate", value: `${tasks?.completionRate ?? 0}%` },
                    ].map(m => (
                        <div key={m.label} className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7] text-center">
                            <p className="text-2xl font-bold text-[#18181B]">{m.value}</p>
                            <p className="text-xs text-[#71717A] mt-0.5">{m.label}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Activity Timeline */}
            <Section icon={Activity} title="Activity Timeline">
                {activities.length === 0 ? (
                    <div className="py-8 text-center text-[#71717A] text-sm">No activities for this period</div>
                ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {activities.map(a => (
                            <div key={a.id} className="flex items-start gap-3 p-3 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7]">
                                <div className="h-7 w-7 rounded-lg bg-white border border-[#E4E4E7] flex items-center justify-center shrink-0 mt-0.5">
                                    {activityIcon(a.action)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-[#18181B] font-medium truncate">{a.action}</p>
                                    {a.lead && <p className="text-[11px] text-[#F97316] mt-0.5">{a.lead.name}</p>}
                                </div>
                                <span className="text-[10px] text-[#71717A] whitespace-nowrap shrink-0">
                                    {new Date(a.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Performance Breakdown */}
            <Section icon={Star} title="Performance Breakdown">
                <div className="space-y-4">
                    <ProgressBar
                        label="Lead Effectiveness"
                        value={ep?.leadEffectiveness ?? 0.5}
                        color="bg-[#F97316]"
                        tooltip="Conversion rate among closed leads (30% weight)"
                    />
                    <ProgressBar
                        label="Response Quality"
                        value={ep?.responseQuality ?? 0.5}
                        color="bg-blue-500"
                        tooltip="Fraction of leads responded to within 2 hours (25% weight)"
                    />
                    <ProgressBar
                        label="Follow-up Discipline"
                        value={ep?.followupDiscipline ?? 0.5}
                        color="bg-purple-500"
                        tooltip="Fraction of leads with at least one follow-up activity (25% weight)"
                    />
                    <ProgressBar
                        label="Attendance Reliability"
                        value={ep?.attendanceReliability ?? 0.5}
                        color="bg-amber-500"
                        tooltip="Attendance days in last 30 days vs expected 22 working days (20% weight)"
                    />
                    <div className="pt-2 border-t border-[#F4F4F5]">
                        <ProgressBar
                            label="Overall Performance Score"
                            value={ep?.performanceScore ?? 0.5}
                            color="bg-green-500"
                        />
                    </div>
                </div>
            </Section>

            {/* Manager Notes */}
            <Section icon={FileText} title="Manager Notes">
                <div className="flex gap-2">
                    <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add a private note about this employee…"
                        rows={2}
                        className="flex-1 text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-[#FAFAFA] focus:outline-none focus:ring-1 focus:ring-[#F97316] resize-none"
                    />
                    <button
                        disabled={!noteText.trim() || addNoteMut.isPending}
                        onClick={() => addNoteMut.mutate(noteText)}
                        className="px-3 py-2 bg-[#F97316] text-white rounded-xl hover:bg-[#FB923C] disabled:opacity-40 transition-colors self-stretch flex items-center gap-1.5 text-sm font-medium">
                        {addNoteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Add
                    </button>
                </div>

                {notesLoading ? (
                    <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin text-[#F97316] mx-auto" /></div>
                ) : notes.length === 0 ? (
                    <p className="text-sm text-[#71717A] text-center py-4">No notes yet. Notes are private and visible only to managers.</p>
                ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {notes.map(note => (
                            <div key={note.id} className="bg-[#FFFBF5] rounded-xl border border-[#FED7AA] p-3 flex gap-3">
                                {note.author?.profilePhoto ? (
                                    <img src={note.author.profilePhoto} className="h-7 w-7 rounded-full object-cover shrink-0" alt="" />
                                ) : (
                                    <div className="h-7 w-7 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#F97316] text-xs font-bold shrink-0">
                                        {note.author?.name?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold text-[#18181B]">{note.author?.name}</span>
                                        <span className="text-[10px] text-[#71717A]">
                                            {new Date(note.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#18181B]">{note.content}</p>
                                </div>
                                {(note.author?.id === user?.id || user?.role === "SUPER_ADMIN") && (
                                    <button onClick={() => deleteNoteMut.mutate(note.id)}
                                        disabled={deleteNoteMut.isPending}
                                        className="text-[#71717A] hover:text-red-500 transition-colors shrink-0 self-start mt-0.5">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
};

export default EmployeeReport;
