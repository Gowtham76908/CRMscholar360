import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Search, Filter, Edit, Plus, Upload, Phone, PhoneCall, Play, Pause, SearchCheck, Users, History, Mail, ChevronLeft, ChevronRight as ChevronRightIcon, LayoutGrid, List } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Merge } from "lucide-react";
import { Modal } from "../components/Modal";
import AddLeadForm from "../components/AddLeadForm";
import MergeLeadModal from "../components/MergeLeadModal";
import LeadActivityModal from "../components/LeadActivityModal";
import CallDetailModal from "../components/CallDetailModal";
import { useAuth } from "../context/AuthContext";
import { LeadsSkeleton } from "../components/ui/Skeleton";

function getSLAStatus(lead) {
    if (!["NEW", "CONTACTED", "FOLLOW_UP"].includes(lead.status)) return null;
    const days = (Date.now() - new Date(lead.updatedAt).getTime()) / 86_400_000;
    if (days > 7) return "breach";
    if (days > 3) return "warning";
    return null;
}

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

const Leads = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const activeTab    = searchParams.get("tab")    || "leads";
    const searchTerm   = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "ALL";
    const page         = parseInt(searchParams.get("page") || "1", 10);

    const setActiveTab    = (v) => setSearchParams(p => { p.set("tab", v); p.set("page", "1"); return p; }, { replace: true });
    const setSearchTerm   = (v) => setSearchParams(p => { if (v) p.set("search", v); else p.delete("search"); p.set("page", "1"); return p; }, { replace: true });
    const setStatusFilter = (v) => setSearchParams(p => { p.set("status", v); p.set("page", "1"); return p; }, { replace: true });
    const setPage         = (v) => setSearchParams(p => { p.set("page", String(v)); return p; }, { replace: true });
    const limit = 20;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const csvInputRef = useRef(null);
    const queryClient = useQueryClient();

    const { data: leadsData, isLoading, isFetching } = useQuery({
        queryKey: ["leads", page, searchTerm, statusFilter, activeTab],
        queryFn: async () => {
            const params = {
                page,
                limit,
                search: searchTerm || undefined,
                status: statusFilter === "ALL" ? undefined : statusFilter,
                isSearchLead: activeTab === "search-leads"
            };
            const res = await api.get("/leads", { params });
            return res.data;
        },
        placeholderData: (prev) => prev,
    });

    const leads = leadsData?.data || [];
    const meta = leadsData?.meta || { total: 0, totalPages: 0 };

    const pageButtons = useMemo(() => getPages(page, meta.totalPages), [page, meta.totalPages]);

    const goTo = useCallback((p) => setPage(Math.max(1, Math.min(meta.totalPages, p))), [meta.totalPages]);

    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowLeft") goTo(page - 1);
            if (e.key === "ArrowRight") goTo(page + 1);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [page, goTo]);

    const [viewMode, setViewMode] = useState("grid");

    // Bulk Actions
    const [selectedLeads, setSelectedLeads] = useState([]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedLeads(leads.map(l => l.id));
        } else {
            setSelectedLeads([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(l => l !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    const handleBulkUpdate = async (status) => {
        if (!confirm(`Update ${selectedLeads.length} leads to ${status}?`)) return;
        try {
            await api.patch("/leads/bulk-update", { leadIds: selectedLeads, status });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setSelectedLeads([]);
        } catch (error) {
            toast.error("Failed to update leads");
        }
    };

    // Merge Modal
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

    // Activity Modal
    const [selectedLeadForActivity, setSelectedLeadForActivity] = useState(null);

    // Call Detail Modal
    const [selectedLeadForCalls, setSelectedLeadForCalls] = useState(null);

    // Click2Call state
    const { user } = useAuth();
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

    // CSV Import
    const handleImportCSV = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";

        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append("csv", file);
            const res = await api.post("/leads/import", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            toast.success(res.data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to import CSV");
        } finally {
            setIsImporting(false);
        }
    };

    if (isLoading) {
        return <LeadsSkeleton />;
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leads</h1>
                        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                    </div>
                    <p className="text-sm text-gray-500">{meta.total} leads · Manage your pipeline</p>
                </div>
                <div className="flex gap-2">
                    <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportCSV}
                    />
                    <button
                        onClick={() => csvInputRef.current?.click()}
                        disabled={isImporting}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                    >
                        {isImporting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4 mr-2" />
                        )}
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

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => { setActiveTab("leads"); setSearchTerm(""); setStatusFilter("ALL"); setSelectedLeads([]); setPage(1); }}
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
                    onClick={() => { setActiveTab("search-leads"); setSearchTerm(""); setStatusFilter("ALL"); setSelectedLeads([]); setPage(1); }}
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

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search leads by name or email..."
                        className="pl-10 w-full border border-gray-300 rounded-lg py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="relative w-full sm:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                        className="pl-10 w-full border border-gray-300 rounded-lg py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    >
                        <option value="ALL">All Status</option>
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="FOLLOW_UP">Follow Up</option>
                        <option value="CONVERTED">Converted</option>
                        <option value="LOST">Lost</option>
                    </select>
                </div>
            </div>

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

                        <select
                            className="text-sm border-gray-300 rounded-lg focus:ring-indigo-500 py-1.5"
                            onChange={(e) => { if (e.target.value) handleBulkUpdate(e.target.value); }}
                            defaultValue=""
                        >
                            <option value="" disabled>Update Status...</option>
                            <option value="NEW">New</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="FOLLOW_UP">Follow Up</option>
                            <option value="CONVERTED">Converted</option>
                            <option value="LOST">Lost</option>
                        </select>
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
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Showing <span className="font-semibold text-gray-700">{meta.total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, meta.total)}</span> of <span className="font-semibold text-gray-700">{meta.total}</span>
                </p>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`} title="Card view">
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button onClick={() => setViewMode("table")} className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`} title="Table view">
                        <List className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Card Grid */}
            {viewMode === "grid" ? (
                <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-60" : ""}`}>
                    {leads.map((lead) => {
                        const latestRecording = lead.callLogs?.find(c => c.recordingUrl);
                        const statusColors = {
                            NEW: "bg-blue-50 text-blue-700 border-blue-100",
                            CONTACTED: "bg-indigo-50 text-indigo-700 border-indigo-100",
                            FOLLOW_UP: "bg-amber-50 text-amber-700 border-amber-100",
                            CONVERTED: "bg-emerald-50 text-emerald-700 border-emerald-100",
                            LOST: "bg-red-50 text-red-600 border-red-100",
                        };
                        const categoryColors = {
                            HOT: "bg-red-100 text-red-700",
                            WARM: "bg-amber-100 text-amber-700",
                            COLD: "bg-blue-100 text-blue-700",
                        };
                        const isSelected = selectedLeads.includes(lead.id);
                        const sla = getSLAStatus(lead);
                        return (
                            <div
                                key={lead.id}
                                className={`relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group ${isSelected ? "border-indigo-400 ring-2 ring-indigo-100" : sla === "breach" ? "border-red-200" : "border-gray-200"}`}
                            >
                                {/* Selection checkbox */}
                                <div className="absolute top-3 left-3 z-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={isSelected}
                                        onChange={() => handleSelectOne(lead.id)}
                                    />
                                </div>

                                {/* Card top — name + status */}
                                <Link to={`/leads/${lead.id}`} className="px-4 pt-4 pb-3 pl-9 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate text-sm group-hover:text-indigo-600 transition-colors">{lead.name}</h3>
                                        <p className="text-xs text-gray-400 mt-0.5 capitalize truncate">{lead.enquiryType?.toLowerCase().replace(/_/g, " ") || "—"}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[lead.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                            {lead.status?.replace("_", " ")}
                                        </span>
                                        {sla === "breach" && (
                                            <span title="No activity for 7+ days" className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">SLA</span>
                                        )}
                                        {sla === "warning" && (
                                            <span title="No activity for 3+ days" className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">3d</span>
                                        )}
                                    </div>
                                </Link>

                                {/* Divider */}
                                <div className="mx-4 border-t border-gray-100" />

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
                                </div>

                                {/* Footer — score, source, assigned */}
                                <div className="px-4 pb-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColors[lead.category] ?? "bg-gray-100 text-gray-500"}`}>
                                            {lead.category || "COLD"} · {lead.score ?? 0}
                                        </span>
                                        {lead.source && (
                                            <span className="text-[10px] text-gray-400 capitalize">{lead.source.toLowerCase().replace(/_/g, " ")}</span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 truncate max-w-[80px]" title={lead.assignedTo?.name}>{lead.assignedTo?.name || "Unassigned"}</span>
                                </div>

                                {/* Action bar */}
                                <div className="px-3 pb-3 flex items-center gap-1">
                                    <button
                                        onClick={() => handleClick2Call(lead)}
                                        disabled={!!callingLeadId}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${callingLeadId === lead.id ? "bg-green-50 text-green-600 animate-pulse" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"} disabled:opacity-50`}
                                    >
                                        {callingLeadId === lead.id ? <PhoneCall className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                                        {callingLeadId === lead.id ? "Calling…" : "Call"}
                                    </button>
                                    {latestRecording && (
                                        <button
                                            onClick={() => handlePlayRecording(latestRecording)}
                                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                            title="Play recording"
                                        >
                                            {playingRecording === latestRecording.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                            {playingRecording === latestRecording.id && (
                                                <audio ref={audioRef} src={getAudioSrc(latestRecording.recordingUrl)} autoPlay onEnded={() => setPlayingRecording(null)} className="hidden" />
                                            )}
                                        </button>
                                    )}
                                    <button onClick={() => setSelectedLeadForCalls(lead)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors" title="Call details"><Phone className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setSelectedLeadForActivity(lead)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors" title="Timeline"><History className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setEditingLead(lead)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors" title="Edit"><Edit className="h-3.5 w-3.5" /></button>
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
                                    <th className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300 text-indigo-600" onChange={handleSelectAll} checked={leads.length > 0 && selectedLeads.length === leads.length} /></th>
                                    {["Name", "Contact", "Score", "Source", "Assigned", "Status", "Actions"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leads.map((lead) => {
                                    const latestRecording = lead.callLogs?.find(c => c.recordingUrl);
                                    return (
                                        <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${selectedLeads.includes(lead.id) ? "bg-indigo-50/40" : ""}`}>
                                            <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300 text-indigo-600" checked={selectedLeads.includes(lead.id)} onChange={() => handleSelectOne(lead.id)} /></td>
                                            <td className="px-4 py-3">
                                                <Link to={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-indigo-600 text-sm">{lead.name}</Link>
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
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lead.category === "HOT" ? "bg-red-100 text-red-700" : lead.category === "WARM" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{lead.category || "COLD"} · {lead.score ?? 0}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap"><span className="text-xs capitalize text-gray-500">{lead.source?.toLowerCase().replace(/_/g, " ") || "—"}</span></td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{lead.assignedTo?.name || "—"}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lead.status === "NEW" ? "bg-blue-100 text-blue-700" : lead.status === "CONVERTED" ? "bg-emerald-100 text-emerald-700" : lead.status === "LOST" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{lead.status?.replace("_", " ")}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setSelectedLeadForCalls(lead)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Call details"><Phone className="h-4 w-4" /></button>
                                                    <button onClick={() => setSelectedLeadForActivity(lead)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Timeline"><History className="h-4 w-4" /></button>
                                                    <button onClick={() => setEditingLead(lead)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {leads.length === 0 && (
                                    <tr><td colSpan="8" className="px-6 py-12 text-center text-sm text-gray-400">No leads found matching your filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-1">
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

            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Lead"
            >
                <AddLeadForm onClose={() => setIsAddModalOpen(false)} />
            </Modal>

            {isMergeModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsMergeModalOpen(false)}></div>
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
                <Modal
                    isOpen={!!editingLead}
                    onClose={() => setEditingLead(null)}
                    title="Edit Lead"
                >
                    <AddLeadForm
                        lead={editingLead}
                        onClose={() => setEditingLead(null)}
                    />
                </Modal>
            )}

            {selectedLeadForActivity && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setSelectedLeadForActivity(null)}></div>
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
    );
};

export default Leads;
