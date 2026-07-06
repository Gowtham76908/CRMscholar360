import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Building2, Loader2, Mail, Phone, Globe, Tag, Calendar,
    ClipboardList, X, ChevronDown, UserPlus, User, Users, Hash,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWorkflows, useDepartmentBoard, useDepartmentMembers } from "../hooks/useDepartments";
import { DEPARTMENT_ORDER, departmentLabel, departmentStyle } from "../lib/departments";
import { getCategoryFromScore, getSLAStatus } from "../utils/leadScore";
import api from "../api/axios";
import Avatar from "../components/Avatar";

// Show all leads in single page - set high limit
const PER_STAGE = 9999;

const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const getCountryFlag = (name) => {
    if (!name) return "";
    const clean = name.trim().toLowerCase();
    const map = {
        "united kingdom": "🇬🇧",
        "uk": "🇬🇧",
        "united states": "🇺🇸",
        "usa": "🇺🇸",
        "us": "🇺🇸",
        "canada": "🇨🇦",
        "australia": "🇦🇺",
        "ireland": "🇮🇪",
        "germany": "🇩🇪",
        "new zealand": "🇳🇿",
        "singapore": "🇸🇬",
        "france": "🇫🇷",
        "sweden": "🇸🇪",
        "netherlands": "🇳🇱",
        "italy": "🇮🇹",
        "spain": "🇪🇸",
        "switzerland": "🇨🇭",
        "united arab emirates": "🇦🇪",
        "uae": "🇦🇪",
        "malaysia": "🇲🇾",
        "japan": "🇯🇵",
        "south korea": "🇰🇷",
        "finland": "🇫🇮",
        "norway": "🇳🇴",
        "denmark": "🇩🇰",
        "india": "🇮🇳",
    };
    return map[clean] || "🌐";
};

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

/**
 * Leads Board — a read-only, category-scoped Kanban that displays all leads
 * in a single view per department (useDepartmentBoard → GET /lead-departments/board).
 *
 * Columns are that department's workflow stages; cards show all leads in each stage.
 * There is no drag-and-drop and no stage-mutation here on purpose —
 * moving a lead's stage happens from Lead Detail. Cards are plain links, except
 * the task preview chip which opens a read-only popup.
 */
