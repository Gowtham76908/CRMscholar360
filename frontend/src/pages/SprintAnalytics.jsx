import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Loader2, ArrowLeft, Target, Calendar, TrendingUp,
    CheckCircle, AlertCircle, Clock, Users
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from "recharts";
import api from "../api/axios";

// ── Color palettes ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
    BACKLOG:     "#94a3b8",
    TODO:        "#6366f1",
    IN_PROGRESS: "#3b82f6",
    IN_REVIEW:   "#a855f7",
    DONE:        "#22c55e",
    BLOCKED:     "#ef4444",
};

const PRIORITY_COLORS = {
    CRITICAL: "#ef4444",
    HIGH:     "#f97316",
    MEDIUM:   "#eab308",
    LOW:      "#22c55e",
};

const PIE_COLORS = Object.values(STATUS_COLORS);

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// ── Stat card ─────────────────────────────────────────────────────────────────

const Stat = ({ icon, label, value, sub, color = "text-gray-900" }) => (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 text-gray-400 mb-2">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
        <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const SprintAnalytics = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data, isLoading, isError } = useQuery({
        queryKey: ["sprintAnalytics", id],
        queryFn: () => api.get(`/sprints/${id}/analytics`).then(r => r.data),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="text-center py-16">
                <p className="text-red-500 font-semibold">Failed to load sprint analytics.</p>
            </div>
        );
    }

    const { sprint, summary, byStatus, byPriority, members, burndown } = data;

    const statusPieData = Object.entries(byStatus)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name: name.replace("_", " "), value }));

    const priorityData = Object.entries(byPriority).map(([name, value]) => ({ name, value }));

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/sprints")}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">{sprint.name}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            sprint.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                            sprint.status === "COMPLETED" ? "bg-blue-100 text-blue-600" :
                            "bg-gray-100 text-gray-600"
                        }`}>{sprint.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {sprint.goal && <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />{sprint.goal}</span>}
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}</span>
                    </div>
                </div>
            </div>

            {/* ── Summary stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat icon={<CheckCircle className="h-4 w-4" />} label="Completion"
                    value={`${summary.completion}%`} sub={`${summary.doneTasks} of ${summary.totalTasks} tasks`}
                    color={summary.completion === 100 ? "text-green-600" : "text-indigo-600"} />
                <Stat icon={<TrendingUp className="h-4 w-4" />} label="Points Done"
                    value={summary.completedPoints} sub={`of ${summary.totalPoints} total`} color="text-blue-600" />
                <Stat icon={<AlertCircle className="h-4 w-4" />} label="Blocked"
                    value={byStatus.BLOCKED || 0} sub="tasks blocked" color={byStatus.BLOCKED > 0 ? "text-red-600" : "text-gray-400"} />
                <Stat icon={<Clock className="h-4 w-4" />} label="In Progress"
                    value={byStatus.IN_PROGRESS || 0} sub="tasks active" color="text-orange-600" />
            </div>

            {/* ── Progress bar ── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-gray-700">Sprint Progress</p>
                    <span className="text-sm font-bold text-indigo-600">{summary.completion}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
                        style={{ width: `${summary.completion}%` }} />
                </div>
                {/* Column breakdown */}
                <div className="flex flex-wrap gap-3 mt-4">
                    {Object.entries(byStatus).map(([status, count]) => count > 0 && (
                        <div key={status} className="flex items-center gap-1.5 text-xs">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                            <span className="text-gray-600 font-medium">{status.replace("_", " ")}</span>
                            <span className="font-bold text-gray-800">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Burndown chart */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Burndown Chart</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={burndown} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="ideal" stroke="#cbd5e1" strokeWidth={2}
                                strokeDasharray="5 5" dot={false} name="Ideal" />
                            <Line type="monotone" dataKey="remaining" stroke="#6366f1" strokeWidth={2.5}
                                dot={{ r: 3 }} activeDot={{ r: 5 }} name="Actual Remaining" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Task distribution pie */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Tasks by Status</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                                paddingAngle={3} dataKey="value" label={({ name, percent }) =>
                                    percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                                } labelLine={false}>
                                {statusPieData.map((entry, i) => (
                                    <Cell key={i} fill={Object.values(STATUS_COLORS)[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Priority distribution */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Tasks by Priority</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={priorityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Tasks">
                                {priorityData.map((entry, i) => (
                                    <Cell key={i} fill={PRIORITY_COLORS[entry.name] || "#6366f1"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Team performance */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-500" /> Team Performance
                    </h3>
                    {members.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No assignments yet</p>
                    ) : (
                        <div className="space-y-3">
                            {members.sort((a, b) => b.done - a.done).map(m => {
                                const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                                return (
                                    <div key={m.id}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                                                    {m.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                                                </div>
                                                <span className="font-semibold text-gray-700">{m.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="text-green-600 font-bold">{m.done} done</span>
                                                {m.inProgress > 0 && <span className="text-blue-600">{m.inProgress} active</span>}
                                                {m.blocked > 0 && <span className="text-red-500">{m.blocked} blocked</span>}
                                                <span className="text-indigo-600 font-bold">{m.points}sp</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SprintAnalytics;
