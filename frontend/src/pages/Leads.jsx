import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Search, Filter, Edit, Plus, Upload, Phone, PhoneCall, Play, Pause, SearchCheck, Users, History, Mail, ChevronLeft, ChevronRight as ChevronRightIcon, LayoutGrid, List, Kanban, X, SlidersHorizontal, AlertTriangle, ChevronDown, User, Calendar, Star, Tag, Globe, CheckCircle2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Merge } from "lucide-react";
import { Modal } from "../components/Modal";
import SlidePanel from "../components/SlidePanel";
import AddLeadForm from "../components/AddLeadForm";
import MergeLeadModal from "../components/MergeLeadModal";
import LeadActivityModal from "../components/LeadActivityModal";
import CallDetailModal from "../components/CallDetailModal";
import ImportLeadsModal from "../components/ImportLeadsModal";
import { useAuth } from "../context/AuthContext";
import { LeadsSkeleton } from "../components/ui/Skeleton";
import { getCategoryFromScore, getSLAStatus } from "../utils/leadScore";
import { useWorkflows, useMyDepartments, useClaimService } from "../hooks/useDepartments";
import { DEPARTMENT_ORDER, departmentLabel } from "../lib/departments";
import LeadsBoard from "./LeadsBoard";
import Avatar from "../components/Avatar";


const getPages = (current, total) => {
    const delta = 2;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const result = [1];
    if (current > delta + 2) result.push("...");
    const start = Math.max(2, current - delta);
    const end = Math.min(total - 1, current + delta);
    for (let i = start; i <= end; i++) result.push(i);
    if (current < total - delta - 1) result.push("...");
    result.push(total);
    return result;
};

