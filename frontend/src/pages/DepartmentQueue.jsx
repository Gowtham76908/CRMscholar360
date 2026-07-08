import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Loader2, Search, UserPlus, Building2, Clock, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
    useMyDepartments,
    useWorkflows,
    useDepartmentQueue,
    useDepartmentMembers,
    useReassignmentRequests,
    useDecideReassignment,
} from "../hooks/useDepartments";
import { departmentLabel, departmentStyle, sortDepartments, DEPARTMENT_ORDER } from "../lib/departments";
import { getScoreStyle } from "../utils/leadScore";

// Vanilla helpers for relative time and date formatting to avoid extra packages
const getRelativeTimeString = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
};

const formatDateString = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const getSourceStyles = (source) => {
    const s = String(source || "").toUpperCase();
    if (s.includes("FACEBOOK")) return "bg-blue-50 text-blue-700 border-blue-100/50";
    if (s.includes("INSTAGRAM")) return "bg-pink-50 text-pink-700 border-pink-100/50";
    if (s.includes("WEBSITE") || s.includes("WEB")) return "bg-emerald-50 text-emerald-700 border-emerald-100/50";
    if (s.includes("LINKEDIN")) return "bg-sky-50 text-sky-700 border-sky-100/50";
    if (s.includes("PHONE") || s.includes("CALL")) return "bg-teal-50 text-teal-700 border-teal-100/50";
    return "bg-gray-50 text-gray-600 border-gray-200";
};

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

/**
 * Department Queue — a manager's (or Director's) work list for one department.
 * Pick a department, filter by stage / assignment state, and assign consultants.
 * This is the screen that proves the department model end-to-end: unassigned
 * services surface here and get routed to a consultant.
 */
