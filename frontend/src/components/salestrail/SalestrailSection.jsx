/**
 * SalestrailSection — reusable embedded Salestrail analytics block.
 *
 * Props:
 *   agentEmails  string[]   when set, scopes stats + calls to these agents
 *   hideTopAgents boolean   hides the Top Agents panel (for employee view)
 *   title        string     section heading override
 */
import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock,
    Play, Pause, Search, ChevronLeft, ChevronRight,
    TrendingUp, Calendar, Loader2, RefreshCw, Download,
    Lightbulb, Users, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import api from "../../api/axios";

// ── helpers ──────────────────────────────────────────────────────────────────
export const fmtSecs = (s) => {
    if (!s) return "0s";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m ? `${m}m ${r}s` : `${r}s`;
};

export const fmtDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

// ── shared mini-components ────────────────────────────────────────────────────
export const Sparkline = ({ data = [], color = "#F97316" }) => {
    if (!data.length) return null;
    const vals = data.map(d => d.count ?? d.total ?? 0);
    const max  = Math.max(...vals, 1);
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

export const KpiCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, sparkData, sparkColor }) => (
    <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
        <div className="flex items-start justify-between">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className={`h-4.5 w-4.5 ${iconColor}`} style={{ height: 18, width: 18 }} />
            </div>
            <Sparkline data={sparkData || []} color={sparkColor} />
        </div>
        <div>
            <p className="text-2xl font-bold text-[#18181B] leading-tight">{value}</p>
            <p className="text-xs text-[#71717A] font-medium mt-0.5">{label}</p>
        </div>
        {sub && <p className="text-[11px] text-[#71717A]">{sub}</p>}
    </div>
);

export const StatusBadge = ({ s }) => {
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

export const DirectionChip = ({ d }) => {
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
            <button onClick={toggle}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF7ED] text-[#F97316] hover:bg-[#FED7AA] text-xs font-medium transition-colors border border-[#FED7AA]">
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {playing ? "Pause" : "Play"}
            </button>
        </div>
    );
};

const DonutCenter = ({ cx, cy, total }) => (
    <>
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#18181B" fontSize={22} fontWeight={700}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#71717A" fontSize={11}>Total</text>
    </>
);

const DONUT_COLORS = ["#22C55E", "#3B82F6", "#EF4444", "#8B5CF6"];

