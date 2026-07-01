import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useDepartmentSelection, useDepartmentDashboard, useDepartmentMembers, useWorkflows } from "../hooks/useDepartments";
import api from "../api/axios";
import Badge from "../components/ui/Badge";
import Avatar from "../components/Avatar";
import CountUp from "../components/ui/CountUp";
import * as XLSX from "xlsx";
import {
    CheckCircle, Clock, Sparkles, X, ArrowRight,
    Users, AlertCircle, Bell,
    TrendingUp, Target, UserCheck, IndianRupee, Receipt,
    Wallet, BarChart2, Trophy, Banknote, TrendingDown, KanbanSquare,
    CalendarClock, HelpCircle, GraduationCap, Hourglass, FolderOpen,
    ShieldAlert, BadgeCheck, Landmark, CheckCircle2, XCircle, ShieldCheck,
    Settings, Search, CalendarDays, FileText, Inbox, CheckSquare, SlidersHorizontal,
    Download, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { roleLabel } from "../lib/roles";
import DepartmentSection from "../components/department/DepartmentSection";
import HistoricalActivity from "../components/department/HistoricalActivity";
import Dialog from "../components/ui/Dialog";

const isSuperAdmin = (role) => role === "SUPER_ADMIN";
const isManager    = (role) => role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEAM_LEADER";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dueSoonLabel = (date) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 0) return { label: "Overdue", variant: "error" };
    if (hrs < 24) return { label: "Due today", variant: "warning" };
    if (hrs < 48) return { label: "Due tomorrow", variant: "warning" };
    return null;
};

const fmtINR = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
    return `₹${v.toLocaleString("en-IN")}`;
};

const daysOverdue = (date) => {
    if (!date) return "—";
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
    return d <= 0 ? "Today" : d === 1 ? "1 day overdue" : `${d} days overdue`;
};


// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, accent = "indigo" }) {
    const colors = {
        indigo:  "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        amber:   "bg-amber-50 text-amber-600",
        red:     "bg-red-50 text-red-600",
        violet:  "bg-violet-50 text-violet-600",
        sky:     "bg-sky-50 text-sky-600",
        rose:    "bg-rose-50 text-rose-600",
    };
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colors[accent]}`}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-black text-gray-900 leading-tight">{value ?? "—"}</p>
                {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── AI Digest ────────────────────────────────────────────────────────────────

function AIDigestCard({ followUp, overdueTasks, pendingTasks, upcomingReminders, userName }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["ai-digest", followUp, overdueTasks, pendingTasks, upcomingReminders],
        queryFn: () =>
            api.post("/ai/digest", { followUp, overdueTasks, pendingTasks, upcomingReminders, userName })
               .then(r => r.data.digest),
        staleTime: 30 * 60 * 1000,
        gcTime:    60 * 60 * 1000,
        retry: false,
    });

    return (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-widest">AI Digest</span>
                {data && <span className="ml-auto text-[10px] text-violet-400">AI</span>}
            </div>
            {isLoading ? (
                <div className="flex items-center gap-2">
                    {[0, 150, 300].map(d => (
                        <div key={d} className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                </div>
            ) : isError ? (
                <p className="text-xs text-violet-700">
                    {followUp > 0 && <><span className="font-semibold">{followUp} leads</span> need follow-up. </>}
                    {overdueTasks > 0 && <><span className="font-semibold">{overdueTasks} tasks</span> are overdue. </>}
                    {followUp === 0 && overdueTasks === 0 && "Your workload looks clear. Great job!"}
                </p>
            ) : (
                <p className="text-xs text-violet-800 leading-relaxed">{data}</p>
            )}
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, to, linkLabel = "View all →", accent = "indigo" }) {
    const colors = { indigo: "text-indigo-500", emerald: "text-emerald-500", amber: "text-amber-500" };
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${colors[accent]}`} />
                <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            </div>
            {to && (
                <Link to={to} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    {linkLabel}
                </Link>
            )}
        </div>
    );
}

// ─── Team Table (Manager/Admin) ───────────────────────────────────────────────

