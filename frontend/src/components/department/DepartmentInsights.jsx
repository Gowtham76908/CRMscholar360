import { Loader2, TrendingUp, Users, Clock, AlertTriangle, Inbox, CheckCircle2 } from "lucide-react";
import { useDepartmentDashboard, useDepartmentWorkload } from "../../hooks/useDepartments";
import { departmentLabel } from "../../lib/departments";

/**
 * Self-contained per-department analytics block (KPIs + stage funnel + aging +
 * workload), all computed from LeadDepartment.stage on the backend. Embedded in
 * both the Dashboard and Reports so the two stay consistent. There is no global
 * funnel — this always reflects the selected department's workflow.
 */
export default function DepartmentInsights({ department }) {
    const { data, isLoading, isError, error } = useDepartmentDashboard(department);
    const { data: workload = [] } = useDepartmentWorkload(department);

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
    }
    if (isError) {
        const msg = error?.response?.data?.error?.message || "Could not load department analytics";
        return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">{msg}</div>;
    }
    if (!data) return null;

    const maxCount = Math.max(...data.funnel.map((s) => s.count), 1);

    return (
        <div className="space-y-5">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi icon={Users}        label="Total"        value={data.total}             color="bg-indigo-500" />
                <Kpi icon={Inbox}        label="New Today"    value={data.newToday}          color="bg-blue-500" />
                <Kpi icon={TrendingUp}   label="Active"       value={data.active}            color="bg-amber-500" />
                <Kpi icon={CheckCircle2} label="Won"          value={data.won}               color="bg-emerald-500" />
                <Kpi icon={TrendingUp}   label="Conversion"   value={`${data.conversionRate}%`} color="bg-violet-500" />
                <Kpi icon={AlertTriangle} label="Unassigned"  value={data.unassigned}        color="bg-rose-500" />
            </div>

            {/* Stage funnel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">{departmentLabel(department)} Funnel</h3>
                {data.funnel.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No workflow configured for this department yet.</p>
                ) : (
                    <div className="space-y-2.5">
                        {data.funnel.map((s) => (
                            <div key={s.code} className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-600 w-44 shrink-0 truncate">{s.label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${s.won ? "bg-emerald-500" : s.lost ? "bg-rose-400" : "bg-indigo-400"}`}
                                        style={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 6 : 0)}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-10 text-right">{s.count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Aging */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-bold text-gray-900">Aging (idle active services)</h3>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 rounded-lg bg-amber-50 border border-amber-100 p-3">
                            <p className="text-2xl font-bold text-amber-700">{data.aging.warning}</p>
                            <p className="text-xs text-amber-600 mt-0.5">3–7 days idle</p>
                        </div>
                        <div className="flex-1 rounded-lg bg-rose-50 border border-rose-100 p-3">
                            <p className="text-2xl font-bold text-rose-700">{data.aging.stale}</p>
                            <p className="text-xs text-rose-600 mt-0.5">7+ days idle</p>
                        </div>
                    </div>
                </div>

                {/* Workload */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Users className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-bold text-gray-900">Consultant Workload (active)</h3>
                    </div>
                    {workload.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">No assigned active services.</p>
                    ) : (
                        <div className="space-y-2">
                            {workload.map((w) => (
                                <div key={w.userId} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 truncate">{w.name}</span>
                                    <span className="font-bold text-gray-900">{w.active}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Kpi({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color} mb-2`}>
                <Icon className="h-4 w-4 text-white" />
            </div>
            <p className="text-xl font-bold text-gray-900 leading-none">{value ?? "—"}</p>
            <p className="text-[11px] text-gray-500 mt-1">{label}</p>
        </div>
    );
}