export default function LeadsBoard({
    search = "",
    mine = false,
    initialDepartment,
    slaWarningDays = 3,
    slaBreachDays = 7,
    boardControlsExpanded = false,
    setBoardControlsExpanded,
    source,
    category,
    enquiryType,
    sla,
    startDate,
    endDate,
    score_min,
    score_max,
}) {
    const { user } = useAuth();
    const { getStages, hasWorkflow, isLoading: workflowsLoading } = useWorkflows();

    const categories = useMemo(
        () => DEPARTMENT_ORDER.filter((d) => hasWorkflow(d)),
        [hasWorkflow, workflowsLoading]
    );

    const [department, setDepartment] = useState(initialDepartment && categories.includes(initialDepartment) ? initialDepartment : null);
    const [previewTask, setPreviewTask] = useState(null);
    const [assigningLead, setAssigningLead] = useState(null);   // stores the full lead object
    const qc = useQueryClient();

    // Auto-initialize department when categories load
    if (!department && categories.length > 0) {
        const defaultDept = initialDepartment && categories.includes(initialDepartment) ? initialDepartment : categories[0];
        setDepartment(defaultDept);
    }

    // Changing tabs reloads data
    const changeDepartment = (d) => { setDepartment(d); };

    const filters = useMemo(() => {
        const f = {};
        if (search) f.search = search;
        if (mine && user?.id) f.assignedEmployeeId = user.id;
        if (source) f.source = source;
        if (category) f.category = category;
        if (enquiryType) f.enquiryType = enquiryType;
        if (sla) f.sla = sla;
        if (startDate) f.startDate = startDate;
        if (endDate) f.endDate = endDate;
        if (score_min) f.score_min = score_min;
        if (score_max) f.score_max = score_max;
        return f;
    }, [search, mine, user, source, category, enquiryType, sla, startDate, endDate, score_min, score_max]);

    const { data, isLoading, isFetching } = useDepartmentBoard(department, filters, 1, PER_STAGE);
    // Already split server-side, one entry per stage: { [stageCode]: { rows, total, totalPages } }.
    const columns = data?.columns || {};
    const total = data?.total ?? 0;

    const stages = department ? getStages(department) : [];

    // The board sits below variable-height page chrome (search, filter chips,
    // tabs that expand/collapse). Rather than guess a fixed offset, measure the
    // board's real distance from the top of the viewport and size it to fill
    // exactly to the bottom — so the horizontal slider is always reachable and
    // each column gets full height for its own vertical scroll.
    const boardRef = useRef(null);
    const [boardHeight, setBoardHeight] = useState(null);
    useLayoutEffect(() => {
        const el = boardRef.current;
        if (!el) return;
        const compute = () => {
            const top = el.getBoundingClientRect().top;
            setBoardHeight(Math.max(window.innerHeight - top - 16, 320));
        };
        compute();
        window.addEventListener("resize", compute);
        // Recompute after layout settles (fonts, images, async chrome).
        const raf = requestAnimationFrame(compute);
        return () => {
            window.removeEventListener("resize", compute);
            cancelAnimationFrame(raf);
        };
    }, [boardControlsExpanded, stages.length, isLoading, department]);

    if (workflowsLoading) {
        return <div className="py-20 text-center text-sm text-gray-400">Loading workflow…</div>;
    }

    return (
        <div className="space-y-4">
            {/* Category tabs & Toggle Controls Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2 bg-slate-100/85 backdrop-blur-md border border-slate-200/60 p-1.5 rounded-full w-fit shadow-inner">
                    {categories.map((d) => (
                        <button
                            key={d}
                            onClick={() => changeDepartment(d)}
                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 relative cursor-pointer ${
                                department === d 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200/50 scale-[1.03]" 
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                            }`}
                        >
                            {departmentLabel(d)}
                        </button>
                    ))}
                </div>

                {setBoardControlsExpanded && (
                    <button
                        onClick={() => setBoardControlsExpanded(!boardControlsExpanded)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-all shadow-sm text-xs font-bold cursor-pointer font-sans"
                        title={boardControlsExpanded ? "Hide filters & actions" : "Show filters & actions"}
                    >
                        {boardControlsExpanded ? "Hide Filters & Actions" : "Show Filters & Actions"}
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${boardControlsExpanded ? "rotate-180" : ""}`} />
                    </button>
                )}
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
                    {/* Board fills the viewport down to the bottom; each column's card
                        area scrolls internally so there's no dead gap below the board. */}
                    <div
                        ref={boardRef}
                        style={boardHeight ? { height: `${boardHeight}px` } : undefined}
                        className={`flex gap-5 overflow-x-auto pb-4 pt-2 items-stretch transition-opacity duration-150 select-none scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent ${boardHeight ? "" : "h-[calc(100vh-85px)]"} ${isFetching ? "opacity-60" : ""}`}
                    >
                        {stages.map((stage) => (
                            <StageColumn
                                key={stage.code}
                                stage={stage}
                                department={department}
                                rows={columns[stage.code]?.rows || []}
                                totalInStage={columns[stage.code]?.total ?? 0}
                                slaWarningDays={slaWarningDays}
                                slaBreachDays={slaBreachDays}
                                onPreviewTask={setPreviewTask}
                                onAssignClick={(lead) => setAssigningLead(lead)}
                            />
                        ))}
                    </div>
                </>
            )}

            {previewTask && <TaskPreviewModal task={previewTask} onClose={() => setPreviewTask(null)} />}
            {assigningLead && (
                <AssignAllDepartmentsModal
                    lead={assigningLead}
                    onClose={() => setAssigningLead(null)}
                    onDone={() => {
                        qc.invalidateQueries({ queryKey: ["department-board"] });
                    }}
                />
            )}
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

