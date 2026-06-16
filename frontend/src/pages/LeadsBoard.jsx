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

const PER_STAGE = 10;

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

    if (categories.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-500">
                No department workflow configured yet.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Category tabs */}
            <div className="flex flex-wrap items-center gap-2">
                {categories.map((d) => (
                    <button
                        key={d}
                        onClick={() => changeDepartment(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            department === d ? departmentStyle(d) : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                        {departmentLabel(d)}
                    </button>
                ))}
            </div>

            {stages.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-500">
                    <Building2 className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    {departmentLabel(department)} has no workflow configured yet.
                </div>
            ) : isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-400" /></div>
            ) : (
                <>
                    {/* Bounded height so this row's own scrollbar (horizontal AND vertical)
                        never falls below the screen — no need to scroll the page down just
                        to reach the horizontal scrollbar. Columns scroll vertically inside
                        this box together; the box itself never grows past the viewport. */}
                    <div
                        className={`flex gap-4 overflow-auto pb-2 transition-opacity duration-150 ${isFetching ? "opacity-60" : ""}`}
                        style={{ maxHeight: "calc(100vh - 280px)" }}
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

                    {/* Pagination — sticky to the bottom of the viewport (not the bottom of the
                        column content) so it's reachable without scrolling past every card.
                        `<main>` (AppLayout) is the scrolling ancestor, so sticky bottom-0 here
                        pins it to the visible screen edge for as long as the board is on screen. */}
                    <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-white border-t border-gray-200 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <p className="text-xs text-gray-400 truncate">
                            {total === 0 ? "0 leads" : `${total} lead${total === 1 ? "" : "s"} in ${departmentLabel(department)}`}
                        </p>
                        <div className="flex items-center gap-1 justify-self-center">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft className="h-4 w-4" /> Prev
                            </button>
                            <div className="flex items-center gap-1 mx-1">
                                {getPageButtons(page, totalPages).map((p, i) =>
                                    p === "..." ? (
                                        <span key={`e${i}`} className="px-1.5 text-gray-400 text-sm">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>
                                            {p}
                                        </button>
                                    )
                                )}
                            </div>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                Next <ChevronRight className="h-4 w-4" />
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
    return (
        <div className="min-w-[280px] w-[280px] flex-shrink-0">
            <div className="rounded-t-xl border border-b-0 border-gray-200 bg-white sticky top-0 px-3 py-2.5 flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${stageColor(stage.code)}`}>
                    {stage.label}
                </span>
                {/* Real total in this stage, not just this page's slice — so a column
                    showing 10 cards but "30" here tells you there's more on later pages. */}
                <span className="text-xs text-gray-400">{totalInStage}</span>
            </div>
            <div className="rounded-b-xl border border-gray-200 bg-gray-50/60 p-2 space-y-2">
                {rows.map((row) => (
                    <LeadCard key={row.id} row={row} slaWarningDays={slaWarningDays} slaBreachDays={slaBreachDays} onPreviewTask={onPreviewTask} />
                ))}
                {rows.length === 0 && (
                    <p className="text-center text-gray-300 text-[11px] py-6">No leads</p>
                )}
            </div>
        </div>
    );
}

// ─── Card ────────────────────────────────────────────────────────────────────

const TASK_STATUS_DOT = {
    PENDING: "bg-gray-400",
    IN_PROGRESS: "bg-blue-500",
    COMPLETED: "bg-green-500",
    CANCELLED: "bg-red-400",
};

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function LeadCard({ row, slaWarningDays, slaBreachDays, onPreviewTask }) {
    const lead = row.lead || {};
    const sla = getSLAStatus(lead, slaWarningDays, slaBreachDays);
    const category = getCategoryFromScore(lead.score ?? 0);
    const task = lead.tasks?.[0];

    return (
        <Link
            to={`/leads/${lead.id}`}
            className="group block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-3"
        >
            {/* Row 1 — name + SLA badge */}
            <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                    {lead.name}
                </span>
                {sla && (
                    <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        sla.level === "breach" ? "bg-red-100 text-red-600 border-red-200" : "bg-amber-100 text-amber-600 border-amber-200"
                    }`}>
                        {sla.days}d
                    </span>
                )}
            </div>

            {/* Row 2 — contact (phone + email, both when available) */}
            <div className="mt-1 space-y-0.5">
                {lead.phone && (
                    <p className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
                        <Phone className="h-3 w-3 shrink-0" /> {lead.phone}
                    </p>
                )}
                {lead.email && (
                    <p className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {lead.email}
                    </p>
                )}
            </div>

            {/* Row 3 — source + enquiry type */}
            {(lead.source || lead.enquiryType) && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {lead.source && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                            <Globe className="h-2.5 w-2.5" /> {lead.source.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                    {lead.enquiryType && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                            <Tag className="h-2.5 w-2.5" /> {lead.enquiryType.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                </div>
            )}

            {/* Row 4 — last activity */}
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
                <Calendar className="h-3 w-3" /> Active {fmtDate(lead.updatedAt)}
            </p>

            {/* Row 5 — footer */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {category} · {lead.score ?? 0}
                </span>
                <span className="text-[11px] text-gray-400 truncate max-w-[100px]" title={row.assignedEmployee?.name || "Unassigned"}>
                    {row.assignedEmployee?.name || "Unassigned"}
                </span>
            </div>

            {/* Row 6 — most recent task, click opens a read-only preview */}
            {task && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreviewTask(task); }}
                    className="mt-2 w-full flex items-center gap-1.5 text-[10px] text-left px-2 py-1.5 rounded-lg bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                    <ClipboardList className="h-3 w-3 shrink-0" />
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TASK_STATUS_DOT[task.status] || "bg-gray-400"}`} />
                    <span className="truncate flex-1">{task.title}</span>
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