const formatLastUpdated = (date) => {
    if (!date) return "—";
    const now = new Date();
    const updated = new Date(date);
    const diffMs = now - updated;
    if (diffMs < 0) return "just now";
    
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const isToday = now.toDateString() === updated.toDateString();
    
    if (isToday) {
        if (diffHrs < 1) {
            return "less than 1 hr";
        }
        return `${diffHrs} hr${diffHrs === 1 ? "" : "s"} ago`;
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
        return "1 day ago";
    }
    if (diffDays >= 30) {
        return "30+ days ago";
    }
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

function FilterChip({ label, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
            {label}
            <button onClick={onRemove} className="ml-0.5 text-indigo-400 hover:text-indigo-700"><X className="h-3 w-3" /></button>
        </span>
    );
}

// A lead now carries one service row per department (LeadDepartment), each with its
// own workflow stage and consultant. This replaces the single status badge / assignee.
function DeptChips({ leadDepartments = [], stageLabel, max = 2 }) {
    if (!leadDepartments.length) {
        return <span className="text-[10px] font-semibold text-gray-400">No service</span>;
    }
    const shown = leadDepartments.slice(0, max);
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {shown.map(ld => (
                <span key={ld.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-semibold whitespace-nowrap">
                    {ld.assignedEmployee ? (
                        <Avatar user={ld.assignedEmployee} size="xs" className="w-3.5 h-3.5 border border-indigo-200" />
                    ) : (
                        <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-[8px] font-bold" title="Unassigned">U</div>
                    )}
                    <span>
                        {departmentLabel(ld.department)} · {stageLabel(ld.department, ld.stage)}
                    </span>
                </span>
            ))}
            {leadDepartments.length > max && (
                <span className="text-[10px] text-gray-400">+{leadDepartments.length - max}</span>
            )}
        </div>
    );
}

const Leads = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const [boardControlsExpanded, setBoardControlsExpanded] = useState(false);

    useEffect(() => {
        localStorage.setItem("last-leads-path", location.pathname + location.search);
    }, [location]);

    const activeTab    = searchParams.get("tab")         || "leads";
    const searchTerm   = searchParams.get("search")      || "";
    const page         = parseInt(searchParams.get("page") || "1", 10);
    const sortBy       = searchParams.get("sortBy")      || "createdAt";
    const sortOrder    = searchParams.get("sortOrder")   || "desc";
    const scoreMin     = searchParams.get("score_min")   || "";
    const scoreMax     = searchParams.get("score_max")   || "";
    const mineFilter   = searchParams.get("mine")        || "";
    const sourceFilter = searchParams.get("source")      || "";
    const categoryFilter = searchParams.get("category") || "";
    const enquiryFilter  = searchParams.get("enquiryType") || "";
    const slaFilter      = searchParams.get("sla")       || "";
    const dateFrom       = searchParams.get("startDate") || "";
    const dateTo         = searchParams.get("endDate")   || "";
    const departmentFilter = searchParams.get("department") || "";
    const stageFilter      = searchParams.get("stage")      || "";

    const [filterOpen, setFilterOpen] = useState(false);

    // Count active filters (excluding status which has its own tab row)
    const activeFilterCount = [sourceFilter, categoryFilter, enquiryFilter, slaFilter, dateFrom, dateTo, scoreMin, scoreMax, mineFilter, departmentFilter, stageFilter].filter(Boolean).length;

    const [localSearch, setLocalSearch] = useState(searchTerm);

    // Sync local search when URL changes
    useEffect(() => {
        setLocalSearch(searchTerm);
    }, [searchTerm]);

    // Debounce updating searchParams
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchTerm) {
                setSearchParams(p => {
                    const next = new URLSearchParams(p);
                    if (localSearch) next.set("search", localSearch);
                    else next.delete("search");
                    next.set("page", "1");
                    return next;
                }, { replace: true });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, setSearchParams, searchTerm]);

    const setParam  = (key, val) => setSearchParams(p => { const n = new URLSearchParams(p); if (val) n.set(key, val); else n.delete(key); n.set("page", "1"); return n; }, { replace: true });
    const setActiveTab    = (v) => setSearchParams(p => { const next = new URLSearchParams(p); next.set("tab", v); next.set("page", "1"); return next; }, { replace: true });
    const setSearchTerm   = (v) => setSearchParams(p => { const next = new URLSearchParams(p); if (v) next.set("search", v); else next.delete("search"); next.set("page", "1"); return next; }, { replace: true });
    const setPage         = (v) => setSearchParams(p => { const next = new URLSearchParams(p); next.set("page", String(v)); return next; }, { replace: true });
    const clearAllFilters = () => setSearchParams(p => {
        const next = new URLSearchParams(p);
        ["source","category","enquiryType","sla","startDate","endDate","score_min","score_max","mine","department","stage"].forEach(k => next.delete(k));
        next.set("page", "1");
        return next;
    }, { replace: true });
    // View mode lives in the URL (?view=) so links (e.g. the sidebar's "Board
    // View" shortcut) can deep-link straight into the board.
    const viewMode = searchParams.get("view") || "grid";
    const setViewMode = (v) => setSearchParams(p => { const next = new URLSearchParams(p); next.set("view", v); return next; }, { replace: true });
    const isBoardView = viewMode === "kanban";

    const limit = 20;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Board view fetches its own paginated data per department (see LeadsBoard /
    // useDepartmentBoard) instead of this list query — skip it entirely there so
    // switching to the board doesn't also fire an unused /leads request.
    const { data: leadsData, isLoading, isFetching } = useQuery({
        queryKey: ["leads", page, limit, searchTerm, activeTab, sortBy, sortOrder, scoreMin, scoreMax, mineFilter, sourceFilter, categoryFilter, enquiryFilter, slaFilter, dateFrom, dateTo, departmentFilter, stageFilter],
        queryFn: async () => {
            const params = {
                page,
                limit,
                search: searchTerm || undefined,
                isSearchLead: activeTab === "search-leads" ? true : activeTab === "leads" ? false : undefined,
                sortBy,
                sortOrder,
                score_min: scoreMin ? parseInt(scoreMin, 10) : undefined,
                score_max: scoreMax ? parseInt(scoreMax, 10) : undefined,
                mine: mineFilter === "true" ? true : undefined,
                source: sourceFilter || undefined,
                category: categoryFilter || undefined,
                enquiryType: enquiryFilter || undefined,
                sla: slaFilter || undefined,
                startDate: dateFrom || undefined,
                endDate: dateTo || undefined,
                department: departmentFilter || undefined,
                stage: stageFilter || undefined,
            };
            const res = await api.get("/leads", { params });
            return res.data;
        },
        enabled: !isBoardView,
        staleTime: 60_000,
        placeholderData: (prev) => prev,
    });

    const { data: orgSettings } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then((r) => r.data),
        staleTime: 5 * 60_000,
    });
    const slaWarningDays = orgSettings?.slaWarningDays ?? 3;
    const slaBreachDays  = orgSettings?.slaBreachDays  ?? 7;

    const { getStages, stageLabel } = useWorkflows();
    const { data: myDepartments = [] } = useMyDepartments();
    const claim = useClaimService();

    // A consultant may directly claim an unassigned service still at its department's
    // initial (enquiry) stage, in a department they belong to. Returns that service.
    const claimableService = (lead) => {
        if (user?.role !== "EMPLOYEE") return null;
        return (lead.leadDepartments || []).find(
            (ld) =>
                !ld.assignedEmployeeId &&
                myDepartments.includes(ld.department) &&
                ld.stage === getStages(ld.department)[0]?.code
        );
    };

    const handleClaim = (svc) => {
        claim.mutate(svc.id, {
            onSuccess: () => toast.success("Lead assigned to you"),
            onError: (e) => toast.error(e.response?.data?.error?.message || "Could not claim lead"),
        });
    };

    const leads = leadsData?.data || [];
    const meta = { total: leadsData?.total ?? 0, totalPages: leadsData?.totalPages ?? 0 };

    const pageButtons = useMemo(() => getPages(page, meta.totalPages), [page, meta.totalPages]);

    const goTo = useCallback((p) => setPage(Math.max(1, Math.min(meta.totalPages, p))), [meta.totalPages]);

    const toggleSort = (field) => {
        setSearchParams(p => {
            const next = new URLSearchParams(p);
            const currentField = next.get("sortBy") || "createdAt";
            const currentOrder = next.get("sortOrder") || "desc";
            if (currentField === field) {
                next.set("sortOrder", currentOrder === "desc" ? "asc" : "desc");
            } else {
                next.set("sortBy", field);
                next.set("sortOrder", "asc");
            }
            return next;
        }, { replace: true });
    };

    useEffect(() => {
        if (searchParams.get("new") === "1") {
            setIsAddModalOpen(true);
            setSearchParams(p => {
                const next = new URLSearchParams(p);
                next.delete("new");
                return next;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowLeft") goTo(page - 1);
            if (e.key === "ArrowRight") goTo(page + 1);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [page, goTo]);

    // Bulk Actions
    const [selectedLeads, setSelectedLeads] = useState([]);

    const _handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedLeads(leads.map(l => l.id));
        } else {
            setSelectedLeads([]);
        }
    };

    const _handleSelectOne = (id) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(l => l !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    // Merge Modal
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

    // Activity Modal
    const [selectedLeadForActivity, setSelectedLeadForActivity] = useState(null);

    // Call Detail Modal
    const [selectedLeadForCalls, setSelectedLeadForCalls] = useState(null);

    // Click2Call state
    const [callingLeadId, setCallingLeadId] = useState(null);
    const [playingRecording, setPlayingRecording] = useState(null);
    const audioRef = useRef(null);

    const handleClick2Call = async (lead) => {
        if (!user?.phone) {
            toast.warning("Your phone number is not set. Please update your profile first.");
            return;
        }
        if (callingLeadId) {
            toast.warning("A call is already in progress.");
            return;
        }

        setCallingLeadId(lead.id);
        try {
            await api.post("/calls/click2call", {
                leadId: lead.id,
                customerNumber: lead.phone
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to initiate call");
        } finally {
            setTimeout(() => setCallingLeadId(null), 5000);
        }
    };

    const getAudioSrc = (url) => {
        if (!url) return "";
        if (url.startsWith("/uploads/")) {
            const base = import.meta.env.VITE_API_BASE_URL;
            return `${base}${url}`;
        }
        return url;
    };

    const handlePlayRecording = (callLog) => {
        if (playingRecording === callLog.id) {
            audioRef.current?.pause();
            setPlayingRecording(null);
        } else {
            setPlayingRecording(callLog.id);
        }
    };


    if (isLoading) {
        return <LeadsSkeleton />;
    }

    const showControls = !isBoardView || boardControlsExpanded;

    return (
        <>
        <div className="space-y-5">
            {isBoardView && boardControlsExpanded && (
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-3.5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <Users className="h-5 w-5 text-indigo-650" /> Leads Board
                        </h1>
                        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                    </div>
                </div>
            )}

            {showControls && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        {!isBoardView && (
                            <>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leads</h1>
                                    {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                                </div>
                                <p className="text-sm text-gray-500">{meta.total} leads · Manage your pipeline</p>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-55 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Import File
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Lead
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            {showControls && (
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => { setActiveTab("leads"); setSearchTerm(""); setSelectedLeads([]); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === "leads"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <Users className="h-4 w-4" />
                    Leads
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        activeTab === "leads" ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"
                    }`}>
                        {activeTab === "leads" ? meta.total : "-"}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab("search-leads"); setSearchTerm(""); setSelectedLeads([]); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === "search-leads"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <SearchCheck className="h-4 w-4" />
                    Search Leads
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        activeTab === "search-leads" ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"
                    }`}>
                        {activeTab === "search-leads" ? meta.total : "-"}
                    </span>
                </button>
            </div>
            )}

            {/* Search + Filter bar */}
            {showControls && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Top row: search + filter toggle */}
                <div className="flex items-center gap-3 p-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, phone or email…"
                            className="pl-10 w-full border border-gray-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none bg-gray-50"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                        />
                        {localSearch && (
                            <button onClick={() => setLocalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter toggle button */}
                    <button onClick={() => setFilterOpen(o => !o)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all shrink-0 ${
                            filterOpen || activeFilterCount > 0
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}>
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
                        )}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                    </button>
                </div>

                {/* Active filter chips row */}
                {activeFilterCount > 0 && !filterOpen && (
                    <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
                        {sourceFilter    && <FilterChip label={`Source: ${sourceFilter.toLowerCase()}`}    onRemove={() => setParam("source", "")} />}
                        {categoryFilter  && <FilterChip label={`Category: ${categoryFilter}`}               onRemove={() => setParam("category", "")} />}
                        {enquiryFilter   && <FilterChip label={`Type: ${enquiryFilter}`}                    onRemove={() => setParam("enquiryType", "")} />}
                        {slaFilter       && <FilterChip label={`SLA: ${slaFilter}`}                         onRemove={() => setParam("sla", "")} />}
                        {mineFilter      && <FilterChip label="My Leads"                                     onRemove={() => setParam("mine", "")} />}
                        {departmentFilter && <FilterChip label={`Dept: ${departmentLabel(departmentFilter)}`} onRemove={() => { setParam("department", ""); setParam("stage", ""); }} />}
                        {stageFilter     && <FilterChip label={`Stage: ${stageLabel(departmentFilter, stageFilter)}`} onRemove={() => setParam("stage", "")} />}
                        {(scoreMin || scoreMax) && <FilterChip label={`Score: ${scoreMin||"0"}–${scoreMax||"100"}`} onRemove={() => { setParam("score_min",""); setParam("score_max",""); }} />}
                        {(dateFrom || dateTo)   && <FilterChip label={`Date: ${dateFrom||"…"} → ${dateTo||"…"}`}   onRemove={() => { setParam("startDate",""); setParam("endDate",""); }} />}
                        <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 font-semibold ml-1">Clear all</button>
                    </div>
                )}

                {/* Expanded filter panel */}
                {filterOpen && (
                    <div className="border-t border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        {/* Source */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><Globe className="h-3 w-3" />Source</label>
                            <div className="flex flex-wrap gap-1.5">
                                {["FACEBOOK","INSTAGRAM","GMAIL","WEBSITE","PHONE_CALL","LINKEDIN"].map(s => (
                                    <button key={s} onClick={() => setParam("source", sourceFilter === s ? "" : s)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${sourceFilter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
                                        {s === "PHONE_CALL" ? "Phone" : s.charAt(0) + s.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><Star className="h-3 w-3" />Category</label>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { v: "PREMIUM", cls: "bg-purple-600 border-purple-600", idle: "border-purple-200 text-purple-700 hover:border-purple-400" },
                                    { v: "HOT",     cls: "bg-red-500 border-red-500",       idle: "border-red-200 text-red-600 hover:border-red-400" },
                                    { v: "WARM",    cls: "bg-amber-500 border-amber-500",   idle: "border-amber-200 text-amber-700 hover:border-amber-400" },
                                    { v: "COLD",    cls: "bg-blue-500 border-blue-500",     idle: "border-blue-200 text-blue-600 hover:border-blue-400" },
                                ].map(({ v, cls, idle }) => (
                                    <button key={v} onClick={() => setParam("category", categoryFilter === v ? "" : v)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${categoryFilter === v ? `${cls} text-white` : `bg-white ${idle}`}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SLA */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><AlertTriangle className="h-3 w-3" />SLA Status</label>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { v: "warning", label: "Warning (3+ days)", cls: "bg-amber-500 border-amber-500", idle: "border-amber-200 text-amber-700 hover:border-amber-400" },
                                    { v: "breach",  label: "Breach (7+ days)",  cls: "bg-red-500 border-red-500",     idle: "border-red-200 text-red-600 hover:border-red-400"   },
                                ].map(({ v, label, cls, idle }) => (
                                    <button key={v} onClick={() => setParam("sla", slaFilter === v ? "" : v)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${slaFilter === v ? `${cls} text-white` : `bg-white ${idle}`}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Score range */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><Tag className="h-3 w-3" />Score Range</label>
                            <div className="flex items-center gap-2">
                                <input type="number" min="0" max="100" placeholder="Min" value={scoreMin}
                                    onChange={e => setParam("score_min", e.target.value)}
                                    className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
                                <span className="text-gray-400 text-xs">to</span>
                                <input type="number" min="0" max="100" placeholder="Max" value={scoreMax}
                                    onChange={e => setParam("score_max", e.target.value)}
                                    className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
                            </div>
                        </div>

                        {/* Date range */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><Calendar className="h-3 w-3" />Created Between</label>
                            <div className="flex items-center gap-2">
                                <input type="date" value={dateFrom}
                                    onChange={e => setParam("startDate", e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
                                <span className="text-gray-400 text-xs">→</span>
                                <input type="date" value={dateTo}
                                    onChange={e => setParam("endDate", e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
                            </div>
                        </div>

                        {/* My leads toggle */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><User className="h-3 w-3" />Ownership</label>
                            <button onClick={() => setParam("mine", mineFilter ? "" : "true")}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${mineFilter ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
                                <CheckCircle2 className="h-3 w-3" />Assigned to me
                            </button>
                        </div>

                        {/* Department & Stage — disabled in board view: columns already split by stage */}
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2"><Users className="h-3 w-3" />Department</label>
                            <div className="flex items-center gap-2">
                                <select value={departmentFilter} disabled={isBoardView}
                                    onChange={e => { setParam("department", e.target.value); setParam("stage", ""); }}
                                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none bg-white disabled:opacity-50">
                                    <option value="">Any department</option>
                                    {DEPARTMENT_ORDER.map(d => <option key={d} value={d}>{departmentLabel(d)}</option>)}
                                </select>
                                <select value={stageFilter} disabled={isBoardView || !departmentFilter}
                                    onChange={e => setParam("stage", e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none bg-white disabled:opacity-50">
                                    <option value="">Any stage</option>
                                    {departmentFilter && getStages(departmentFilter).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                                </select>
                                {isBoardView && <p className="text-[10px] text-gray-400 shrink-0">Board splits by stage</p>}
                            </div>
                        </div>

                        {/* Clear / close row */}
                        <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-gray-100">
                            <button onClick={clearAllFilters} className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1">
                                <X className="h-3 w-3" />Clear all filters
                            </button>
                            <button onClick={() => setFilterOpen(false)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* Bulk Action Bar */}
            {selectedLeads.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                    <span className="text-indigo-900 font-medium text-sm ml-2">
                        {selectedLeads.length} leads selected
                    </span>
                    <div className="flex gap-2">
                        {selectedLeads.length === 2 && (
                            <button
                                onClick={() => setIsMergeModalOpen(true)}
                                className="inline-flex items-center text-sm bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg shadow-sm"
                            >
                                <Merge className="h-3 w-3 mr-1.5" />
                                Merge Leads
                            </button>
                        )}

                        <button
                            onClick={() => setSelectedLeads([])}
                            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* View toggle + lead count */}
            {showControls && (
                <div className="flex items-center justify-between flex-wrap gap-4">
                <p className="text-sm text-gray-500">
                    {isBoardView
                        ? "Click a card to open the lead"
                        : <>Showing <span className="font-semibold text-gray-700">{meta.total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, meta.total)}</span> of <span className="font-semibold text-gray-700">{meta.total}</span></>}
                </p>
                <div className="flex items-center gap-2">
                    {/* Sort Dropdown — list views only */}
                    <div className={`flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 ${viewMode === "kanban" ? "hidden" : ""}`}>
                        <span className="font-medium">Sort:</span>
                        <select
                            value={`${sortBy}:${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split(":");
                                setSearchParams(p => {
                                    p.set("sortBy", field);
                                    p.set("sortOrder", order);
                                    return p;
                                }, { replace: true });
                            }}
                            className="bg-transparent border-0 p-0 pr-6 text-indigo-600 font-semibold focus:ring-0 cursor-pointer text-xs"
                        >
                            <option value="createdAt:desc">Newest First</option>
                            <option value="createdAt:asc">Oldest First</option>
                            <option value="score:desc">Score: High to Low</option>
                            <option value="score:asc">Score: Low to High</option>
                            <option value="name:asc">Name: A to Z</option>
                            <option value="name:desc">Name: Z to A</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`} title="Card view">
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewMode("table")} className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`} title="Table view">
                            <List className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewMode("kanban")} className={`p-1.5 rounded-md transition-colors ${viewMode === "kanban" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`} title="Board view (by stage)">
                            <Kanban className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
            )}

            {/* Board view — read-only, category-scoped, server-paginated per department
                (see useDepartmentBoard) so it loads quickly regardless of department size.
                No drag-and-drop: moving a lead's stage happens from Lead Detail. */}
            {isBoardView ? (
                <LeadsBoard
                    search={searchTerm}
                    mine={mineFilter === "true"}
                    initialDepartment={departmentFilter || undefined}
                    slaWarningDays={slaWarningDays}
                    slaBreachDays={slaBreachDays}
                    boardControlsExpanded={boardControlsExpanded}
                    setBoardControlsExpanded={setBoardControlsExpanded}
                />
            ) : viewMode === "grid" ? (
                <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-60" : ""}`}>
                    {leads.map((lead) => {
                        const latestRecording = lead.callLogs?.find(c => c.recordingUrl);
                        const dynamicCategory = getCategoryFromScore(lead.score ?? 0);
                        const categoryColors = {
                            PREMIUM: "bg-purple-100 text-purple-700",
                            HOT: "bg-red-100 text-red-700",
                            WARM: "bg-amber-100 text-amber-700",
                            COLD: "bg-blue-100 text-blue-700",
                        };
                        const sla = getSLAStatus(lead, slaWarningDays, slaBreachDays);
                        return (
                            <div
                                key={lead.id}
                                className={`relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group ${sla?.level === "breach" ? "border-red-200" : "border-gray-200"}`}
                            >
                                {/* Card top — name + SLA */}
                                <Link to={`/leads/${lead.id}`} className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h3 className="font-semibold text-gray-900 truncate text-sm group-hover:text-indigo-600 transition-colors">{lead.name}</h3>
                                            {lead.leadId && (
                                                <span className="text-[9px] font-mono font-bold bg-gray-100 text-gray-500 px-1 py-0.2 rounded border border-gray-200 select-all">
                                                    {lead.leadId}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5 capitalize truncate">{lead.enquiryType?.toLowerCase().replace(/_/g, " ") || "—"}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {sla?.level === "breach" && (
                                            <span title={`No activity for ${sla.days} days`} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">{sla.days}d inactive</span>
                                        )}
                                        {sla?.level === "warning" && (
                                            <span title={`No activity for ${sla.days} days`} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">{sla.days}d inactive</span>
                                        )}
                                    </div>
                                </Link>

                                {/* Divider */}
                                <div className="mx-4 border-t border-gray-100" />

                                {/* Department services */}
                                <div className="px-4 pt-3">
                                    <DeptChips leadDepartments={lead.leadDepartments} stageLabel={stageLabel} />
                                </div>

                                {/* Consultant self-claim (enquiry, unassigned, my department) */}
                                {(() => {
                                    const claimSvc = claimableService(lead);
                                    if (!claimSvc) return null;
                                    const busy = claim.isPending && claim.variables === claimSvc.id;
                                    return (
                                        <div className="px-4 pt-2">
                                            <button
                                                onClick={() => handleClaim(claimSvc)}
                                                disabled={busy}
                                                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                            >
                                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
                                                Assign to me · {departmentLabel(claimSvc.department)}
                                            </button>
                                        </div>
                                    );
                                })()}

                                {/* Contact info */}
                                <div className="px-4 py-3 space-y-1.5 flex-1">
                                    {lead.email && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                                            <Mail className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                            <span className="truncate">{lead.email}</span>
                                        </div>
                                    )}
                                    {lead.phone && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Phone className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                            <span>{lead.phone}</span>
                                        </div>
                                    )}
                                    {lead.biodata && (
                                        <p className="text-xs text-gray-400 line-clamp-2 pt-0.5">{lead.biodata}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-400 pt-0.5">
                                        <Calendar className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                        <span>Active {formatLastUpdated(lead.updatedAt)}</span>
                                    </div>
                                </div>

                                {/* Footer — score, source, assigned */}
                                <div className="px-4 pb-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColors[dynamicCategory] ?? "bg-gray-100 text-gray-500"}`}>
                                            {dynamicCategory} · {lead.score ?? 0}
                                        </span>
                                        {lead.source && (
                                            <span className="text-[10px] text-gray-400 capitalize">{lead.source.toLowerCase().replace(/_/g, " ")}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Action bar */}
                                <div className="px-3 pb-3 flex items-center gap-1.5 mt-auto">
                                    <button
                                        onClick={() => handleClick2Call(lead)}
                                        disabled={!!callingLeadId}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                            callingLeadId === lead.id 
                                                ? "bg-green-50 text-green-600 border-green-200 animate-pulse" 
                                                : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-100"
                                        } disabled:opacity-50`}
                                    >
                                        {callingLeadId === lead.id ? <PhoneCall className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                                        {callingLeadId === lead.id ? "Calling…" : "Call"}
                                    </button>
                                    {latestRecording && (
                                        <button
                                            onClick={() => handlePlayRecording(latestRecording)}
                                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-colors cursor-pointer"
                                            title="Play recording"
                                        >
                                            {playingRecording === latestRecording.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                            {playingRecording === latestRecording.id && (
                                                <audio ref={audioRef} src={getAudioSrc(latestRecording.recordingUrl)} autoPlay onEnded={() => setPlayingRecording(null)} className="hidden" />
                                            )}
                                        </button>
                                    )}
                                    <button onClick={() => setSelectedLeadForCalls(lead)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-250/30 hover:border-indigo-200 transition-colors cursor-pointer" title="Call details"><Phone className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setSelectedLeadForActivity(lead)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-250/30 hover:border-indigo-200 transition-colors cursor-pointer" title="Timeline"><History className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setEditingLead(lead)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-250/30 hover:border-indigo-200 transition-colors cursor-pointer" title="Edit"><Edit className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        );
                    })}
                    {leads.length === 0 && (
                        <div className="col-span-3 py-20 text-center text-gray-400">
                            <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                            <p className="font-medium">No leads found</p>
                            <p className="text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            ) : (
                /* Table view */
                <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-60" : ""}`}>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th onClick={() => toggleSort("name")} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:text-indigo-600 transition-colors">
                                        <div className="flex items-center gap-1">
                                            Name {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                                    <th onClick={() => toggleSort("score")} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:text-indigo-600 transition-colors">
                                        <div className="flex items-center gap-1">
                                            Score {sortBy === "score" && (sortOrder === "asc" ? "▲" : "▼")}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Source</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Departments</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leads.map((lead) => {
                                    const latestRecording = lead.callLogs?.find(c => c.recordingUrl);
                                    const dynamicCategory = getCategoryFromScore(lead.score ?? 0);
                                    return (
                                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Link to={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-indigo-600 text-sm">{lead.name}</Link>
                                                    {lead.leadId && (
                                                        <span className="text-[10px] font-mono font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 select-all">
                                                            {lead.leadId}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 capitalize">{lead.enquiryType?.toLowerCase().replace(/_/g, " ") || "—"}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-700">{lead.email || "—"}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-gray-500">{lead.phone}</span>
                                                    <button onClick={() => handleClick2Call(lead)} disabled={!!callingLeadId} className="p-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50">
                                                        {callingLeadId === lead.id ? <PhoneCall className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                                                    </button>
                                                    {latestRecording && (
                                                        <button onClick={() => handlePlayRecording(latestRecording)} className="p-1 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                                                            {playingRecording === latestRecording.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                                            {playingRecording === latestRecording.id && <audio ref={audioRef} src={getAudioSrc(latestRecording.recordingUrl)} autoPlay onEnded={() => setPlayingRecording(null)} className="hidden" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                    dynamicCategory === "PREMIUM" ? "bg-purple-100 text-purple-700" :
                                                    dynamicCategory === "HOT" ? "bg-red-100 text-red-700" :
                                                    dynamicCategory === "WARM" ? "bg-amber-100 text-amber-700" :
                                                    "bg-blue-100 text-blue-700"
                                                }`}>{dynamicCategory} · {lead.score ?? 0}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap"><span className="text-xs capitalize text-gray-500">{lead.source?.toLowerCase().replace(/_/g, " ") || "—"}</span></td>
                                            <td className="px-4 py-3"><DeptChips leadDepartments={lead.leadDepartments} stageLabel={stageLabel} /></td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {(() => {
                                                        const claimSvc = claimableService(lead);
                                                        if (!claimSvc) return null;
                                                        const busy = claim.isPending && claim.variables === claimSvc.id;
                                                        return (
                                                            <button
                                                                onClick={() => handleClaim(claimSvc)}
                                                                disabled={busy}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                                                title={`Assign ${departmentLabel(claimSvc.department)} to me`}
                                                            >
                                                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
                                                                Assign to me
                                                            </button>
                                                        );
                                                    })()}
                                                    <button onClick={() => setSelectedLeadForCalls(lead)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Call details"><Phone className="h-4 w-4" /></button>
                                                    <button onClick={() => setSelectedLeadForActivity(lead)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Timeline"><History className="h-4 w-4" /></button>
                                                    <button onClick={() => setEditingLead(lead)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {leads.length === 0 && (
                                    <tr><td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-400">No leads found matching your filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination — list views only */}
            <div className={`flex items-center justify-center gap-4 pt-1 ${viewMode === "kanban" ? "hidden" : ""}`}>
                <button onClick={() => goTo(page - 1)} disabled={page === 1} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <div className="flex items-center gap-1">
                    {pageButtons.map((p, i) =>
                        p === "..." ? (
                            <span key={`e${i}`} className="px-2 text-gray-400 text-sm">…</span>
                        ) : (
                            <button key={p} onClick={() => goTo(p)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>
                        )
                    )}
                </div>
                <button onClick={() => goTo(page + 1)} disabled={page >= meta.totalPages} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next <ChevronRightIcon className="h-4 w-4" />
                </button>
            </div>

            {isAddModalOpen && (
                <AddLeadForm onClose={() => setIsAddModalOpen(false)} />
            )}

            {isMergeModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" aria-hidden="true" onClick={() => setIsMergeModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <MergeLeadModal
                                leads={leads.filter(l => selectedLeads.includes(l.id))}
                                onClose={() => setIsMergeModalOpen(false)}
                                onSuccess={() => {
                                    setSelectedLeads([]);
                                    queryClient.invalidateQueries({ queryKey: ["leads"] });
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {selectedLeadForCalls && (
                <CallDetailModal
                    lead={selectedLeadForCalls}
                    callLogs={selectedLeadForCalls.callLogs || []}
                    onClose={() => setSelectedLeadForCalls(null)}
                    onUpdate={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
                />
            )}

            {editingLead && (
                <AddLeadForm
                    lead={editingLead}
                    onClose={() => setEditingLead(null)}
                />
            )}

            {selectedLeadForActivity && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" aria-hidden="true" onClick={() => setSelectedLeadForActivity(null)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <LeadActivityModal
                                lead={selectedLeadForActivity}
                                onClose={() => setSelectedLeadForActivity(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
        {isImportModalOpen && (
            <ImportLeadsModal onClose={() => setIsImportModalOpen(false)} />
        )}
        </>
    );
};

export default Leads;