function TeamTable({ data, navigate }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-900">My Team — Lead Performance</h2>
                </div>
                <Link to="/team-performance" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    Full report →
                </Link>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Converted</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Win Rate</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.map((m) => (
                            <tr key={m.userId} className="hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => navigate(`/employee-report/${m.userId}`)}>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 leading-tight">{m.name}</p>
                                            <p className="text-[10px] text-gray-400">{roleLabel(m.role)}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-center px-3 py-2.5 text-sm font-semibold text-gray-700">{m.total}</td>
                                <td className="text-center px-3 py-2.5 text-sm font-semibold text-emerald-600">{m.converted}</td>
                                <td className="text-center px-3 py-2.5 text-sm font-semibold text-amber-600">{m.followUp}</td>
                                <td className="text-center px-3 py-2.5">
                                    <span className={cn(
                                        "text-xs font-bold px-2 py-0.5 rounded-full",
                                        m.conversionRate >= 30 ? "bg-emerald-100 text-emerald-700" :
                                        m.conversionRate >= 15 ? "bg-amber-100 text-amber-700" :
                                        "bg-red-100 text-red-700"
                                    )}>
                                        {m.conversionRate}%
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 w-32">
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${Math.min(m.conversionRate, 100)}%` }} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Deal Pipeline Section ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
    { id: "NEW",         label: "New",         bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   amt: "text-blue-600"   },
    { id: "NEGOTIATION", label: "Negotiation", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", amt: "text-orange-600" },
    { id: "WON",         label: "Won",         bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  amt: "text-green-600"  },
    { id: "LOST",        label: "Lost",        bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    amt: "text-red-500"    },
];

function DealPipelineSection({ pipeline }) {
    const navigate = useNavigate();
    const cols = pipeline.columns ?? {};
    const kpi  = pipeline.kpi ?? {};

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <KanbanSquare className="h-4 w-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-900">Deal Pipeline</h2>
                    <span className="text-[11px] font-medium text-gray-400">All-time</span>
                    {kpi.totalDeals > 0 && (
                        <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {kpi.totalDeals} deals
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {kpi.winRate != null && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {kpi.winRate}% win rate
                        </span>
                    )}
                    <Link to="/deals" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                        All deals →
                    </Link>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
                {PIPELINE_STAGES.map(s => {
                    const deals = cols[s.id] ?? [];
                    const total = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
                    return (
                        <button key={s.id}
                            onClick={() => navigate(`/deals?stage=${s.id}`)}
                            className={`flex flex-col items-center justify-center py-5 gap-1 transition-colors hover:${s.bg} group`}
                        >
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${s.text}`}>{s.label}</span>
                            <span className="text-2xl font-black text-gray-900 group-hover:scale-105 transition-transform">{deals.length}</span>
                            <span className={`text-xs font-semibold ${s.amt}`}>{fmtINR(total)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Overdue Follow-ups Widget ────────────────────────────────────────────────

function OverdueFollowUpsWidget({ leads }) {
    if (!leads?.length) return null;

    const daysOverdue = (date) => {
        const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
        return d <= 0 ? "Today" : d === 1 ? "1 day overdue" : `${d} days overdue`;
    };

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-red-500" />
                    <h2 className="text-sm font-semibold text-gray-900">Overdue Follow-ups</h2>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                        {leads.length}
                    </span>
                </div>
                <Link to="/leads?status=FOLLOW_UP" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    View all →
                </Link>
            </div>
            <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-50">
                {leads.map(lead => (
                    <Link
                        key={lead.id}
                        to={`/leads/${lead.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-red-50/40 transition-colors"
                    >
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xs font-bold text-red-700">
                            {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                            <p className="text-xs text-gray-400 truncate">{lead.phone || lead.email || "No contact"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                {daysOverdue(lead.nextFollowUpAt)}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

// ─── Finance Dashboard Panel ──────────────────────────────────────────────────

const FINANCE_CAT_COLORS = [
    "#6366F1","#F59E0B","#10B981","#EF4444",
    "#8B5CF6","#06B6D4","#F97316","#64748B",
];

function FinanceDashboardPanel() {
    const { data: summary, isLoading } = useQuery({
        queryKey: ["finance-summary", { period: "30d" }],
        queryFn: () => api.get("/expenses/tracker", { params: { period: "30d" } }).then(r => r.data),
        staleTime: 60_000,
    });

    const fmtINR = (val) => new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(val || 0);

    const categoryBreakdown = useMemo(() => {
        const expenses = (summary?.transactions || []).filter(t => t.type === "EXPENSE");
        const map = {};
        expenses.forEach(t => {
            const cat = t.category || "Miscellaneous";
            map[cat] = (map[cat] || 0) + (t.amount || 0);
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [summary?.transactions]);

    if (isLoading) return (
        <div className="flex justify-center py-16">
            <IndianRupee className="h-6 w-6 animate-pulse text-indigo-400" />
        </div>
    );

    const netPositive = (summary?.netProfit ?? 0) >= 0;
    const margin = summary?.totalIncome > 0
        ? Math.round((summary.netProfit / summary.totalIncome) * 100) : 0;
    const catTotal = categoryBreakdown.reduce((s, c) => s + c.value, 0);

    return (
        <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Income</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(summary?.totalIncome)}</p>
                        <p className="text-[10px] text-emerald-600 font-medium mt-1.5">Last 30 days · paid invoices</p>
                    </div>
                    <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(summary?.totalExpense)}</p>
                        <p className="text-[10px] text-red-500 font-medium mt-1.5">Last 30 days · operating costs</p>
                    </div>
                    <div className="h-11 w-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                        <TrendingDown className="h-5 w-5" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</p>
                        <p className={`text-2xl font-bold mt-1 ${netPositive ? "text-emerald-700" : "text-red-700"}`}>
                            {fmtINR(summary?.netProfit)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1.5">Operating margin: {margin}%</p>
                    </div>
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${netPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        <IndianRupee className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Expense Category Breakdown */}
            {categoryBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Expense Breakdown by Category · Last 30d</p>
                    <div className="space-y-3">
                        {categoryBreakdown.map((cat, idx) => {
                            const pct = catTotal > 0 ? Math.round((cat.value / catTotal) * 100) : 0;
                            const color = FINANCE_CAT_COLORS[idx % FINANCE_CAT_COLORS.length];
                            return (
                                <div key={cat.name} className="flex items-center gap-3">
                                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-slate-700 truncate">{cat.name}</span>
                                            <span className="text-xs font-bold text-slate-900 ml-2 flex-shrink-0">{fmtINR(cat.value)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 w-8 text-right flex-shrink-0">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Link to full tracker */}
            <div className="flex justify-end">
                <Link
                    to="/finance"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                    View Full Finance Tracker <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        </div>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    useEffect(() => {
        localStorage.setItem("last-leads-path", location.pathname + location.search);
    }, [location]);

    // Tab state: overview, finance, performance
    const [activeTab, setActiveTab] = useState("overview");

    // Modal state for viewing leads by stage
    const [selectedStage, setSelectedStage] = useState(null);
    const [showStageModal, setShowStageModal] = useState(false);
    const [stageLeadsPage, setStageLeadsPage] = useState(1);
    const stageLeadsLimit = 50; // Load 50 leads per page
    const [exportingStage, setExportingStage] = useState(false);

    // Today's Attendance modal state
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const [searchParams, setSearchParams] = useSearchParams();

    // ── Generate dynamic intakes for last 5 years ──────────────────────────────
    const availableIntakes = useMemo(() => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        
        const intakes = [];
        
        // Define season configurations
        // Spring: March-May, Summer: June-August, Fall: September-November, Winter: December-February
        const seasons = [
            { name: "Spring", startMonth: 3, endMonth: 5, yearOffset: 0 },
            { name: "Summer", startMonth: 6, endMonth: 8, yearOffset: 0 },
            { name: "Fall", startMonth: 9, endMonth: 11, yearOffset: 0 },
            { name: "Winter", startMonth: 12, endMonth: 2, yearOffset: 1 } // Winter spans two years
        ];
        
        // Generate intakes for the last 5 years
        for (let yearOffset = 0; yearOffset < 5; yearOffset++) {
            const year = currentYear - yearOffset;
            
            for (const season of seasons) {
                const intakeYear = year;
                const endYear = season.yearOffset ? year + 1 : year;
                
                // Format dates properly with leading zeros
                const startMonth = String(season.startMonth).padStart(2, '0');
                const endMonth = String(season.endMonth).padStart(2, '0');
                
                // Calculate last day of end month
                const lastDay = new Date(endYear, season.endMonth, 0).getDate();
                
                const startDate = `${intakeYear}-${startMonth}-01`;
                const endDate = `${endYear}-${endMonth}-${String(lastDay).padStart(2, '0')}`;
                
                // Only include intakes that are in the past or current
                const intakeEndDate = new Date(endDate);
                const shouldInclude = intakeEndDate <= currentDate || 
                    (intakeYear === currentYear && season.startMonth <= currentMonth);
                
                if (shouldInclude) {
                    intakes.push({
                        label: `${season.name} ${intakeYear}`,
                        value: `${season.name} ${intakeYear}`,
                        startDate,
                        endDate
                    });
                }
            }
        }
        
        // Sort in descending order (most recent first)
        intakes.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        
        return intakes;
    }, []);

    // Default to the most recent intake
    const defaultIntake = availableIntakes[0]?.value || "All Intakes";

    // 1. Read values from searchParams, fallback to defaults
    const paramStartDate = searchParams.get("startDate");
    const paramEndDate = searchParams.get("endDate");
    const paramIntake = searchParams.get("intake");
    const paramYearRange = searchParams.get("yearRange");
    const paramDept = searchParams.get("department");
    const paramConsultant = searchParams.get("consultantId");
    const paramSource = searchParams.get("source");

    const defaultStartDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split("T")[0]; // default: 30 days ago
    }, []);

    const defaultEndDate = useMemo(() => {
        return new Date().toISOString().split("T")[0]; // default: today
    }, []);

    // Filter states (applied values that trigger query fetching)
    const startDate = paramStartDate !== null ? paramStartDate : defaultStartDate;
    const endDate = paramEndDate !== null ? paramEndDate : defaultEndDate;
    const intake = paramIntake !== null ? paramIntake : defaultIntake;
    const yearRange = paramYearRange !== null ? paramYearRange : "All Time";
    const selectedConsultantId = paramConsultant !== null ? paramConsultant : "";
    const source = paramSource !== null ? paramSource : "";

    // Department selection hook
    const { department, setDepartment, options } = useDepartmentSelection();

    // Sync department with search param initially (when it loads/resolves)
    useEffect(() => {
        if (paramDept && options.includes(paramDept) && department !== paramDept) {
            setDepartment(paramDept);
        }
    }, [paramDept, options, department, setDepartment]);

    // If paramDept is not in URL, but department hook initializes it, update URL
    useEffect(() => {
        if (!paramDept && department) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set("department", department);
            setSearchParams(nextParams, { replace: true });
        }
    }, [department, paramDept, searchParams, setSearchParams]);

    // Temporary/local filter states (unapplied until clicking Proceed)
    const [tempStartDate, setTempStartDate] = useState(startDate);
    const [tempEndDate, setTempEndDate] = useState(endDate);
    const [tempIntake, setTempIntake] = useState(intake);
    const [tempYearRange, setTempYearRange] = useState(yearRange);
    const [tempDepartment, setTempDepartment] = useState(null);
    const [tempSelectedConsultantId, setTempSelectedConsultantId] = useState(selectedConsultantId);
    const [tempSource, setTempSource] = useState(source);

    // Sync temp states with URL query params when they change
    useEffect(() => {
        setTempStartDate(startDate);
        setTempEndDate(endDate);
        setTempIntake(intake);
        setTempYearRange(yearRange);
        setTempSelectedConsultantId(selectedConsultantId);
        setTempSource(source);
    }, [startDate, endDate, intake, yearRange, selectedConsultantId, source]);

    // Sync tempDepartment with department once it loads/resolves initially
    useEffect(() => {
        if (department && tempDepartment === null) {
            setTempDepartment(department);
        }
    }, [department]);

    // Custom handlers for Intake selection vs Manual Date selection
    const handleIntakeChange = (val) => {
        setTempIntake(val);
        
        if (val === "All Intakes") {
            setTempStartDate("");
            setTempEndDate("");
        } else {
            // Find the selected intake and set its date range
            const selectedIntake = availableIntakes.find(intake => intake.value === val);
            if (selectedIntake) {
                setTempStartDate(selectedIntake.startDate);
                setTempEndDate(selectedIntake.endDate);
            }
        }
        // Reset year range when intake is selected
        setTempYearRange("All Time");
    };

    const handleYearRangeChange = (val) => {
        setTempYearRange(val);
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        
        if (val === "Last 1 Year") {
            const lastYear = new Date();
            lastYear.setFullYear(lastYear.getFullYear() - 1);
            setTempStartDate(lastYear.toISOString().split("T")[0]);
            setTempEndDate(todayStr);
        } else if (val === "Last 5 Years") {
            const last5Years = new Date();
            last5Years.setFullYear(last5Years.getFullYear() - 5);
            setTempStartDate(last5Years.toISOString().split("T")[0]);
            setTempEndDate(todayStr);
        } else if (val === "Last 10 Years") {
            const last10Years = new Date();
            last10Years.setFullYear(last10Years.getFullYear() - 10);
            setTempStartDate(last10Years.toISOString().split("T")[0]);
            setTempEndDate(todayStr);
        } else if (val === "10+ Years") {
            // Set to a very old date (e.g., 20 years ago) to capture everything
            const tenPlusYears = new Date();
            tenPlusYears.setFullYear(tenPlusYears.getFullYear() - 20);
            setTempStartDate(tenPlusYears.toISOString().split("T")[0]);
            setTempEndDate(todayStr);
        } else if (val === "All Time") {
            setTempStartDate("");
            setTempEndDate("");
        }
        // Reset intake when year range is selected
        setTempIntake("All Intakes");
    };

    const handleStartDateChange = (val) => {
        setTempStartDate(val);
        setTempIntake("All Intakes");
        setTempYearRange("All Time");
    };

    const handleEndDateChange = (val) => {
        setTempEndDate(val);
        setTempIntake("All Intakes");
        setTempYearRange("All Time");
    };

    const handleApplyFilters = () => {
        const nextParams = new URLSearchParams(searchParams);

        if (tempStartDate !== null && tempStartDate !== undefined) nextParams.set("startDate", tempStartDate);
        else nextParams.delete("startDate");

        if (tempEndDate !== null && tempEndDate !== undefined) nextParams.set("endDate", tempEndDate);
        else nextParams.delete("endDate");

        if (tempIntake !== null && tempIntake !== undefined) nextParams.set("intake", tempIntake);
        else nextParams.delete("intake");

        if (tempYearRange !== null && tempYearRange !== undefined && tempYearRange !== "All Time") {
            nextParams.set("yearRange", tempYearRange);
        } else {
            nextParams.delete("yearRange");
        }

        if (tempDepartment) {
            nextParams.set("department", tempDepartment);
            setDepartment(tempDepartment);
        }

        if (tempSelectedConsultantId !== null && tempSelectedConsultantId !== undefined) {
            nextParams.set("consultantId", tempSelectedConsultantId);
        } else {
            nextParams.delete("consultantId");
        }

        if (tempSource !== null && tempSource !== undefined) {
            nextParams.set("source", tempSource);
        } else {
            nextParams.delete("source");
        }

        setSearchParams(nextParams);
    };

    const handlePillClick = (deptKey) => {
        setDepartment(deptKey);
        setTempDepartment(deptKey);
        setTempSelectedConsultantId("");
        
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("department", deptKey);
        nextParams.delete("consultantId");
        setSearchParams(nextParams);
    };

    const handleClearFilters = () => {
        const activeDept = department || options[0] || "SALES";
        
        setTempStartDate("");
        setTempEndDate("");
        setTempIntake("All Intakes");
        setTempYearRange("All Time");
        setTempSelectedConsultantId("");
        setTempSource("");
        setTempDepartment(activeDept);
        
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("startDate", "");
        nextParams.set("endDate", "");
        nextParams.set("intake", "All Intakes");
        nextParams.delete("yearRange");
        nextParams.delete("consultantId");
        nextParams.delete("source");
        nextParams.set("department", activeDept);
        
        setSearchParams(nextParams);
        setDepartment(activeDept);
    };

    // ── Shared queries ─────────────────────────────────────────────────────────
    const { data: stats } = useQuery({
        queryKey: ["dashboard-stats"],
        queryFn: () => api.get("/leads/stats").then(r => r.data),
        staleTime: 120_000,
    });

    const { data: tasks } = useQuery({
        queryKey: ["tasks", "my-pending"],
        queryFn: () => api.get("/tasks").then(r => r.data.data ?? r.data),
        staleTime: 120_000,
    });

    const { data: reminders } = useQuery({
        queryKey: ["reminders", "upcoming"],
        queryFn: () => api.get("/reminders").then(r => r.data.data ?? r.data),
        staleTime: 120_000,
    });

    // ── Today's date for attendance queries ────────────────────────────────────
    const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

    // ── Today's attendance status for current user ────────────────────────────
    const { data: myTodayAttendance, refetch: refetchMyAttendance } = useQuery({
        queryKey: ["my-attendance-today", todayDate],
        queryFn: () => api.get(`/attendance/my?date=${todayDate}`).then(r => {
            // API returns array, find today's record
            const records = r.data || [];
            return records.find(att => {
                const attDate = new Date(att.date).toISOString().split('T')[0];
                return attDate === todayDate;
            }) || null;
        }),
        staleTime: 10_000, // Refresh every 10 seconds
        retry: false,
    });

    // Check-in mutation
    const checkInMut = useMutation({
        mutationFn: () => api.post("/attendance/check-in", {}),
        onSuccess: () => {
            toast.success("Checked in successfully!");
            refetchMyAttendance();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Failed to check in");
        },
    });

    // Check-out mutation
    const checkOutMut = useMutation({
        mutationFn: () => api.post("/attendance/check-out", {}),
        onSuccess: () => {
            toast.success("Checked out successfully!");
            refetchMyAttendance();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Failed to check out");
        },
    });

    // ── Query for leads by stage (for modal) ──────────────────────────────────
    const { data: stageLeadsData, isLoading: stageLeadsLoading } = useQuery({
        queryKey: ["stage-leads", selectedStage?.code, department, selectedConsultantId, stageLeadsPage],
        queryFn: () => api.get("/leads", {
            params: {
                department,
                stage: selectedStage?.code,
                assignedTo: selectedConsultantId || undefined,
                // Don't apply date filters - we want all leads in this stage
                // startDate: startDate || undefined,
                // endDate: endDate || undefined,
                page: stageLeadsPage,
                limit: stageLeadsLimit
            }
        }).then(r => r.data),
        enabled: !!selectedStage && !!department,
        staleTime: 30_000,
        keepPreviousData: true, // Keep previous data while loading next page
    });

    const stageLeads = stageLeadsData?.data || [];
    const stageLeadsTotal = stageLeadsData?.total || 0;
    const stageLeadsTotalPages = stageLeadsData?.totalPages || 1;

    // Handler to open stage modal
    const handleStageClick = (stage) => {
        setSelectedStage(stage);
        setStageLeadsPage(1); // Reset to first page
        setShowStageModal(true);
    };

    const closeStageModal = () => {
        setShowStageModal(false);
        setSelectedStage(null);
        setStageLeadsPage(1); // Reset pagination
    };

    // Export every lead in the selected stage (not just the current page) to Excel.
    const handleExportStage = async () => {
        if (!selectedStage || exportingStage) return;
        setExportingStage(true);
        try {
            const res = await api.get("/leads", {
                params: {
                    department,
                    stage: selectedStage.code,
                    assignedTo: selectedConsultantId || undefined,
                    page: 1,
                    limit: Math.max(stageLeadsTotal || 0, 1000),
                },
            });
            const rows = (res.data?.data || []).map((lead, i) => ({
                "#": i + 1,
                Name: lead.name || "",
                Phone: lead.phone || "",
                Email: lead.email || "",
                Consultant: lead.assignedTo?.name || "",
                Score: lead.leadScore ?? "",
                Stage: formatStageLabel(selectedStage.code),
                Department: department || "",
            }));
            if (rows.length === 0) {
                toast.error("No leads to export");
                return;
            }
            const ws = XLSX.utils.json_to_sheet(rows);
            ws["!cols"] = [{ wch: 5 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 8 }, { wch: 20 }, { wch: 18 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, formatStageLabel(selectedStage.code).slice(0, 31));
            const stamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `${(department || "leads")}_${selectedStage.code}_${stamp}.xlsx`);
            toast.success(`Exported ${rows.length} leads`);
        } catch (err) {
            toast.error("Failed to export leads");
        } finally {
            setExportingStage(false);
        }
    };

    const handleNextPage = () => {
        if (stageLeadsPage < stageLeadsTotalPages) {
            setStageLeadsPage(prev => prev + 1);
        }
    };

    const handlePrevPage = () => {
        if (stageLeadsPage > 1) {
            setStageLeadsPage(prev => prev - 1);
        }
    };

    // ── Manager / Admin queries ────────────────────────────────────────────────
    const { data: rawTeamStats = [] } = useQuery({
        queryKey: ["team-performance-employees-dashboard"],
        queryFn: () => api.get("/team-performance/employees", { params: { period: "30d" } }).then(r => r.data),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const teamStats = useMemo(() => {
        return rawTeamStats.map(m => {
            const conversionRate = m.assignedLeads > 0 ? Math.round((m.convertedLeads / m.assignedLeads) * 100) : 0;
            return {
                userId: m.id,
                name: m.name,
                role: "Consultant",
                total: m.assignedLeads,
                converted: m.convertedLeads,
                followUp: m.pendingFollowUps,
                conversionRate,
            };
        });
    }, [rawTeamStats]);

    const { data: revKPIs = {} } = useQuery({
        queryKey: ["dash-rev-kpis"],
        queryFn: () => api.get("/team-performance/revenue-kpis").then(r => r.data ?? {}),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const { data: pipeline = { columns: {}, kpi: {} } } = useQuery({
        queryKey: ["dash-pipeline"],
        queryFn: () => api.get("/deals/pipeline").then(r => r.data),
        enabled: isManager(user?.role),
        staleTime: 60_000,
        retry: false,
    });

    const { data: overdueLeads = [] } = useQuery({
        queryKey: ["overdue-followups"],
        queryFn: () => api.get("/leads/overdue-followups").then(r => r.data),
        staleTime: 60_000,
        retry: false,
    });

    // ── Today's Attendance (Admin/Manager only) ────────────────────────────────
    const { data: todayAttendance = [] } = useQuery({
        queryKey: ["attendance-today", todayDate],
        queryFn: () => api.get(`/attendance/all?date=${todayDate}`).then(r => r.data),
        enabled: isManager(user?.role),
        staleTime: 30_000, // Refresh every 30 seconds
        retry: false,
    });

    const presentCount = todayAttendance.filter(a => a.status === 'PRESENT').length;
    const absentCount = todayAttendance.filter(a => a.status === 'ABSENT').length;
    const wfhCount = todayAttendance.filter(a => a.status === 'WFH').length;

    // ── Department dashboard (counts for each stage of the current workflow) ───
    const { data: dashData, isLoading: dashLoading } = useDepartmentDashboard(department, {
        assignedEmployeeId: selectedConsultantId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        source: source || undefined,
    });

    // Load consultants list for the selected department
    const { data: consultants = [] } = useDepartmentMembers(tempDepartment || department);

    // Static-ish workflow config — lets us render the KPI grid structure (stage
    // labels) instantly while the live counts are still loading.
    const { getStages } = useWorkflows();

    // KPI cards: real funnel once loaded, else the workflow's stages as
    // placeholders (count undefined → show a loader), else generic skeletons.
    const funnelCards = useMemo(() => {
        if (dashData?.funnel) return dashData.funnel;
        const stages = getStages(department);
        if (stages.length) return stages.map(s => ({ code: s.code, count: undefined }));
        return Array.from({ length: 8 }, (_, i) => ({ code: `__skeleton_${i}`, count: undefined, skeleton: true }));
    }, [dashData, department, getStages]);

    // ── Employee own revenue query ─────────────────────────────────────────────
    const { data: myRevKPIs } = useQuery({
        queryKey: ["dash-my-rev-kpis", user?.id],
        queryFn: () => api.get(`/employee-report/${user.id}/revenue-kpis`).then(r => r.data),
        enabled: !isManager(user?.role) && !!user?.id,
        staleTime: 60_000,
        retry: false,
    });

    const hasActiveFilters = useMemo(() => {
        const isTempCleared = 
            (tempStartDate === "" || tempStartDate === null) &&
            (tempEndDate === "" || tempEndDate === null) &&
            (tempIntake === "All Intakes") &&
            (tempYearRange === "All Time") &&
            (tempSelectedConsultantId === "") &&
            (tempSource === "");
            
        const isTempDefault = 
            (tempStartDate === defaultStartDate) &&
            (tempEndDate === defaultEndDate) &&
            (tempIntake === defaultIntake) &&
            (tempYearRange === "All Time") &&
            (tempSelectedConsultantId === "") &&
            (tempSource === "");
            
        if (isTempCleared || isTempDefault) {
            return false;
        }
        return true;
    }, [tempStartDate, tempEndDate, tempIntake, tempYearRange, tempSelectedConsultantId, tempSource, defaultStartDate, defaultEndDate, defaultIntake]);

    // No full-page gate — render chrome (header, filters, pills, KPI grid)
    // immediately and let individual counts show their own loaders.
    const pendingTasks      = (tasks || []).filter(t => t.status === "PENDING");
    const upcomingReminders = (reminders || []).filter(r => !r.isSent).slice(0, 5);

    const PILLS = [
        { key: "SALES", label: "SALES" },
        { key: "LOAN", label: "LOAN" },
        { key: "ACCOMMODATION_TICKETS", label: "ACCOMMODATION" },
        { key: "FOREX", label: "FOREX" },
        { key: "MISCELLANEOUS", label: "MISCELLANEOUS" },
    ];

    // Filter pills by options to ensure role/department visibility permissions
    const visiblePills = PILLS.filter(p => options.includes(p.key));

    const STAGE_ICONS = {
        ENQUIRY: HelpCircle,
        FOLLOW_UP: CalendarDays,
        FOLLOWUP: CalendarDays,
        PROSPECT: UserCheck,
        UNIVERSITY_SHORTLISTING: GraduationCap,
        APPLICATION: FileText,
        AWAITING_STATUS: Hourglass,
        DEPOSIT_STATUS: Landmark,
        VISA_DOCUMENTATION: FolderOpen,
        VISA_STATUS: Target,
        VISA_APPROVAL: BadgeCheck,
        COMMISSION_INVOICING: Receipt,
        ARCHIVE: Inbox,
        FUTURE_PROSPECT: CalendarClock,
        LOAN_DOCUMENTATION: Landmark,
        AWAITING_APPROVAL: Clock,
        APPROVED: CheckCircle2,
        REJECTED: XCircle,
        ON_PROGRESS: TrendingUp,
        BOOKING_CONFIRMED: ShieldCheck,
        PROCESS_COMPLETED: CheckSquare
    };

    const formatStageLabel = (code) => {
        if (code === "FOLLOW_UP") return "FOLLOWUP";
        if (code === "UNIVERSITY_SHORTLISTING") return "UNIVERSITY SORT LISTING";
        return code.replace(/_/g, " ");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-5">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-black text-indigo-950">Dashboard</h1>
                    <nav className="flex items-center gap-6 text-sm font-semibold">
                        {[
                            { id: "overview", label: "Overview" },
                            { id: "finance", label: "Finance", superAdminOnly: true },
                            { id: "performance", label: "Performance", managerOnly: true },
                        ].map(tab => {
                            if (tab.managerOnly && !isManager(user?.role)) return null;
                            if (tab.superAdminOnly && !isSuperAdmin(user?.role)) return null;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "relative py-2 text-gray-500 transition-colors hover:text-indigo-600",
                                        isActive && "text-indigo-600"
                                    )}
                                >
                                    {tab.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex items-center gap-3">
                    {/* Check-in/Check-out Widget */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-slate-200/80 rounded-xl shadow-[0_1px_2px_rgb(0,0,0,0.04)]">
                        {myTodayAttendance ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        myTodayAttendance.checkOut ? "bg-gray-400" : "bg-emerald-500 animate-pulse"
                                    )} />
                                    <div className="text-xs">
                                        <p className="font-bold text-gray-700">
                                            {myTodayAttendance.checkOut ? "Checked Out" : "Checked In"}
                                        </p>
                                        <p className="text-gray-500 text-[10px]">
                                            {new Date(myTodayAttendance.checkIn).toLocaleTimeString('en-US', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}
                                            {myTodayAttendance.checkOut && ` - ${new Date(myTodayAttendance.checkOut).toLocaleTimeString('en-US', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}`}
                                        </p>
                                    </div>
                                </div>
                                {!myTodayAttendance.checkOut && (
                                    <button
                                        onClick={() => setConfirmDialog({
                                            title: "Confirm Check Out",
                                            description: "Are you sure you want to check out for today?",
                                            confirmLabel: "Check Out",
                                            variant: "danger",
                                            onConfirm: () => checkOutMut.mutate()
                                        })}
                                        disabled={checkOutMut.isLoading}
                                        className="ml-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    >
                                        {checkOutMut.isLoading ? (
                                            <>
                                                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>Checking out...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Clock className="h-3 w-3" />
                                                <span>Check Out</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-gray-300" />
                                    <p className="text-xs font-bold text-gray-600">Not Checked In</p>
                                </div>
                                <button
                                    onClick={() => setConfirmDialog({
                                        title: "Confirm Check In",
                                        description: "Are you sure you want to check in for today?",
                                        confirmLabel: "Check In",
                                        variant: "success",
                                        onConfirm: () => checkInMut.mutate()
                                    })}
                                    disabled={checkInMut.isLoading}
                                    className="ml-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    {checkInMut.isLoading ? (
                                        <>
                                            <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Checking in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-3 w-3" />
                                            <span>Check In</span>
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                    
                    <Link 
                        to="/my-day" 
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                    >
                        View My Day →
                    </Link>
                </div>
            </header>

            {/* Overview Tab Content */}
            {activeTab === "overview" && (
                <>
                    {/* Filter Row */}
                    <div className="bg-white ring-1 ring-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgb(0,0,0,0.04)] flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-4 flex-wrap flex-1 min-w-[280px]">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">From</span>
                                <input
                                    type="date"
                                    value={tempStartDate}
                                    onChange={(e) => handleStartDateChange(e.target.value)}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold outline-none bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-700 w-36 cursor-pointer"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">To</span>
                                <input
                                    type="date"
                                    value={tempEndDate}
                                    onChange={(e) => handleEndDateChange(e.target.value)}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold outline-none bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-700 w-36 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Year Range</span>
                                <select
                                    value={tempYearRange}
                                    onChange={(e) => handleYearRangeChange(e.target.value)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold outline-none bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-700 min-w-[140px] cursor-pointer"
                                >
                                    <option value="All Time">All Time</option>
                                    <option value="Last 1 Year">Last 1 Year</option>
                                    <option value="Last 5 Years">Last 5 Years</option>
                                    <option value="Last 10 Years">Last 10 Years</option>
                                    <option value="10+ Years">10+ Years</option>
                                </select>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Intake</span>
                                <select
                                    value={tempIntake}
                                    onChange={(e) => handleIntakeChange(e.target.value)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold outline-none bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-700 min-w-[150px] cursor-pointer"
                                >
                                    <option value="All Intakes">All Intakes</option>
                                    {availableIntakes.map((intake) => (
                                        <option key={intake.value} value={intake.value}>
                                            {intake.label}
                                        </option>
                                    ))}
                                </select>
                            </div>



                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Consultant</span>
                                <select
                                    value={tempSelectedConsultantId}
                                    onChange={(e) => setTempSelectedConsultantId(e.target.value)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold outline-none bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-700 min-w-[165px] cursor-pointer"
                                >
                                    <option value="">All Consultants</option>
                                    {consultants.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Lead Source</span>
                                <select
                                    value={tempSource}
                                    onChange={(e) => setTempSource(e.target.value)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold outline-none bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-700 min-w-[150px] cursor-pointer"
                                >
                                    <option value="">All Sources</option>
                                    <option value="FACEBOOK">Facebook</option>
                                    <option value="INSTAGRAM">Instagram</option>
                                    <option value="GMAIL">Gmail</option>
                                    <option value="WEBSITE">Website</option>
                                    <option value="PHONE_CALL">Phone Call</option>
                                    <option value="LINKEDIN">LinkedIn</option>
                                </select>
                            </div>

                            <div className="flex items-end gap-2 pt-5">
                                <button
                                    onClick={handleApplyFilters}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-md shadow-indigo-100 flex items-center gap-1.5 h-9"
                                >
                                    Proceed
                                </button>
                                {hasActiveFilters && (
                                    <button
                                        onClick={handleClearFilters}
                                        type="button"
                                        className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 text-xs font-bold rounded-xl transition-all duration-200 h-9"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Department Pills */}
                    <div className="flex flex-wrap gap-2 my-6">
                        {visiblePills.map(pill => {
                            const isSelected = department === pill.key;
                            return (
                                <button
                                    key={pill.key}
                                    onClick={() => handlePillClick(pill.key)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-200",
                                        isSelected
                                            ? "bg-indigo-600 text-white ring-1 ring-indigo-600 shadow-[0_2px_8px_-2px_rgb(79,70,229,0.4)]"
                                            : "bg-white text-slate-600 ring-1 ring-slate-200/80 hover:ring-indigo-300 hover:text-indigo-600"
                                    )}
                                >
                                    {pill.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* 12 KPI Grid (dynamic by selected workflow) */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {funnelCards.map(stage => {
                            const loading = stage.count === undefined || stage.count === null;
                            const Icon = stage.skeleton ? FileText : (STAGE_ICONS[stage.code] || FileText);
                            return (
                                <button
                                    key={stage.code}
                                    onClick={() => !loading && handleStageClick(stage)}
                                    disabled={loading}
                                    className={cn(
                                        "group relative flex flex-col p-5 bg-white rounded-2xl ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgb(0,0,0,0.04)] transition-all duration-200 text-left overflow-hidden",
                                        loading
                                            ? "cursor-default"
                                            : "hover:shadow-[0_10px_28px_-12px_rgb(0,0,0,0.2)] hover:ring-indigo-200 cursor-pointer"
                                    )}
                                >
                                    <span className="absolute left-0 inset-y-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="flex items-center justify-between">
                                        <div className={cn(
                                            "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1",
                                            stage.skeleton ? "bg-slate-100 text-slate-300 ring-slate-200" : "bg-indigo-50 text-indigo-600 ring-indigo-100"
                                        )}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        {!loading && (
                                            <ArrowRight className="h-4 w-4 text-indigo-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                        )}
                                    </div>
                                    {loading ? (
                                        <span className="flex items-center h-9 mt-4">
                                            <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
                                        </span>
                                    ) : (
                                        <CountUp value={stage.count} className="text-3xl font-black text-indigo-950 leading-none tabular-nums mt-4" />
                                    )}
                                    {stage.skeleton ? (
                                        <span className="h-3 w-20 rounded bg-slate-100 mt-3" />
                                    ) : (
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide leading-tight mt-2 select-none">
                                            {formatStageLabel(stage.code)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Historical activity (ledger) — "what happened over time", separate
                        from the current-state snapshot funnel above. */}
                    {department && <HistoricalActivity department={department} />}

                    {/* Bottom Widgets Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                        {/* Widget 1: Lead Aging */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-5">
                                    <Clock className="h-5 w-5 text-indigo-600" />
                                    <h3 className="text-base font-bold text-indigo-950">Lead Aging</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-4 flex items-center justify-between">
                                        <div>
                                            {dashLoading
                                                ? <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
                                                : <CountUp value={dashData?.aging?.warning ?? 0} className="text-3xl font-black text-amber-700" />}
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">3–7 Days Idle</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                                            <AlertCircle className="h-5 w-5 text-amber-600" />
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-rose-50/60 border border-rose-100 p-4 flex items-center justify-between">
                                        <div>
                                            {dashLoading
                                                ? <Loader2 className="h-7 w-7 animate-spin text-rose-400" />
                                                : <CountUp value={dashData?.aging?.stale ?? 0} className="text-3xl font-black text-rose-700" />}
                                            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-0.5">7+ Days Idle</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                                            <ShieldAlert className="h-5 w-5 text-rose-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center font-medium">
                                Active leads with no recent activities
                            </div>
                        </div>

                        {/* Widget 2: Overdue Follow-ups */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <CalendarClock className="h-5 w-5 text-red-500" />
                                        <h3 className="text-base font-bold text-indigo-950">Overdue Follow-ups</h3>
                                    </div>
                                    {overdueLeads.length > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                            {overdueLeads.length}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-3 max-h-[175px] overflow-y-auto pr-1">
                                    {overdueLeads.slice(0, 4).map(lead => (
                                        <Link
                                            key={lead.id}
                                            to={`/leads/${lead.id}`}
                                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50/30 transition-colors border border-transparent hover:border-red-100/50"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">
                                                {lead.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-900 truncate">{lead.name}</p>
                                                <p className="text-[10px] text-gray-400 truncate">{lead.phone || lead.email}</p>
                                            </div>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500 shrink-0">
                                                {daysOverdue(lead.nextFollowUpAt)}
                                            </span>
                                        </Link>
                                    ))}
                                    {overdueLeads.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center py-8">No overdue follow-ups!</p>
                                    )}
                                </div>
                            </div>
                            {overdueLeads.length > 0 && (
                                <Link to="/leads?status=FOLLOW_UP" className="text-xs text-indigo-600 hover:underline font-bold text-center block mt-3">
                                    View all follow-ups →
                                </Link>
                            )}
                        </div>

                        {/* Widget 3: Today's Attendance (Admin/Manager only) */}
                        {isManager(user?.role) ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-5">
                                        <Clock className="h-5 w-5 text-emerald-600" />
                                        <h3 className="text-base font-bold text-indigo-950">Today's Attendance</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-3xl font-black text-emerald-700">{presentCount}</p>
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Present</p>
                                            </div>
                                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                                <Users className="h-5 w-5 text-emerald-600" />
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-1 rounded-xl bg-purple-50/60 border border-purple-100 p-3 flex flex-col items-center">
                                                <p className="text-2xl font-black text-purple-700">{wfhCount}</p>
                                                <p className="text-[9px] font-bold text-purple-600 uppercase tracking-wider mt-0.5">WFH</p>
                                            </div>
                                            <div className="flex-1 rounded-xl bg-rose-50/60 border border-rose-100 p-3 flex flex-col items-center">
                                                <p className="text-2xl font-black text-rose-700">{absentCount}</p>
                                                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mt-0.5">Absent</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAttendanceModal(true)}
                                    className="mt-4 pt-3 border-t border-gray-100 text-xs text-indigo-600 hover:text-indigo-700 font-bold text-center transition-colors hover:underline"
                                >
                                    View Full List →
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-5">
                                        <Sparkles className="h-5 w-5 text-indigo-600" />
                                        <h3 className="text-base font-bold text-indigo-950">Workload AI Digest</h3>
                                    </div>
                                    <AIDigestCard
                                        followUp={stats?.followUp ?? 0}
                                        overdueTasks={pendingTasks.filter(t => dueSoonLabel(t.dueDate)?.variant === "error").length}
                                        pendingTasks={pendingTasks.length}
                                        upcomingReminders={upcomingReminders.length}
                                        userName={user?.name?.split(" ")[0] ?? ""}
                                    />
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-semibold">
                                    <span>Tasks: <strong className="text-gray-700">{pendingTasks.length}</strong></span>
                                    <span>Reminders: <strong className="text-gray-700">{upcomingReminders.length}</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                </>
            )}


            {/* Stage Details Modal */}
            {showStageModal && selectedStage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeStageModal}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-indigo-950">
                                    {formatStageLabel(selectedStage.code)}
                                </h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {selectedStage.count} {selectedStage.count === 1 ? 'lead' : 'leads'} in this stage
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportStage}
                                    disabled={exportingStage || stageLeadsTotal === 0}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Download these leads as Excel"
                                >
                                    {exportingStage
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Download className="h-4 w-4" />}
                                    Excel
                                </button>
                                <button
                                    onClick={closeStageModal}
                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {stageLeadsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="flex items-center gap-2">
                                        {[0, 150, 300].map(d => (
                                            <div key={d} className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                        ))}
                                    </div>
                                </div>
                            ) : stageLeads && stageLeads.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {stageLeads.map(lead => (
                                        <Link
                                            key={lead.id}
                                            to={`/leads/${lead.id}`}
                                            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                                            onClick={closeStageModal}
                                        >
                                            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-700 group-hover:bg-indigo-200 transition-colors">
                                                {lead.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                                                    {lead.name}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {lead.phone && (
                                                        <span className="text-xs text-gray-500">📞 {lead.phone}</span>
                                                    )}
                                                    {lead.email && (
                                                        <span className="text-xs text-gray-500">✉️ {lead.email}</span>
                                                    )}
                                                </div>
                                                {lead.assignedTo && (
                                                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                        <UserCheck className="h-3 w-3" />
                                                        {lead.assignedTo.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="shrink-0">
                                                {lead.leadScore && (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Score</span>
                                                        <span className={cn(
                                                            "text-lg font-black",
                                                            lead.leadScore >= 70 ? "text-emerald-600" :
                                                            lead.leadScore >= 40 ? "text-amber-600" :
                                                            "text-gray-400"
                                                        )}>
                                                            {lead.leadScore}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                        <FileText className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">No leads found</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        There are no leads in this stage matching your current filters
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-500">
                                    Showing {((stageLeadsPage - 1) * stageLeadsLimit) + 1} - {Math.min(stageLeadsPage * stageLeadsLimit, stageLeadsTotal)} of {stageLeadsTotal} leads
                                </span>
                                {stageLeadsTotalPages > 1 && (
                                    <span className="text-xs text-gray-400">
                                        Page {stageLeadsPage} of {stageLeadsTotalPages}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {stageLeadsTotalPages > 1 && (
                                    <>
                                        <button
                                            onClick={handlePrevPage}
                                            disabled={stageLeadsPage === 1}
                                            className={cn(
                                                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                                stageLeadsPage === 1
                                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                            )}
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={handleNextPage}
                                            disabled={stageLeadsPage >= stageLeadsTotalPages}
                                            className={cn(
                                                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                                stageLeadsPage >= stageLeadsTotalPages
                                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                            )}
                                        >
                                            Next
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={closeStageModal}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Today's Attendance Modal */}
            {showAttendanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAttendanceModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-emerald-50/50">
                            <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-emerald-600" />
                                <div>
                                    <h2 className="text-lg font-bold text-indigo-950">Today's Attendance</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAttendanceModal(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {todayAttendance.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Users className="h-16 w-16 text-gray-300 mb-4" />
                                    <p className="text-gray-500 font-medium">No attendance records for today</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Present Employees */}
                                    {presentCount > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                                    Present ({presentCount})
                                                </h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {todayAttendance.filter(a => a.status === 'PRESENT').map(att => (
                                                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors">
                                                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                                                            {att.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{att.user?.name || 'Unknown'}</p>
                                                            <p className="text-xs text-gray-500 truncate">{att.user?.department || att.user?.email}</p>
                                                        </div>
                                                        {att.checkIn && (
                                                            <span className="text-xs font-medium text-emerald-600 shrink-0">
                                                                {new Date(att.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* WFH Employees */}
                                    {wfhCount > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                                    Work From Home ({wfhCount})
                                                </h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {todayAttendance.filter(a => a.status === 'WFH').map(att => (
                                                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/50 transition-colors">
                                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 shrink-0">
                                                            {att.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{att.user?.name || 'Unknown'}</p>
                                                            <p className="text-xs text-gray-500 truncate">{att.user?.department || att.user?.email}</p>
                                                        </div>
                                                        <span className="text-xs font-medium text-purple-600 shrink-0">WFH</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Absent Employees */}
                                    {absentCount > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                                    Absent ({absentCount})
                                                </h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {todayAttendance.filter(a => a.status === 'ABSENT').map(att => (
                                                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-rose-100 bg-rose-50/30 hover:bg-rose-50/50 transition-colors">
                                                        <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-sm font-bold text-rose-700 shrink-0">
                                                            {att.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{att.user?.name || 'Unknown'}</p>
                                                            <p className="text-xs text-gray-500 truncate">{att.user?.department || att.user?.email}</p>
                                                        </div>
                                                        <span className="text-xs font-medium text-rose-600 shrink-0">Absent</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <div className="text-xs text-gray-500">
                                Total: <strong className="text-gray-700">{todayAttendance.length}</strong> employees
                            </div>
                            <div className="flex items-center gap-3">
                                <Link
                                    to={isManager(user?.role) ? "/team-attendance" : "/attendance"}
                                    onClick={() => setShowAttendanceModal(false)}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
                                >
                                    View Full Attendance Page →
                                </Link>
                                <button
                                    onClick={() => setShowAttendanceModal(false)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Finance Tab Content */}
            {activeTab === "finance" && isSuperAdmin(user?.role) && (
                <FinanceDashboardPanel />
            )}

            {/* Performance Tab Content */}
            {activeTab === "performance" && isManager(user?.role) && (
                <div className="space-y-6">
                    <TeamTable data={teamStats} navigate={navigate} />
                </div>
            )}

            <Dialog
                open={!!confirmDialog}
                title={confirmDialog?.title}
                description={confirmDialog?.description}
                confirmLabel={confirmDialog?.confirmLabel}
                variant={confirmDialog?.variant}
                onConfirm={() => {
                    confirmDialog?.onConfirm();
                    setConfirmDialog(null);
                }}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
};

export default Dashboard;
