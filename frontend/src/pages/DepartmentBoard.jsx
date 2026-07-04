import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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
    LayoutGrid, Loader2, Search, X, GripVertical, ChevronDown,
    UserPlus, User, Building2, Phone, ExternalLink,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
    useWorkflows, useDepartmentQueue, useDepartmentMembers, useDepartmentSelection,
} from "../hooks/useDepartments";
import { departmentLabel, departmentStyle } from "../lib/departments";
import { getScoreStyle } from "../utils/leadScore";
import Avatar from "../components/Avatar";

/**
 * Department Board — a per-department Kanban over LeadDepartment services. Each
 * column is a workflow stage; cards are a lead's service in that department.
 * Drag a card (or use the move menu) to advance its stage; managers/Director can
 * assign consultants inline. Visibility is role-scoped server-side (consultants
 * see only their own assignments), mirroring the Department Queue.
 */
export default function DepartmentBoard() {
    const { user } = useAuth();
    const isManager = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    const qc = useQueryClient();
    const location = useLocation();

    useEffect(() => {
        localStorage.setItem("last-leads-path", location.pathname + location.search);
    }, [location]);

    const { department, setDepartment, options, isLoading: deptsLoading } = useDepartmentSelection();
    const { getStages, stageLabel } = useWorkflows();

    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [unassignedOnly, setUnassignedOnly] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [moveLoading, setMoveLoading] = useState(null);
    const [assigningLead, setAssigningLead] = useState(null);

    const onSearch = (v) => {
        setSearch(v);
        clearTimeout(window._deptBoardTimer);
        window._deptBoardTimer = setTimeout(() => setDebounced(v.trim()), 300);
    };

    const filters = useMemo(() => {
        const f = {};
        if (debounced) f.search = debounced;
        if (unassignedOnly && isManager) f.assignedEmployeeId = "unassigned";
        return f;
    }, [debounced, unassignedOnly, isManager]);

    const queryKey = ["department-queue", department, filters];
    const { data: rows = [], isLoading } = useDepartmentQueue(department, filters);

    const stages = department ? getStages(department) : [];

    // Group rows by stage code; stages with no rows still render as empty columns.
    const columns = useMemo(() => {
        const map = Object.fromEntries(stages.map((s) => [s.code, []]));
        for (const r of rows) (map[r.stage] ||= []).push(r);
        return map;
    }, [rows, stages]);

    const stageMutation = useMutation({
        mutationFn: ({ id, stage }) => api.patch(`/lead-departments/${id}/stage`, { stage }).then((r) => r.data),
        onMutate: async ({ id, stage: newStage }) => {
            await qc.cancelQueries({ queryKey });
            const snapshot = qc.getQueryData(queryKey);
            qc.setQueryData(queryKey, (old) =>
                Array.isArray(old) ? old.map((r) => (r.id === id ? { ...r, stage: newStage } : r)) : old
            );
            return { snapshot };
        },
        onError: (e, _v, ctx) => {
            if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot);
            toast.error(e.response?.data?.error?.message || "Could not move stage");
        },
        onSuccess: (_d, { stage, leadId }) => {
            toast.success(`Moved to ${stageLabel(department, stage)}`);
            qc.invalidateQueries({ queryKey: ["department-dashboard", department] });
            qc.invalidateQueries({ queryKey: ["department-workload", department] });
            if (leadId) qc.invalidateQueries({ queryKey: ["lead-departments", leadId] });
        },
        onSettled: () => { setMoveLoading(null); qc.invalidateQueries({ queryKey: ["department-queue"] }); },
    });

    const handleMove = useCallback((id, stage, leadId) => {
        setMoveLoading(id);
        stageMutation.mutate({ id, stage, leadId });
    }, [stageMutation]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const activeRow = activeId ? rows.find((r) => r.id === activeId) : null;

    const handleDragEnd = ({ active, over }) => {
        setActiveId(null);
        if (!over) return;
        const target = String(over.id).replace(/^col:/, "");
        if (!stages.some((s) => s.code === target)) return;
        const row = rows.find((r) => r.id === active.id);
        if (!row || row.stage === target) return;
        handleMove(row.id, target, row.lead?.id);
    };

    const accent = department ? departmentStyle(department) : "";

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="h-6 w-6 text-indigo-600" /> Department Board
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Drag a service across stages. {rows.length} service{rows.length === 1 ? "" : "s"} visible.
                    </p>
                </div>
            </div>

            {/* Department tabs + filters */}
            {deptsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
            ) : options.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                    You are not a member of any department yet. Ask a Director to add you in Department Staffing.
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        {options.map((d) => (
                            <button
                                key={d}
                                onClick={() => setDepartment(d)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    department === d ? departmentStyle(d) : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                {departmentLabel(d)}
                            </button>
                        ))}
                        <div className="relative ml-auto">
                            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                value={search}
                                onChange={(e) => onSearch(e.target.value)}
                                placeholder="Search lead…"
                                className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            {search && (
                                <button onClick={() => onSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        {isManager && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={unassignedOnly}
                                    onChange={(e) => setUnassignedOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
                                />
                                Unassigned only
                            </label>
                        )}
                    </div>

                    {/* Board */}
                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
                    ) : stages.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                            <Building2 className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                            {departmentLabel(department)} has no workflow configured yet.
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragStart={({ active }) => setActiveId(active.id)}
                            onDragCancel={() => setActiveId(null)}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="flex gap-3 overflow-x-auto pb-4">
                                {stages.map((s) => (
                                    <StageColumn
                                        key={s.code}
                                        stage={s}
                                        department={department}
                                        accent={accent}
                                        rows={columns[s.code] || []}
                                        stages={stages}
                                        canAssign={isManager}
                                        onMove={handleMove}
                                        moveLoading={moveLoading}
                                        onAssignClick={(lead) => setAssigningLead(lead)}
                                    />
                                ))}
                            </div>
                            <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                                {activeRow && (
                                    <ServiceCard row={activeRow} department={department} stages={stages} overlay />
                                )}
                            </DragOverlay>
                        </DndContext>
                    )}
                </>
            )}

            {assigningLead && (
                <AssignAllDepartmentsModal
                    lead={assigningLead}
                    onClose={() => setAssigningLead(null)}
                    onDone={() => {
                        qc.invalidateQueries({ queryKey: ["department-board"] });
                        qc.invalidateQueries({ queryKey: ["department-queue"] });
                    }}
                />
            )}
        </div>
    );
}