// ── main section ──────────────────────────────────────────────────────────────
const SalestrailSection = ({ agentEmails = null, hideTopAgents = false, title = "Salestrail Call Analytics" }) => {
    const qc = useQueryClient();
    const [page, setPage]               = useState(1);
    const [limit]                       = useState(10);
    const [direction, setDirection]     = useState("");
    const [status, setStatus]           = useState("");
    const [search, setSearch]           = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [dateFrom, setDateFrom]       = useState("");
    const [dateTo, setDateTo]           = useState("");
    const [chartDays, setChartDays]     = useState(30);
    const [chartMode, setChartMode]     = useState("daily");

    // Build agentEmails query param if scoped
    const emailParam = agentEmails?.length ? agentEmails.join(",") : null;

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ["st-stats", chartDays, emailParam],
        queryFn: () => {
            const p = new URLSearchParams({ days: chartDays });
            if (emailParam) p.set("agentEmails", emailParam);
            return api.get(`/salestrail/stats?${p}`).then(r => r.data);
        },
        staleTime: 60_000,
    });

    const { data: callsData, isLoading: callsLoading } = useQuery({
        queryKey: ["st-calls", page, limit, direction, status, search, dateFrom, dateTo, emailParam],
        queryFn: () => {
            const p = new URLSearchParams({ page, limit });
            if (direction)  p.set("direction",    direction);
            if (status)     p.set("status",       status);
            if (search)     p.set("search",       search);
            if (dateFrom)   p.set("from",         dateFrom);
            if (dateTo)     p.set("to",           dateTo);
            if (emailParam) p.set("agentEmails",  emailParam);
            return api.get(`/salestrail/calls?${p}`).then(r => r.data);
        },
        staleTime: 30_000,
    });

    const s      = statsData?.summary || {};
    const perDay = statsData?.perDay  || [];
    const calls  = callsData?.calls   || [];
    const total  = callsData?.total   || 0;
    const pages  = callsData?.pages   || 1;

    const chartData = useMemo(() => {
        if (chartMode === "daily" || perDay.length <= 14) return perDay;
        const weeks = [];
        for (let i = 0; i < perDay.length; i += 7) {
            const chunk = perDay.slice(i, i + 7);
            weeks.push({
                date:     chunk[0]?.date,
                answered: chunk.reduce((a, d) => a + (d.answered || 0), 0),
                missed:   chunk.reduce((a, d) => a + (d.missed   || 0), 0),
                outgoing: chunk.reduce((a, d) => a + (d.outgoing || 0), 0),
                incoming: chunk.reduce((a, d) => a + (d.incoming || 0), 0),
            });
        }
        return weeks;
    }, [perDay, chartMode]);

    const donutData = [
        { name: "Answered", value: s.answered || 0 },
        { name: "Incoming", value: s.incoming || 0 },
        { name: "Missed",   value: s.missed   || 0 },
        { name: "Outgoing", value: s.outgoing || 0 },
    ];

    const topAgents = useMemo(() => {
        const map = new Map();
        calls.forEach(c => {
            const key = c.agentName || c.agentEmail || "Unknown";
            if (!map.has(key)) map.set(key, { agent: key, total: 0, answered: 0, missed: 0, duration: 0 });
            const a = map.get(key);
            a.total++;
            if (c.status === "answered") a.answered++;
            if (["missed", "no_answer"].includes(c.status)) a.missed++;
            a.duration += c.duration || 0;
        });
        return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    }, [calls]);

    const answerRate = s.totalCalls ? Math.round((s.answered / s.totalCalls) * 100) : 0;
    const missedRate = s.totalCalls ? Math.round((s.missed   / s.totalCalls) * 100) : 0;
    const sparkBase  = perDay.slice(-7).map(d => ({ count: d.answered + d.missed + d.incoming + d.outgoing }));

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ["st-stats"] });
        qc.invalidateQueries({ queryKey: ["st-calls"] });
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
            ["Date & Time", "Direction", "Contact", "Phone", "Agent", "Duration", "Status"],
            ...calls.map(c => [fmtDate(c.startedAt), c.direction, c.contactName || "", c.contactPhone || "", c.agentName || "", fmtSecs(c.duration), c.status]),
        ];
        const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = "data:text/csv," + encodeURIComponent(csv);
        a.download = "salestrail_calls.csv";
        a.click();
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-[#FFF7ED] flex items-center justify-center border border-[#FED7AA]">
                        <Phone className="h-4 w-4 text-[#F97316]" />
                    </div>
                    <h2 className="font-bold text-[#18181B]">{title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E4E4E7] rounded-xl text-sm shadow-sm">
                        <Calendar className="h-3.5 w-3.5 text-[#71717A]" />
                        <select value={chartDays} onChange={e => setChartDays(Number(e.target.value))}
                            className="bg-transparent text-sm focus:outline-none text-[#18181B]">
                            <option value={7}>Last 7 days</option>
                            <option value={14}>Last 14 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>
                    <button onClick={refresh}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#F97316] text-[#F97316] rounded-xl text-sm font-medium hover:bg-[#FFF7ED] transition-colors shadow-sm">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            {statsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /></div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard icon={Phone}         label="Total Calls"  value={s.totalCalls ?? 0}  sub={`Today: ${s.today ?? 0}`}               iconBg="bg-[#FFF7ED]"  iconColor="text-[#F97316]"   sparkData={sparkBase}                                           sparkColor="#F97316" />
                    <KpiCard icon={PhoneIncoming} label="Answered"     value={s.answered   ?? 0}  sub={answerRate ? `${answerRate}% rate` : "—"} iconBg="bg-green-50"   iconColor="text-green-600"  sparkData={perDay.slice(-7).map(d=>({count:d.answered}))}      sparkColor="#22C55E" />
                    <KpiCard icon={PhoneMissed}   label="Missed"       value={s.missed     ?? 0}  sub={missedRate ? `${missedRate}% rate` : "—"} iconBg="bg-red-50"     iconColor="text-red-500"    sparkData={perDay.slice(-7).map(d=>({count:d.missed}))}        sparkColor="#EF4444" />
                    <KpiCard icon={Clock}         label="Avg Duration" value={fmtSecs(s.avgDuration)} sub={`Total: ${fmtSecs(s.totalDuration)}`} iconBg="bg-amber-50"   iconColor="text-amber-600"  sparkData={sparkBase}                                           sparkColor="#F59E0B" />
                    <KpiCard icon={PhoneOutgoing} label="Outgoing"     value={s.outgoing   ?? 0}  sub=""                                         iconBg="bg-blue-50"    iconColor="text-blue-600"   sparkData={perDay.slice(-7).map(d=>({count:d.outgoing}))}      sparkColor="#3B82F6" />
                    <KpiCard icon={PhoneIncoming} label="Incoming"     value={s.incoming   ?? 0}  sub=""                                         iconBg="bg-purple-50"  iconColor="text-purple-600" sparkData={perDay.slice(-7).map(d=>({count:d.incoming}))}      sparkColor="#8B5CF6" />
                </div>
            )}

            {/* Charts */}
            <div className={`grid grid-cols-1 gap-4 ${!hideTopAgents ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
                {/* Overview line chart */}
                <div className={`bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm ${!hideTopAgents ? "lg:col-span-2" : ""}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-[#F97316]" />
                            <h3 className="font-semibold text-[#18181B] text-sm">Calls Overview</h3>
                        </div>
                        <select value={chartMode} onChange={e => setChartMode(e.target.value)}
                            className="text-xs border border-[#E4E4E7] rounded-lg px-2 py-1.5 bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#F97316]">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                    {chartData.length === 0 ? (
                        <div className="h-52 flex items-center justify-center text-[#71717A] text-sm">No data yet</div>
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
                                <Line dataKey="answered" name="Answered" stroke="#22C55E" strokeWidth={2} dot={false} />
                                <Line dataKey="incoming" name="Incoming" stroke="#3B82F6" strokeWidth={2} dot={false} />
                                <Line dataKey="missed"   name="Missed"   stroke="#EF4444" strokeWidth={2} dot={false} />
                                <Line dataKey="outgoing" name="Outgoing" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Distribution donut */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 rounded-full bg-[#F97316]" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Call Distribution</h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        {s.totalCalls ? (
                            <div className="flex items-center gap-4 w-full">
                                <PieChart width={130} height={130}>
                                    <Pie data={donutData} cx={60} cy={60} innerRadius={38} outerRadius={58} dataKey="value" strokeWidth={0}>
                                        {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                                    </Pie>
                                    <DonutCenter cx={60} cy={60} total={s.totalCalls} />
                                </PieChart>
                                <div className="flex-1 space-y-2.5">
                                    {donutData.map((d, i) => (
                                        <div key={d.name} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                                                <span className="text-xs text-[#71717A]">{d.name}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-[#18181B]">
                                                {d.value} <span className="text-[#71717A] font-normal">({s.totalCalls ? Math.round((d.value / s.totalCalls) * 100) : 0}%)</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <Phone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-xs text-[#71717A]">No data yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Insights + Top Agents */}
            <div className={`grid grid-cols-1 gap-4 ${!hideTopAgents ? "lg:grid-cols-2" : ""}`}>
                {/* Insights */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="h-4 w-4 text-[#F97316]" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Insights</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Answer Rate",   value: `${answerRate}%`,         icon: ArrowUpRight,   iconBg: "bg-green-50",  iconColor: "text-green-600" },
                            { label: "Avg. Duration", value: fmtSecs(s.avgDuration),   icon: Clock,          iconBg: "bg-amber-50",  iconColor: "text-amber-600" },
                            { label: "Missed Rate",   value: `${missedRate}%`,          icon: ArrowDownRight, iconBg: "bg-red-50",    iconColor: "text-red-500"   },
                        ].map(m => (
                            <div key={m.label} className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7] flex flex-col gap-2">
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${m.iconBg}`}>
                                    <m.icon className={`h-3.5 w-3.5 ${m.iconColor}`} />
                                </div>
                                <p className="text-lg font-bold text-[#18181B]">{m.value}</p>
                                <p className="text-[11px] font-medium text-[#18181B]">{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Agents — hidden in employee view */}
                {!hideTopAgents && (
                    <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="h-4 w-4 text-[#F97316]" />
                            <h3 className="font-semibold text-[#18181B] text-sm">Top Agents</h3>
                        </div>
                        {topAgents.length === 0 ? (
                            <div className="py-8 text-center text-[#71717A] text-sm">No agent data available</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-[#E4E4E7]">
                                            {["Agent", "Total", "Answered", "Missed", "Avg Dur."].map(h => (
                                                <th key={h} className="text-left px-2 py-2 text-[#71717A] font-semibold">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F4F4F5]">
                                        {topAgents.map(a => (
                                            <tr key={a.agent} className="hover:bg-[#FFF7ED]/50 transition-colors">
                                                <td className="px-2 py-2 font-medium text-[#18181B] truncate max-w-[100px]">{a.agent}</td>
                                                <td className="px-2 py-2 font-semibold text-[#18181B]">{a.total}</td>
                                                <td className="px-2 py-2 text-green-600 font-medium">{a.answered}</td>
                                                <td className="px-2 py-2 text-red-500 font-medium">{a.missed}</td>
                                                <td className="px-2 py-2 text-[#71717A]">{fmtSecs(a.total ? Math.round(a.duration / a.total) : 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Filter toolbar */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
                            <input type="text" placeholder="Search name, phone…" value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316]" />
                        </div>
                        <button type="submit"
                            className="px-4 py-2 bg-[#F97316] text-white text-sm rounded-xl hover:bg-[#FB923C] transition-colors font-medium">
                            Search
                        </button>
                    </form>
                    <select value={direction} onChange={handleFilter(setDirection)}
                        className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]">
                        <option value="">All Directions</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="incoming">Incoming</option>
                        <option value="missed">Missed</option>
                    </select>
                    <select value={status} onChange={handleFilter(setStatus)}
                        className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]">
                        <option value="">All Statuses</option>
                        <option value="answered">Answered</option>
                        <option value="missed">Missed</option>
                        <option value="no_answer">No Answer</option>
                        <option value="busy">Busy</option>
                        <option value="voicemail">Voicemail</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={dateFrom} onChange={handleFilter(setDateFrom)}
                            className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]" />
                        <span className="text-[#71717A] text-xs">to</span>
                        <input type="date" value={dateTo} onChange={handleFilter(setDateTo)}
                            className="text-sm border border-[#E4E4E7] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]" />
                    </div>
                    {hasFilter && (
                        <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 px-2 py-2 rounded-xl hover:bg-red-50 transition-colors">
                            Clear
                        </button>
                    )}
                    <button onClick={exportCsv}
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-[#E4E4E7] rounded-xl text-sm hover:bg-[#FFF7ED] hover:border-[#F97316] hover:text-[#F97316] transition-colors">
                        <Download className="h-3.5 w-3.5" /> Export
                    </button>
                </div>
            </div>

            {/* Call logs table */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-[#E4E4E7] flex items-center justify-between">
                    <h3 className="font-semibold text-[#18181B] text-sm">
                        Call Logs <span className="text-[#71717A] font-normal ml-1">({total} total)</span>
                    </h3>
                </div>
                {callsLoading ? (
                    <div className="p-10 text-center flex flex-col items-center gap-2 text-[#71717A] text-sm">
                        <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /> Loading calls…
                    </div>
                ) : calls.length === 0 ? (
                    <div className="py-16 text-center">
                        <Phone className="h-7 w-7 text-[#F97316] mx-auto mb-3" />
                        <p className="font-semibold text-[#18181B] text-sm">No call records found</p>
                        <p className="text-[#71717A] text-xs mt-1">Calls will appear here once Salestrail pushes data</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#FFF7ED] border-b border-[#E4E4E7]">
                                <tr>
                                    {["Date & Time", "Direction", "Contact", "Phone Number", "Agent", "Duration", "Status", "Recording"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F4F4F5]">
                                {calls.map(call => (
                                    <tr key={call.id} className="hover:bg-[#FFF7ED]/50 transition-colors">
                                        <td className="px-4 py-3 text-xs text-[#71717A] whitespace-nowrap">{fmtDate(call.startedAt)}</td>
                                        <td className="px-4 py-3"><DirectionChip d={call.direction} /></td>
                                        <td className="px-4 py-3 font-medium text-[#18181B]">
                                            {call.contactName || <span className="text-[#71717A]">Unknown</span>}
                                            {call.lead && <div className="text-[10px] text-[#F97316] font-medium mt-0.5">{call.lead.name}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-[#71717A] font-mono">{call.contactPhone || call.fromNumber || call.toNumber || "—"}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-[#18181B]">{call.agentName || "—"}</p>
                                            {call.agentEmail && <p className="text-[10px] text-[#71717A]">{call.agentEmail}</p>}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-[#18181B]">{fmtSecs(call.duration)}</td>
                                        <td className="px-4 py-3"><StatusBadge s={call.status} /></td>
                                        <td className="px-4 py-3"><AudioPlayer url={call.recordingUrl} /></td>
                                    </tr>
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
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                                className="p-1.5 rounded-lg border border-[#E4E4E7] disabled:opacity-40 hover:bg-[#FFF7ED] hover:border-[#F97316] transition-colors">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalestrailSection;
