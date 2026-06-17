import { useMemo, useState } from "react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { History, TrendingUp, Loader2 } from "lucide-react";
import { useStageTimeSeries, useDepartmentThroughput, useWorkflows } from "../../hooks/useDepartments";

/**
 * Historical activity for one department — "what happened over time", derived from
 * the LeadDepartmentStageEvent ledger. Deliberately separate from the current-state
 * snapshot funnel above it: the snapshot answers "what exists now", this answers
 * "what moved during the period". Both are useful and shown together.
 */

const RANGES = [
    { id: 7,   label: "7 days",  granularity: "day" },
    { id: 30,  label: "30 days", granularity: "day" },
    { id: 90,  label: "90 days", granularity: "week" },
    { id: 365, label: "1 year",  granularity: "month" },
];

const ymd = (d) => d.toISOString().slice(0, 10);

function bucketLabel(bucket, granularity) {
    const d = new Date(bucket + "T00:00:00Z");
    if (granularity === "month") return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
    if (granularity === "year")  return d.toLocaleDateString("en-IN", { year: "numeric", timeZone: "UTC" });
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#3b82f6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#a855f7", "#64748b", "#22c55e"];

export default function HistoricalActivity({ department }) {
    const [rangeId, setRangeId] = useState(30);
    const range = RANGES.find((r) => r.id === rangeId) || RANGES[1];
    const { getStages, stageLabel } = useWorkflows();
    const stages = getStages(department);
    const [metric, setMetric] = useState("ENQUIRY");

    const { from, to } = useMemo(() => {
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - range.id * 86400000);
        return { from: ymd(fromDate), to: ymd(toDate) };
    }, [range.id]);

    const ts = useStageTimeSeries({ department, toStage: metric, granularity: range.granularity, from, to });
    const tp = useDepartmentThroughput(department, { from, to });

    const series = (ts.data?.series || []).map((p) => ({ ...p, label: bucketLabel(p.bucket, range.granularity) }));
    const throughput = (tp.data?.byStage || []).map((s) => ({ ...s, name: s.label }));
    const metricLabel = metric === "ENQUIRY" ? "Enquiries received" : `Moved into ${stageLabel(department, metric)}`;

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-indigo-950">Activity Over Time</h3>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 uppercase tracking-wider">Historical</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {RANGES.map((r) => (
                        <button
                            key={r.id}
                            onClick={() => setRangeId(r.id)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                                rangeId === r.id ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
            <p className="text-xs text-gray-400 mb-5">Stage events recorded over the selected period — distinct from the current pipeline snapshot above.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Time series for one metric */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                            <h4 className="text-sm font-bold text-gray-700">{metricLabel}</h4>
                        </div>
                        <select
                            value={metric}
                            onChange={(e) => setMetric(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            {stages.map((s) => (
                                <option key={s.code} value={s.code}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    {ts.isLoading ? (
                        <ChartLoader />
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                <defs>
                                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#histGrad)" name={metricLabel} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                    <p className="text-[11px] text-gray-400 text-center mt-1">
                        {ts.data?.total ?? 0} total in range
                    </p>
                </div>

                {/* Throughput — moves into each stage */}
                <div>
                    <div className="flex items-center gap-1.5 mb-3">
                        <History className="h-4 w-4 text-violet-500" />
                        <h4 className="text-sm font-bold text-gray-700">Stage Throughput</h4>
                    </div>
                    {tp.isLoading ? (
                        <ChartLoader />
                    ) : throughput.length === 0 ? (
                        <EmptyChart />
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={throughput} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-25} textAnchor="end" height={50} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Bar dataKey="count" name="Moves into stage" radius={[4, 4, 0, 0]}>
                                    {throughput.map((entry, i) => (
                                        <Cell key={entry.stage} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                    <p className="text-[11px] text-gray-400 text-center mt-1">
                        {tp.data?.total ?? 0} transitions in range
                    </p>
                </div>
            </div>
        </div>
    );
}

function ChartLoader() {
    return (
        <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
    );
}

function EmptyChart() {
    return (
        <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">
            No activity in this period
        </div>
    );
}
