import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Users, ClipboardList, Zap, RefreshCw,
    Search, ChevronDown, X, CheckCircle2, AlertTriangle,
    UserPlus, Shield,
} from "lucide-react";
import { toast } from "sonner";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
    </div>
);

// ── Assign modal ──────────────────────────────────────────────────────────────

const AssignModal = ({ lead, employees, onAssign, onClose, isPending }) => {
    const [selected, setSelected] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 text-base">Assign Lead</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-4 truncate">
                    Assigning: <span className="font-medium text-gray-800">{lead?.name}</span>
                </p>
                <div className="relative mb-4">
                    <select
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Select employee…</option>
                        {employees.map(emp => {
                            const load = emp.employeeProfile?.currentLeadLoad ?? 0;
                            const max  = emp.employeeProfile?.maxDailyLeads   ?? 20;
                            return (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} — {load}/{max} leads
                                </option>
                            );
                        })}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!selected || isPending}
                        onClick={() => onAssign(lead.id, selected)}
                        className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        Assign
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_COLORS = {
    FACEBOOK:   "bg-blue-100 text-blue-700",
    INSTAGRAM:  "bg-pink-100 text-pink-700",
    GMAIL:      "bg-red-100 text-red-700",
    WEBSITE:    "bg-green-100 text-green-700",
    PHONE_CALL: "bg-yellow-100 text-yellow-700",
    LINKEDIN:   "bg-sky-100 text-sky-700",
};

