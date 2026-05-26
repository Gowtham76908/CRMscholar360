/**
 * WorkloadChart — Horizontal bar chart showing per-employee lead load.
 * Green = normal (<75%), Orange = high (75–89%), Red = near capacity (≥90%).
 */
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Loader2 } from "lucide-react";
import api from "../../api/axios";

const tierColor = {
    normal:  { bar: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-100" },
    warning: { bar: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-100" },
    danger:  { bar: "bg-red-500",    badge: "bg-red-50 text-red-600 border-red-100" },
};

const WorkloadChart = () => {
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["tp-workload"],
        queryFn:  () => api.get("/team-performance/workload").then(r => r.data),
        staleTime: 30_000,
        refetchInterval: 60_000,
    });

    return (
        <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#F4F4F5]">
                <div className="h-7 w-7 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                    <BarChart2 className="h-3.5 w-3.5 text-[#F97316]" />
                </div>
                <h2 className="font-semibold text-[#18181B]">Team Workload Distribution</h2>
                <div className="ml-auto flex items-center gap-3 text-[11px] text-[#71717A]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Normal</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> High</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Near Capacity</span>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /></div>
            ) : employees.length === 0 ? (
                <div className="py-10 text-center text-[#71717A] text-sm">No team members found</div>
            ) : (
                <div className="space-y-3">
                    {employees.map((emp, i) => {
                        const cfg = tierColor[emp.tier] || tierColor.normal;
                        return (
                            <motion.div key={emp.id}
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-32 shrink-0 flex items-center gap-2">
                                        {emp.profilePhoto ? (
                                            <img src={emp.profilePhoto} className="h-6 w-6 rounded-full object-cover shrink-0" alt="" />
                                        ) : (
                                            <div className="h-6 w-6 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#F97316] text-xs font-bold shrink-0">
                                                {emp.name?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-xs font-medium text-[#18181B] truncate">{emp.name}</span>
                                    </div>
                                    <div className="flex-1 h-5 bg-[#F4F4F5] rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full ${cfg.bar}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${emp.pct}%` }}
                                            transition={{ delay: i * 0.04 + 0.15, duration: 0.5, ease: "easeOut" }}
                                        />
                                    </div>
                                    <div className="w-20 shrink-0 flex items-center justify-end gap-1.5">
                                        <span className="text-xs text-[#71717A]">{emp.currentLeadLoad}/{emp.maxDailyLeads}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cfg.badge}`}>{emp.pct}%</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WorkloadChart;
