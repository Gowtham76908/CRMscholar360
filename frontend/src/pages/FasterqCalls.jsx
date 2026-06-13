import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock,
    Play, Pause, Search, ChevronLeft, ChevronRight,
    TrendingUp, Calendar, Loader2, RefreshCw, Download,
    ExternalLink, FileText,
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../api/axios";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (secs) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
};

const fmtDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ── AudioPlayer ───────────────────────────────────────────────────────────────
const AudioPlayer = ({ url }) => {
    const [playing, setPlaying] = useState(false);
    const ref = useRef(null);
    const toggle = () => {
        if (!ref.current) return;
        playing ? ref.current.pause() : ref.current.play();
        setPlaying(!playing);
    };
    if (!url) return <span className="text-[#71717A] text-xs">—</span>;
    return (
        <div className="flex items-center gap-1.5">
            <audio ref={ref} src={url} onEnded={() => setPlaying(false)} className="hidden" />
            <button
                onClick={toggle}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF7ED] text-[#F97316] hover:bg-[#FED7AA] text-xs font-medium transition-colors border border-[#FED7AA]"
            >
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {playing ? "Pause" : "Play"}
            </button>
        </div>
    );
};

// ── Sparkline ─────────────────────────────────────────────────────────────────
const Sparkline = ({ data = [], color = "#F97316" }) => {
    if (!data.length) return null;
    const vals = data.map(d => d.v ?? 0);
    const max = Math.max(...vals, 1);
    const w = 64, h = 24;
    const pts = vals.map((v, i) => {
        const x = (i / Math.max(vals.length - 1, 1)) * w;
        const y = h - (v / max) * h;
        return `${x},${y}`;
    }).join(" ");
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

// ── KpiCard ───────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, spark, sparkColor }) => (
    <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-start justify-between">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className={iconColor} style={{ height: 18, width: 18 }} />
            </div>
            <Sparkline data={spark} color={sparkColor} />
        </div>
        <div>
            <p className="text-2xl font-bold text-[#18181B] leading-tight">{value}</p>
            <p className="text-xs text-[#71717A] font-medium mt-0.5">{label}</p>
        </div>
        {sub && <p className="text-[11px] text-[#71717A]">{sub}</p>}
    </div>
);

// ── StatusBadge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ s }) => {
    const map = {
        answered:  "bg-green-50 text-green-700 border-green-100",
        missed:    "bg-red-50 text-red-600 border-red-100",
        no_answer: "bg-red-50 text-red-600 border-red-100",
        busy:      "bg-yellow-50 text-yellow-700 border-yellow-100",
        voicemail: "bg-purple-50 text-purple-700 border-purple-100",
    };
    return (
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize border ${map[s] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
            {s?.replace("_", " ") || "unknown"}
        </span>
    );
};

// ── DirectionChip ─────────────────────────────────────────────────────────────
const DirectionChip = ({ d }) => {
    if (d === "incoming") return (
        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
            <PhoneIncoming className="h-3 w-3" /> Incoming
        </span>
    );
    if (d === "outgoing") return (
        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-medium">
            <PhoneOutgoing className="h-3 w-3" /> Outgoing
        </span>
    );
    return (
        <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-medium">
            <PhoneMissed className="h-3 w-3" /> Missed
        </span>
    );
};