const SourceBadge = ({ source }) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[source] || "bg-gray-100 text-gray-600"}`}>
        {source?.replace("_", " ")}
    </span>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const SOURCES = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];

export default function UnassignedLeads() {
    const { user }        = useAuth();
    const queryClient     = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch]       = useState("");
    const [sourceFilter, setSource] = useState("");
    const [selected, setSelected]   = useState(new Set());
    const [assignTarget, setAssignTarget] = useState(null); // lead being assigned

    const isAuthorized = ["SUPER_ADMIN", "MANAGER"].includes(user?.role);

    // ── Queries ───────────────────────────────────────────────────────────────

    const { data: stats } = useQuery({
        queryKey: ["dist-stats"],
        queryFn:  () => api.get("/distribution/stats").then(r => r.data),
        enabled:  isAuthorized,
        refetchInterval: 30_000,
    });

    const { data: leadsData, isLoading, refetch } = useQuery({
        queryKey: ["unassigned-leads", page, search, sourceFilter],
        queryFn:  () => api.get("/distribution/unassigned", {
            params: { page, limit: 25, search: search || undefined, source: sourceFilter || undefined },
        }).then(r => r.data),
        enabled: isAuthorized,
        keepPreviousData: true,
    });

    const { data: employees = [] } = useQuery({
        queryKey: ["dist-employees"],
        queryFn:  () => api.get("/distribution/available-employees").then(r => r.data),
        enabled:  isAuthorized,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["unassigned-leads"] });
        queryClient.invalidateQueries({ queryKey: ["dist-stats"] });
        queryClient.invalidateQueries({ queryKey: ["dist-employees"] });
    };

    const assignMutation = useMutation({
        mutationFn: ({ leadId, employeeId }) => api.post("/distribution/assign", { leadId, employeeId }),
        onSuccess: () => { toast.success("Lead assigned"); setAssignTarget(null); invalidate(); },
        onError:   (e) => toast.error(e.response?.data?.message || "Assignment failed"),
    });

    const bulkMutation = useMutation({
        mutationFn: (leadIds) => api.post("/distribution/bulk-assign", { leadIds }),
        onSuccess: (res) => {
            const { assigned, failed } = res.data;
            toast.success(`${assigned} assigned, ${failed} failed`);
            setSelected(new Set());
            invalidate();
        },
        onError: (e) => toast.error(e.response?.data?.message || "Bulk assign failed"),
    });

    const autoAllMutation = useMutation({
        mutationFn: () => api.post("/distribution/bulk-assign", { all: true }),
        onSuccess: (res) => {
            const { assigned, failed } = res.data;
            toast.success(`Auto-assigned ${assigned} leads (${failed} failed)`);
            invalidate();
        },
        onError: (e) => toast.error(e.response?.data?.message || "Auto-assign failed"),
    });

    const claimMutation = useMutation({
        mutationFn: (leadId) => api.post(`/distribution/claim/${leadId}`),
        onSuccess: () => { toast.success("Lead claimed"); invalidate(); },
        onError:   (e) => toast.error(e.response?.data?.message || "Claim failed"),
    });

    // ── Selection helpers ─────────────────────────────────────────────────────

    const leads      = leadsData?.leads ?? [];
    const pagination = leadsData?.pagination;

    const allSelected  = leads.length > 0 && leads.every(l => selected.has(l.id));
    const someSelected = selected.size > 0;

    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(leads.map(l => l.id)));
    };

    const toggleOne = (id) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    // ── Access guard ──────────────────────────────────────────────────────────

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-14 w-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Shield className="h-7 w-7 text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
                <p className="text-sm text-gray-500 mt-1">Only Managers and Super Admins can access this page.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Unassigned Leads</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Fair distribution engine — assign manually or auto-distribute</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4 text-gray-500" />
                    </button>
                    <button
                        onClick={() => autoAllMutation.mutate()}
                        disabled={autoAllMutation.isPending || !stats?.unassigned}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {autoAllMutation.isPending
                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                            : <Zap className="h-4 w-4" />}
                        Auto-Assign All
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon={ClipboardList} label="Unassigned Leads"    value={stats?.unassigned}        color="bg-orange-500" />
                <StatCard icon={Users}         label="Available Employees" value={stats?.availableEmployees} color="bg-green-500" />
                <StatCard icon={CheckCircle2}  label="Assigned Today"      value={stats?.assignedToday}      color="bg-indigo-500" />
            </div>

            {/* Filters + bulk actions */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="relative">
                    <select
                        value={sourceFilter}
                        onChange={(e) => { setSource(e.target.value); setPage(1); }}
                        className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Sources</option>
                        {SOURCES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>

                {someSelected && (
                    <button
                        onClick={() => bulkMutation.mutate([...selected])}
                        disabled={bulkMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {bulkMutation.isPending
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <Zap className="h-3.5 w-3.5" />}
                        Auto-Assign {selected.size} selected
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Lead</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Source</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Score</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Created</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 7 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : leads.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-16 text-center">
                                    {search || sourceFilter ? (
                                        <>
                                            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-gray-700">No leads match your filters</p>
                                            <p className="text-xs text-gray-400 mt-1 mb-3">Try adjusting the search or source filter.</p>
                                            <button
                                                onClick={() => { setSearch(""); setSource(""); setPage(1); }}
                                                className="text-xs text-indigo-600 hover:underline font-medium"
                                            >
                                                Clear filters
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-gray-700">All caught up — no unassigned leads</p>
                                            <p className="text-xs text-gray-400 mt-1">Every lead has been assigned to a team member.</p>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(lead.id)}
                                            onChange={() => toggleOne(lead.id)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-900">{lead.name}</p>
                                        <p className="text-xs text-gray-400">{lead.email || lead.phone || "—"}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <SourceBadge source={lead.source} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-semibold ${lead.score >= 70 ? "text-green-600" : lead.score >= 40 ? "text-orange-500" : "text-gray-500"}`}>
                                            {lead.score}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {new Date(lead.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setAssignTarget(lead)}
                                                className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
                                            >
                                                Assign
                                            </button>
                                            <button
                                                onClick={() => claimMutation.mutate(lead.id)}
                                                disabled={claimMutation.isPending}
                                                className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium disabled:opacity-50"
                                            >
                                                Auto
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                            {pagination.total} leads — page {pagination.page} of {pagination.pages}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                            >
                                Prev
                            </button>
                            <button
                                disabled={page >= pagination.pages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Assign modal */}
            {assignTarget && (
                <AssignModal
                    lead={assignTarget}
                    employees={employees}
                    isPending={assignMutation.isPending}
                    onAssign={(leadId, employeeId) => assignMutation.mutate({ leadId, employeeId })}
                    onClose={() => setAssignTarget(null)}
                />
            )}
        </div>
    );
}