function StageColumn({ stage, department, rows, totalInStage, slaWarningDays, slaBreachDays, onPreviewTask, onAssignClick }) {
    const theme = STAGE_THEME[stage.code] || { border: "border-t-indigo-500" };

    return (
        <div className={`w-[390px] min-w-[390px] flex-shrink-0 flex flex-col bg-slate-50/60 backdrop-blur-md rounded-2xl border border-slate-200/50 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300/60 transition-all duration-300 border-t-4 ${theme.border} h-full`}>
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
            <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {rows.map((row) => (
                    <LeadCard key={row.id} row={row} department={department} slaWarningDays={slaWarningDays} slaBreachDays={slaBreachDays} onPreviewTask={onPreviewTask} onAssignClick={onAssignClick} />
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

function LeadCard({ row, department, slaWarningDays, slaBreachDays, onPreviewTask, onAssignClick }) {
    const { user } = useAuth();
    const isManager = ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"].includes(user?.role);
    const [showDeptAssignees, setShowDeptAssignees] = useState(false);
    const lead = row.lead || {};
    const sla = getSLAStatus(lead, slaWarningDays, slaBreachDays);
    const category = getCategoryFromScore(lead.score ?? 0);
    const task = lead.tasks?.[0];

    const destinationCountriesStr = lead.customFields?.destinationCountries || "";
    const countries = destinationCountriesStr ? destinationCountriesStr.split(", ") : [];
    const flags = countries.map(getCountryFlag).filter(Boolean);

    const categoryColors = {
        PREMIUM: "bg-purple-50 text-purple-700 border-purple-100/60 shadow-sm shadow-purple-50",
        HOT: "bg-rose-50 text-rose-700 border-rose-100/60 shadow-sm shadow-rose-50",
        WARM: "bg-amber-50 text-amber-700 border-amber-100/60 shadow-sm shadow-amber-50",
        COLD: "bg-blue-50 text-blue-700 border-blue-100/60 shadow-sm shadow-blue-50",
    };

    return (
        <Link
            to={`/leads/${lead.id}`}
            className={`group block bg-white rounded-xl border transition-all duration-300 p-3.5 relative overflow-visible shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-400/80 ${
                sla?.level === "breach" 
                    ? "border-red-200 bg-gradient-to-br from-white to-red-50/5 border-l-[4px] border-l-red-500" 
                    : sla?.level === "warning"
                    ? "border-amber-200 bg-gradient-to-br from-white to-amber-50/5 border-l-[4px] border-l-amber-500"
                    : "border-slate-200/75 border-l-[4px] border-l-indigo-400/30"
            }`}
        >
            {/* Row 1 — name + SLA badge */}
            <div className="flex items-start justify-between gap-2.5">
                <span className="font-extrabold text-sm text-slate-800 truncate group-hover:text-indigo-650 transition-colors min-w-0">
                    {lead.name}
                </span>
                {sla && (
                    <span className={`flex-shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${
                        sla.level === "breach" 
                            ? "bg-red-100/80 text-red-700 border-red-200" 
                            : "bg-amber-100/80 text-amber-700 border-amber-200"
                    }`}>
                        {sla.days}d inactive
                    </span>
                )}
            </div>

            {/* Lead ID pill */}
            {lead.leadId && (
                <span
                    onClick={(e) => e.preventDefault()}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-tight text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md pl-1 pr-1.5 py-0.5 select-all group-hover:bg-indigo-100/70 group-hover:border-indigo-200 transition-colors"
                >
                    <Hash className="h-2.5 w-2.5 text-indigo-400" />
                    {lead.leadId}
                </span>
            )}

            {/* Row 2 — contact (phone + email, both when available) */}
            <div className="mt-2.5 space-y-1">
                {lead.phone && (
                    <p className="flex items-center gap-2 text-xs text-slate-500 truncate font-semibold hover:text-slate-800 transition-colors">
                        <Phone className="h-3.5 w-3.5 text-slate-455 shrink-0" /> {lead.phone}
                    </p>
                )}
                {lead.email && (
                    <p className="flex items-center gap-2 text-xs text-slate-500 truncate font-semibold hover:text-slate-800 transition-colors">
                        <Mail className="h-3.5 w-3.5 text-slate-455 shrink-0" /> {lead.email}
                    </p>
                )}
            </div>

            {/* Row 3 — source + enquiry type */}
            {(lead.source || lead.enquiryType) && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {lead.source && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/40">
                            <Globe className="h-3 w-3 shrink-0 text-slate-400" /> {lead.source.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                    {lead.enquiryType && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50/70 text-indigo-750 border border-indigo-100/30">
                            <Tag className="h-3 w-3 shrink-0 text-indigo-400" /> {lead.enquiryType.toLowerCase().replace(/_/g, " ")}
                        </span>
                    )}
                </div>
            )}

            {/* Row 4 — last activity */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                <Calendar className="h-3.5 w-3.5 text-slate-355" />
                <span>Active {formatLastUpdated(lead.updatedAt)}</span>
            </div>

            {/* Expanded Department Assignees list (triggered by clicking the avatar/assignee badge) */}
            {showDeptAssignees && (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 animate-fadeIn">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department Assignees</p>
                    {(lead.leadDepartments || []).map(ld => {
                        const dotColor = 
                            ld.department === "SALES" ? "bg-indigo-500" :
                            ld.department === "APPLICATION_VISA" ? "bg-sky-500" :
                            ld.department === "LOAN" ? "bg-emerald-500" :
                            ld.department === "ACCOMMODATION_TICKETS" ? "bg-amber-500" :
                            ld.department === "FOREX" ? "bg-violet-500" :
                            "bg-slate-400";
                        return (
                            <div key={ld.id} className="flex items-center justify-between text-xs font-semibold py-1 border-b border-slate-50 last:border-0">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                                    <span className="text-slate-500">{departmentLabel(ld.department)}:</span>
                                </div>
                                <span className="text-slate-800 truncate pl-2 max-w-[130px]">
                                    {ld.assignedEmployee?.name || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                                </span>
                            </div>
                        );
                    })}
                    {isManager && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDeptAssignees(false);
                                onAssignClick(lead);
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            Update Assignee
                        </button>
                    )}
                </div>
            )}

            {/* Row 5 — footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-3">
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${categoryColors[category] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {category} · {lead.score ?? 0}
                </span>

                {/* Country flags stack in the middle */}
                {countries.length > 0 && (
                    <div className="flex items-center -space-x-1 hover:-space-x-0.5 transition-all duration-200">
                        {countries.map((c, i) => (
                            <span 
                                key={i} 
                                className="group/flag relative w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xs shadow-xs select-none hover:scale-110 hover:z-10 transition-all duration-200 cursor-help"
                            >
                                {getCountryFlag(c)}
                                {/* Custom Tooltip */}
                                <span className="pointer-events-none absolute bottom-full mb-2 hidden group-hover/flag:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50 animate-fadeIn">
                                    {c}
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                <div className="relative">
                    {row.assignedEmployee ? (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDeptAssignees(!showDeptAssignees);
                            }}
                            className={`flex items-center gap-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200/50 pl-1 pr-2.5 py-1 rounded-full shadow-sm max-w-[150px] transition-all duration-200 hover:border-indigo-300 ring-offset-2 focus:outline-none ${showDeptAssignees ? "ring-2 ring-indigo-400 bg-indigo-50/50 border-indigo-300" : ""}`}
                            title="Click to view all department assignees"
                        >
                            <Avatar user={row.assignedEmployee} size="xs" className="w-5 h-5 ring-2 ring-white" />
                            <span className="text-xs text-slate-655 font-bold truncate">
                                {row.assignedEmployee.name.split(" ")[0]}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDeptAssignees(!showDeptAssignees);
                            }}
                            className={`text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-200/40 px-2 py-0.5 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-350 transition-all focus:outline-none ${showDeptAssignees ? "ring-2 ring-indigo-400 bg-indigo-50 border-indigo-300" : ""}`}
                            title="Click to view all department assignees"
                        >
                            Unassigned
                        </button>
                    )}
                </div>
            </div>

            {/* Row 6 — most recent task, click opens a read-only preview */}
            {task && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreviewTask(task); }}
                    className="mt-2.5 w-full flex items-center gap-2 text-[10px] text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/40 hover:border-indigo-150/40 text-slate-600 hover:text-indigo-700 transition-all duration-200 font-bold"
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

// ─── Multi-department Assign Modal ─────────────────────────────────────────
// Shows ALL departments for a lead and lets the manager assign a consultant per department.

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

// Each department section shows the current assignee and lets the manager pick a new one.
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
            {/* Department header row */}
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

            {/* Expandable member list */}
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
