import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Loader2, Search, UserPlus, Building2 } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
    useMyDepartments,
    useWorkflows,
    useDepartmentQueue,
    useDepartmentMembers,
} from "../hooks/useDepartments";
import { departmentLabel, departmentStyle, sortDepartments, DEPARTMENT_ORDER } from "../lib/departments";
import { getScoreStyle } from "../utils/leadScore";

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
    const [assignment, setAssignment] = useState(""); // "", "unassigned"
    const [stage, setStage] = useState("");
    const [search, setSearch] = useState("");

    // Default to the first available department once memberships load.
    useEffect(() => {
        if (!department && departments.length) setDepartment(departments[0]);
    }, [departments, department]);

    const filters = {};
    if (assignment) filters.assignedEmployeeId = assignment;
    if (stage) filters.stage = stage;
    if (search.trim()) filters.search = search.trim();

    const { data: rows = [], isLoading } = useDepartmentQueue(department, filters);

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-5 w-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900">Department Queue</h1>
            </div>
            <p className="text-sm text-gray-500 mb-5">Assign consultants and track each department's pipeline.</p>

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

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
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
                            value={assignment}
                            onChange={(e) => setAssignment(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="">All assignments</option>
                            <option value="unassigned">Unassigned only</option>
                        </select>
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
                        <span className="text-xs text-gray-400 ml-auto">{rows.length} service{rows.length === 1 ? "" : "s"}</span>
                    </div>

                    {/* Queue */}
                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : rows.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                            <Building2 className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                            No services match these filters.
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                            {rows.map((r) => (
                                <QueueRow key={r.id} row={r} department={department} stageLabel={stageLabel} canAssign={isDirector || myDepartments.includes(department)} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function QueueRow({ row, department, stageLabel, canAssign }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const lead = row.lead || {};

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["department-queue"] });
        qc.invalidateQueries({ queryKey: ["lead-departments", lead.id] });
    };

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link to={`/leads/${lead.id}`} className="text-sm font-semibold text-gray-900 hover:text-indigo-600 truncate">
                        {lead.name || "—"}
                    </Link>
                    {typeof lead.score === "number" && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getScoreStyle(lead.score)}`}>{lead.score}</span>
                    )}
                </div>
                <p className="text-xs text-gray-400 truncate">{lead.phone || lead.email || ""}</p>
            </div>

            <span className="text-xs font-medium text-gray-600 w-40 shrink-0 hidden sm:block">
                {stageLabel(department, row.stage)}
            </span>

            <div className="w-44 shrink-0 text-right">
                {row.assignedEmployee ? (
                    <span className="text-xs font-medium text-gray-700">{row.assignedEmployee.name}</span>
                ) : (
                    <span className="text-xs italic text-amber-600">Unassigned</span>
                )}
            </div>

            {canAssign && (
                <div className="shrink-0">
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                        <UserPlus className="h-3.5 w-3.5" /> {row.assignedEmployeeId ? "Reassign" : "Assign"}
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
        <div className="absolute right-4 mt-1 z-10 bg-white border border-indigo-100 rounded-lg shadow-lg p-2 w-56">
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
