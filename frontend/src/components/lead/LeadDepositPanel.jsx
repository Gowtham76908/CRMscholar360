import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Wallet, Pencil, X, Loader2, CreditCard, CalendarDays, History, Plus,
    FileText, Eye, Upload, Trash2, ChevronDown, Building2,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { fileUrl } from "../../utils/fileUrl";
import { cn } from "../../lib/utils";

const BUILT_IN_MODES = ["Bank Transfer", "Credit Card", "Debit Card", "UPI", "Cash", "Cheque"];
const CUSTOM_SENTINEL = "__custom__";
const UNSPECIFIED = "Unspecified";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// Receipt is a document named per college so each college keeps its own PDF.
const receiptNameFor = (college) =>
    college && college !== UNSPECIFIED ? `Deposit Receipt — ${college}` : "Deposit Receipt";

const emptyDraft = { deposit_college: "", deposit_amount: "", payment_mode: "", payment_date: "" };

export default function LeadDepositPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const cf = lead?.customFields || {};

    const history = Array.isArray(cf.deposit_history) ? cf.deposit_history : [];
    const docs = Array.isArray(cf.documents) ? cf.documents : [];
    const shortlist = Array.isArray(cf.shortlisted_universities) ? cf.shortlisted_universities : [];
    const hasLegacyTop = !!(cf.deposit_amount || cf.payment_mode || cf.payment_date);

    // Build per-college groups from the (newest-first) history. Legacy entries with
    // no college fall under the old top-level college, else "Unspecified".
    const groupsMap = new Map();
    history.forEach(h => {
        const key = h.deposit_college || cf.deposit_college || UNSPECIFIED;
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key).push(h);
    });
    // Legacy: a top-level deposit with no history at all → synthesize one entry.
    if (history.length === 0 && hasLegacyTop) {
        groupsMap.set(cf.deposit_college || UNSPECIFIED, [{
            deposit_amount: cf.deposit_amount || "",
            payment_mode: cf.payment_mode || "",
            payment_date: cf.payment_date || "",
            recordedAt: null,
        }]);
    }
    const collegeGroups = [...groupsMap.entries()];
    const hasAnyDeposit = collegeGroups.length > 0;

    const receiptFor = (college) => {
        const primary = docs.find(d => d.name?.toLowerCase() === receiptNameFor(college).toLowerCase());
        if (primary) return primary;
        // Legacy single "Deposit Receipt" belongs to the unspecified/top-level college.
        if (college === (cf.deposit_college || UNSPECIFIED)) {
            return docs.find(d => d.name?.toLowerCase() === "deposit receipt");
        }
        return undefined;
    };

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);
    const [customMode, setCustomMode] = useState("");
    const [expanded, setExpanded] = useState(new Set());
    const receiptInputRef = useRef(null);
    const uploadCollegeRef = useRef(null);
    const [uploadingCollege, setUploadingCollege] = useState(null); // college currently uploading/removing

    const saveMut = useMutation({
        mutationFn: (fields) => api.patch(`/leads/${leadId}/custom-fields`, { fields }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Deposit details updated");
            setOpen(false);
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update deposit details"),
    });

    // As a standalone card, only surface once a deposit exists. When embedded in the
    // Activity tabs, always render so the user can add one. (After all hooks.)
    if (!embedded && !hasAnyDeposit) return null;

    const openAdd = (college = "") => {
        setDraft({ ...emptyDraft, deposit_college: college });
        setCustomMode("");
        setOpen(true);
    };

    const effectiveMode = draft.payment_mode === CUSTOM_SENTINEL ? customMode.trim() : (draft.payment_mode || "");

    const handleSave = () => {
        if (!draft.deposit_college) { toast.warning("Please select the college this deposit is for"); return; }
        if (!draft.deposit_amount?.trim()) { toast.warning("Please enter the deposit amount"); return; }
        const entry = {
            deposit_college: draft.deposit_college,
            deposit_amount: draft.deposit_amount || "",
            payment_mode: effectiveMode,
            payment_date: draft.payment_date || "",
            recordedAt: new Date().toISOString(),
            recordedBy: user?.name || "",
        };
        saveMut.mutate({
            // Top-level mirrors the latest deposit overall (backward compatibility).
            deposit_amount: draft.deposit_amount || "",
            payment_mode: effectiveMode,
            payment_date: draft.payment_date || "",
            deposit_college: draft.deposit_college,
            deposit_history: [entry, ...history],
        });
    };

    // ── Per-college receipt upload / remove ──────────────────────────────────
    const triggerReceiptUpload = (college) => { uploadCollegeRef.current = college; receiptInputRef.current?.click(); };

    const handleReceiptFile = async (file) => {
        const college = uploadCollegeRef.current;
        if (!file || !college) return;
        if (file.type !== "application/pdf") { toast.error("Please upload a PDF file"); return; }
        if (file.size > 10 * 1024 * 1024) { toast.error("File size exceeds 10MB limit"); return; }
        const formData = new FormData();
        formData.append("document", file);
        formData.append("documentName", receiptNameFor(college));
        setUploadingCollege(college);
        try {
            await api.post(`/upload/document/${leadId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Deposit receipt uploaded");
        } catch (err) {
            toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to upload receipt");
        } finally {
            setUploadingCollege(null);
        }
    };

    const handleReceiptDelete = async (college) => {
        const doc = receiptFor(college);
        if (!doc) return;
        const nextDocs = docs.filter(d => d.name?.toLowerCase() !== doc.name?.toLowerCase());
        setUploadingCollege(college);
        try {
            await api.patch(`/leads/${leadId}/custom-fields`, { fields: { documents: nextDocs } });
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            toast.success("Deposit receipt removed");
        } catch (err) {
            toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to remove receipt");
        } finally {
            setUploadingCollege(null);
        }
    };

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    // College options for the modal: shortlisted universities + any colleges that
    // already have deposits, de-duplicated.
    const collegeOptions = [...new Set([
        ...shortlist.map(u => u.univ_name).filter(Boolean),
        ...collegeGroups.map(([c]) => c).filter(c => c && c !== UNSPECIFIED),
    ])];

    const AddButton = (
        <button onClick={() => openAdd()} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Deposit
        </button>
    );

    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            {/* Heading */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    <h2 className="text-sm font-bold text-gray-800">Deposit</h2>
                    {collegeGroups.length > 0 && (
                        <span className="text-xs text-gray-400 font-medium">· {collegeGroups.length} college{collegeGroups.length === 1 ? "" : "s"}</span>
                    )}
                </div>
                {AddButton}
            </div>

            {/* Hidden receipt file input (shared; target college tracked in a ref) */}
            <input type="file" ref={receiptInputRef} accept="application/pdf" className="hidden"
                onChange={e => { handleReceiptFile(e.target.files?.[0]); e.target.value = ""; }} />

            <div className="px-5 py-4 space-y-3">
                {!hasAnyDeposit && (
                    <p className="text-xs text-slate-400">No deposit recorded yet.</p>
                )}

                {collegeGroups.map(([college, entries]) => {
                    const latest = entries[0];
                    const receipt = receiptFor(college);
                    const busy = uploadingCollege === college;
                    const isOpen = expanded.has(college);
                    return (
                        <div key={college} className="rounded-2xl border border-slate-200 overflow-hidden">
                            {/* College header */}
                            <div className="px-4 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                    <span className="text-xs font-extrabold text-indigo-700 truncate">{college}</span>
                                    <span className="text-[10px] font-bold text-indigo-400 bg-white/70 border border-indigo-100 rounded-full px-1.5 py-0.5 shrink-0">
                                        {entries.length}
                                    </span>
                                </div>
                                <button onClick={() => openAdd(college === UNSPECIFIED ? "" : college)}
                                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                    <Plus className="h-3 w-3" /> Add
                                </button>
                            </div>

                            {/* Latest deposit for this college */}
                            <div className="px-4 py-3 grid grid-cols-3 gap-3">
                                <div>
                                    <p className={labelCls}>Amount</p>
                                    <p className="text-sm font-bold text-slate-800 break-words">{latest.deposit_amount || "—"}</p>
                                </div>
                                <div>
                                    <p className={labelCls}>Mode</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                        <CreditCard className="h-3.5 w-3.5 text-slate-400" /> {latest.payment_mode || "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className={labelCls}>Date</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(latest.payment_date)}
                                    </p>
                                </div>
                            </div>

                            {/* This college's receipt */}
                            <div className="px-4 pb-3">
                                {receipt?.url ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                                        <div className="h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                                            <FileText className="h-3.5 w-3.5 text-rose-500" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 truncate flex-1">{receipt.fileName || "Deposit Receipt.pdf"}</span>
                                        <a href={fileUrl(receipt.url)} target="_blank" rel="noreferrer" title="View receipt"
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                            <Eye className="h-3.5 w-3.5" />
                                        </a>
                                        <button type="button" onClick={() => triggerReceiptUpload(college)} disabled={busy} title="Replace"
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                        </button>
                                        <button type="button" onClick={() => handleReceiptDelete(college)} disabled={busy} title="Remove"
                                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => triggerReceiptUpload(college)} disabled={busy || college === UNSPECIFIED}
                                        title={college === UNSPECIFIED ? "Assign a college first" : "Attach receipt"}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-500 border border-dashed border-slate-300 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors disabled:opacity-50">
                                        {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</> : <><Upload className="h-3.5 w-3.5" /> Attach PDF receipt</>}
                                    </button>
                                )}
                            </div>

                            {/* Collapsible history for this college */}
                            {entries.length > 1 && (
                                <div className="border-t border-slate-100">
                                    <button onClick={() => setExpanded(prev => {
                                        const n = new Set(prev);
                                        n.has(college) ? n.delete(college) : n.add(college);
                                        return n;
                                    })}
                                        className="w-full px-4 py-2 flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wide hover:bg-slate-50 transition-colors">
                                        <History className="h-3 w-3" /> History ({entries.length - 1} earlier)
                                        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", isOpen && "rotate-180")} />
                                    </button>
                                    {isOpen && (
                                        <ul className="px-4 pb-3 space-y-2">
                                            {entries.slice(1).map((h, i) => (
                                                <li key={i} className="flex items-start gap-2 text-[11px]">
                                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-700">
                                                            {h.deposit_amount || "—"} · {h.payment_mode || "—"} · {fmtDate(h.payment_date)}
                                                        </p>
                                                        <p className="text-slate-400">
                                                            {fmtDateTime(h.recordedAt)}{h.recordedBy ? ` · ${h.recordedBy}` : ""}
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Add-deposit modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-emerald-500" />
                                <h3 className="text-sm font-bold text-slate-800">Add Deposit</h3>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* College selector */}
                            <div className="space-y-1">
                                <label className={labelCls}>College / University</label>
                                {collegeOptions.length > 0 ? (
                                    <select className={inputCls} value={draft.deposit_college || ""} onChange={e => setDraft(d => ({ ...d, deposit_college: e.target.value }))}>
                                        <option value="">— Select College —</option>
                                        {collegeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                ) : (
                                    <input className={inputCls} placeholder="College / University name" value={draft.deposit_college || ""} onChange={e => setDraft(d => ({ ...d, deposit_college: e.target.value }))} />
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className={labelCls}>Deposit Amount</label>
                                <input className={inputCls} placeholder="e.g. $5,000 CAD / £3,000" value={draft.deposit_amount || ""} onChange={e => setDraft(d => ({ ...d, deposit_amount: e.target.value }))} />
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelCls}>Mode of Payment</label>
                                <select
                                    className={inputCls}
                                    value={BUILT_IN_MODES.includes(draft.payment_mode) ? draft.payment_mode : (draft.payment_mode ? CUSTOM_SENTINEL : "")}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === CUSTOM_SENTINEL) setDraft(d => ({ ...d, payment_mode: CUSTOM_SENTINEL }));
                                        else { setCustomMode(""); setDraft(d => ({ ...d, payment_mode: val })); }
                                    }}
                                >
                                    <option value="">— Select —</option>
                                    {BUILT_IN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                    <option value={CUSTOM_SENTINEL}>➕ Add Custom...</option>
                                </select>
                                {(draft.payment_mode === CUSTOM_SENTINEL || (!BUILT_IN_MODES.includes(draft.payment_mode) && draft.payment_mode)) && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Plus className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                        <input autoFocus className={inputCls} placeholder="Type custom payment mode..." value={customMode} onChange={e => setCustomMode(e.target.value)} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className={labelCls}>Date of Payment</label>
                                <input type="date" className={inputCls} value={draft.payment_date || ""} onChange={e => setDraft(d => ({ ...d, payment_date: e.target.value }))} />
                            </div>

                            <p className="text-[10px] text-slate-400">Attach the receipt PDF from the college card after saving.</p>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button onClick={() => setOpen(false)} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                            <button onClick={handleSave} disabled={saveMut.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
