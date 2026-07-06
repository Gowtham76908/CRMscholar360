/**
 * ProductivitySection — Employee Productivity Analytics.
 * Rendered inside /employee-report/:id.
 * Props: employeeId, period, from, to
 */
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
    Clock, Target, Loader2, BarChart2,
} from "lucide-react";
import api from "../../api/axios";

// ── Funnel bar component (custom — no recharts dependency) ───────────────────
const FunnelChart = ({ data = [] }) => {
    if (!data.length) return <div className="py-8 text-center text-[#71717A] text-sm">No data</div>;

    const COLORS = ["#3B82F6", "#F97316", "#8B5CF6", "#22C55E", "#EF4444"];

    return (
        <div className="space-y-2.5">
            {data.map((row, i) => (
                <motion.div key={row.stage}
                    initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
                    style={{ transformOrigin: "left" }}>
                    <div className="flex items-center gap-3 text-sm mb-1">
                        <span className="w-24 text-[#18181B] font-medium text-xs shrink-0">{row.stage}</span>
                        <div className="flex-1 h-6 bg-[#F4F4F5] rounded-lg overflow-hidden">
                            <motion.div
                                className="h-full rounded-lg flex items-center justify-end pr-2"
                                style={{ backgroundColor: COLORS[i] }}
                                initial={{ width: 0 }}
                                animate={{ width: `${row.pct}%` }}
                                transition={{ delay: i * 0.08 + 0.1, duration: 0.5, ease: "easeOut" }}>
                                <span className="text-white text-[10px] font-bold whitespace-nowrap">{row.count}</span>
                            </motion.div>
                        </div>
                        <span className="w-10 text-right text-xs text-[#71717A] font-medium shrink-0">{row.pct}%</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────
const ProductivitySection = ({ employeeId, period = "30d", from, to }) => {
    const pq = period === "custom" ? { period, from, to } : { period };

    const { data: prod, isLoading: prodLoading } = useQuery({
        queryKey: ["er-productivity", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/productivity`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const { data: funnel = [] } = useQuery({
        queryKey: ["er-funnel", employeeId, period, from, to],
        queryFn:  () => api.get(`/employee-report/${employeeId}/funnel`, { params: pq }).then(r => r.data),
        staleTime: 30_000,
    });

    const cardVariants = {
        hidden:  { opacity: 0, y: 12 },
        visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
    };

    const prodCards = [
        { label: "Conversion Rate",       value: `${prod?.leadConversionRate ?? 0}%`, icon: Target,      iconBg: "bg-purple-50", iconColor: "text-purple-600"},
        { label: "Avg Follow-up Time",    value: prod?.avgFollowupTime != null ? `${prod.avgFollowupTime}h` : "—", icon: Clock, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
        { label: "Avg Response Time",     value: prod?.avgResponseTime  != null ? `${prod.avgResponseTime}h`  : "—", icon: Clock, iconBg: "bg-orange-50", iconColor: "text-orange-600"},
        { label: "Avg Lead Aging",        value: prod?.avgLeadAging     != null ? `${prod.avgLeadAging}d`     : "—", icon: Clock, iconBg: "bg-red-50",    iconColor: "text-red-500"   },
    ];

    if (prodLoading) {
        return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /></div>;
    }

    return (
        <div className="space-y-5">
            {/* Section heading */}
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#FFF7ED] flex items-center justify-center border border-[#FED7AA]">
                    <BarChart2 className="h-4 w-4 text-[#F97316]" />
                </div>
                <h2 className="font-bold text-[#18181B]">Productivity Analytics</h2>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {prodCards.map((c, i) => (
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

            {/* Lead Progress Funnel */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Target className="h-4 w-4 text-[#F97316]" />
                    <h3 className="font-semibold text-[#18181B] text-sm">Lead Progress Funnel</h3>
                </div>
                <FunnelChart data={funnel} />
            </div>
        </div>
    );
};

export default ProductivitySection;
