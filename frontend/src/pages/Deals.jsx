import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    TrendingUp, Search, Filter, Plus, ChevronLeft, ChevronRight,
    Loader2, IndianRupee, CalendarDays, User, ArrowUpDown, Trash2,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["NEW", "NEGOTIATION", "WON", "LOST"];

const STAGE_STYLE = {
    NEW:         "bg-blue-100 text-blue-800 border-blue-200",
    NEGOTIATION: "bg-orange-100 text-orange-800 border-orange-200",
    WON:         "bg-green-100 text-green-800 border-green-200",
    LOST:        "bg-red-100 text-red-800 border-red-200",
};

const STAGE_DOT = {
    NEW:         "bg-blue-500",
    NEGOTIATION: "bg-orange-500",
    WON:         "bg-green-500",
    LOST:        "bg-red-500",
};

const CURRENCY_SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

function fmt(amount, currency = "INR") {
    const sym = CURRENCY_SYMBOL[currency] ?? currency + " ";
    return `${sym}${Number(amount).toLocaleString("en-IN")}`;
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Stage Badge ──────────────────────────────────────────────────────────────

function StageBadge({ stage }) {
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${STAGE_STYLE[stage] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage] ?? "bg-gray-400"}`} />
            {stage}
        </span>
    );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ deals }) {
    const stats = useMemo(() => {
        const all = deals ?? [];
        const total = all.reduce((s, d) => s + d.amount, 0);
        const won = all.filter(d => d.stage === "WON").reduce((s, d) => s + d.amount, 0);
        const open = all.filter(d => !["WON", "LOST"].includes(d.stage)).reduce((s, d) => s + d.amount, 0);
        return {
            count: all.length,
            total,
            won,
            open,
            winRate: all.length ? Math.round((all.filter(d => d.stage === "WON").length / all.length) * 100) : 0,
        };
    }, [deals]);

    const cards = [
        { label: "Total Deals",    value: stats.count,        sub: "all time",       color: "from-indigo-500 to-violet-600" },
        { label: "Pipeline Value", value: fmt(stats.open),    sub: "open deals",     color: "from-blue-500 to-cyan-500" },
        { label: "Won Revenue",    value: fmt(stats.won),     sub: "closed won",     color: "from-green-500 to-emerald-600" },
        { label: "Win Rate",       value: `${stats.winRate}%`, sub: "won / total",   color: "from-orange-400 to-amber-500" },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(c => (
                <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium mb-1">{c.label}</p>
                    <p className="text-2xl font-black text-gray-900">{c.value}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function getPages(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const result = [1];
    if (current > 4) result.push("...");
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) result.push(i);
    if (current < total - 3) result.push("...");
    result.push(total);
    return result;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Deals() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const search    = searchParams.get("search") || "";
    const stage     = searchParams.get("stage")  || "";
    const page      = parseInt(searchParams.get("page") || "1", 10);
    const sortBy    = searchParams.get("sortBy")    || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const [localSearch, setLocalSearch] = useState(search);

    const setParam = (key, val) => {
        const next = new URLSearchParams(searchParams);
        if (val) next.set(key, val); else next.delete(key);
        if (key !== "page") next.delete("page");
        setSearchParams(next, { replace: true });
    };

    const { data, isLoading } = useQuery({
        queryKey: ["deals", { search, stage, page, sortBy, sortOrder }],
        queryFn: () => api.get("/deals", { params: { search, stage, page, limit: 20, sortBy, sortOrder } }).then(r => r.data),
        keepPreviousData: true,
    });

    // For summary cards — fetch all without pagination
    const { data: allDeals } = useQuery({
        queryKey: ["deals-all"],
        queryFn: () => api.get("/deals", { params: { limit: 1000 } }).then(r => r.data.data ?? []),
        staleTime: 60_000,
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/deals/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["deals"] });
            toast.success("Deal deleted");
        },
        onError: () => toast.error("Failed to delete deal"),
    });

    const deals = data?.data ?? [];
    const totalPages = data?.totalPages ?? 1;
    const total = data?.total ?? 0;

    const toggleSort = (field) => {
        if (sortBy === field) {
            setParam("sortOrder", sortOrder === "asc" ? "desc" : "asc");
        } else {
            const next = new URLSearchParams(searchParams);
            next.set("sortBy", field);
            next.set("sortOrder", "desc");
            next.delete("page");
            setSearchParams(next, { replace: true });
        }
    };

    const SortIcon = ({ field }) => (
        <ArrowUpDown className={`h-3 w-3 ml-1 inline ${sortBy === field ? "text-indigo-500" : "text-gray-300"}`} />
    );

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-indigo-600" /> Deals
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">{total} deal{total !== 1 ? "s" : ""} found</p>
                </div>
            </div>

            {/* Summary cards */}
            <SummaryCards deals={allDeals} />

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search deals or lead name…"
                        value={localSearch}
                        onChange={e => setLocalSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && setParam("search", localSearch)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                    />
                </div>

                <select
                    value={stage}
                    onChange={e => setParam("stage", e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                >
                    <option value="">All Stages</option>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {(search || stage) && (
                    <button
                        onClick={() => { setLocalSearch(""); setSearchParams({}); }}
                        className="text-xs text-gray-500 hover:text-red-500 underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("title")}>
                                    Deal Name <SortIcon field="title" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Lead
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Owner / Assigned
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                                    Amount <SortIcon field="amount" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Stage
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>
                                    Created <SortIcon field="createdAt" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("updatedAt")}>
                                    Updated <SortIcon field="updatedAt" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Age
                                </th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400 mx-auto" />
                                    </td>
                                </tr>
                            ) : deals.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                                        No deals found. Convert a lead to create your first deal.
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence initial={false}>
                                    {deals.map((deal, i) => (
                                        <motion.tr
                                            key={deal.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            className="hover:bg-gray-50 transition-colors group"
                                        >
                                            <td className="px-4 py-3 font-semibold text-gray-900 max-w-[180px] truncate">
                                                {deal.title}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    to={`/leads/${deal.leadId}`}
                                                    className="text-indigo-600 hover:underline font-medium truncate block max-w-[140px]"
                                                >
                                                    {deal.lead?.name ?? "—"}
                                                </Link>
                                                {deal.lead?.company && (
                                                    <span className="text-[11px] text-gray-400">{deal.lead.company}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                <span className="flex items-center gap-1 text-xs">
                                                    <User className="h-3 w-3 text-gray-400 shrink-0" />
                                                    <span className="truncate max-w-[120px]">
                                                        {deal.assignedEmployee?.name ?? deal.createdBy?.name ?? "—"}
                                                    </span>
                                                </span>
                                                {deal.assignedEmployee && deal.assignedEmployee.id !== deal.createdById && (
                                                    <span className="text-[10px] text-gray-400">by {deal.createdBy?.name}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-gray-900">
                                                {fmt(deal.amount, deal.currency)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StageBadge stage={deal.stage} />
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                {fmtDate(deal.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                {fmtDate(deal.updatedAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                                    deal.daysOpen > 30
                                                        ? "bg-red-50 text-red-600"
                                                        : deal.daysOpen > 14
                                                        ? "bg-orange-50 text-orange-600"
                                                        : "bg-gray-100 text-gray-500"
                                                }`}>
                                                    {deal.daysOpen}d
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Delete deal "${deal.title}"?`)) {
                                                            deleteMutation.mutate(deal.id);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    title="Delete deal"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                        <p className="text-xs text-gray-500">
                            Page {page} of {totalPages} · {total} deals
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setParam("page", String(page - 1))}
                                disabled={page === 1}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            {getPages(page, totalPages).map((p, i) =>
                                p === "..." ? (
                                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setParam("page", String(p))}
                                        className={`h-7 min-w-7 px-2 flex items-center justify-center rounded-lg text-xs font-bold transition-colors border ${
                                            p === page
                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setParam("page", String(page + 1))}
                                disabled={page === totalPages}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
