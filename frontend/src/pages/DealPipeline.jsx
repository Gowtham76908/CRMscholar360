import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    DndContext, DragOverlay, closestCorners,
    PointerSensor, TouchSensor, useSensor, useSensors,
    useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
    TrendingUp, LayoutGrid, TableProperties, Search, Filter, X,
    Loader2, IndianRupee, User, CalendarDays, Clock, Phone,
    MessageSquare, Pencil, Trash2, ExternalLink, Receipt,
    ChevronLeft, ChevronRight, ArrowUpDown, GripVertical,
    Trophy, AlertCircle, Activity, ChevronDown,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAGES = ["NEW", "NEGOTIATION", "WON", "LOST"];

const STAGE_CFG = {
    NEW:         { label: "New",         headerBg: "bg-blue-600",   cardBorder: "border-blue-200",   colBg: "bg-blue-50/40",  badge: "bg-blue-100 text-blue-800 border-blue-200",   dot: "bg-blue-500"   },
    NEGOTIATION: { label: "Negotiation", headerBg: "bg-orange-500", cardBorder: "border-orange-200", colBg: "bg-orange-50/40",badge: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
    WON:         { label: "Won",         headerBg: "bg-green-600",  cardBorder: "border-green-200",  colBg: "bg-green-50/40", badge: "bg-green-100 text-green-800 border-green-200",  dot: "bg-green-500"  },
    LOST:        { label: "Lost",        headerBg: "bg-red-600",    cardBorder: "border-red-200",    colBg: "bg-red-50/40",   badge: "bg-red-100 text-red-800 border-red-200",     dot: "bg-red-500"    },
};

const CURRENCY_SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

function fmt(amount, currency = "INR") {
    const sym = CURRENCY_SYMBOL[currency] ?? currency + " ";
    return `${sym}${Number(amount).toLocaleString("en-IN")}`;
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtDateFull(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ageColor(days) {
    if (days > 30) return "bg-red-50 text-red-600";
    if (days > 7)  return "bg-orange-50 text-orange-600";
    return "bg-green-50 text-green-600";
}

// ─── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCards({ kpi, loading }) {
    const cards = kpi ? [
        { label: "Active Pipeline",  value: fmt(kpi.activeValue), sub: "NEW + NEGOTIATION",  icon: TrendingUp,    gradient: "from-indigo-500 to-violet-600" },
        { label: "Won Revenue",      value: fmt(kpi.wonRevenue),  sub: "Closed won",         icon: Trophy,        gradient: "from-green-500 to-emerald-600" },
        { label: "Lost Revenue",     value: fmt(kpi.lostRevenue), sub: "Closed lost",        icon: AlertCircle,   gradient: "from-red-400 to-rose-600"      },
        { label: "Avg Deal Size",    value: fmt(kpi.avgDealSize), sub: "All deals",          icon: IndianRupee,   gradient: "from-blue-500 to-cyan-500"     },
        { label: "Total Deals",      value: kpi.totalDeals,       sub: "Visible to you",     icon: Activity,      gradient: "from-gray-600 to-gray-800"     },
        { label: "Win Rate",         value: `${kpi.winRate}%`,   sub: "Won / total",        icon: TrendingUp,    gradient: "from-orange-400 to-amber-500"  },
    ] : [];

    if (loading) return (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />
            ))}
        </div>
    );

    return (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {cards.map(c => (
                <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">{c.label}</p>
                    <p className="text-xl font-black text-gray-900 truncate">{c.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Stage Badge ───────────────────────────────────────────────────────────────

function StageBadge({ stage }) {
    const cfg = STAGE_CFG[stage];
    if (!cfg) return null;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ─── Move Stage Dropdown ───────────────────────────────────────────────────────

function MoveStageMenu({ currentStage, onMove, loading }) {
    const [open, setOpen] = useState(false);
    const targets = STAGES.filter(s => s !== currentStage);

    return (
        <div className="relative">
            <button
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                title="Move stage"
                className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                disabled={loading}
            >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {open && (
                <div className="absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-32 py-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1">Move to</p>
                    {targets.map(s => (
                        <button
                            key={s}
                            onClick={e => { e.stopPropagation(); setOpen(false); onMove(s); }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors`}
                        >
                            <span className={`h-2 w-2 rounded-full ${STAGE_CFG[s].dot}`} />
                            {STAGE_CFG[s].label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Deal Card ─────────────────────────────────────────────────────────────────

function DealCard({ deal, onEdit, onDelete, onMove, moveLoading, overlay = false }) {
    const navigate = useNavigate();
    const cfg = STAGE_CFG[deal.stage] ?? STAGE_CFG.NEW;
    const owner = deal.assignedEmployee?.name ?? deal.createdBy?.name ?? "—";

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

    const style = !overlay ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 } : {};

    return (
        <div
            ref={!overlay ? setNodeRef : undefined}
            style={style}
            className={`group bg-white border ${cfg.cardBorder} rounded-xl p-3 shadow-sm select-none cursor-grab active:cursor-grabbing
                ${overlay ? "shadow-2xl rotate-1 scale-105 ring-2 ring-indigo-300" : "hover:shadow-md hover:border-indigo-300"}
                transition-all`}
        >
            {/* Drag handle + title row */}
            <div className="flex items-start gap-1.5">
                <div
                    {...(!overlay ? { ...attributes, ...listeners } : {})}
                    className="mt-0.5 text-gray-300 hover:text-gray-500 transition-colors shrink-0 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </div>
                <Link
                    to={`/deals/${deal.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-sm font-bold text-gray-900 leading-tight flex-1 min-w-0 truncate pr-1 hover:text-indigo-700 transition-colors"
                >
                    {deal.title}
                </Link>
                {!overlay && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoveStageMenu currentStage={deal.stage} onMove={s => onMove(deal.id, s, deal.stage)} loading={moveLoading === deal.id} />
                        <button onClick={e => { e.stopPropagation(); onEdit(deal); }} title="Edit deal" className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/leads/${deal.leadId}`); }} title="View lead" className="p-1 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDelete(deal); }} title="Delete deal" className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Lead */}
            <Link
                to={`/leads/${deal.leadId}`}
                onClick={e => e.stopPropagation()}
                className="mt-1 block text-xs text-indigo-600 hover:underline font-medium truncate"
            >
                {deal.lead?.name ?? "—"}
                {deal.lead?.company && <span className="text-gray-400 font-normal"> · {deal.lead.company}</span>}
            </Link>

            {/* Amount */}
            <div className="mt-2 flex items-center justify-between">
                <span className="text-base font-black text-gray-900">{fmt(deal.amount, deal.currency)}</span>
                <StageBadge stage={deal.stage} />
            </div>

            {/* Meta row */}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-0.5">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[80px]">{owner}</span>
                </span>
                <span className="flex items-center gap-0.5">
                    <CalendarDays className="h-3 w-3" />
                    {fmtDate(deal.createdAt)}
                </span>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${ageColor(deal.daysOpen)}`}>
                    {deal.daysOpen}d
                </span>
            </div>

            {/* Last activity */}
            {deal.lastActivityAt && (
                <div className="mt-1 flex items-center gap-0.5 text-[10px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>Active {fmtDate(deal.lastActivityAt)}</span>
                </div>
            )}

            {/* Quick actions */}
            {!overlay && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                        to={`/leads/${deal.leadId}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50 transition-colors"
                    >
                        <ExternalLink className="h-3 w-3" /> Lead
                    </Link>
                    <Link
                        to={`/messages?leadId=${deal.leadId}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-green-600 px-1.5 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                        <MessageSquare className="h-3 w-3" /> Message
                    </Link>
                    <Link
                        to={`/leads/${deal.leadId}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-600 px-1.5 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                        <Phone className="h-3 w-3" /> Call
                    </Link>
                    <Link
                        to={`/deals/${deal.id}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-violet-600 px-1.5 py-1 rounded hover:bg-violet-50 transition-colors ml-auto"
                    >
                        <Receipt className="h-3 w-3" /> Invoice
                    </Link>
                </div>
            )}
        </div>
    );
}

// ─── Droppable Column ──────────────────────────────────────────────────────────

function StageColumn({ stage, deals, onEdit, onDelete, onMove, moveLoading }) {
    const cfg = STAGE_CFG[stage];
    const { isOver, setNodeRef } = useDroppable({ id: stage });

    const colTotal = deals.reduce((s, d) => s + d.amount, 0);

    return (
        <div className="flex flex-col min-w-[260px] flex-1">
            {/* Column header */}
            <div className={`${cfg.headerBg} rounded-t-xl px-3 py-2.5 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{cfg.label}</span>
                    <span className="bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{deals.length}</span>
                </div>
                <span className="text-white/80 text-xs font-semibold">{fmt(colTotal)}</span>
            </div>

            {/* Drop zone */}
            <div
                ref={setNodeRef}
                className={`flex-1 ${cfg.colBg} ${isOver ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50/60" : ""} rounded-b-xl p-2 space-y-2 min-h-[200px] transition-colors overflow-y-auto`}
                style={{ maxHeight: "calc(100vh - 320px)" }}
            >
                <AnimatePresence>
                    {deals.map((deal, i) => (
                        <motion.div
                            key={deal.id}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.18, delay: i * 0.02 }}
                        >
                            <DealCard
                                deal={deal}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onMove={onMove}
                                moveLoading={moveLoading}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {deals.length === 0 && (
                    <div className={`flex items-center justify-center h-20 text-xs text-gray-400 border-2 border-dashed ${isOver ? "border-indigo-400 text-indigo-400" : "border-gray-200"} rounded-lg transition-colors`}>
                        {isOver ? "Drop here" : "No deals"}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Edit Deal Modal ────────────────────────────────────────────────────────────

function EditDealModal({ deal, members, onClose, onSaved }) {
    const [form, setForm] = useState({
        title:              deal.title,
        amount:             String(deal.amount),
        currency:           deal.currency,
        stage:              deal.stage,
        notes:              deal.notes ?? "",
        assignedEmployeeId: deal.assignedEmployeeId ?? "",
    });
    const [error, setError] = useState("");

    const mutation = useMutation({
        mutationFn: (data) => api.patch(`/deals/${deal.id}`, data),
        onSuccess: (res) => { onSaved(res.data); onClose(); },
        onError: (err) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to save"),
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const cls = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none";

    const submit = (e) => {
        e.preventDefault();
        if (!form.title.trim()) { setError("Title is required"); return; }
        mutation.mutate({
            title:              form.title.trim(),
            amount:             parseFloat(form.amount) || 0,
            currency:           form.currency,
            stage:              form.stage,
            notes:              form.notes.trim() || undefined,
            assignedEmployeeId: form.assignedEmployeeId || undefined,
        });
    };

    return (
        <Modal isOpen onClose={onClose} title="Edit Deal">
            <form onSubmit={submit} className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                    <input className={cls} value={form.title} onChange={e => set("title", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Amount</label>
                        <input type="number" min="0" step="0.01" className={cls} value={form.amount} onChange={e => set("amount", e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
                        <select className={cls} value={form.currency} onChange={e => set("currency", e.target.value)}>
                            <option value="INR">INR ₹</option>
                            <option value="USD">USD $</option>
                            <option value="EUR">EUR €</option>
                            <option value="GBP">GBP £</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Stage</label>
                        <select className={cls} value={form.stage} onChange={e => set("stage", e.target.value)}>
                            {STAGES.map(s => <option key={s} value={s}>{STAGE_CFG[s].label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned To</label>
                        <select className={cls} value={form.assignedEmployeeId} onChange={e => set("assignedEmployeeId", e.target.value)}>
                            <option value="">Unassigned</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                    <textarea className={`${cls} resize-none`} rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-3 pt-1">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                        Save
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ─── Table View ─────────────────────────────────────────────────────────────────

function TableView({ columns, onEdit, onDelete, onMove }) {
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortDir, setSortDir] = useState("desc");
    const LIMIT = 25;

    const allDeals = useMemo(() => {
        const flat = STAGES.flatMap(s => columns[s] ?? []);
        return [...flat].sort((a, b) => {
            const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
            if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [columns, sortBy, sortDir]);

    const totalPages = Math.max(1, Math.ceil(allDeals.length / LIMIT));
    const pageDeals = allDeals.slice((page - 1) * LIMIT, page * LIMIT);

    const toggleSort = (field) => {
        if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(field); setSortDir("desc"); setPage(1); }
    };

    const SortIcon = ({ field }) => (
        <ArrowUpDown className={`h-3 w-3 ml-1 inline ${sortBy === field ? "text-indigo-500" : "text-gray-300"}`} />
    );

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("title")}>Deal <SortIcon field="title" /></th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Lead</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Owner</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("amount")}>Amount <SortIcon field="amount" /></th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Stage</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("daysOpen")}>Age <SortIcon field="daysOpen" /></th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>Created <SortIcon field="createdAt" /></th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("updatedAt")}>Updated <SortIcon field="updatedAt" /></th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pageDeals.length === 0 ? (
                            <tr><td colSpan={9} className="py-16 text-center text-gray-400 text-sm">No deals match current filters.</td></tr>
                        ) : pageDeals.map((deal, i) => (
                            <motion.tr
                                key={deal.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.015 }}
                                className="hover:bg-gray-50 transition-colors group"
                            >
                                <td className="px-4 py-3 font-semibold text-gray-900 max-w-[180px] truncate">{deal.title}</td>
                                <td className="px-4 py-3">
                                    <Link to={`/leads/${deal.leadId}`} className="text-indigo-600 hover:underline font-medium text-xs truncate block max-w-[130px]">
                                        {deal.lead?.name ?? "—"}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600">{deal.assignedEmployee?.name ?? deal.createdBy?.name ?? "—"}</td>
                                <td className="px-4 py-3 font-bold text-gray-900">{fmt(deal.amount, deal.currency)}</td>
                                <td className="px-4 py-3"><StageBadge stage={deal.stage} /></td>
                                <td className="px-4 py-3"><span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ageColor(deal.daysOpen)}`}>{deal.daysOpen}d</span></td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateFull(deal.createdAt)}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateFull(deal.updatedAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onEdit(deal)} className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => onDelete(deal)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-500">Page {page} of {totalPages} · {allDeals.length} deals</p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DealPipeline() {
    const { user } = useAuth();
    const role = user?.role;
    const queryClient = useQueryClient();

    const [view, setView] = useState("kanban");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterStage,  setFilterStage]  = useState("");
    const [filterOwner,  setFilterOwner]  = useState("");
    const [filterMgr,    setFilterMgr]    = useState("");
    const [dateFrom,     setDateFrom]     = useState("");
    const [dateTo,       setDateTo]       = useState("");
    const [showFilters,  setShowFilters]  = useState(false);
    const [editDeal,     setEditDeal]     = useState(null);
    const [activeId,     setActiveId]     = useState(null);
    const [moveLoading,  setMoveLoading]  = useState(null);

    const filterKey = { search: debouncedSearch, ownerId: filterOwner, managerId: filterMgr, dateFrom, dateTo };

    // Debounce search
    const handleSearchChange = (val) => {
        setSearch(val);
        clearTimeout(window._pipelineSearchTimer);
        window._pipelineSearchTimer = setTimeout(() => setDebouncedSearch(val), 350);
    };

    // Pipeline data
    const { data, isLoading } = useQuery({
        queryKey: ["pipeline", filterKey],
        queryFn:  () => api.get("/deals/pipeline", { params: filterKey }).then(r => r.data),
        staleTime: 30_000,
    });

    // Members for filter dropdowns + edit modal
    const { data: members = [] } = useQuery({
        queryKey: ["deal-members"],
        queryFn:  () => api.get("/deals/members").then(r => r.data),
        staleTime: 300_000,
    });

    const rawColumns = data?.columns ?? { NEW: [], NEGOTIATION: [], WON: [], LOST: [] };
    const kpi        = data?.kpi;

    // Apply client-side stage filter (pipeline endpoint returns all stages; let user narrow view)
    const columns = useMemo(() => {
        if (!filterStage) return rawColumns;
        const filtered = { NEW: [], NEGOTIATION: [], WON: [], LOST: [] };
        filtered[filterStage] = rawColumns[filterStage] ?? [];
        return filtered;
    }, [rawColumns, filterStage]);

    // Stage move mutation with optimistic update
    const stageMutation = useMutation({
        mutationFn: ({ dealId, stage }) => api.patch(`/deals/${dealId}`, { stage }),
        onMutate: async ({ dealId, stage: newStage }) => {
            await queryClient.cancelQueries({ queryKey: ["pipeline", filterKey] });
            const snapshot = queryClient.getQueryData(["pipeline", filterKey]);

            queryClient.setQueryData(["pipeline", filterKey], old => {
                if (!old) return old;
                const cols = { ...old.columns, NEW: [...old.columns.NEW], NEGOTIATION: [...old.columns.NEGOTIATION], WON: [...old.columns.WON], LOST: [...old.columns.LOST] };
                const fromStage = STAGES.find(s => cols[s].some(d => d.id === dealId));
                if (!fromStage || fromStage === newStage) return old;
                const deal = cols[fromStage].find(d => d.id === dealId);
                cols[fromStage] = cols[fromStage].filter(d => d.id !== dealId);
                cols[newStage] = [{ ...deal, stage: newStage }, ...cols[newStage]];
                return { ...old, columns: cols };
            });

            return { snapshot };
        },
        onError: (_, __, ctx) => {
            if (ctx?.snapshot) queryClient.setQueryData(["pipeline", filterKey], ctx.snapshot);
            toast.error("Failed to update stage");
        },
        onSuccess: (res, { stage }) => {
            toast.success(`Deal moved to ${STAGE_CFG[stage].label}`);
            queryClient.invalidateQueries({ queryKey: ["pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["deals"] });
        },
        onSettled: () => setMoveLoading(null),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/deals/${id}`),
        onSuccess: () => {
            toast.success("Deal deleted");
            queryClient.invalidateQueries({ queryKey: ["pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["deals"] });
        },
        onError: () => toast.error("Failed to delete deal"),
    });

    const handleMove = useCallback((dealId, newStage) => {
        setMoveLoading(dealId);
        stageMutation.mutate({ dealId, stage: newStage });
    }, [stageMutation]);

    const handleDelete = (deal) => {
        if (!confirm(`Delete deal "${deal.title}"?`)) return;
        deleteMutation.mutate(deal.id);
    };

    // DnD
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const activeDeal = activeId
        ? STAGES.flatMap(s => columns[s]).find(d => d.id === activeId)
        : null;

    const handleDragStart  = ({ active }) => setActiveId(active.id);
    const handleDragCancel = ()           => setActiveId(null);

    const handleDragEnd = ({ active, over }) => {
        setActiveId(null);
        if (!over) return;
        const newStage = over.id;
        if (!STAGES.includes(newStage)) return;
        const fromStage = STAGES.find(s => columns[s].some(d => d.id === active.id));
        if (!fromStage || fromStage === newStage) return;
        handleMove(active.id, newStage);
    };

    const clearFilters = () => {
        setSearch(""); setDebouncedSearch(""); setFilterStage(""); setFilterOwner(""); setFilterMgr(""); setDateFrom(""); setDateTo("");
    };
    const hasFilters = debouncedSearch || filterStage || filterOwner || filterMgr || dateFrom || dateTo;

    const managers = members.filter(m => m.role === "ADMIN" || m.role === "SUPER_ADMIN");

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="h-6 w-6 text-indigo-600" /> Deal Pipeline
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {kpi ? `${kpi.totalDeals} deals · ${kpi.winRate}% win rate` : "Loading…"}
                    </p>
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setView("kanban")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === "kanban" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                        <button
                            onClick={() => setView("table")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            <TableProperties className="h-3.5 w-3.5" /> Table
                        </button>
                    </div>
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showFilters || hasFilters ? "border-indigo-400 text-indigo-700 bg-indigo-50" : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"}`}
                    >
                        <Filter className="h-3.5 w-3.5" /> Filters {hasFilters && <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 py-0.5">•</span>}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <KpiCards kpi={kpi} loading={isLoading} />

            {/* Search + Filter Bar */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search deal name or lead…"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                        />
                        {search && (
                            <button onClick={() => handleSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <select
                        value={filterStage}
                        onChange={e => setFilterStage(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    >
                        <option value="">All Stages</option>
                        {STAGES.map(s => <option key={s} value={s}>{STAGE_CFG[s].label}</option>)}
                    </select>

                    {hasFilters && (
                        <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 underline whitespace-nowrap">
                            Clear all
                        </button>
                    )}
                </div>

                {/* Extended filters */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-2 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Owner</label>
                                    <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none">
                                        <option value="">All owners</option>
                                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                                {(role === "SUPER_ADMIN") && (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Manager</label>
                                        <select value={filterMgr} onChange={e => setFilterMgr(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none">
                                            <option value="">All managers</option>
                                            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Created from</label>
                                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Created to</label>
                                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                </div>
            )}

            {/* Kanban View */}
            {!isLoading && view === "kanban" && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {STAGES.map(stage => (
                            <StageColumn
                                key={stage}
                                stage={stage}
                                deals={columns[stage] ?? []}
                                onEdit={setEditDeal}
                                onDelete={handleDelete}
                                onMove={handleMove}
                                moveLoading={moveLoading}
                            />
                        ))}
                    </div>

                    <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                        {activeDeal && (
                            <DealCard
                                deal={activeDeal}
                                onEdit={() => {}}
                                onDelete={() => {}}
                                onMove={() => {}}
                                moveLoading={null}
                                overlay
                            />
                        )}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Table View */}
            {!isLoading && view === "table" && (
                <TableView
                    columns={columns}
                    onEdit={setEditDeal}
                    onDelete={handleDelete}
                    onMove={handleMove}
                />
            )}

            {/* Edit Modal */}
            {editDeal && (
                <EditDealModal
                    deal={editDeal}
                    members={members}
                    onClose={() => setEditDeal(null)}
                    onSaved={() => {
                        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
                        queryClient.invalidateQueries({ queryKey: ["deals"] });
                    }}
                />
            )}
        </div>
    );
}