export default function DepartmentQueue() {
    const { user } = useAuth();
    const isDirector = user?.role === "SUPER_ADMIN";
    const { data: myDepartments = [] } = useMyDepartments();
    const { stageLabel, getStages } = useWorkflows();

    // Director can work any department; managers only the ones they belong to.
    const departments = useMemo(
        () => sortDepartments(isDirector ? DEPARTMENT_ORDER : myDepartments),
        [isDirector, myDepartments]
    );

    const [department, setDepartment] = useState(null);
    const [assignmentTab, setAssignmentTab] = useState("all"); // "all", "unassigned", "assigned"
    const [stage, setStage] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selectedRowIds, setSelectedRowIds] = useState([]);

    const canAssign = isDirector || myDepartments.includes(department);
    const qc = useQueryClient();

    // Default to the first available department once memberships load.
    useEffect(() => {
        if (!department && departments.length) setDepartment(departments[0]);
    }, [departments, department]);

    // Reset pagination to page 1 whenever filters change and clear selection
    useEffect(() => {
        setPage(1);
        setSelectedRowIds([]);
    }, [department, assignmentTab, stage, search]);

    const handleBulkAssign = async (consultantId) => {
        try {
            await api.patch("/lead-departments/bulk-assign", {
                leadDepartmentIds: selectedRowIds,
                consultantId,
            });
            toast.success(`Successfully assigned ${selectedRowIds.length} services`);
            setSelectedRowIds([]);
            qc.invalidateQueries({ queryKey: ["department-queue"] });
        } catch (e) {
            toast.error(e.response?.data?.error?.message || "Could not bulk assign");
        }
    };

    const filters = {};
    if (stage) filters.stage = stage;
    if (search.trim()) filters.search = search.trim();

    // Fetch the list of leads matching search and stage criteria
    const { data: rawRows = [], isLoading } = useDepartmentQueue(department, filters);

    // Filter rows client-side based on assignment tab
    const filteredRows = useMemo(() => {
        return rawRows.filter((row) => {
            if (assignmentTab === "unassigned") {
                return !row.assignedEmployeeId;
            }
            if (assignmentTab === "assigned") {
                return !!row.assignedEmployeeId;
            }
            return true;
        });
    }, [rawRows, assignmentTab]);

    // Pagination computations
    const itemsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredRows.slice(start, start + itemsPerPage);
    }, [filteredRows, page]);

    const pageButtons = useMemo(() => getPages(page, totalPages), [page, totalPages]);
    const goTo = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-5 w-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900">Department Queue</h1>
            </div>
            <p className="text-sm text-gray-500 mb-5">Assign consultants and track each department's pipeline.</p>

            {/* Informational Banner */}
            <div className="bg-indigo-50/60 border border-indigo-100/80 rounded-2xl p-4 flex gap-4 animate-fade-in mb-6">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-gray-900">How the Department Queue works</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Leads enter the queue when they request specific services (e.g. Sales, Admissions, Visa processing). 
                        Incoming leads initially land in the <span className="font-semibold text-indigo-700">Unassigned</span> state 
                        at the start of the department's workflow. As a manager, you should assign a dedicated consultant 
                        to manage their progress.
                    </p>
                </div>
            </div>

            {departments.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                    You are not a member of any department yet. Ask a Director to add you in Department Staffing.
                </div>
            ) : (
                <>
                    {/* Department tabs */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {departments.map((d) => (
                            <button
                                key={d}
                                onClick={() => { setDepartment(d); setStage(""); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    department === d
                                        ? departmentStyle(d)
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                {departmentLabel(d)}
                            </button>
                        ))}
                    </div>

                    {/* Pending reassignment requests for managers to approve/reject */}
                    {canAssign && <ReassignRequests department={department} />}

                    {/* Tabs for Assignment State */}
                    <div className="flex border-b border-gray-200 mb-5">
                        <button
                            onClick={() => setAssignmentTab("all")}
                            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                                assignmentTab === "all"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            All ({rawRows.length})
                        </button>
                        <button
                            onClick={() => setAssignmentTab("unassigned")}
                            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                                assignmentTab === "unassigned"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            Unassigned ({rawRows.filter(r => !r.assignedEmployeeId).length})
                        </button>
                        <button
                            onClick={() => setAssignmentTab("assigned")}
                            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                                assignmentTab === "assigned"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            Assigned ({rawRows.filter(r => !!r.assignedEmployeeId).length})
                        </button>
                    </div>

                    {/* Filters & Count */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {canAssign && filteredRows.length > 0 && (
                            <div className="flex items-center gap-1.5 pr-2.5 border-r border-gray-200 mr-1.5">
                                <input
                                    type="checkbox"
                                    checked={
                                        filteredRows.length > 0 &&
                                        filteredRows.every((row) => selectedRowIds.includes(row.id))
                                    }
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedRowIds(filteredRows.map((row) => row.id));
                                        } else {
                                            setSelectedRowIds([]);
                                        }
                                    }}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <span className="text-xs text-gray-500 font-semibold select-none">Select All</span>
                            </div>
                        )}
                        <div className="relative">
                            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search lead…"
                                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                        <select
                            value={stage}
                            onChange={(e) => setStage(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="">All stages</option>
                            {department && getStages(department).map((s) => (
                                <option key={s.code} value={s.code}>{s.label}</option>
                            ))}
                        </select>
                        
                        <span className="text-xs text-gray-400 ml-auto font-medium">
                            Showing {filteredRows.length === 0 ? 0 : (page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, filteredRows.length)} of {filteredRows.length} services
                        </span>
                    </div>

                    {/* Bulk Actions Bar */}
                    {selectedRowIds.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 animate-fade-in mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-indigo-900 bg-indigo-200 px-2 py-0.5 rounded-full animate-pulse">
                                    {selectedRowIds.length}
                                </span>
                                <span className="text-xs font-medium text-indigo-950">
                                    services selected for bulk assignment
                                </span>
                            </div>
                            <BulkAssignSelect
                                department={department}
                                onAssign={handleBulkAssign}
                                onCancel={() => setSelectedRowIds([])}
                            />
                        </div>
                    )}

                    {/* Queue */}
                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : paginatedRows.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                            <Building2 className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                            No services match these filters.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-sm">
                                {paginatedRows.map((r) => (
                                    <QueueRow
                                        key={r.id}
                                        row={r}
                                        department={department}
                                        stageLabel={stageLabel}
                                        canAssign={canAssign}
                                        isSelected={selectedRowIds.includes(r.id)}
                                        onSelectToggle={() => {
                                            setSelectedRowIds((prev) =>
                                                prev.includes(r.id)
                                                    ? prev.filter((id) => id !== r.id)
                                                    : [...prev, r.id]
                                            );
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => goTo(page - 1)}
                                        disabled={page === 1}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Prev
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {pageButtons.map((p, i) =>
                                            p === "..." ? (
                                                <span key={`ell-${i}`} className="px-2 text-gray-400 text-xs">…</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => goTo(p)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                                        page === p
                                                            ? "bg-indigo-600 text-white shadow-sm"
                                                            : "text-gray-600 hover:bg-gray-100"
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}
                                    </div>
                                    <button
                                        onClick={() => goTo(page + 1)}
                                        disabled={page === totalPages}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        Next <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function QueueRow({ row, department, stageLabel, canAssign, isSelected, onSelectToggle }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const lead = row.lead || {};

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["department-queue"] });
        qc.invalidateQueries({ queryKey: ["lead-departments", lead.id] });
    };

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
            {/* Checkbox select */}
            {canAssign && (
                <div className="shrink-0 flex items-center pr-2">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onSelectToggle}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                </div>
            )}
            {/* Left Section: Lead Main Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                    <Link to={`/leads/${lead.id}${department ? `?dept=${department}` : ""}`} className="text-sm font-bold text-gray-900 hover:text-indigo-600 flex items-center gap-1 group">
                        {lead.name || "—"}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                    </Link>
                    
                    {typeof lead.score === "number" && (
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${getScoreStyle(lead.score)}`}>
                            {lead.score} pts
                        </span>
                    )}

                    {lead.source && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getSourceStyles(lead.source)}`}>
                            {lead.source.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {lead.phone && (
                        <span className="font-semibold text-gray-700">{lead.phone}</span>
                    )}
                    {lead.email && (
                        <span className="flex items-center gap-1.5">
                            {lead.phone && <span className="text-gray-300">·</span>}
                            <span className="text-gray-400">{lead.email}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Middle Section: Workflow / Department Details */}
            <div className="flex items-center gap-6 md:w-96 shrink-0">
                {/* Stage Info */}
                <div className="flex-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Workflow Stage</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50/50 text-indigo-700 text-xs font-semibold border border-indigo-100/30">
                        {stageLabel(department, row.stage)}
                    </span>
                </div>

                {/* Queue Origin & Time Details */}
                <div className="w-36">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Time in Queue</span>
                    <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{getRelativeTimeString(row.createdAt)}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                        Added {formatDateString(row.createdAt)}
                    </span>
                </div>
            </div>

            {/* Right Section: Consultant Allocation Action */}
            <div className="flex items-center justify-between md:justify-end gap-4 md:w-64 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                <div className="text-left md:text-right">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Assigned Consultant</span>
                    {row.assignedEmployee ? (
                        <div className="flex items-center gap-1.5 md:justify-end">
                            <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                {row.assignedEmployee.name.charAt(0)}
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{row.assignedEmployee.name}</span>
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100/50">
                            ⚠️ Unassigned
                        </span>
                    )}
                </div>

                {canAssign && (
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setOpen((v) => !v)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50/50 transition-colors shadow-sm cursor-pointer"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            {row.assignedEmployeeId ? "Reassign" : "Assign"}
                        </button>
                        {open && (
                            <InlineAssign
                                leadDepartmentId={row.id}
                                department={department}
                                currentId={row.assignedEmployeeId}
                                onClose={() => setOpen(false)}
                                onDone={invalidate}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function InlineAssign({ leadDepartmentId, department, currentId, onClose, onDone }) {
    const { data: members = [], isLoading } = useDepartmentMembers(department);
    const mut = useMutation({
        mutationFn: (consultantId) =>
            api.patch(`/lead-departments/${leadDepartmentId}/assign`, { consultantId }).then((r) => r.data),
        onSuccess: () => { toast.success("Consultant assigned"); onDone(); onClose(); },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not assign"),
    });

    return (
        <div className="absolute right-0 mt-1 z-10 bg-white border border-indigo-100 rounded-lg shadow-lg p-2 w-56 animate-fade-in">
            {isLoading ? (
                <div className="flex justify-center py-1"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
            ) : members.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-1">No members in {departmentLabel(department)}.</p>
            ) : (
                <select
                    autoFocus
                    defaultValue={currentId || ""}
                    disabled={mut.isPending}
                    onChange={(e) => e.target.value && mut.mutate(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <option value="" disabled>Select consultant…</option>
                    {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}{m.role === "ADMIN" ? " (Manager)" : ""}</option>
                    ))}
                </select>
            )}
        </div>
    );
}

// Pending reassignment requests raised by consultants — a manager approves or
// rejects each one; approval performs the actual reassignment server-side.
function ReassignRequests({ department }) {
    const { data: requests = [], isLoading } = useReassignmentRequests(department);
    const decide = useDecideReassignment(department);

    const act = (requestId, decision) => {
        decide.mutate(
            { requestId, decision },
            {
                onSuccess: () => toast.success(decision === "APPROVE" ? "Reassignment approved" : "Request rejected"),
                onError: (e) => toast.error(e.response?.data?.error?.message || "Could not update request"),
            }
        );
    };

    if (isLoading || requests.length === 0) return null;

    return (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-bold text-amber-900">Reassignment requests</h4>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">{requests.length}</span>
            </div>
            <div className="space-y-2">
                {requests.map((r) => {
                    const busy = decide.isPending && decide.variables?.requestId === r.id;
                    return (
                        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 bg-white border border-amber-100 rounded-xl px-3 py-2.5">
                            <div className="min-w-0">
                                <Link to={`/leads/${r.leadDepartment?.lead?.id}${r.leadDepartment?.department ? `?dept=${r.leadDepartment.department}` : ""}`} className="text-sm font-semibold text-gray-900 hover:text-indigo-600">
                                    {r.leadDepartment?.lead?.name || "Lead"}
                                </Link>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {r.requestedBy?.name} wants to reassign{" "}
                                    <span className="font-medium">{r.fromUser?.name || "Unassigned"}</span>
                                    {" → "}
                                    <span className="font-medium text-gray-700">{r.toUser?.name}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => act(r.id, "REJECT")}
                                    disabled={busy}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => act(r.id, "APPROVE")}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Approve & reassign
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BulkAssignSelect({ department, onAssign, onCancel }) {
    const { data: members = [], isLoading } = useDepartmentMembers(department);
    const [selectedConsultantId, setSelectedConsultantId] = useState("");

    return (
        <div className="flex items-center gap-2">
            {isLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading members...
                </div>
            ) : members.length === 0 ? (
                <span className="text-xs text-indigo-950 font-medium">No members in department.</span>
            ) : (
                <>
                    <select
                        value={selectedConsultantId}
                        onChange={(e) => setSelectedConsultantId(e.target.value)}
                        className="text-xs border border-indigo-200 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                        <option value="">Select consultant...</option>
                        {members.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name}{m.role === "ADMIN" ? " (Manager)" : ""}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => selectedConsultantId && onAssign(selectedConsultantId)}
                        disabled={!selectedConsultantId}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                    >
                        Assign
                    </button>
                </>
            )}
            <button
                onClick={onCancel}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2.5 py-1.5 rounded-lg hover:bg-indigo-100/50 transition-colors cursor-pointer"
            >
                Cancel
            </button>
        </div>
    );
}
