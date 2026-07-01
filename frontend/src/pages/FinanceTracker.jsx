import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    IndianRupee, TrendingUp, TrendingDown, Calendar,
    Plus, Trash2, Loader2, Sparkles, Filter, X, ArrowUpRight, ArrowDownRight, FileText
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useMemo } from "react";
import api from "../api/axios";
import { toast } from "sonner";

const CATEGORIES = [
    "Rent & Office",
    "Salaries & Wages",
    "Marketing & Ads",
    "Software & Tools",
    "Utilities & Bills",
    "Travel & Lodging",
    "Taxes & Legal",
    "Miscellaneous"
];

const CATEGORY_COLORS = [
    "#6366F1", "#F59E0B", "#10B981", "#EF4444",
    "#8B5CF6", "#06B6D4", "#F97316", "#64748B"
];

export default function FinanceTracker() {
    const queryClient = useQueryClient();
    const [period, setPeriod] = useState("30d");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [filterType, setFilterType] = useState("all"); // 'all', 'INCOME', 'EXPENSE'
    const [showAddModal, setShowAddModal] = useState(false);

    // Form states
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const pq = { period };
    if (period === "custom" && from && to) {
        pq.from = from;
        pq.to = to;
    }

    const { data: summary, isLoading } = useQuery({
        queryKey: ["finance-summary", pq],
        queryFn: () => api.get("/expenses/tracker", { params: pq }).then(r => r.data),
    });

    const addExpenseMut = useMutation({
        mutationFn: (data) => api.post("/expenses", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
            toast.success("Expense recorded successfully");
            setShowAddModal(false);
            // Reset form
            setTitle("");
            setAmount("");
            setCategory(CATEGORIES[0]);
            setDate(new Date().toISOString().slice(0, 10));
            setDescription("");
        },
        onError: (err) => {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to add expense");
        }
    });

    const deleteExpenseMut = useMutation({
        mutationFn: (id) => api.delete(`/expenses/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
            toast.success("Expense deleted successfully");
        },
        onError: (err) => {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to delete expense");
        }
    });

    const handleAddSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !amount || !category) return;
        addExpenseMut.mutate({
            title: title.trim(),
            amount: parseFloat(amount),
            category,
            date: new Date(date).toISOString(),
            description: description.trim()
        });
    };

    const fmtINR = (val) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    const filteredTransactions = summary?.transactions?.filter(t => {
        if (filterType === "all") return true;
        return t.type === filterType;
    }) || [];

    // Compute per-category expense totals for analytics
    const categoryBreakdown = useMemo(() => {
        const expenses = (summary?.transactions || []).filter(t => t.type === "EXPENSE");
        const map = {};
        expenses.forEach(t => {
            const cat = t.category || "Miscellaneous";
            map[cat] = (map[cat] || 0) + (t.amount || 0);
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [summary?.transactions]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <IndianRupee className="h-6 w-6 text-indigo-600" />
                        Finance Tracker
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Monitor your business revenues from invoices and record operating expenses.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-50 font-medium text-slate-700"
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {period === "custom" && (
                        <div className="flex items-center gap-1.5">
                            <input
                                type="date"
                                value={from}
                                onChange={e => setFrom(e.target.value)}
                                className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-50"
                            />
                            <span className="text-xs text-slate-400">to</span>
                            <input
                                type="date"
                                value={to}
                                onChange={e => setTo(e.target.value)}
                                className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-50"
                            />
                        </div>
                    )}

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="h-9 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                    >
                        <Plus className="h-4 w-4" /> Record Expense
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-xs text-slate-400 font-medium">Fetching financial data...</p>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Income</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(summary?.totalIncome)}</h3>
                                <p className="text-[10px] text-emerald-600 font-medium mt-1.5 flex items-center gap-0.5">
                                    <ArrowUpRight className="h-3.5 w-3.5" /> Realized from paid invoices
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(summary?.totalExpense)}</h3>
                                <p className="text-[10px] text-red-500 font-medium mt-1.5 flex items-center gap-0.5">
                                    <ArrowDownRight className="h-3.5 w-3.5" /> Manually recorded operating costs
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Profit / Margin</p>
                                <h3 className={`text-2xl font-bold mt-1 ${summary?.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                    {fmtINR(summary?.netProfit)}
                                </h3>
                                <p className="text-[10px] text-slate-500 font-medium mt-1.5">
                                    Operating margin: {summary?.totalIncome > 0 ? `${Math.round((summary.netProfit / summary.totalIncome) * 100)}%` : "0%"}
                                </p>
                            </div>
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${summary?.netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                <IndianRupee className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    {/* Expense Category Analytics */}
                    {categoryBreakdown.length > 0 && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Expense Breakdown by Category</h3>
                            <div className="flex flex-col lg:flex-row gap-6 items-center">
                                {/* Pie Chart */}
                                <div className="h-56 w-full lg:w-72 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={90}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {categoryBreakdown.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(val) => fmtINR(val)}
                                                contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "11px" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Category ranked list */}
                                <div className="flex-1 space-y-2 w-full">
                                    {categoryBreakdown.map((cat, idx) => {
                                        const total = categoryBreakdown.reduce((s, c) => s + c.value, 0);
                                        const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
                                        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                                        return (
                                            <div key={cat.name} className="flex items-center gap-3">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: color }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-medium text-slate-700 truncate">{cat.name}</span>
                                                        <span className="text-xs font-bold text-slate-900 ml-2 flex-shrink-0">{fmtINR(cat.value)}</span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{ width: `${pct}%`, backgroundColor: color }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 w-8 text-right flex-shrink-0">{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cash Flow Trend</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={summary?.trend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.01}/>
                                        </linearGradient>
                                        <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.01}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0" }}
                                        labelStyle={{ fontWeight: "bold", color: "#1E293B", fontSize: "11px" }}
                                    />
                                    <Area type="monotone" dataKey="income" name="Income" stroke="#10B981" fillOpacity={1} fill="url(#gInc)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="expense" name="Expense" stroke="#EF4444" fillOpacity={1} fill="url(#gExp)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Transactions Ledger */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ledger Accounts</h3>
                            
                            {/* Type filter pills */}
                            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                {[
                                    { id: "all", label: "All Transactions" },
                                    { id: "INCOME", label: "Income Only" },
                                    { id: "EXPENSE", label: "Expenses Only" }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setFilterType(p.id)}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterType === p.id ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredTransactions.length === 0 ? (
                            <div className="py-16 text-center">
                                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs text-slate-400 font-medium">No ledger entries found for the selected period.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/75 border-b border-slate-100">
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredTransactions.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-3.5 text-xs text-slate-500 font-medium">
                                                    {new Date(t.date).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric"
                                                    })}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <p className="text-xs font-bold text-slate-800">{t.title}</p>
                                                    {t.description && <p className="text-[10px] text-slate-400 mt-0.5">{t.description}</p>}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                    {t.category}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${t.type === "INCOME" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className={`px-5 py-3.5 text-xs font-bold text-right ${t.type === "INCOME" ? "text-emerald-700" : "text-red-700"}`}>
                                                    {t.type === "INCOME" ? "+" : "-"}{fmtINR(t.amount)}
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    {t.type === "EXPENSE" ? (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm("Are you sure you want to delete this expense record?")) {
                                                                    deleteExpenseMut.mutate(t.id);
                                                                }
                                                            }}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Delete record"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Record Expense Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-800">Record Manual Expense</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title / Payee</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. AWS Hosting bill, Rent for July"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount (INR)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="0.01"
                                        placeholder="e.g. 5000"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full h-10 px-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="w-full h-10 px-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description (Optional)</label>
                                <textarea
                                    placeholder="Add payment method, invoice ref, etc."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 min-h-[70px]"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 h-10 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addExpenseMut.isPending}
                                    className="flex-1 h-10 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                                >
                                    {addExpenseMut.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Save Expense"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
