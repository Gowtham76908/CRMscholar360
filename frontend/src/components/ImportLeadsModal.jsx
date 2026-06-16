import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Upload, FileSpreadsheet, X, Users, UserX,
    ChevronRight, AlertCircle, CheckCircle2, Loader2, Plus,
} from "lucide-react";
import api from "../api/axios";
import { cn } from "../lib/utils";

const STEP_PICK    = "pick";
const STEP_MAP     = "map";
const STEP_ALLOC   = "alloc";
const STEP_CONFIRM = "confirm";
const STEP_RUNNING = "running";

const ALLOC_OPTIONS = [
    {
        id: "keep",
        icon: Users,
        title: "Keep from file",
        desc: 'Use the "Assigned To" column in the spreadsheet. Employees are matched by name or email.',
        color: "text-emerald-600",
        border: "border-emerald-200",
        bg: "bg-emerald-50",
    },
    {
        id: "unassigned",
        icon: UserX,
        title: "Import unassigned",
        desc: "Import all leads without assignment. You can distribute them manually later.",
        color: "text-gray-600",
        border: "border-gray-200",
        bg: "bg-gray-50",
    },
];

const STAGE_LABELS = {
    queued:    "Queued…",
    parsing:   "Parsing file…",
    deduping:  "Checking duplicates…",
    inserting: "Inserting leads…",
    assigning: "Assigning consultants…",
    complete:  "Done!",
    failed:    "Failed",
};

// CRM built-in fields available in the column mapper — mirrors SYSTEM_KEYS
const BUILTIN_FIELDS = [
    { value: "name",        label: "Lead Name" },
    { value: "phone",       label: "Phone" },
    { value: "email",       label: "Email" },
    { value: "company",     label: "Company" },
    { value: "source",      label: "Source" },
    { value: "enquiryType", label: "Enquiry Type" },
    { value: "biodata",     label: "Bio / Notes" },
    { value: "jobTitle",    label: "Job Title" },
    { value: "linkedinUrl", label: "LinkedIn URL" },
    { value: "assignedTo",  label: "Assigned To" },
];

// fieldKeys that are reserved by the system and can't be used for new custom fields
const RESERVED_FIELD_KEYS = new Set([
    "name", "phone", "email", "company", "source", "enquirytype",
    "biodata", "jobtitle", "linkedinurl", "category",
]);

function safeCFKey(name) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const rooted = /^[a-z]/.test(base) ? base : `f_${base}`;
    return RESERVED_FIELD_KEYS.has(rooted) ? `${rooted}_cf` : rooted;
}