// ─── Column ──────────────────────────────────────────────────────────────────

function StageColumn({ stage, department, accent, rows, stages, canAssign, onMove, moveLoading, onAssignClick }) {
    const { isOver, setNodeRef } = useDroppable({ id: `col:${stage.code}` });
    return (
        <div className="flex flex-col min-w-[250px] flex-1">
            <div className={`rounded-t-xl px-3 py-2 flex items-center justify-between border ${accent}`}>
                <span className="font-bold text-xs">{stage.label}</span>
                <span className="bg-white/60 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{rows.length}</span>
            </div>
            <div
                ref={setNodeRef}
                className={`flex-1 bg-gray-50/60 rounded-b-xl p-1.5 space-y-1.5 min-h-[200px] transition-colors overflow-y-auto ${
                    isOver ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50/60" : ""
                }`}
                style={{ maxHeight: "calc(100vh - 145px)" }}
            >
                <AnimatePresence>
                    {rows.map((r, i) => (
                        <motion.div
                            key={r.id}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.18, delay: i * 0.02 }}
                        >
                            <ServiceCard
                                row={r}
                                department={department}
                                stages={stages}
                                canAssign={canAssign}
                                onMove={onMove}
                                moveLoading={moveLoading}
                                onAssignClick={onAssignClick}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
                {rows.length === 0 && (
                    <div className={`flex items-center justify-center h-16 text-xs border-2 border-dashed rounded-lg transition-colors ${
                        isOver ? "border-indigo-400 text-indigo-400" : "border-gray-200 text-gray-400"
                    }`}>
                        {isOver ? "Drop here" : "Empty"}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function ServiceCard({ row, department, stages, canAssign = false, onMove, moveLoading, overlay = false, onAssignClick }) {
    const [showOtherAssignees, setShowOtherAssignees] = useState(false);
    const lead = row.lead || {};
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
    const style = !overlay ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 } : {};

    return (
        <div
            ref={!overlay ? setNodeRef : undefined}
            style={style}
            className={`group bg-white border border-gray-200 rounded-lg p-2 shadow-sm select-none
                ${overlay ? "shadow-2xl rotate-1 scale-105 ring-2 ring-indigo-300" : "hover:shadow-md hover:border-indigo-300"} transition-all`}
        >
            <div className="flex items-start gap-1">
                <div
                    {...(!overlay ? { ...attributes, ...listeners } : {})}
                    className="mt-0.5 text-gray-300 hover:text-gray-500 shrink-0 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 min-w-0">
                        <Link
                            to={`/leads/${lead.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-gray-900 leading-tight hover:text-indigo-700 transition-colors truncate flex-1 min-w-0"
                        >
                            {lead.name || "—"}
                        </Link>
                        {typeof lead.score === "number" && (
                            <span className={`text-[8px] font-bold px-1 py-0.2 rounded shrink-0 ${getScoreStyle(lead.score)}`}>{lead.score}</span>
                        )}
                        {!overlay && (
                            <MoveStageMenu
                                stages={stages}
                                currentStage={row.stage}
                                loading={moveLoading === row.id}
                                onMove={(s) => onMove(row.id, s, lead.id)}
                            />
                        )}
                    </div>

                    {lead.leadId && (
                        <p className="text-[8px] font-mono text-slate-400 mt-0.5">ID: {lead.leadId}</p>
                    )}

                    {(lead.phone || lead.email) && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{lead.phone || lead.email}</p>
                    )}

                    <div className="mt-1.5 flex items-center justify-between gap-1.5 relative">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowOtherAssignees(!showOtherAssignees);
                            }}
                            className={`flex items-center gap-0.5 text-[10px] text-gray-500 min-w-0 hover:text-indigo-600 transition-colors focus:outline-none px-1 rounded hover:bg-slate-100 truncate ${showOtherAssignees ? "text-indigo-600 bg-indigo-50/70" : ""}`}
                            title="View all department assignees"
                        >
                            <User className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate font-semibold">{row.assignedEmployee?.name || "Unassigned"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {showOtherAssignees && (
                <div className="mt-2 pl-4 space-y-0.5 border-t border-slate-100 pt-1.5 animate-fadeIn">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assignees</p>
                    {(lead.leadDepartments || []).map(ld => {
                        const dotColor = 
                            ld.department === "SALES" ? "bg-indigo-500" :
                            ld.department === "APPLICATION_VISA" ? "bg-sky-500" :
                            ld.department === "LOAN" ? "bg-emerald-500" :
                            ld.department === "ACCOMMODATION_TICKETS" ? "bg-amber-500" :
                            ld.department === "FOREX" ? "bg-violet-500" :
                            "bg-slate-400";
                        return (
                            <div key={ld.id} className="flex items-center justify-between text-[10px] font-semibold py-0.5">
                                <div className="flex items-center gap-1">
                                    <span className={`w-1 h-1 rounded-full shrink-0 ${dotColor}`} />
                                    <span className="text-slate-400">{departmentLabel(ld.department)}:</span>
                                </div>
                                <span className="text-slate-700 truncate pl-2 max-w-[90px]">
                                    {ld.assignedEmployee?.name || "Unassigned"}
                                </span>
                            </div>
                        );
                    })}
                    {canAssign && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowOtherAssignees(false);
                                onAssignClick(lead);
                            }}
                            className="mt-1.5 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1.5 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                            <UserPlus className="h-3 w-3" />
                            Update Assignee
                        </button>
                    )}
                </div>
            )}

            {!overlay && (
                <div className="mt-1.5 pl-4 pt-1 border-t border-gray-100 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-indigo-600 px-1 py-0.5 rounded hover:bg-indigo-50 transition-colors">
                        <ExternalLink className="h-2.5 w-2.5" /> Lead
                    </Link>
                    {lead.phone && (
                        <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-blue-600 px-1 py-0.5 rounded hover:bg-blue-50 transition-colors">
                            <Phone className="h-2.5 w-2.5" /> Call
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Move stage menu (keyboard/click fallback to drag) ─────────────────────────

function MoveStageMenu({ stages, currentStage, onMove, loading }) {
    const [open, setOpen] = useState(false);
    const targets = stages.filter((s) => s.code !== currentStage);
    return (
        <div className="relative shrink-0">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                title="Move stage"
                disabled={loading}
                className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
            >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {open && (
                <div className="absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-40 py-1 max-h-64 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1">Move to</p>
                    {targets.map((s) => (
                        <button
                            key={s.code}
                            onClick={(e) => { e.stopPropagation(); setOpen(false); onMove(s.code); }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Inline assign (managers / Director) ───────────────────────────────────────

function AssignControl({ leadDepartmentId, department, currentId }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
            >
                <UserPlus className="h-3 w-3" /> {currentId ? "Reassign" : "Assign"}
            </button>
            {open && (
                <AssignMenu
                    leadDepartmentId={leadDepartmentId}
                    department={department}
                    currentId={currentId}
                    onClose={() => setOpen(false)}
                    onDone={() => {
                        qc.invalidateQueries({ queryKey: ["department-queue"] });
                        qc.invalidateQueries({ queryKey: ["department-workload", department] });
                    }}
                />
            )}
        </div>
    );
}

function AssignAllDepartmentsModal({ lead: initialLead, onClose, onDone }) {
    // The board data already includes ALL departments (LEAD_SELECT_FOR_BOARD),
    // so we can render immediately. We also fetch fresh data so that after an
    // assignment the "Current" highlight refreshes without reopening the modal.
    const { data: fullLead } = useQuery({
        queryKey: ["lead-full", initialLead.id],
        queryFn: () => api.get(`/leads/${initialLead.id}`).then((r) => r.data),
        enabled: Boolean(initialLead.id),
        staleTime: 0,
    });

    // Use fullLead's departments if available (has assignedEmployeeId), else fall
    // back to the board data (already has all departments but may lack that field).
    const departments = (fullLead || initialLead).leadDepartments || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 animate-scaleIn max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h3 className="text-sm font-black text-slate-800">Update Assignees</h3>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">{initialLead.name || "—"}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-50">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {/* Department sections */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {departments.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-10 italic">No departments assigned to this lead</p>
                    ) : (
                        departments.map((ld) => (
                            <DepartmentAssignSection
                                key={ld.id}
                                ld={ld}
                                onDone={onDone}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function DepartmentAssignSection({ ld, onDone }) {
    const [expanded, setExpanded] = useState(false);
    const { data: members = [], isLoading } = useDepartmentMembers(ld.department);
    const qc = useQueryClient();

    const mut = useMutation({
        mutationFn: (consultantId) =>
            api.patch(`/lead-departments/${ld.id}/assign`, { consultantId }).then((r) => r.data),
        onSuccess: () => {
            toast.success(`Assigned in ${departmentLabel(ld.department)}`);
            qc.invalidateQueries({ queryKey: ["department-board"] });
            qc.invalidateQueries({ queryKey: ["department-queue"] });
            onDone();
            setExpanded(false);
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not assign"),
    });

    const deptDotColor =
        ld.department === "SALES" ? "bg-indigo-500" :
        ld.department === "APPLICATION_VISA" ? "bg-sky-500" :
        ld.department === "LOAN" ? "bg-emerald-500" :
        ld.department === "ACCOMMODATION_TICKETS" ? "bg-amber-500" :
        ld.department === "FOREX" ? "bg-violet-500" :
        "bg-slate-400";

    return (
        <div className="rounded-xl border border-slate-200/70 overflow-hidden hover:border-slate-300 transition-colors">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${deptDotColor}`} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${departmentStyle(ld.department)}`}>
                        {departmentLabel(ld.department)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {ld.assignedEmployee ? (
                        <span className="text-xs text-slate-700 font-semibold">{ld.assignedEmployee.name}</span>
                    ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                </div>
            </button>

            {expanded && (
                <div className="px-4 py-3 border-t border-slate-100 bg-white space-y-1 animate-fadeIn">
                    {isLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-indigo-500" /></div>
                    ) : members.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4 italic">No members in this department</p>
                    ) : (
                        members.map((m) => {
                            const isCurrent = m.id === ld.assignedEmployeeId;
                            return (
                                <button
                                    key={m.id}
                                    disabled={mut.isPending}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        mut.mutate(m.id);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 hover:bg-slate-50 focus:outline-none ${
                                        isCurrent ? "bg-indigo-50/60 ring-1 ring-indigo-200" : "text-slate-700"
                                    } ${mut.isPending ? "opacity-50 cursor-wait" : ""}`}
                                >
                                    <Avatar user={m} size="xs" className="w-7 h-7 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold truncate leading-snug">{m.name}</p>
                                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{m.role.toLowerCase()}</p>
                                    </div>
                                    {isCurrent && (
                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Current</span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
