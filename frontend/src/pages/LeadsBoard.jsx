import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Building2, Loader2, Mail, Phone, Globe, Tag, Calendar,
    ClipboardList, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWorkflows, useDepartmentBoard } from "../hooks/useDepartments";
import { DEPARTMENT_ORDER, departmentLabel, departmentStyle } from "../lib/departments";
import { getCategoryFromScore, getSLAStatus } from "../utils/leadScore";
import Avatar from "../components/Avatar";

const PER_STAGE = 10;

const STAGE_THEME = {
    // Lead Intake
    ENQUIRY: { border: "border-t-indigo-500" },
    CONTACTED: { border: "border-t-sky-500" },
    // Qual & Pitching
    QUALIFIED: { border: "border-t-blue-500" },
    PROPOSAL_SENT: { border: "border-t-purple-500" },
    DEMO_SCHEDULED: { border: "border-t-pink-500" },
    // Processing
    IN_PROGRESS: { border: "border-t-amber-500" },
    DOCUMENT_VERIFICATION: { border: "border-t-teal-500" },
    VISA_LODGED: { border: "border-t-emerald-500" },
    // Success / Closed
    BOOKING_CONFIRMED: { border: "border-t-green-500" },
    APPROVED: { border: "border-t-green-600" },
    PROCESS_COMPLETED: { border: "border-t-emerald-600" },
    COMMISSION_INVOICING: { border: "border-t-green-500" },
    // Archives / Losses
    FUTURE_PROSPECT: { border: "border-t-slate-400" },
    ARCHIVE: { border: "border-t-slate-500" },
    REJECTED: { border: "border-t-rose-500" },
};

const TASK_STATUS_DOT = {
    PENDING: "bg-amber-500",
    IN_PROGRESS: "bg-blue-500",
    COMPLETED: "bg-green-500",
    CANCELLED: "bg-rose-500",
};


// Same windowed-page-number algorithm as the grid/table pagination (Leads.jsx),
// duplicated locally so this board has no dependency on that page's internals.
function getPageButtons(current, total) {
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
}

/**
 * Leads Board — a read-only, category-scoped Kanban backed by a server-paginated
 * per-department fetch (useDepartmentBoard → GET /lead-departments/board), so it
 * stays fast no matter how many leads a department has — no bulk "load everything"
 * fetch, no client-side filtering of a huge list.
 *
 * Columns are that department's workflow stages; cards are built from the current
 * page only. There is no drag-and-drop and no stage-mutation here on purpose —
 * moving a lead's stage happens from Lead Detail. Cards are plain links, except
 * the task preview chip which opens a read-only popup.
 */