// ── Column Map Row ────────────────────────────────────────────────────────────
function MapRow({ entry, customFields, onFieldChange, newName, onNewNameChange }) {
    const isNew      = entry.field === "new";
    const isMapped   = entry.field && entry.field !== "new";
    const isConflict = entry.conflict && isMapped;

    let badge = null;
    if (isNew) {
        badge = <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Will create</span>;
    } else if (!isMapped) {
        badge = <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Unmapped</span>;
    } else if (isConflict) {
        badge = <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Conflict</span>;
    } else if (entry.confidence === "exact") {
        badge = <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Auto-matched</span>;
    } else {
        badge = <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Detected</span>;
    }

    return (
        <div className={cn(
            "flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0",
            !isMapped && !isNew && "bg-orange-50/40",
            isConflict && "bg-amber-50/40",
        )}>
            {/* Column header + badge */}
            <div className="w-36 flex-shrink-0 pt-0.5">
                <p className="text-xs font-medium text-gray-800 truncate" title={entry.header}>{entry.header}</p>
                <div className="mt-1">{badge}</div>
            </div>

            {/* Selector */}
            <div className="flex-1 space-y-1.5">
                <select
                    value={entry.field ?? ""}
                    onChange={e => onFieldChange(entry.index, e.target.value || null)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                >
                    <option value="">— Skip this column</option>
                    <optgroup label="CRM Fields">
                        {BUILTIN_FIELDS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </optgroup>
                    {customFields?.length > 0 && (
                        <optgroup label="Custom Fields">
                            {customFields.map(cf => (
                                <option key={cf.id} value={`cf:${cf.fieldKey}`}>{cf.name}</option>
                            ))}
                        </optgroup>
                    )}
                    <optgroup label="Actions">
                        <option value="new">+ Create as new field</option>
                    </optgroup>
                </select>

                {isNew && (
                    <input
                        type="text"
                        placeholder={`Field name (default: "${entry.header}")`}
                        value={newName ?? ""}
                        onChange={e => onNewNameChange(entry.index, e.target.value)}
                        className="w-full text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-indigo-50/50 placeholder:text-gray-400 text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                )}
            </div>
        </div>
    );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ImportLeadsModal({ onClose }) {
    const queryClient = useQueryClient();
    const fileRef  = useRef(null);
    const pollRef  = useRef(null);

    const [step, setStep]               = useState(STEP_PICK);
    const [file, setFile]               = useState(null);
    const [preview, setPreview]         = useState(null);
    const [allocMode, setAllocMode]     = useState("keep");
    const [dragging, setDragging]       = useState(false);
    const [columnMap, setColumnMap]     = useState([]);       // [{ index, header, field, confidence, conflict }]
    const [newFieldNames, setNewFieldNames] = useState({});   // { colIndex: "custom field name" }
    const [creatingFields, setCreatingFields] = useState(false);
    const [job, setJob] = useState(null);

    useEffect(() => () => clearInterval(pollRef.current), []);

    function startPolling(jobId) {
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await api.get(`/leads/import/status/${jobId}`);
                setJob(data);
                if (data.status === "done") {
                    clearInterval(pollRef.current);
                    const parts = [`Imported ${data.imported ?? 0} lead${data.imported !== 1 ? "s" : ""}`];
                    if (data.duplicates > 0) parts.push(`${data.duplicates} duplicate${data.duplicates !== 1 ? "s" : ""} skipped`);
                    if (data.assigned > 0)   parts.push(`${data.assigned} auto-assigned`);
                    if (data.failed > 0)     parts.push(`${data.failed} failed`);
                    toast.success(parts.join(" · "), { duration: 6000 });
                    queryClient.invalidateQueries({ queryKey: ["leads"] });
                    onClose();
                } else if (data.status === "failed") {
                    clearInterval(pollRef.current);
                    toast.error(data.message || "Import failed");
                }
            } catch {
                // transient network hiccup — keep polling
            }
        }, 2000);
    }

    const previewMutation = useMutation({
        mutationFn: (f) => {
            const fd = new FormData();
            fd.append("file", f);
            return api.post("/leads/import/preview", fd).then(r => r.data);
        },
        onSuccess: (data) => {
            setPreview(data);
            setColumnMap((data.columnMappings || []).map(m => ({
                index:      m.index,
                header:     m.header,
                field:      m.field ?? null,
                confidence: m.confidence,
                conflict:   m.conflict,
            })));
            if (data.hasConflicts || data.hasUnmapped) {
                setStep(STEP_MAP);
            } else if (data.hasAssignmentColumn) {
                setStep(STEP_ALLOC);
            } else {
                setAllocMode("unassigned");
                setStep(STEP_CONFIRM);
            }
        },
        onError: (err) => toast.error(
            err.response?.data?.error?.message || err.response?.data?.message || "Failed to parse file"
        ),
    });

    const importMutation = useMutation({
        mutationFn: () => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("allocationMode", allocMode);
            fd.append("columnMap", JSON.stringify(
                columnMap.map(m => ({ index: m.index, field: m.field !== "new" ? m.field : null }))
            ));
            return api.post("/leads/import", fd).then(r => r.data);
        },
        onSuccess: (data) => {
            setJob({ jobId: data.jobId, status: "queued", stage: "queued", progress: 0, total: data.total });
            setStep(STEP_RUNNING);
            startPolling(data.jobId);
        },
        onError: (err) => toast.error(
            err.response?.data?.error?.message || err.response?.data?.message || "Import failed"
        ),
    });

    // Called when user confirms the column mapping
    async function handleConfirmMapping() {
        let finalMap = [...columnMap];
        const toCreate = finalMap.filter(m => m.field === "new");

        if (toCreate.length > 0) {
            setCreatingFields(true);
            for (const m of toCreate) {
                const fieldName = (newFieldNames[m.index] ?? m.header).trim() || m.header;
                const fieldKey  = safeCFKey(fieldName) || `field_${m.index}`;

                // Reuse existing custom field if one already has this key
                const existing = preview?.availableCustomFields?.find(cf => cf.fieldKey === fieldKey);
                if (existing) {
                    const idx = finalMap.findIndex(x => x.index === m.index);
                    if (idx >= 0) finalMap[idx] = { ...finalMap[idx], field: `cf:${existing.fieldKey}` };
                    continue;
                }

                try {
                    const resp    = await api.post("/custom-fields", { name: fieldName, fieldKey, type: "TEXT" });
                    const created = resp.data;
                    const idx     = finalMap.findIndex(x => x.index === m.index);
                    if (idx >= 0) finalMap[idx] = { ...finalMap[idx], field: `cf:${created.fieldKey}` };
                } catch (err) {
                    const msg = err.response?.data?.message || err.response?.data?.error?.message || `Could not create field "${fieldName}"`;
                    toast.error(msg);
                    setCreatingFields(false);
                    return;
                }
            }
            setColumnMap(finalMap);
            setCreatingFields(false);
        }

        const hasAssignment = finalMap.some(m => m.field === "assignedTo");
        if (hasAssignment) {
            setStep(STEP_ALLOC);
        } else {
            setAllocMode("unassigned");
            setStep(STEP_CONFIRM);
        }
    }

    function handleFieldChange(colIndex, newField) {
        setColumnMap(prev => prev.map(m => m.index === colIndex ? { ...m, field: newField } : m));
    }

    function handleNewNameChange(colIndex, name) {
        setNewFieldNames(prev => ({ ...prev, [colIndex]: name }));
    }

    function handleFile(f) {
        if (!f) return;
        const ok = /\.(csv|xlsx|xls)$/i.test(f.name);
        if (!ok) { toast.error("Only CSV and Excel (.xlsx/.xls) files are supported"); return; }
        setFile(f);
        previewMutation.mutate(f);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    }

    // Derive back destination from current flow
    function getBackStep() {
        if (step === STEP_CONFIRM) {
            if (columnMap.some(m => m.field === "assignedTo")) return STEP_ALLOC;
            if (preview?.hasConflicts || preview?.hasUnmapped)  return STEP_MAP;
        }
        if (step === STEP_ALLOC) {
            if (preview?.hasConflicts || preview?.hasUnmapped) return STEP_MAP;
        }
        return null;
    }

    // Progress helpers
    const progressPct  = job?.progress ?? 0;
    const stageLabel   = STAGE_LABELS[job?.stage] ?? "Working…";
    const isJobFailed  = job?.status === "failed";

    // Map step summary counts
    const unmappedCount  = columnMap.filter(m => !m.field).length;
    const newFieldCount  = columnMap.filter(m => m.field === "new").length;
    const conflictFields = [...new Set(
        columnMap.filter(m => m.conflict && m.field && m.field !== "new").map(m => m.field)
    )];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                        <h2 className="text-sm font-semibold text-gray-900">Import Leads</h2>
                        {preview && step !== STEP_RUNNING && (
                            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                {preview.totalRows} rows
                            </span>
                        )}
                        {step === STEP_MAP && (
                            <span className="text-[11px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                                Map columns
                            </span>
                        )}
                    </div>
                    {step !== STEP_RUNNING && (
                        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                    {/* ── Step: Pick file ─────────────────────────────────── */}
                    {step === STEP_PICK && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileRef.current?.click()}
                            className={cn(
                                "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 px-6 cursor-pointer transition-colors",
                                dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                            )}
                        >
                            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])} />
                            {previewMutation.isPending ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm text-gray-500">Parsing file…</p>
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 text-gray-300" />
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-700">Drop your file here or click to browse</p>
                                        <p className="text-xs text-gray-400 mt-1">Supports .csv, .xlsx, .xls — max 10 MB</p>
                                    </div>
                                    <div className="flex gap-2 text-[11px] text-gray-400">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">.csv</span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">.xlsx</span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">.xls</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* File picked banner (steps 2+, not running) */}
                    {step !== STEP_PICK && step !== STEP_RUNNING && file && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                            <FileSpreadsheet className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                            <span className="flex-1 truncate text-gray-700 font-medium">{file.name}</span>
                            <span className="text-xs text-gray-400">{preview?.totalRows} rows</span>
                        </div>
                    )}

                    {/* ── Step: Column mapping ──────────────────────────── */}
                    {step === STEP_MAP && (
                        <>
                            {/* Summary banner */}
                            {(unmappedCount > 0 || conflictFields.length > 0) && (
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                    <span>
                                        {unmappedCount > 0 && <><strong>{unmappedCount}</strong> column{unmappedCount > 1 ? "s" : ""} couldn't be auto-mapped.{" "}</>}
                                        {conflictFields.length > 0 && <><strong>{conflictFields.length}</strong> CRM field{conflictFields.length > 1 ? "s have" : " has"} multiple source columns.</>}
                                        {" "}Review the mapping below.
                                    </span>
                                </div>
                            )}

                            {/* Column header row */}
                            <div className="flex items-center gap-3 px-0 pb-1">
                                <p className="w-36 flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                    Import column
                                </p>
                                <p className="flex-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                    Maps to CRM field
                                </p>
                            </div>

                            {/* Mapping rows */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto px-3">
                                    {columnMap.map(entry => (
                                        <MapRow
                                            key={entry.index}
                                            entry={entry}
                                            customFields={preview?.availableCustomFields}
                                            onFieldChange={handleFieldChange}
                                            newName={newFieldNames[entry.index]}
                                            onNewNameChange={handleNewNameChange}
                                        />
                                    ))}
                                </div>
                            </div>

                            {newFieldCount > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                                    <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>
                                        <strong>{newFieldCount}</strong> new custom field{newFieldCount > 1 ? "s" : ""} will be created in your CRM before import.
                                    </span>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Step: Allocation choice ──────────────────────── */}
                    {step === STEP_ALLOC && (
                        <>
                            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                <span>Your file has an <strong>Assigned To</strong> column. How should we handle lead assignment?</span>
                            </div>
                            <div className="space-y-2">
                                {ALLOC_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setAllocMode(opt.id)}
                                        className={cn(
                                            "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                                            allocMode === opt.id
                                                ? `${opt.border} ${opt.bg}`
                                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                        )}
                                    >
                                        <div className={cn("mt-0.5 p-1.5 rounded-lg", allocMode === opt.id ? opt.bg : "bg-gray-100")}>
                                            <opt.icon className={cn("h-4 w-4", allocMode === opt.id ? opt.color : "text-gray-400")} />
                                        </div>
                                        <div>
                                            <p className={cn("text-sm font-semibold", allocMode === opt.id ? opt.color : "text-gray-700")}>{opt.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                                        </div>
                                        {allocMode === opt.id && (
                                            <CheckCircle2 className={cn("ml-auto h-4 w-4 flex-shrink-0 mt-0.5", opt.color)} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Step: Confirm ────────────────────────────────── */}
                    {step === STEP_CONFIRM && preview && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-indigo-700">{preview.totalRows}</p>
                                    <p className="text-xs text-indigo-500 font-medium mt-0.5">Rows to import</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                                    <p className="text-sm font-bold text-gray-700 capitalize">
                                        {allocMode === "keep" ? "From file" : "Unassigned"}
                                    </p>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Allocation mode</p>
                                </div>
                            </div>

                            {/* Confirmed mapping summary */}
                            {columnMap.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                        Column mapping
                                    </p>
                                    <div className="rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden max-h-36 overflow-y-auto">
                                        {columnMap.map(m => {
                                            const builtinLabel = BUILTIN_FIELDS.find(f => f.value === m.field)?.label;
                                            const cfLabel      = preview.availableCustomFields?.find(cf => `cf:${cf.fieldKey}` === m.field)?.name;
                                            const label        = builtinLabel || cfLabel || null;
                                            return (
                                                <div key={m.index} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                                    <span className="text-gray-600 truncate max-w-[160px]">{m.header}</span>
                                                    {label
                                                        ? <span className="text-indigo-600 font-medium">{label}</span>
                                                        : <span className="text-gray-300 italic">skipped</span>
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {preview.previewRows?.length > 0 && (() => {
                                const mappedCols = (preview.columnMappings ?? []).filter(m => m.field);
                                const getLabel = (field) => {
                                    const builtin = BUILTIN_FIELDS.find(f => f.value === field);
                                    if (builtin) return builtin.label;
                                    if (field.startsWith("cf:")) {
                                        const cf = preview.availableCustomFields?.find(c => c.fieldKey === field.slice(3));
                                        return cf?.name ?? field.slice(3);
                                    }
                                    return field;
                                };
                                return (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                            Preview (first {preview.previewRows.length} rows)
                                        </p>
                                        <div className="rounded-xl border border-gray-200 overflow-x-auto">
                                            <table className="text-xs whitespace-nowrap">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        {mappedCols.map(m => (
                                                            <th key={m.index} className="px-3 py-2 text-left font-semibold text-gray-500">{getLabel(m.field)}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {preview.previewRows.map((r, i) => (
                                                        <tr key={i} className="hover:bg-gray-50">
                                                            {mappedCols.map(m => (
                                                                <td key={m.index} className="px-3 py-1.5 text-gray-600 max-w-[140px] truncate">{r[m.header] || "—"}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                Duplicate phone numbers will be skipped automatically.
                            </div>
                        </>
                    )}

                    {/* ── Step: Running ────────────────────────────────── */}
                    {step === STEP_RUNNING && job && (
                        <div className="space-y-5 py-2">
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                                <FileSpreadsheet className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                                <span className="flex-1 truncate text-gray-700 font-medium">{file?.name}</span>
                                <span className="text-xs text-gray-400">{job.total} rows</span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className={cn("font-medium", isJobFailed ? "text-red-600" : "text-gray-600")}>
                                        {stageLabel}
                                    </span>
                                    <span className="text-gray-400 font-mono">{progressPct}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-700", isJobFailed ? "bg-red-400" : "bg-indigo-500")}
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>

                            {job.imported > 0 && (
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2">
                                        <p className="text-lg font-black text-indigo-700">{job.imported}</p>
                                        <p className="text-[10px] text-indigo-500 font-medium">Imported</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
                                        <p className="text-lg font-black text-amber-700">{job.duplicates}</p>
                                        <p className="text-[10px] text-amber-500 font-medium">Duplicates</p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                                        <p className="text-lg font-black text-gray-700">{job.failed}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">Failed rows</p>
                                    </div>
                                </div>
                            )}

                            {isJobFailed && job.message && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
                                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                    <span>{job.message}</span>
                                </div>
                            )}

                            {!isJobFailed && (
                                <div className="flex justify-center">
                                    <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                    {step === STEP_RUNNING ? (
                        isJobFailed ? (
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors">
                                Close
                            </button>
                        ) : (
                            <p className="text-xs text-gray-400">Please wait — import is running in the background…</p>
                        )
                    ) : (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors">
                                Cancel
                            </button>

                            <div className="flex items-center gap-2">
                                {/* Back button */}
                                {getBackStep() && (
                                    <button
                                        onClick={() => setStep(getBackStep())}
                                        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Back
                                    </button>
                                )}

                                {/* Map step: Confirm mapping */}
                                {step === STEP_MAP && (
                                    <button
                                        onClick={handleConfirmMapping}
                                        disabled={creatingFields}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        {creatingFields
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <ChevronRight className="h-3.5 w-3.5" />
                                        }
                                        {creatingFields
                                            ? "Creating fields…"
                                            : newFieldCount > 0
                                                ? `Create ${newFieldCount} field${newFieldCount > 1 ? "s" : ""} & Continue`
                                                : "Confirm Mapping"
                                        }
                                    </button>
                                )}

                                {/* Alloc step: Next */}
                                {step === STEP_ALLOC && (
                                    <button
                                        onClick={() => setStep(STEP_CONFIRM)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Next <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                )}

                                {/* Confirm step: Import */}
                                {step === STEP_CONFIRM && (
                                    <button
                                        onClick={() => importMutation.mutate()}
                                        disabled={importMutation.isPending}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                                    >
                                        {importMutation.isPending
                                            ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <Upload className="h-3.5 w-3.5" />
                                        }
                                        {importMutation.isPending ? "Starting…" : `Import ${preview.totalRows} leads`}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
