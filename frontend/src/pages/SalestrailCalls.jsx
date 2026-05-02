import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Phone,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    Clock,
    Play,
    Pause,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    Calendar,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import api from "../api/axios";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (secs) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
};

const fmtDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const directionIcon = (d) => {
    if (d === "incoming") return <PhoneIncoming className="h-4 w-4 text-blue-500" />;
    if (d === "outgoing") return <PhoneOutgoing className="h-4 w-4 text-green-500" />;
    return <PhoneMissed className="h-4 w-4 text-red-500" />;
};

const statusBadge = (s) => {
    const map = {
        answered:  "bg-green-100 text-green-700",
        missed:    "bg-red-100   text-red-700",
        no_answer: "bg-red-100   text-red-700",
        busy:      "bg-yellow-100 text-yellow-700",
        voicemail: "bg-purple-100 text-purple-700",
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[s] || "bg-gray-100 text-gray-600"}`}>
            {s?.replace("_", " ") || "unknown"}
        </span>
    );
};

// ── AudioPlayer component ─────────────────────────────────────────────────────
const AudioPlayer = ({ url }) => {
    const [playing, setPlaying] = useState(false);
    const ref = useRef(null);

    const toggle = () => {
        if (!ref.current) return;
        if (playing) {
            ref.current.pause();
        } else {
            ref.current.play();
        }
        setPlaying(!playing);
    };

    if (!url) return <span className="text-gray-400 text-xs">No recording</span>;

    return (
        <div className="flex items-center gap-2">
            <audio ref={ref} src={url} onEnded={() => setPlaying(false)} className="hidden" />
            <button
                onClick={toggle}
                className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition-colors"
            >
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {playing ? "Pause" : "Play"}
            </button>
        </div>
    );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const SalestrailCalls = () => {
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [direction, setDirection] = useState("");
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [chartDays, setChartDays] = useState(30);

    // Fetch stats
    const { data: statsData } = useQuery({
        queryKey: ["salestrail-stats", chartDays],
        queryFn: () => api.get(`/salestrail/stats?days=${chartDays}`).then((r) => r.data),
        staleTime: 60_000,
    });

    // Fetch call logs
    const { data: callsData, isLoading } = useQuery({
        queryKey: ["salestrail-calls", page, direction, status, search, dateFrom, dateTo],
        queryFn: () => {
            const params = new URLSearchParams({ page, limit });
            if (direction) params.set("direction", direction);
            if (status)    params.set("status",    status);
            if (search)    params.set("search",    search);
            if (dateFrom)  params.set("from",      dateFrom);
            if (dateTo)    params.set("to",        dateTo);
            return api.get(`/salestrail/calls?${params}`).then((r) => r.data);
        },
        staleTime: 30_000,
    });

    const s = statsData?.summary || {};
    const perDay = statsData?.perDay || [];
    const calls  = callsData?.calls  || [];
    const total  = callsData?.total  || 0;
    const pages  = callsData?.pages  || 1;

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    const handleFilterChange = (setter) => (e) => {
        setter(e.target.value);
        setPage(1);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Salestrail Call Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">All incoming, outgoing and missed calls from Salestrail</p>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <select
                        value={chartDays}
                        onChange={(e) => setChartDays(Number(e.target.value))}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={Phone}
                    label="Total Calls"
                    value={s.totalCalls ?? "—"}
                    sub={`Today: ${s.today ?? 0}`}
                    color="bg-indigo-500"
                />
                <StatCard
                    icon={PhoneIncoming}
                    label="Answered"
                    value={s.answered ?? "—"}
                    sub={s.totalCalls ? `${Math.round((s.answered / s.totalCalls) * 100)}% answer rate` : ""}
                    color="bg-green-500"
                />
                <StatCard
                    icon={PhoneMissed}
                    label="Missed"
                    value={s.missed ?? "—"}
                    sub=""
                    color="bg-red-500"
                />
                <StatCard
                    icon={Clock}
                    label="Avg Duration"
                    value={fmt(s.avgDuration)}
                    sub={`Total: ${fmt(s.totalDuration)}`}
                    color="bg-amber-500"
                />
            </div>

            {/* Outgoing / Incoming quick split */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <PhoneOutgoing className="h-8 w-8 text-green-500" />
                    <div>
                        <p className="text-xl font-bold text-gray-900">{s.outgoing ?? "—"}</p>
                        <p className="text-sm text-gray-500">Outgoing calls</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <PhoneIncoming className="h-8 w-8 text-blue-500" />
                    <div>
                        <p className="text-xl font-bold text-gray-900">{s.incoming ?? "—"}</p>
                        <p className="text-sm text-gray-500">Incoming calls</p>
                    </div>
                </div>
            </div>

            {/* Calls per day chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    <h2 className="font-semibold text-gray-800">Calls Per Day</h2>
                </div>
                {perDay.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={perDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v) =>
                                    new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                }
                            />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                                labelFormatter={(v) =>
                                    new Date(v).toLocaleDateString("en-IN", {
                                        weekday: "short", day: "2-digit", month: "short",
                                    })
                                }
                            />
                            <Legend />
                            <Bar dataKey="answered"  name="Answered"  fill="#22c55e" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="missed"    name="Missed"    fill="#ef4444" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="outgoing"  name="Outgoing"  fill="#6366f1" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="incoming"  name="Incoming"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search name, phone, agent…"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Search
                        </button>
                    </form>

                    {/* Direction filter */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <select
                            value={direction}
                            onChange={handleFilterChange(setDirection)}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Directions</option>
                            <option value="outgoing">Outgoing</option>
                            <option value="incoming">Incoming</option>
                            <option value="missed">Missed</option>
                        </select>
                    </div>

                    {/* Status filter */}
                    <select
                        value={status}
                        onChange={handleFilterChange(setStatus)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="answered">Answered</option>
                        <option value="missed">Missed</option>
                        <option value="no_answer">No Answer</option>
                        <option value="busy">Busy</option>
                        <option value="voicemail">Voicemail</option>
                    </select>

                    {/* Date range */}
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={handleFilterChange(setDateFrom)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={handleFilterChange(setDateTo)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {(direction || status || search || dateFrom || dateTo) && (
                        <button
                            onClick={() => {
                                setDirection(""); setStatus(""); setSearch(""); setSearchInput("");
                                setDateFrom(""); setDateTo(""); setPage(1);
                            }}
                            className="text-sm text-red-500 hover:text-red-700 px-2 py-2"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            </div>

            {/* Call Logs Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800">
                        Call Logs <span className="text-gray-400 font-normal text-sm ml-1">({total} total)</span>
                    </h2>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-gray-400 text-sm">Loading calls…</div>
                ) : calls.length === 0 ? (
                    <div className="p-8 text-center">
                        <Phone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No call records found</p>
                        <p className="text-gray-300 text-xs mt-1">Calls will appear here once Salestrail starts pushing data</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Direction</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Agent</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Lead</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Recording</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {calls.map((call) => (
                                    <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {directionIcon(call.direction)}
                                                <span className="capitalize text-gray-700">{call.direction}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-800 font-medium">
                                            {call.contactName || <span className="text-gray-400">Unknown</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                                            {call.contactPhone || call.fromNumber || call.toNumber || "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-800">{call.agentName || "—"}</div>
                                            {call.agentEmail && (
                                                <div className="text-xs text-gray-400">{call.agentEmail}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{statusBadge(call.status)}</td>
                                        <td className="px-4 py-3 text-gray-700">{fmt(call.duration)}</td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(call.startedAt)}</td>
                                        <td className="px-4 py-3">
                                            {call.lead ? (
                                                <span className="text-indigo-600 text-xs font-medium">
                                                    {call.lead.name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <AudioPlayer url={call.recordingUrl} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pages > 1 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Page {page} of {pages} · {total} calls
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                disabled={page >= pages}
                                onClick={() => setPage((p) => p + 1)}
                                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalestrailCalls;