export default function LeadsBoard({ search = "", mine = false, initialDepartment, slaWarningDays = 3, slaBreachDays = 7 }) {
    const { user } = useAuth();
    const { getStages, hasWorkflow, isLoading: workflowsLoading } = useWorkflows();

    const categories = useMemo(
        () => DEPARTMENT_ORDER.filter((d) => hasWorkflow(d)),
        [hasWorkflow, workflowsLoading]
    );

    const [department, setDepartment] = useState(initialDepartment && categories.includes(initialDepartment) ? initialDepartment : null);
    const [page, setPage] = useState(1);
    const [previewTask, setPreviewTask] = useState(null);

    // Apply the Leads page's department filter once, the first time the category
    // list resolves — afterwards the tabs are user-controlled.
    const appliedInitial = useRef(false);
    useEffect(() => {
        if (appliedInitial.current || !categories.length) return;
        if (initialDepartment && categories.includes(initialDepartment)) {
            setDepartment(initialDepartment);
        } else if (!department) {
            setDepartment(categories[0]);
        }
        appliedInitial.current = true;
    }, [initialDepartment, categories, department]);

    // Changing tabs starts back at page 1.
    const changeDepartment = (d) => { setDepartment(d); setPage(1); };

    const filters = useMemo(() => {
        const f = {};
        if (search) f.search = search;
        if (mine && user?.id) f.assignedEmployeeId = user.id;
        return f;
    }, [search, mine, user?.id]);

    // Reset to page 1 whenever the filters change underneath the current page.
    useEffect(() => { setPage(1); }, [filters.search, filters.assignedEmployeeId, department]);

    const { data, isLoading, isFetching } = useDepartmentBoard(department, filters, page, PER_STAGE);
    // Already split server-side, one entry per stage: { [stageCode]: { rows, total, totalPages } }.
    const columns = data?.columns || {};
    const total = data?.total ?? 0;
    const totalPages = data?.totalPages ?? 1;

    const stages = department ? getStages(department) : [];

    if (workflowsLoading) {
        return <div className="py-20 text-center text-sm text-gray-400">Loading workflow…</div>;
    }

    return (
        <div className="space-y-4">
            {/* Category tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-100/85 backdrop-blur-md border border-slate-200/60 p-1.5 rounded-full w-fit shadow-inner">
                {categories.map((d) => (
                    <button
                        key={d}
                        onClick={() => changeDepartment(d)}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 relative ${
                            department === d 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200/50 scale-[1.03]" 
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        {departmentLabel(d)}
                    </button>
                ))}
            </div>

            {stages.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-sm text-slate-500 shadow-sm">
                    <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700">{departmentLabel(department)}</p>
                    <p className="text-slate-400 mt-1">No department workflow configured yet.</p>
                </div>
            ) : isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>
            ) : (
                <>
                    {/* Bounded height so horizontal scrolling columns look like Trello */}
                    <div
                        className={`flex gap-5 overflow-x-auto pb-6 pt-2 items-start transition-opacity duration-150 select-none scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent ${isFetching ? "opacity-60" : ""}`}
                    >
                        {stages.map((stage) => (
                            <StageColumn
                                key={stage.code}
                                stage={stage}
                                rows={columns[stage.code]?.rows || []}
                                totalInStage={columns[stage.code]?.total ?? 0}
                                slaWarningDays={slaWarningDays}
                                slaBreachDays={slaBreachDays}
                                onPreviewTask={setPreviewTask}
                            />
                        ))}
                    </div>

                    {/* Pagination — sticky to the bottom of the viewport */}
                    <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white border-t border-slate-200/80 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            {total === 0 ? "0 leads" : `${total} lead${total === 1 ? "" : "s"} in ${departmentLabel(department)}`}
                        </p>
                        <div className="flex items-center gap-1 justify-self-center">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                                <ChevronLeft className="h-3.5 w-3.5" /> Prev
                            </button>
                            <div className="flex items-center gap-1.5 mx-1">
                                {getPageButtons(page, totalPages).map((p, i) =>
                                    p === "..." ? (
                                        <span key={`e${i}`} className="px-1 text-slate-400 text-xs">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${page === p ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 border border-indigo-600" : "text-slate-600 hover:bg-slate-100"}`}>{p}</button>
                                    )
                                )}
                            </div>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                                Next <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {previewTask && <TaskPreviewModal task={previewTask} onClose={() => setPreviewTask(null)} />}
        </div>
    );
}

// ─── Column ──────────────────────────────────────────────────────────────────

// Color is used sparingly: the stage pill is the only saturated color in the
// column header; everything inside the cards stays grayscale so it doesn't
// compete with the stage badge or an SLA warning.
function stageColor(code) {
    if (code === "COMMISSION_INVOICING" || code === "APPROVED" || code === "BOOKING_CONFIRMED" || code === "PROCESS_COMPLETED") {
        return "bg-green-50 text-green-700 border-green-200";
    }
    if (code === "ARCHIVE" || code === "REJECTED") return "bg-red-50 text-red-700 border-red-200";
    if (code === "FUTURE_PROSPECT") return "bg-gray-100 text-gray-600 border-gray-200";
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function StageColumn({ stage, rows, totalInStage, slaWarningDays, slaBreachDays, onPreviewTask }) {
    const theme = STAGE_THEME[stage.code] || { border: "border-t-indigo-500" };

    return (
        <div className={`w-80 min-w-[320px] flex-shrink-0 flex flex-col bg-slate-50/60 backdrop-blur-md rounded-2xl border border-slate-200/50 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300/60 transition-all duration-300 border-t-4 ${theme.border}`}>
            {/* Column Header */}
            <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200/40 bg-white/95 backdrop-blur-md sticky top-0 z-10">
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border whitespace-nowrap shadow-sm ${stageColor(stage.code)}`}>
                    {stage.label}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/30">
                    {totalInStage}
                </span>
            </div>
            {/* Column Card Container with dynamic height limits */}
            <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1 min-h-[350px] max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {rows.map((row) => (
                    <LeadCard key={row.id} row={row} slaWarningDays={slaWarningDays} slaBreachDays={slaBreachDays} onPreviewTask={onPreviewTask} />
                ))}
                {rows.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/40 border border-dashed border-slate-200/60 rounded-2xl">
                        <div className="p-3 bg-white rounded-full shadow-sm border border-slate-100 mb-3 text-slate-400">
                            <Building2 className="h-6 w-6 stroke-[1.5]" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">{stage.label}</p>
                        <p className="text-[10px] text-slate-400 text-center mt-1 max-w-[180px]">No active leads are currently in this workflow stage.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────
function formatLastUpdated(date) {
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
}

function LeadCard({ row, slaWarningDays, slaBreachDays, onPreviewTask }) {
    const lead = row.lead || {};
    const sla = getSLAStatus(lead, slaWarningDays, slaBreachDays);
    const category = getCategoryFromScore(lead.score ?? 0);
    const task = lead.tasks?.[0];

    const categoryColors = {
        PREMIUM: "bg-purple-50 text-purple-700 border-purple-100/60 shadow-sm shadow-purple-50",
        HOT: "bg-rose-50 text-rose-700 border-rose-100/60 shadow-sm shadow-rose-50",
        WARM: "bg-amber-50 text-amber-700 border-amber-100/60 shadow-sm shadow-amber-50",
        COLD: "bg-blue-50 text-blue-700 border-blue-100/60 shadow-sm shadow-blue-50",
    };

    return (
        <Link
            to={`/leads/${lead.id}`}
            className={`group block bg-white rounded-2xl border transition-all duration-355 p-4 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-400/80 ${
                sla?.level === "breach" 
                    ? "border-red-200 bg-gradient-to-br from-white to-red-50/5 border-l-4 border-l-red-500" 
                    : sla?.level === "warning"
                    ? "border-amber-200 bg-gradient-to-br from-white to-amber-50/5 border-l-4 border-l-amber-500"
                    : "border-slate-200/75 border-l-4 border-l-indigo-400/30"
            }`}
        >
            {/* Row 1 — name + SLA badge */}
            <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-sm text-slate-800 truncate group-hover:text-indigo-650 transition-colors">
                    {lead.name}
                </span>
                {sla && (
                    <span className={`flex-shrink-0 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-sm ${
                        sla.level === "breach" 
                            ? "bg-red-100/80 text-red-700 border-red-200" 
                            : "bg-amber-100/80 text-amber-700 border-amber-200"
                    }`}>
                        {sla.days}d inactive
                    </span>
                )}
            </div>

            {/* Row 2 — contact (phone + email, both when available) */}
            <div className="mt-2.5 space-y-1.5">
                {lead.phone && (
                    <p className="flex items-center gap-2 text-xs text-slate-500 truncate font-semibold hover:text-slate-800 transition-colors">
                        <Phone className="h-3.5 w-3.5 text-slate-450 shrink-0" /> {lead.phone}
                    </p>
                )}
                {lead.email && (
                    <p className="flex items-center gap-2 text-xs text-slate-500 truncate font-semibold hover:text-slate-800 transition-colors">
                        <Mail className="h-3.5 w-3.5 text-slate-450 shrink-0" /> {lead.email}
                    </p>
                )}
            </div>

            {/* Row 3 — source + enquiry type */}
            {(lead.source || lead.enquiryType) && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {lead.source && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/40">
                            <Globe className="h-2.5 w-2.5 shrink-0 text-slate-400" /> {lead.source.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                    {lead.enquiryType && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50/70 text-indigo-750 border border-indigo-100/30">
                            <Tag className="h-2.5 w-2.5 shrink-0 text-indigo-400" /> {lead.enquiryType.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                </div>
            )}

            {/* Row 4 — last activity */}
            <div className="mt-3.5 flex items-center gap-1.5 text-[10px] text-slate-450 font-semibold">
                <Calendar className="h-3.5 w-3.5 text-slate-350" />
                <span>Active {formatLastUpdated(lead.updatedAt)}</span>
            </div>

            {/* Row 5 — footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3.5">
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-sm ${categoryColors[category] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {category} · {lead.score ?? 0}
                </span>
                {row.assignedEmployee ? (
                    <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 pl-1 pr-2.5 py-0.5 rounded-full shadow-sm max-w-[140px] transition-colors duration-200" title={row.assignedEmployee.name}>
                        <Avatar user={row.assignedEmployee} size="xs" className="w-5 h-5 ring-2 ring-white" />
                        <span className="text-[10px] text-slate-655 font-bold truncate">
                            {row.assignedEmployee.name.split(" ")[0]}
                        </span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-200/40 px-2.5 py-0.5 rounded-full shadow-sm" title="Unassigned">
                        Unassigned
                    </span>
                )}
            </div>

            {/* Row 6 — most recent task, click opens a read-only preview */}
            {task && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreviewTask(task); }}
                    className="mt-3 w-full flex items-center gap-2 text-[10px] text-left px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/40 hover:border-indigo-150/40 text-slate-600 hover:text-indigo-700 transition-all duration-200 font-bold"
                >
                    <ClipboardList className="h-3.5 w-3.5 shrink-0 text-slate-455 group-hover:text-indigo-400" />
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TASK_STATUS_DOT[task.status] || "bg-gray-400"}`} />
                    <span className="truncate flex-1 font-semibold">{task.title}</span>
                </button>
            )}
        </Link>
    );
}

// ─── Task preview popup ─────────────────────────────────────────────────────

function TaskPreviewModal({ task, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{task.title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0"><X className="h-4 w-4" /></button>
                </div>
                {task.description && <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{task.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[task.status] || "bg-gray-400"}`} />
                        {task.status?.replace(/_/g, " ") ?? "—"}
                    </span>
                    {task.priority && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {task.priority}
                        </span>
                    )}
                    {task.dueDate && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Due {fmtDate(task.dueDate)}
                        </span>
                    )}
                </div>
                <Link
                    to={`/tasks/${task.id}`}
                    className="mt-4 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                    Open full task →
                </Link>
            </div>
        </div>
    );
}
