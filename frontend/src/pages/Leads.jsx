import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Edit, Plus, Upload, Phone, PhoneCall, Play, Pause, SearchCheck, Users, History } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Merge } from "lucide-react";
import { Modal } from "../components/Modal";
import AddLeadForm from "../components/AddLeadForm";
import MergeLeadModal from "../components/MergeLeadModal";
import LeadActivityModal from "../components/LeadActivityModal";
import CallDetailModal from "../components/CallDetailModal";
import { useAuth } from "../context/AuthContext";

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
    const [activeTab, setActiveTab] = useState("leads"); // "leads" | "search-leads"
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
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
            alert("Failed to update leads");
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
            alert("Your phone number is not set. Please update your profile first.");
            return;
        }
        if (callingLeadId) {
            alert("A call is already in progress.");
            return;
        }
        if (!confirm(`Call ${lead.name} at ${lead.phone}?`)) return;

        setCallingLeadId(lead.id);
        try {
            await api.post("/calls/click2call", {
                leadId: lead.id,
                customerNumber: lead.phone
            });
        } catch (error) {
            alert(error.response?.data?.message || "Failed to initiate call");
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
            alert(res.data.message);
        } catch (error) {
            alert(error.response?.data?.message || "Failed to import CSV");
        } finally {
            setIsImporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leads</h1>
                        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                    </div>
                    <p className="text-sm text-gray-500">Manage your potential customers</p>
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

            {/* Table */}
            <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-60" : ""}`}>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200" aria-busy={isFetching && !isLoading}>
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        onChange={handleSelectAll}
                                        checked={leads.length > 0 && selectedLeads.length === leads.length}
                                    />
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Biodata</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leads.map((lead) => (
                                <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${selectedLeads.includes(lead.id) ? 'bg-indigo-50/50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedLeads.includes(lead.id)}
                                            onChange={() => handleSelectOne(lead.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link to={`/leads/${lead.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline">{lead.name}</Link>
                                        <div className="text-xs text-gray-500 capitalize">{lead.enquiryType?.toLowerCase()?.replace("_", " ") || "n/a"}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{lead.email || "-"}</div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-gray-500">{lead.phone}</span>
                                            <button
                                                onClick={() => handleClick2Call(lead)}
                                                disabled={callingLeadId === lead.id}
                                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                                                    callingLeadId === lead.id
                                                        ? "bg-green-100 text-green-600 animate-pulse"
                                                        : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                                }`}
                                                title={callingLeadId === lead.id ? "Calling..." : "Call this lead"}
                                            >
                                                {callingLeadId === lead.id ? (
                                                    <PhoneCall className="h-3 w-3" />
                                                ) : (
                                                    <Phone className="h-3 w-3" />
                                                )}
                                            </button>
                                        </div>
                                        {/* Latest recording */}
                                        {lead.callLogs?.find(c => c.recordingUrl) && (() => {
                                            const latestRecording = lead.callLogs.find(c => c.recordingUrl);
                                            return (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <button
                                                        onClick={() => handlePlayRecording(latestRecording)}
                                                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                                                        title="Play recording"
                                                    >
                                                        {playingRecording === latestRecording.id ? (
                                                            <Pause className="h-3 w-3" />
                                                        ) : (
                                                            <Play className="h-3 w-3" />
                                                        )}
                                                        <span>{latestRecording.duration > 0 ? `${Math.floor(latestRecording.duration / 60)}m ${latestRecording.duration % 60}s` : "Recording"}</span>
                                                    </button>
                                                    {playingRecording === latestRecording.id && (
                                                        <audio
                                                            ref={audioRef}
                                                            src={getAudioSrc(latestRecording.recordingUrl)}
                                                            autoPlay
                                                            onEnded={() => setPlayingRecording(null)}
                                                            className="hidden"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        {lead.biodata ? (
                                            <p
                                                className="text-xs text-gray-600 line-clamp-2 cursor-default"
                                                title={lead.biodata}
                                            >
                                                {lead.biodata}
                                            </p>
                                        ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className={`text-sm font-bold mr-2
                                                ${lead.category === 'HOT' ? 'text-red-600' :
                                                    lead.category === 'WARM' ? 'text-amber-600' : 'text-blue-600'}`}>
                                                {lead.score || 0}
                                            </span>
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${lead.category === 'HOT' ? 'bg-red-100 text-red-800' :
                                                    lead.category === 'WARM' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {lead.category || "COLD"}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 capitalize">
                                            {lead.source?.toLowerCase().replace("_", " ") || "n/a"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {lead.assignedTo?.name || "Unassigned"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                                lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                                                    lead.status === 'LOST' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => setSelectedLeadForCalls(lead)}
                                            disabled={isFetching && !isLoading}
                                            className="text-indigo-500 hover:text-indigo-700 mr-3 disabled:pointer-events-none"
                                            title="Call Details"
                                        >
                                            <Phone className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedLeadForActivity(lead)}
                                            disabled={isFetching && !isLoading}
                                            className="text-gray-400 hover:text-gray-600 mr-3 disabled:pointer-events-none"
                                            title="View Timeline"
                                        >
                                            <History className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setEditingLead(lead)}
                                            disabled={isFetching && !isLoading}
                                            className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:pointer-events-none"
                                            title="Edit Lead"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {leads.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="px-6 py-10 text-center text-sm text-gray-500">
                                        No leads found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                            disabled={page >= meta.totalPages}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{meta.total === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, meta.total)}</span> of <span className="font-medium">{meta.total}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => goTo(page - 1)}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    ← Prev
                                </button>
                                {pageButtons.map((p, i) =>
                                    p === "..." ? (
                                        <span key={`e${i}`} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => goTo(p)}
                                            aria-current={page === p ? "page" : undefined}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                page === p ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600" : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => goTo(page + 1)}
                                    disabled={page >= meta.totalPages}
                                    className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Next →
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
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
