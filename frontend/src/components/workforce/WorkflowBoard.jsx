/**
 * WorkflowBoard — Kanban-style operational view of team leads by status.
 * Shows up to 8 cards per column with overflow count.
 * "View All" opens a Sheet drawer with search, filter, and pagination (20/page).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { scoreChipClass } from "../../utils/leadScore";
import {
    Loader2, Phone, MessageSquare, ExternalLink,
    UserCheck, Clock, Star, Layers, Search, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import api from "../../api/axios";
import Sheet from "../ui/Sheet";

const COLUMNS = [
    { key: "NEW",       label: "New Leads",        color: "bg-blue-500",   headerBg: "bg-blue-50",   border: "border-blue-100"   },
    { key: "CONTACTED", label: "Contacted",         color: "bg-purple-500", headerBg: "bg-purple-50", border: "border-purple-100" },
    { key: "FOLLOW_UP", label: "Follow-up Pending", color: "bg-orange-500", headerBg: "bg-orange-50", border: "border-orange-100" },
    { key: "CONVERTED", label: "Converted",         color: "bg-green-500",  headerBg: "bg-green-50",  border: "border-green-100"  },
    { key: "LOST",      label: "Lost",              color: "bg-red-500",    headerBg: "bg-red-50",    border: "border-red-100"    },
];

const PAGE_SIZE = 20;

// Canonical temperature colors (shared with Leads, LeadDetail, etc.)
const scoreColor = scoreChipClass;

const fmtDays = (d) => {
    if (d === 0) return "today";
    if (d === 1) return "1d ago";
    return `${d}d ago`;
};

const cardVariants = {
    hidden:  { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
    exit:    { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
};

// ── Preview card (kanban column) ─────────────────────────────────────────────
const LeadCard = ({ lead, navigate }) => (
    <motion.div
        layout key={lead.id}
        variants={cardVariants} initial="hidden" animate="visible" exit="exit"
        className="bg-white rounded-xl border border-[#E4E4E7] p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default group">

        <div className="flex items-start justify-between gap-1 mb-2">
            <p className="text-sm font-semibold text-[#18181B] leading-tight line-clamp-1">{lead.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${scoreColor(lead.score)}`}>
                ★{lead.score}
            </span>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
            <UserCheck className="h-3 w-3 text-[#71717A] shrink-0" />
            <span className="text-xs text-[#71717A] truncate">{lead.ownerName}</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-[#71717A]">
            <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {fmtDays(lead.daysInStage)} in stage
            </span>
            {lead.lastAction && (
                <span className="truncate ml-auto opacity-70">{lead.lastAction.replace(/_/g, " ").toLowerCase()}</span>
            )}
        </div>

        <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-[#F4F4F5] opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => navigate(`/leads/${lead.id}`)}
                className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-medium rounded-lg bg-[#FFF7ED] text-[#F97316] hover:bg-[#FED7AA] transition-colors border border-[#FED7AA]">
                <ExternalLink className="h-2.5 w-2.5" /> Open
            </button>
            <button onClick={() => navigate("/unassigned-leads")}
                className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-100 transition-colors"
                title="Reassign">
                <UserCheck className="h-2.5 w-2.5" />
            </button>
            <button onClick={() => navigate("/messages")}
                className="p-1.5 rounded-lg bg-green-50 text-green-500 hover:bg-green-100 border border-green-100 transition-colors"
                title="Message">
                <MessageSquare className="h-2.5 w-2.5" />
            </button>
            <button onClick={() => navigate("/salestrail")}
                className="p-1.5 rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-100 transition-colors"
                title="Call">
                <Phone className="h-2.5 w-2.5" />
            </button>
        </div>
    </motion.div>
);

// ── Drawer list row ──────────────────────────────────────────────────────────
const DrawerRow = ({ lead, navigate }) => (
    <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-3 p-3 rounded-xl border border-[#E4E4E7] bg-white hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 group">

        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-[#18181B] truncate">{lead.name}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${scoreColor(lead.score)}`}>
                    ★{lead.score}
                </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#71717A]">
                <span className="flex items-center gap-1 truncate">
                    <UserCheck className="h-3 w-3 shrink-0" />{lead.ownerName}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" />{fmtDays(lead.daysInStage)} in stage
                </span>
                {lead.lastAction && (
                    <span className="truncate opacity-70">{lead.lastAction.replace(/_/g, " ").toLowerCase()}</span>
                )}
            </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => navigate(`/leads/${lead.id}`)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-[#FFF7ED] text-[#F97316] hover:bg-[#FED7AA] border border-[#FED7AA] transition-colors">
                <ExternalLink className="h-2.5 w-2.5" /> Open
            </button>
            <button onClick={() => navigate("/unassigned-leads")}
                className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-100 transition-colors" title="Reassign">
                <UserCheck className="h-2.5 w-2.5" />
            </button>
            <button onClick={() => navigate("/messages")}
                className="p-1.5 rounded-lg bg-green-50 text-green-500 hover:bg-green-100 border border-green-100 transition-colors" title="Message">
                <MessageSquare className="h-2.5 w-2.5" />
            </button>
            <button onClick={() => navigate("/salestrail")}
                className="p-1.5 rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-100 transition-colors" title="Call">
                <Phone className="h-2.5 w-2.5" />
            </button>
        </div>
    </motion.div>
);

// ── Column drawer — lazy-fetches pages from the server ──────────────────────
const ColumnDrawer = ({ col, navigate, onClose }) => {
    const [search, setSearch] = useState("");
    const [page, setPage]     = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ["tp-workflow-col", col.key, page, search],
        queryFn:  () =>
            api.get(`/team-performance/workflow-board/${col.key}/leads`, {
                params: { page, ...(search ? { search } : {}) },
            }).then(r => r.data),
        keepPreviousData: true,
        staleTime: 30_000,
    });

    const leads      = data?.leads      || [];
    const total      = data?.total      || 0;
    const totalPages = data?.totalPages || 1;

    const handleSearch = (v) => { setSearch(v); setPage(1); };

    return (
        <Sheet open={!!col} onClose={onClose} size="lg"
            title={col.label}
            description={`${total} total lead${total !== 1 ? "s" : ""}`}>

            <Sheet.Body className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A]" />
                    <input
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search by name…"
                        className="w-full pl-9 pr-9 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
                    />
                    {search && (
                        <button onClick={() => handleSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B]">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Count */}
                {!isLoading && (
                    <p className="text-xs text-[#71717A] shrink-0">
                        Showing {leads.length} of {total}
                    </p>
                )}

                {/* Lead list */}
                <div className="flex flex-col gap-2 flex-1">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-[#F97316]" />
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {leads.length === 0 ? (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="py-12 text-center text-sm text-[#71717A]">
                                    No leads found
                                </motion.div>
                            ) : (
                                leads.map(lead => (
                                    <DrawerRow key={lead.id} lead={lead} navigate={navigate} />
                                ))
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </Sheet.Body>

            {/* Pagination footer */}
            {totalPages > 1 && (
                <Sheet.Footer className="justify-between">
                    <span className="text-xs text-[#71717A]">Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft className="h-4 w-4 text-[#18181B]" />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <ChevronRight className="h-4 w-4 text-[#18181B]" />
                        </button>
                    </div>
                </Sheet.Footer>
            )}
        </Sheet>
    );
};

// ── Main board ───────────────────────────────────────────────────────────────
const WorkflowBoard = () => {
    const navigate = useNavigate();
    const [expanded, setExpanded]       = useState(true);
    const [drawerCol, setDrawerCol]     = useState(null); // column key

    const { data: board = {}, isLoading } = useQuery({
        queryKey: ["tp-workflow-board"],
        queryFn:  () => api.get("/team-performance/workflow-board").then(r => r.data),
        staleTime: 60_000,
        refetchInterval: 120_000,
    });

    const activeCol = drawerCol ? COLUMNS.find(c => c.key === drawerCol) : null;

    return (
        <>
            <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-sm overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7] hover:bg-[#FAFAFA] transition-colors">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                            <Layers className="h-3.5 w-3.5 text-[#F97316]" />
                        </div>
                        <h2 className="font-semibold text-[#18181B]">Team Workflow Board</h2>
                        <span className="text-xs text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full ml-1">
                            {Object.values(board).reduce((s, col) => s + (col.total || 0), 0)} leads
                        </span>
                    </div>
                    <span className="text-xs text-[#71717A]">{expanded ? "Collapse ▲" : "Expand ▼"}</span>
                </button>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden">
                            {isLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
                                </div>
                            ) : (
                                <div className="p-4 overflow-x-auto">
                                    <div className="flex gap-3 min-w-max pb-2">
                                        {COLUMNS.map(col => {
                                            const colData  = board[col.key] || { leads: [], total: 0 };
                                            const overflow = colData.total - colData.leads.length;
                                            return (
                                                <div key={col.key} className="w-52 shrink-0 flex flex-col gap-2">
                                                    {/* Column header */}
                                                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${col.headerBg} ${col.border}`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`h-2 w-2 rounded-full ${col.color}`} />
                                                            <span className="text-xs font-semibold text-[#18181B]">{col.label}</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.headerBg} ${col.color.replace("bg-", "text-")}`}>
                                                            {colData.total}
                                                        </span>
                                                    </div>

                                                    {/* Cards */}
                                                    <div className="space-y-2 min-h-[60px]">
                                                        <AnimatePresence>
                                                            {colData.leads.map(lead => (
                                                                <LeadCard key={lead.id} lead={lead} navigate={navigate} />
                                                            ))}
                                                        </AnimatePresence>

                                                        {/* Overflow indicator + View All button */}
                                                        {overflow > 0 && (
                                                            <motion.button
                                                                initial={{ opacity: 0, y: 4 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                onClick={() => setDrawerCol(col.key)}
                                                                className="w-full py-2.5 flex flex-col items-center gap-0.5 text-xs border border-dashed border-[#E4E4E7] rounded-xl hover:bg-[#FFF7ED] hover:border-[#F97316] hover:text-[#F97316] transition-colors group">
                                                                <span className="font-semibold text-[#71717A] group-hover:text-[#F97316]">
                                                                    +{overflow} more lead{overflow !== 1 ? "s" : ""}
                                                                </span>
                                                                <span className="text-[10px] text-[#71717A] group-hover:text-[#F97316]">View All →</span>
                                                            </motion.button>
                                                        )}

                                                        {colData.leads.length === 0 && (
                                                            <div className="py-4 text-center text-[11px] text-[#71717A] border border-dashed border-[#E4E4E7] rounded-xl">
                                                                No leads
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Column drawer */}
            {activeCol && (
                <ColumnDrawer
                    col={activeCol}
                    navigate={navigate}
                    onClose={() => setDrawerCol(null)}
                />
            )}
        </>
    );
};

export default WorkflowBoard;
