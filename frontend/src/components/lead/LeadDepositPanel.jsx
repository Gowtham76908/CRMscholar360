import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Wallet, Pencil, X, Loader2, CreditCard, CalendarDays, History, Plus,
    FileText, Eye, Upload, Trash2,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { fileUrl } from "../../utils/fileUrl";

const RECEIPT_DOC_NAME = "Deposit Receipt";

const BUILT_IN_MODES = ["Bank Transfer", "Credit Card", "Debit Card", "UPI", "Cash", "Cheque"];
const CUSTOM_SENTINEL = "__custom__";


const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function LeadDepositPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const cf = lead?.customFields || {};

    const current = {
        deposit_amount: cf.deposit_amount || "",
        payment_mode: cf.payment_mode || "",
        payment_date: cf.payment_date || "",
        deposit_college: cf.deposit_college || "",
    };
    const history = Array.isArray(cf.deposit_history) ? cf.deposit_history : [];
    const hasDeposit = !!(current.deposit_amount || current.payment_mode || current.payment_date);

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(current);

    // Deposit receipt — stored as a document named "Deposit Receipt" in
    // customFields.documents (same store & signing as the Documents section).
    const receiptDoc = (Array.isArray(cf.documents) ? cf.documents : [])
        .find(d => d.name?.toLowerCase() === RECEIPT_DOC_NAME.toLowerCase());
    const receiptInputRef = useRef(null);
    const [uploadingReceipt, setUploadingReceipt] = useState(false);

    const handleReceiptUpload = async (file) => {
        if (!file) return;
        if (file.type !== "application/pdf") { toast.error("Please upload a PDF file"); return; }
        if (file.size > 10 * 1024 * 1024) { toast.error("File size exceeds 10MB limit"); return; }
        const formData = new FormData();
        formData.append("document", file);
        formData.append("documentName", RECEIPT_DOC_NAME);
        setUploadingReceipt(true);
        try {
            await api.post(`/upload/document/${leadId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Deposit receipt uploaded");
        } catch (err) {
            toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to upload receipt");
        } finally {
            setUploadingReceipt(false);
        }
    };

    const handleReceiptDelete = async () => {
        const nextDocs = (cf.documents || []).filter(d => d.name?.toLowerCase() !== RECEIPT_DOC_NAME.toLowerCase());
        setUploadingReceipt(true);
        try {
            await api.patch(`/leads/${leadId}/custom-fields`, { fields: { documents: nextDocs } });
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            toast.success("Deposit receipt removed");
        } catch (err) {
            toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to remove receipt");
        } finally {
            setUploadingReceipt(false);
        }
    };
    // If the stored payment_mode is not a built-in, track the custom value separately
    const [customMode, setCustomMode] = useState(() => {
        const stored = current.payment_mode || "";
        return BUILT_IN_MODES.includes(stored) ? "" : stored;
    });

    // As a standalone card, only surface once a deposit exists. When embedded in the
    // Activity tabs, always render so the user can add one.
    if (!embedded && !hasDeposit && history.length === 0) return null;

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

    const openEdit = () => {
        setDraft(current);
        // Pre-populate custom mode input if the stored value isn't built-in
        const stored = current.payment_mode || "";
        setCustomMode(BUILT_IN_MODES.includes(stored) ? "" : stored);
        setOpen(true);
    };

    // The "effective" payment mode: if user picked the custom sentinel, use customMode text
    const effectiveMode = (draft.payment_mode === CUSTOM_SENTINEL)
        ? customMode.trim()
        : (draft.payment_mode || "");

    const handleSave = () => {
        // Append the new values as a history entry (most recent first).
        const entry = {
            deposit_amount: draft.deposit_amount || "",
            payment_mode: effectiveMode,
            payment_date: draft.payment_date || "",
            recordedAt: new Date().toISOString(),
            recordedBy: user?.name || "",
        };
        saveMut.mutate({
            deposit_amount: draft.deposit_amount || "",
            payment_mode: effectiveMode,
            payment_date: draft.payment_date || "",
            deposit_history: [entry, ...history],
        });
    };

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";


    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            {/* Heading */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    <h2 className="text-sm font-bold text-gray-800">Deposit</h2>
                </div>
                <button onClick={openEdit} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> {hasDeposit ? "Edit" : "Add"}
                </button>
            </div>

            <div className="px-5 py-4">
                {hasDeposit ? (
                    <div className="space-y-3">
                        {/* College badge if set */}
                        {current.deposit_college && (
                            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wide">College</span>
                                <span className="ml-1 text-xs font-bold text-indigo-700 truncate">{current.deposit_college}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className={labelCls}>Amount</p>
                                <p className="text-sm font-bold text-slate-800 break-words">{current.deposit_amount || "—"}</p>
                            </div>
                            <div>
                                <p className={labelCls}>Mode</p>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                    <CreditCard className="h-3.5 w-3.5 text-slate-400" /> {current.payment_mode || "—"}
                                </p>
                            </div>
                            <div>
                                <p className={labelCls}>Date</p>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(current.payment_date)}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400">No deposit recorded yet.</p>
                )}

                {/* Deposit receipt link */}
                {receiptDoc?.url && (
                    <a
                        href={fileUrl(receiptDoc.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 border border-indigo-100 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                        <FileText className="h-3.5 w-3.5" /> View Deposit Receipt <Eye className="h-3.5 w-3.5" />
                    </a>
                )}

                {/* History */}
                {history.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                            <History className="h-3 w-3" /> History
                        </p>
                        <ul className="space-y-2">
                            {history.map((h, i) => (
                                <li key={i} className="flex items-start gap-2 text-[11px]">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-700">
                                            {h.deposit_amount || "—"} · {h.payment_mode || "—"} · {fmtDate(h.payment_date)}
                                            {h.deposit_college && (
                                                <span className="ml-1 text-indigo-500">· {h.deposit_college}</span>
                                            )}
                                        </p>
                                        <p className="text-slate-400">
                                            {fmtDateTime(h.recordedAt)}{h.recordedBy ? ` · ${h.recordedBy}` : ""}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Edit modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-emerald-500" />
                                <h3 className="text-sm font-bold text-slate-800">Deposit Details</h3>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className={labelCls}>Deposit Amount</label>
                                <input className={inputCls} placeholder="e.g. $5,000 CAD / £3,000" value={draft.deposit_amount || ""} onChange={e => setDraft(d => ({ ...d, deposit_amount: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelCls}>Mode of Payment</label>
                                <select
                                    className={inputCls}
                                    value={
                                        // If current draft mode is not built-in, show the sentinel
                                        BUILT_IN_MODES.includes(draft.payment_mode)
                                            ? draft.payment_mode
                                            : draft.payment_mode
                                                ? CUSTOM_SENTINEL
                                                : ""
                                    }
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === CUSTOM_SENTINEL) {
                                            setDraft(d => ({ ...d, payment_mode: CUSTOM_SENTINEL }));
                                        } else {
                                            setCustomMode("");
                                            setDraft(d => ({ ...d, payment_mode: val }));
                                        }
                                    }}
                                >
                                    <option value="">— Select —</option>
                                    {BUILT_IN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                    <option value={CUSTOM_SENTINEL}>➕ Add Custom...</option>
                                </select>

                                {/* Custom mode input — only visible when "Add Custom..." is selected */}
                                {(draft.payment_mode === CUSTOM_SENTINEL || (!BUILT_IN_MODES.includes(draft.payment_mode) && draft.payment_mode)) && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Plus className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                        <input
                                            autoFocus
                                            className={inputCls}
                                            placeholder="Type custom payment mode..."
                                            value={customMode}
                                            onChange={e => setCustomMode(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Date of Payment</label>
                                <input type="date" className={inputCls} value={draft.payment_date || ""} onChange={e => setDraft(d => ({ ...d, payment_date: e.target.value }))} />
                            </div>

                            {/* Deposit Receipt — PDF attachment */}
                            <div className="space-y-1.5">
                                <label className={labelCls}>Deposit Receipt <span className="text-slate-400 font-medium normal-case">(PDF)</span></label>
                                <input
                                    type="file"
                                    ref={receiptInputRef}
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={e => { handleReceiptUpload(e.target.files?.[0]); e.target.value = ""; }}
                                />
                                {receiptDoc?.url ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                                        <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-rose-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-700 truncate">{receiptDoc.fileName || "Deposit Receipt.pdf"}</p>
                                            {receiptDoc.uploadedAt && (
                                                <p className="text-[10px] text-slate-400">Uploaded {fmtDate(receiptDoc.uploadedAt)}</p>
                                            )}
                                        </div>
                                        <a href={fileUrl(receiptDoc.url)} target="_blank" rel="noreferrer" title="View receipt"
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                            <Eye className="h-3.5 w-3.5" />
                                        </a>
                                        <button type="button" onClick={() => receiptInputRef.current?.click()} disabled={uploadingReceipt} title="Replace"
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                                            {uploadingReceipt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                        </button>
                                        <button type="button" onClick={handleReceiptDelete} disabled={uploadingReceipt} title="Remove"
                                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => receiptInputRef.current?.click()}
                                        disabled={uploadingReceipt}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-500 border border-dashed border-slate-300 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors disabled:opacity-50"
                                    >
                                        {uploadingReceipt ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Attach PDF receipt</>}
                                    </button>
                                )}
                            </div>
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
