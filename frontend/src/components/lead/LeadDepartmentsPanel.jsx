import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, X, Loader2, UserPlus, ChevronDown, History, ArrowRight } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import {
    useLeadDepartments,
    useMyDepartments,
    useWorkflows,
    useDepartmentMembers,
    useServiceTimeline,
    useRequestReassignment,
} from "../../hooks/useDepartments";
import {
    departmentLabel,
    departmentStyle,
    sortDepartments,
    DEPARTMENT_ORDER,
} from "../../lib/departments";

/**
 * Lead Detail → Departments panel. Renders every department service on a lead
 * (Step 1), and lets authorized users allocate new departments (Step 2), assign a
 * consultant, change the stage, or remove a department. The list the API returns
 * is already visibility-scoped to the caller, so a consultant only sees their own
 * services; authorization on every mutation is enforced server-side — the role
 * checks here only decide what controls to render.
 */
export default function LeadDepartmentsPanel({ leadId }) {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { data: assignments = [], isLoading } = useLeadDepartments(leadId);
    const { data: myDepartments = [] } = useMyDepartments();
    const { stageLabel, hasWorkflow } = useWorkflows();
    const [showAllocate, setShowAllocate] = useState(false);

    const isDirector = user?.role === "SUPER_ADMIN";
    const isManager = user?.role === "ADMIN";

    // Best-effort client gating (server is the source of truth):
    // allocation is for the Director, a Sales manager, or the assigned Sales consultant.
    const salesRow = assignments.find((a) => a.department === "SALES");
    const canAllocate =
        isDirector ||
        (isManager && myDepartments.includes("SALES")) ||
        (salesRow && salesRow.assignedEmployeeId === user?.id);

    const allocatedSet = new Set(assignments.map((a) => a.department));

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["lead-departments", leadId] });
        qc.invalidateQueries({ queryKey: ["lead", leadId] });
        qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    };

    const sorted = [...assignments].sort(
        (a, b) => DEPARTMENT_ORDER.indexOf(a.department) - DEPARTMENT_ORDER.indexOf(b.department)
    );

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-gray-400" />
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Departments</h3>
                </div>
                {canAllocate && (
                    <button
                        onClick={() => setShowAllocate((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        title="Allocate departments"
                    >
                        <Plus className="h-3.5 w-3.5" /> Allocate
                    </button>
                )}
            </div>

            {showAllocate && canAllocate && (
                <AllocateDepartments
                    leadId={leadId}
                    allocated={allocatedSet}
                    hasWorkflow={hasWorkflow}
                    onClose={() => setShowAllocate(false)}
                    onDone={invalidate}
                />
            )}

            {isLoading ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
            ) : sorted.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No department services visible.</p>
            ) : (
                <div className="space-y-2.5">
                    {sorted.map((a) => (
                        <DepartmentServiceRow
                            key={a.id}
                            assignment={a}
                            user={user}
                            isDirector={isDirector}
                            isManager={isManager}
                            myDepartments={myDepartments}
                            canAllocate={canAllocate}
                            stageLabel={stageLabel}
                            onChanged={invalidate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── A single department service (consultant + stage + controls) ────────────────

function DepartmentServiceRow({ assignment, user, isDirector, isManager, myDepartments, canAllocate, stageLabel, onChanged }) {
    const a = assignment;
    const managesDept = isDirector || (isManager && myDepartments.includes(a.department));
    const canAssign = managesDept;
    const canUpdateStage = isDirector || managesDept || a.assignedEmployeeId === user?.id;
    const canRemove = canAllocate && a.department !== "SALES";
    // A consultant assigned to this service can't reassign it directly — they ask a
    // manager via a reassignment request (their own surface, not the manager Assign).
    const canRequestReassign = !managesDept && a.assignedEmployeeId === user?.id;

    const [assigning, setAssigning] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const stageMut = useMutation({
        mutationFn: (stage) => api.patch(`/lead-departments/${a.id}/stage`, { stage }).then((r) => r.data),
        onSuccess: () => { toast.success("Stage updated"); onChanged(); },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not update stage"),
    });

    const removeMut = useMutation({
        mutationFn: () => api.delete(`/lead-departments/${a.id}`).then((r) => r.data),
        onSuccess: () => { toast.success(`${departmentLabel(a.department)} removed`); onChanged(); },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not remove department"),
    });

    return (
        <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/50">
            <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${departmentStyle(a.department)}`}>
                    {departmentLabel(a.department)}
                </span>
                {canRemove && (
                    <button
                        onClick={() => { if (confirm(`Remove ${departmentLabel(a.department)} from this lead?`)) removeMut.mutate(); }}
                        disabled={removeMut.isPending}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove department"
                    >
                        {removeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                )}
            </div>

            {/* Consultant */}
            <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Consultant</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                        {a.assignedEmployee?.name || <span className="text-gray-400 italic">Unassigned</span>}
                    </p>
                </div>
                {canAssign && (
                    <button
                        onClick={() => setAssigning((v) => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                    >
                        <UserPlus className="h-3 w-3" /> {a.assignedEmployeeId ? "Reassign" : "Assign"}
                    </button>
                )}
                {!canAssign && canRequestReassign && (
                    <button
                        onClick={() => setRequesting((v) => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-800 shrink-0"
                        title="Request a manager to reassign this lead"
                    >
                        <UserPlus className="h-3 w-3" /> Request reassign
                    </button>
                )}
            </div>

            {assigning && canAssign && (
                <AssignConsultant
                    leadDepartmentId={a.id}
                    department={a.department}
                    currentId={a.assignedEmployeeId}
                    onClose={() => setAssigning(false)}
                    onDone={onChanged}
                />
            )}

            {requesting && canRequestReassign && (
                <RequestReassign
                    leadDepartmentId={a.id}
                    department={a.department}
                    currentId={a.assignedEmployeeId}
                    onClose={() => setRequesting(false)}
                    onDone={onChanged}
                />
            )}

            {/* Stage */}
            <div className="mt-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Stage</p>
                {canUpdateStage ? (
                    <StageSelect
                        department={a.department}
                        value={a.stage}
                        disabled={stageMut.isPending}
                        onChange={(stage) => stageMut.mutate(stage)}
                    />
                ) : (
                    <span className="text-xs font-medium text-gray-700">{stageLabel(a.department, a.stage)}</span>
                )}
            </div>

            {/* Stage history (lazy-loaded from the historical ledger) */}
            <div className="mt-2">
                <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
                >
                    <History className="h-3 w-3" />
                    {showHistory ? "Hide history" : "Stage history"}
                    <ChevronDown className={`h-3 w-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
                </button>
                {showHistory && <StageTimeline leadDepartmentId={a.id} stageLabel={stageLabel} department={a.department} />}
            </div>
        </div>
    );
}

// ── Stage history timeline (Lead Details → Journey → Activity Timeline) ─────────

function StageTimeline({ leadDepartmentId, stageLabel, department }) {
    const { data, isLoading } = useServiceTimeline(leadDepartmentId, true);
    const events = data?.events || [];

    const fmtDate = (d) =>
        new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    if (isLoading) {
        return (
            <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
        );
    }
    if (events.length === 0) {
        return <p className="text-[11px] text-gray-400 py-2">No stage history recorded yet.</p>;
    }

    return (
        <ol className="mt-2 pl-1 space-y-2.5 border-l-2 border-gray-100">
            {events.map((e) => (
                <li key={e.id} className="relative pl-3">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-white" />
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {e.fromStage ? (
                            <>
                                <span className="text-[11px] text-gray-400">{stageLabel(department, e.fromStage)}</span>
                                <ArrowRight className="h-3 w-3 text-gray-300" />
                                <span className="text-[11px] font-semibold text-gray-700">{stageLabel(department, e.toStage)}</span>
                            </>
                        ) : (
                            <span className="text-[11px] font-semibold text-emerald-700">
                                Entered · {stageLabel(department, e.toStage)}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        {fmtDate(e.at)}{e.by?.name ? ` · ${e.by.name}` : " · system"}
                    </p>
                </li>
            ))}
        </ol>
    );
}

// ── Stage dropdown (options from the workflow config) ──────────────────────────

function StageSelect({ department, value, onChange, disabled }) {
    const { getStages } = useWorkflows();
    const stages = getStages(department);

    return (
        <div className="relative">
            <select
                value={value || ""}
                disabled={disabled || stages.length === 0}
                onChange={(e) => e.target.value && e.target.value !== value && onChange(e.target.value)}
                className="w-full appearance-none text-xs font-medium border border-gray-200 rounded-md pl-2 pr-7 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
            >
                {stages.length === 0 && <option value="">No workflow</option>}
                {stages.map((s) => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
    );
}

// ── Inline consultant picker (loads department members on open) ────────────────

function AssignConsultant({ leadDepartmentId, department, currentId, onClose, onDone }) {
    const { data: members = [], isLoading } = useDepartmentMembers(department);
    const mut = useMutation({
        mutationFn: (consultantId) =>
            api.patch(`/lead-departments/${leadDepartmentId}/assign`, { consultantId }).then((r) => r.data),
        onSuccess: () => { toast.success("Consultant assigned"); onDone(); onClose(); },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not assign consultant"),
    });

    return (
        <div className="mt-2 p-2 rounded-md bg-white border border-indigo-100">
            {isLoading ? (
                <div className="flex justify-center py-1"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
            ) : members.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-1">No members in {departmentLabel(department)}. Add them in Settings → Departments.</p>
            ) : (
                <select
                    autoFocus
                    defaultValue={currentId || ""}
                    disabled={mut.isPending}
                    onChange={(e) => e.target.value && mut.mutate(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
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

// ── Request reassignment (consultant → manager approval) ───────────────────────

function RequestReassign({ leadDepartmentId, department, currentId, onClose, onDone }) {
    const { data: members = [], isLoading } = useDepartmentMembers(department);
    const mut = useRequestReassignment();

    const submit = (toUserId) => {
        mut.mutate(
            { leadDepartmentId, toUserId, reason: null },
            {
                onSuccess: () => { toast.success("Reassignment requested — sent to the manager for approval"); onDone(); onClose(); },
                onError: (e) => toast.error(e.response?.data?.error?.message || "Could not send request"),
            }
        );
    };

    // The current assignee can't be a target; everyone else in the department can.
    const options = members.filter((m) => m.id !== currentId);

    return (
        <div className="mt-2 p-2 rounded-md bg-amber-50/60 border border-amber-100">
            {isLoading ? (
                <div className="flex justify-center py-1"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
            ) : options.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-1">No other members in {departmentLabel(department)} to reassign to.</p>
            ) : (
                <>
                    <p className="text-[10px] text-amber-700 mb-1.5">A manager must approve this reassignment.</p>
                    <select
                        autoFocus
                        defaultValue=""
                        disabled={mut.isPending}
                        onChange={(e) => e.target.value && submit(e.target.value)}
                        className="w-full text-xs border border-amber-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                        <option value="" disabled>Reassign to…</option>
                        {options.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}{m.role === "ADMIN" ? " (Manager)" : ""}</option>
                        ))}
                    </select>
                </>
            )}
        </div>
    );
}

// ── Allocate new departments (Step 2) ──────────────────────────────────────────

function AllocateDepartments({ leadId, allocated, hasWorkflow, onClose, onDone }) {
    const [selected, setSelected] = useState([]);
    // Allocatable = every department except those already on the lead and those
    // without a configured workflow (e.g. Application & Visa) — the backend rejects
    // unconfigured departments, so we don't offer them.
    const options = sortDepartments(
        DEPARTMENT_ORDER.filter((d) => d !== "SALES" && !allocated.has(d) && hasWorkflow(d))
    );

    const mut = useMutation({
        mutationFn: (departments) => api.post(`/leads/${leadId}/departments`, { departments }).then((r) => r.data),
        onSuccess: () => { toast.success("Departments allocated"); onDone(); onClose(); },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not allocate departments"),
    });

    const toggle = (d) =>
        setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

    return (
        <div className="mb-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50/40">
            {options.length === 0 ? (
                <p className="text-[11px] text-gray-500">All available departments are already allocated.</p>
            ) : (
                <>
                    <div className="space-y-1.5">
                        {options.map((d) => (
                            <label key={d} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(d)}
                                    onChange={() => toggle(d)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
                                />
                                {departmentLabel(d)}
                            </label>
                        ))}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-3">
                        <button onClick={onClose} className="text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                        <button
                            onClick={() => mut.mutate(selected)}
                            disabled={selected.length === 0 || mut.isPending}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md px-2.5 py-1.5"
                        >
                            {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Allocate{selected.length > 0 ? ` (${selected.length})` : ""}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
