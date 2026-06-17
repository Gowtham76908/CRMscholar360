/**
 * WorkforceSection — Workforce Intelligence cards + Actionable Insights.
 * Rendered inside /team-performance.
 */
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
    Users, Clock, CheckSquare, AlertCircle, TrendingUp,
    Zap, Loader2, TrendingDown, Info,
} from "lucide-react";
import api from "../../api/axios";

const cardVariants = {
    hidden:  { opacity: 0, y: 16 },
    visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35, ease: "easeOut" } }),
};

const insightColor = {
    positive: { bg: "bg-green-50",  border: "border-green-100",  text: "text-green-700",  icon: TrendingUp   },
    warning:  { bg: "bg-yellow-50", border: "border-yellow-100", text: "text-yellow-700", icon: AlertCircle  },
    danger:   { bg: "bg-red-50",    border: "border-red-100",    text: "text-red-600",    icon: TrendingDown },
};

const WorkforceSection = ({ period = "30d", from, to }) => {
    const pq = period === "custom" ? { period, from, to } : { period };

    const { data, isLoading } = useQuery({
        queryKey: ["tp-workforce", period, from, to],
        queryFn:  () => api.get("/team-performance/workforce", { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const statCards = [
        { label: "Active Leads",          value: data?.totalActiveLeads    ?? 0, icon: Users,        iconBg: "bg-indigo-50",  iconColor: "text-indigo-600" },
        { label: "Pending Follow-ups",    value: data?.totalPendingFollowUps ?? 0, icon: AlertCircle, iconBg: "bg-yellow-50",  iconColor: "text-yellow-600" },
        { label: "Tasks Completed",       value: data?.tasksCompleted       ?? 0, icon: CheckSquare,  iconBg: "bg-green-50",   iconColor: "text-green-600" },
        { label: "Tasks Pending",         value: data?.tasksPending         ?? 0, icon: CheckSquare,  iconBg: "bg-red-50",     iconColor: "text-red-500"   },
        { label: "Avg Response Time",     value: data?.avgLeadResponseTimeHours != null ? `${data.avgLeadResponseTimeHours}h` : "—",    icon: Clock,        iconBg: "bg-blue-50",    iconColor: "text-blue-600"  },
        { label: "Avg Conversion Time",   value: data?.avgConversionTimeDays    != null ? `${data.avgConversionTimeDays}d`  : "—",    icon: TrendingUp,   iconBg: "bg-purple-50",  iconColor: "text-purple-600"},
        { label: "Aging Leads (7d+)",     value: data?.leadAgingCount       ?? 0, icon: Clock,        iconBg: "bg-indigo-50",  iconColor: "text-indigo-600"},
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Section heading */}
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <Zap className="h-4 w-4 text-indigo-600" />
                </div>
                <h2 className="font-bold text-[#18181B]">Workforce Intelligence</h2>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {statCards.map((c, i) => (
                    <motion.div key={c.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}
                        className="bg-white rounded-2xl border border-[#E4E4E7] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${c.iconBg}`}>
                            <c.icon className={`h-4 w-4 ${c.iconColor}`} />
                        </div>
                        <p className="text-xl font-bold text-[#18181B] leading-tight">{c.value}</p>
                        <p className="text-[11px] text-[#71717A] font-medium mt-0.5 leading-tight">{c.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Actionable Insights */}
            {data?.insights?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Info className="h-4 w-4 text-indigo-600" />
                        <h3 className="font-semibold text-[#18181B] text-sm">Actionable Insights</h3>
                        <span className="ml-auto text-xs text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">{data.insights.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.insights.map((ins, i) => {
                            const cfg = insightColor[ins.type] || insightColor.warning;
                            const Icon = cfg.icon;
                            return (
                                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.text}`} />
                                    <p className={`text-xs leading-snug ${cfg.text}`}>{ins.text}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkforceSection;