// ── StatBar (horizontal progress) ────────────────────────────────────────────
const StatBar = ({ label, value, total, color, textColor }) => {
    const p = pct(value, total);
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#71717A]">{label}</span>
                <span className={`text-xs font-semibold ${textColor}`}>{value} <span className="text-[#71717A] font-normal">({p}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F4F4F5] overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${p}%` }} />
            </div>
        </div>
    );
};

// ── RateGauge ─────────────────────────────────────────────────────────────────
const RateGauge = ({ value, label, thresholds = [50, 70] }) => {
    const color = value >= thresholds[1] ? "text-green-600" : value >= thresholds[0] ? "text-amber-600" : "text-red-500";
    const bg    = value >= thresholds[1] ? "bg-green-50"    : value >= thresholds[0] ? "bg-amber-50"    : "bg-red-50";
    const bar   = value >= thresholds[1] ? "bg-green-500"   : value >= thresholds[0] ? "bg-amber-500"   : "bg-red-500";
    return (
        <div className={`${bg} rounded-xl p-3 flex flex-col gap-1.5`}>
            <p className={`text-xl font-bold ${color}`}>{value}%</p>
            <p className="text-[11px] font-medium text-[#18181B]">{label}</p>
            <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(value, 100)}%` }} />
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const FasterqCalls = () => {
    const qc       = useQueryClient();
    const navigate = useNavigate();

    const [page, setPage]               = useState(1);
    const [limit]                       = useState(10);
    const [direction, setDirection]     = useState("");
    const [status, setStatus]           = useState("");
    const [search, setSearch]           = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [dateFrom, setDateFrom]       = useState("");
    const [dateTo, setDateTo]           = useState("");
    const [chartDays, setChartDays]     = useState(30);
    const [chartView, setChartView]     = useState("calls"); // "calls" | "duration"
    const [chartMode, setChartMode]     = useState("daily");
    const [expandedRow, setExpandedRow] = useState(null);

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ["fasterq-stats", chartDays],
        queryFn: () => api.get(`/fasterq/stats?days=${chartDays}`).then(r => r.data),
        staleTime: 60_000,
    });

    const { data: callsData, isLoading: callsLoading, error: callsError } = useQuery({
        queryKey: ["fasterq-calls", page, limit, direction, status, search, dateFrom, dateTo],
        queryFn: () => {
            const p = new URLSearchParams({ page, limit });
            if (direction) p.set("direction", direction);
            if (status)    p.set("status",    status);
            if (search)    p.set("search",    search);
            if (dateFrom)  p.set("from",      dateFrom);
            if (dateTo)    p.set("to",        dateTo);
            return api.get(`/fasterq/calls?${p}`).then(r => r.data);
        },
        staleTime: 30_000,
    });

    const s      = statsData?.summary || {};
    const perDay = statsData?.perDay  || [];
    const calls  = callsData?.data    || [];
    const total  = callsData?.total   || 0;
    const pages  = callsData?.totalPages || 1;

    // derived stats
    const answerRate = pct(s.answered, s.totalCalls);
    const missedRate = pct(s.missed,   s.totalCalls);
    const outPct     = pct(s.outgoing, s.totalCalls);
    const inPct      = pct(s.incoming, s.totalCalls);

    // peak day from perDay
    const peakDay = useMemo(() => {
        if (!perDay.length) return null;
        const m = perDay.reduce((best, d) => d.total > best.total ? d : best, perDay[0]);
        return m.total > 0 ? m : null;
    }, [perDay]);

    // lead match rate from current page
    const leadMatchRate = calls.length
        ? pct(calls.filter(c => c.lead).length, calls.length)
        : null;

    // sparklines from perDay — use d.total (actual total, not re-summed)
    const spark7 = (key) => perDay.slice(-7).map(d => ({ v: d[key] ?? 0 }));
    const sparkTotal    = perDay.slice(-7).map(d => ({ v: d.total    ?? 0 }));
    const sparkDuration = perDay.slice(-7).map(d => ({ v: d.total ? Math.round((d.duration ?? 0) / d.total) : 0 }));

    // chart data — weekly aggregation only when chartDays > 14
    const showWeekly    = chartDays > 14;
    const effectiveMode = showWeekly ? chartMode : "daily";

    const chartData = useMemo(() => {
        if (effectiveMode === "daily") return perDay;
        const weeks = [];
        for (let i = 0; i < perDay.length; i += 7) {
            const chunk = perDay.slice(i, i + 7);
            weeks.push({
                date:     chunk[0]?.date,
                total:    chunk.reduce((a, d) => a + (d.total    || 0), 0),
                answered: chunk.reduce((a, d) => a + (d.answered || 0), 0),
                missed:   chunk.reduce((a, d) => a + (d.missed   || 0), 0),
                outgoing: chunk.reduce((a, d) => a + (d.outgoing || 0), 0),
                incoming: chunk.reduce((a, d) => a + (d.incoming || 0), 0),
                duration: chunk.reduce((a, d) => a + (d.duration || 0), 0),
            });
        }
        return weeks;
    }, [perDay, effectiveMode]);

    // avg duration per day / week for duration chart
    const durationChartData = useMemo(() =>
        chartData.map(d => ({
            ...d,
            avgDuration: d.total ? Math.round((d.duration || 0) / d.total) : 0,
        })),
    [chartData]);

    // top agents from current page — with answer rate
    const topAgents = useMemo(() => {
        const map = new Map();
        calls.forEach(c => {
            const key = c.agentName || c.agentEmail || "Unknown";
            if (!map.has(key)) map.set(key, { agent: key, total: 0, answered: 0, missed: 0, duration: 0 });
            const a = map.get(key);
            a.total++;
            if (c.status === "answered") a.answered++;
            if (c.status === "missed" || c.status === "no_answer") a.missed++;
            a.duration += c.duration || 0;
        });
        return [...map.values()]
            .map(a => ({ ...a, answerPct: pct(a.answered, a.total) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [calls]);

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ["fasterq-stats"] });
        qc.invalidateQueries({ queryKey: ["fasterq-calls"] });
    };

    const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1); };
    const handleFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };
    const clearFilters = () => {
        setDirection(""); setStatus(""); setSearch(""); setSearchInput("");
        setDateFrom(""); setDateTo(""); setPage(1);
    };
    const hasFilter = direction || status || search || dateFrom || dateTo;

    const exportCsv = () => {
        const rows = [
            ["Date & Time", "End Time", "Direction", "Status", "Contact", "Phone", "Agent", "Duration", "Lead", "Notes"],
            ...calls.map(c => [
                fmtDate(c.startedAt), fmtDate(c.endedAt), c.direction, c.status,
                c.contactName || "", c.contactPhone || c.fromNumber || c.toNumber || "",
                c.agentName || "", fmt(c.duration), c.lead?.name || "", c.notes || "",
            ]),
        ];
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = "data:text/csv," + encodeURIComponent(csv);
        a.download = "fasterq_calls.csv";
        a.click();
    };

    if (statsLoading && callsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
            </div>
        );
    }

    if (callsError) {
        return (
            <div className="flex items-center justify-center h-64 text-center">
                <p className="text-red-600 font-semibold">Failed to load call logs.</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-5 bg-[#FAFAFA] min-h-screen">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center shadow-sm border border-[#FED7AA]">
                        <Phone className="h-5 w-5 text-[#F97316]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#18181B]">Fasterq Call Analytics</h1>
                        <p className="text-xs text-[#71717A] mt-0.5">
                            {s.totalCalls
                                ? `${s.totalCalls} calls · ${answerRate}% answered · ${fmt(s.avgDuration)} avg`
                                : "No calls recorded yet"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E4E4E7] rounded-xl text-sm shadow-sm">
                        <Calendar className="h-4 w-4 text-[#71717A]" />
                        <select
                            value={chartDays}
                            onChange={e => setChartDays(Number(e.target.value))}
                            className="bg-transparent text-sm focus:outline-none pr-1 text-[#18181B]"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={14}>Last 14 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>
                    <button
                        onClick={refresh}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#F97316] text-[#F97316] rounded-xl text-sm font-medium hover:bg-[#FFF7ED] transition-colors shadow-sm"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                    icon={Phone}
                    label="Total Calls"
                    value={s.totalCalls ?? 0}
                    sub={`Today: ${s.today ?? 0}`}
                    iconBg="bg-[#FFF7ED]" iconColor="text-[#F97316]"
                    spark={sparkTotal} sparkColor="#F97316"
                />
                <KpiCard
                    icon={PhoneIncoming}
                    label="Answered"
                    value={s.answered ?? 0}
                    sub={`${answerRate}% answer rate`}
                    iconBg="bg-green-50" iconColor="text-green-600"
                    spark={spark7("answered")} sparkColor="#22C55E"
                />
                <KpiCard
                    icon={PhoneMissed}
                    label="Missed"
                    value={s.missed ?? 0}
                    sub={`${missedRate}% miss rate`}
                    iconBg="bg-red-50" iconColor="text-red-500"
                    spark={spark7("missed")} sparkColor="#EF4444"
                />
                <KpiCard
                    icon={Clock}
                    label="Avg Duration"
                    value={fmt(s.avgDuration)}
                    sub={`Total: ${fmt(s.totalDuration)}`}
                    iconBg="bg-amber-50" iconColor="text-amber-600"
                    spark={sparkDuration} sparkColor="#F59E0B"
                />
                <KpiCard
                    icon={PhoneOutgoing}
                    label="Outgoing"
                    value={s.outgoing ?? 0}
                    sub={`${outPct}% of total`}
                    iconBg="bg-blue-50" iconColor="text-blue-600"
                    spark={spark7("outgoing")} sparkColor="#3B82F6"
                />
                <KpiCard
                    icon={PhoneIncoming}
                    label="Incoming"
                    value={s.incoming ?? 0}
                    sub={`${inPct}% of total`}
                    iconBg="bg-purple-50" iconColor="text-purple-600"
                    spark={spark7("incoming")} sparkColor="#8B5CF6"
                />
            </div>

            {/* ── Chart + Stats ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Overview chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-[#F97316]" />
                            <h2 className="font-semibold text-[#18181B] text-sm">Trend</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* View toggle: Calls vs Duration */}
                            <div className="flex rounded-lg border border-[#E4E4E7] overflow-hidden text-xs">
                                <button
                                    onClick={() => setChartView("calls")}
                                    className={`px-3 py-1.5 transition-colors ${chartView === "calls" ? "bg-[#F97316] text-white" : "bg-white text-[#71717A] hover:bg-[#FFF7ED]"}`}
                                >
                                    Calls
                                </button>
                                <button
                                    onClick={() => setChartView("duration")}
                                    className={`px-3 py-1.5 transition-colors ${chartView === "duration" ? "bg-[#F97316] text-white" : "bg-white text-[#71717A] hover:bg-[#FFF7ED]"}`}
                                >
                                    Duration
                                </button>
                            </div>
                            {/* Weekly toggle — only when enough data */}
                            {showWeekly && (
                                <select
                                    value={chartMode}
                                    onChange={e => setChartMode(e.target.value)}
                                    className="text-xs border border-[#E4E4E7] rounded-lg px-2 py-1.5 bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                </select>
                            )}
                        </div>
                    </div>

                    {chartData.every(d => d.total === 0) ? (
                        <div className="h-52 flex items-center justify-center text-[#71717A] text-sm">No call data in this period</div>
                    ) : chartView === "calls" ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }}
                                    tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }}
                                    labelFormatter={v => new Date(v).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line dataKey="total"    name="Total"    stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                                <Line dataKey="answered" name="Answered" stroke="#22C55E" strokeWidth={2}   dot={false} />
                                <Line dataKey="missed"   name="Missed"   stroke="#EF4444" strokeWidth={2}   dot={false} />
                                <Line dataKey="incoming" name="Incoming" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                                <Line dataKey="outgoing" name="Outgoing" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={durationChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }}
                                    tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} allowDecimals={false}
                                    tickFormatter={v => fmt(v)} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }}
                                    labelFormatter={v => new Date(v).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                                    formatter={(v) => [fmt(v), "Avg Duration"]}
                                />
                                <Bar dataKey="avgDuration" name="Avg Duration" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Call mix + rates panel */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm flex flex-col gap-4">
                    <h2 className="font-semibold text-[#18181B] text-sm">Call Mix</h2>

                    {s.totalCalls ? (
                        <>
                            {/* Direction split */}
                            <div className="space-y-2.5">
                                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest">Direction</p>
                                <StatBar label="Incoming" value={s.incoming ?? 0} total={s.totalCalls} color="bg-blue-500"  textColor="text-blue-600" />
                                <StatBar label="Outgoing" value={s.outgoing ?? 0} total={s.totalCalls} color="bg-purple-500" textColor="text-purple-600" />
                            </div>

                            <div className="h-px bg-[#F4F4F5]" />

                            {/* Outcome split */}
                            <div className="space-y-2.5">
                                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest">Outcome</p>
                                <StatBar label="Answered" value={s.answered ?? 0} total={s.totalCalls} color="bg-green-500" textColor="text-green-600" />
                                <StatBar label="Missed"   value={s.missed   ?? 0} total={s.totalCalls} color="bg-red-400"   textColor="text-red-500" />
                            </div>

                            <div className="h-px bg-[#F4F4F5]" />

                            {/* Rate gauges */}
                            <div className="grid grid-cols-2 gap-2">
                                <RateGauge value={answerRate} label="Answer Rate"  thresholds={[50, 70]} />
                                <RateGauge value={100 - missedRate} label="Connect Rate" thresholds={[60, 80]} />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-[#71717A] text-sm">No data yet</div>
                    )}
                </div>
            </div>

            {/* ── Insights + Top Agents ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Insights */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <h2 className="font-semibold text-[#18181B] text-sm mb-4">Period Summary</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Answer rate */}
                        <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                            <p className={`text-xl font-bold ${answerRate >= 70 ? "text-green-600" : answerRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {answerRate}%
                            </p>
                            <p className="text-[11px] font-medium text-[#18181B] mt-0.5">Answer Rate</p>
                            <p className="text-[10px] text-[#71717A] mt-0.5">{s.answered ?? 0} of {s.totalCalls ?? 0} calls</p>
                        </div>

                        {/* Avg duration */}
                        <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                            <p className="text-xl font-bold text-amber-600">{fmt(s.avgDuration)}</p>
                            <p className="text-[11px] font-medium text-[#18181B] mt-0.5">Avg Duration</p>
                            <p className="text-[10px] text-[#71717A] mt-0.5">Total: {fmt(s.totalDuration)}</p>
                        </div>

                        {/* Peak day */}
                        <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                            {peakDay ? (
                                <>
                                    <p className="text-xl font-bold text-[#F97316]">{peakDay.total}</p>
                                    <p className="text-[11px] font-medium text-[#18181B] mt-0.5">Peak Day</p>
                                    <p className="text-[10px] text-[#71717A] mt-0.5">
                                        {new Date(peakDay.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xl font-bold text-[#71717A]">—</p>
                                    <p className="text-[11px] font-medium text-[#18181B] mt-0.5">Peak Day</p>
                                </>
                            )}
                        </div>

                        {/* Lead match rate */}
                        <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                            <p className="text-xl font-bold text-indigo-600">
                                {leadMatchRate !== null ? `${leadMatchRate}%` : "—"}
                            </p>
                            <p className="text-[11px] font-medium text-[#18181B] mt-0.5">Lead Match</p>
                            <p className="text-[10px] text-[#71717A] mt-0.5">
                                {leadMatchRate !== null
                                    ? `${calls.filter(c => c.lead).length} of ${calls.length} on page`
                                    : "No calls loaded"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Top Agents */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-[#18181B] text-sm">Agents on this page</h2>
                        <span className="text-[10px] text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                            {calls.length} calls
                        </span>
                    </div>
                    {topAgents.length === 0 ? (
                        <div className="py-8 text-center text-[#71717A] text-sm">No call data loaded</div>
                    ) : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[#E4E4E7]">
                                        {["Agent", "Calls", "Ans%", "Missed", "Avg"].map(h => (
                                            <th key={h} className="text-left px-2 py-2 text-[#71717A] font-semibold whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F4F4F5]">
                                    {topAgents.map(a => (
                                        <tr key={a.agent} className="hover:bg-[#FFF7ED]/50 transition-colors">
                                            <td className="px-2 py-2 font-medium text-[#18181B] truncate max-w-[100px]">{a.agent}</td>
                                            <td className="px-2 py-2 font-semibold text-[#18181B]">{a.total}</td>
                                            <td className="px-2 py-2">
                                                <span className={`font-semibold ${a.answerPct >= 70 ? "text-green-600" : a.answerPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                                    {a.answerPct}%
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-red-500 font-medium">{a.missed}</td>
                                            <td className="px-2 py-2 text-[#71717A]">{fmt(a.total ? Math.round(a.duration / a.total) : 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Filter Toolbar ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
                            <input
                                type="text"
                                placeholder="Search name, phone, agent…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316]"
                            />
                        </div>
                        <button type="submit" className="px-4 py-2 bg-[#F97316] text-white text-sm rounded-xl hover:bg-[#FB923C] transition-colors font-medium shadow-sm">
                            Search
                        </button>
                    </form>

                    <select value={direction} onChange={handleFilter(setDirection)}
                        className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#18181B]">
                        <option value="">All Directions</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="incoming">Incoming</option>
                        <option value="missed">Missed</option>
                    </select>

                    <select value={status} onChange={handleFilter(setStatus)}
                        className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#18181B]">
                        <option value="">All Statuses</option>
                        <option value="answered">Answered</option>
                        <option value="missed">Missed</option>
                        <option value="no_answer">No Answer</option>
                        <option value="busy">Busy</option>
                        <option value="voicemail">Voicemail</option>
                    </select>

                    <div className="flex items-center gap-1.5">
                        <input type="date" value={dateFrom} onChange={handleFilter(setDateFrom)}
                            className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#18181B]" />
                        <span className="text-[#71717A] text-xs">to</span>
                        <input type="date" value={dateTo} onChange={handleFilter(setDateTo)}
                            className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#18181B]" />
                    </div>

                    {hasFilter && (
                        <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 px-2 py-2 rounded-xl hover:bg-red-50 transition-colors">
                            Clear
                        </button>
                    )}

                    <button onClick={exportCsv} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-[#E4E4E7] rounded-xl text-sm text-[#18181B] hover:bg-[#FFF7ED] hover:border-[#F97316] hover:text-[#F97316] transition-colors">
                        <Download className="h-3.5 w-3.5" /> Export
                    </button>
                </div>
            </div>

            {/* ── Call Logs Table ────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-[#E4E4E7] flex items-center justify-between">
                    <h2 className="font-semibold text-[#18181B] text-sm">
                        Call Logs
                        <span className="text-[#71717A] font-normal ml-1">({total} total)</span>
                    </h2>
                    {hasFilter && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">Filtered</span>
                    )}
                </div>

                {callsLoading ? (
                    <div className="p-10 text-center text-[#71717A] text-sm flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
                        Loading calls…
                    </div>
                ) : calls.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-[#FFF7ED] flex items-center justify-center mx-auto mb-3 border border-[#FED7AA]">
                            <Phone className="h-7 w-7 text-[#F97316]" />
                        </div>
                        <p className="font-semibold text-[#18181B] text-sm">No call records found</p>
                        <p className="text-[#71717A] text-xs mt-1">
                            {hasFilter ? "Try clearing your filters." : "Calls will appear here once Fasterq starts pushing data."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#FFF7ED] border-b border-[#E4E4E7]">
                                <tr>
                                    {["Date & Time", "Direction", "Contact", "Phone", "Agent", "Duration", "Status", "Recording"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {calls.map(call => (
                                    <>
                                        <tr
                                            key={call.id}
                                            onClick={() => setExpandedRow(expandedRow === call.id ? null : call.id)}
                                            className="hover:bg-[#FFF7ED]/50 transition-colors border-b border-[#F4F4F5] cursor-pointer"
                                        >
                                            <td className="px-4 py-3 text-xs text-[#71717A] whitespace-nowrap">{fmtDate(call.startedAt)}</td>
                                            <td className="px-4 py-3"><DirectionChip d={call.direction} /></td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-[#18181B]">{call.contactName || <span className="text-[#71717A]">Unknown</span>}</p>
                                                {call.lead && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); navigate(`/leads/${call.lead.id}`); }}
                                                        className="text-[10px] text-[#F97316] font-medium mt-0.5 flex items-center gap-0.5 hover:underline"
                                                    >
                                                        {call.lead.name} <ExternalLink className="h-2.5 w-2.5" />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-[#71717A] font-mono">{call.contactPhone || call.fromNumber || call.toNumber || "—"}</td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-[#18181B]">{call.agentName || "—"}</p>
                                                {call.agentEmail && <p className="text-[10px] text-[#71717A]">{call.agentEmail}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[#18181B] font-medium tabular-nums">{fmt(call.duration)}</td>
                                            <td className="px-4 py-3"><StatusBadge s={call.status} /></td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}><AudioPlayer url={call.recordingUrl} /></td>
                                        </tr>
                                        {/* Expanded row — notes + end time */}
                                        {expandedRow === call.id && (
                                            <tr key={`${call.id}-exp`} className="bg-[#FFF7ED]/40 border-b border-[#F4F4F5]">
                                                <td colSpan={8} className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-6 text-xs">
                                                        {call.endedAt && (
                                                            <span className="text-[#71717A]">
                                                                <span className="font-medium text-[#18181B]">End:</span> {fmtDate(call.endedAt)}
                                                            </span>
                                                        )}
                                                        {call.fromNumber && (
                                                            <span className="text-[#71717A]">
                                                                <span className="font-medium text-[#18181B]">From:</span> {call.fromNumber}
                                                            </span>
                                                        )}
                                                        {call.toNumber && (
                                                            <span className="text-[#71717A]">
                                                                <span className="font-medium text-[#18181B]">To:</span> {call.toNumber}
                                                            </span>
                                                        )}
                                                        {call.notes && (
                                                            <span className="text-[#71717A] flex items-center gap-1">
                                                                <FileText className="h-3 w-3" />
                                                                <span className="font-medium text-[#18181B]">Notes:</span> {call.notes}
                                                            </span>
                                                        )}
                                                        {!call.endedAt && !call.notes && !call.fromNumber && !call.toNumber && (
                                                            <span className="text-[#71717A] italic">No additional details</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {pages > 1 && (
                    <div className="px-5 py-3 border-t border-[#E4E4E7] flex items-center justify-between">
                        <span className="text-xs text-[#71717A]">Page {page} of {pages} · {total} calls</span>
                        <div className="flex items-center gap-1.5">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="p-1.5 rounded-lg border border-[#E4E4E7] disabled:opacity-40 hover:bg-[#FFF7ED] hover:border-[#F97316] transition-colors">
                                <ChevronLeft className="h-4 w-4 text-[#18181B]" />
                            </button>
                            {/* Page numbers */}
                            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                                const p = page <= 3 ? i + 1 : page >= pages - 2 ? pages - 4 + i : page - 2 + i;
                                if (p < 1 || p > pages) return null;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${p === page ? "bg-[#F97316] text-white" : "border border-[#E4E4E7] text-[#18181B] hover:bg-[#FFF7ED]"}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                                className="p-1.5 rounded-lg border border-[#E4E4E7] disabled:opacity-40 hover:bg-[#FFF7ED] hover:border-[#F97316] transition-colors">
                                <ChevronRight className="h-4 w-4 text-[#18181B]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FasterqCalls;
