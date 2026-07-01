import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Pencil, X, Loader2, CalendarDays, CheckCircle2, Circle, FileCheck2, UploadCloud } from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// The visa-related custom fields collected across the visa journey stages.
const VISA_FIELDS = [
    { key: "financial_proof_docs", label: "Financial Proof Docs", type: "text" },
    { key: "cas_form_number", label: "CAS / I-20 Form Number", type: "text" },
    { key: "visa_appointment_date", label: "Visa Appointment Date", type: "date" },
    { key: "mock_interview_scorecard", label: "Mock Interview Scorecard", type: "text" },
    { key: "embassy_result", label: "Embassy Result", type: "select", options: ["Approved", "Refused"] },
    { key: "visa_approved_date", label: "Date of Visa Approved", type: "date" },
    { key: "approved_visa_passport", label: "Approved Visa Passport Page", type: "text" },
    { key: "flight_departure_date", label: "Flight Departure Date", type: "date" },
    { key: "visa_manager_approved", label: "Visa Manager Approved", type: "checkbox" },
];

export default function LeadVisaPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const cf = lead?.customFields || {};

    const current = Object.fromEntries(VISA_FIELDS.map(f => [f.key, cf[f.key] ?? (f.type === "checkbox" ? false : "")]));
    const hasVisa = VISA_FIELDS.some(f => {
        const v = cf[f.key];
        return f.type === "checkbox" ? !!v : !!(v && String(v).trim());
    });

    // The visa-approval proof lives in the lead's Documents list.
    const proofDoc = (Array.isArray(cf.documents) ? cf.documents : [])
        .find(d => (d?.name || "").toLowerCase() === "proof of visa approved");

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(current);
    const [uploadingProof, setUploadingProof] = useState(false);

    const uploadProof = async (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error("File size exceeds 10MB limit"); return; }
        const fd = new FormData();
        fd.append("document", file);
        fd.append("documentName", "Proof of Visa Approved");
        setUploadingProof(true);
        try {
            await api.post(`/upload/document/${leadId}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            toast.success("Proof of Visa Approved uploaded");
        } catch (err) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to upload proof");
        } finally {
            setUploadingProof(false);
        }
    };

    const saveMut = useMutation({
        mutationFn: (fields) => api.patch(`/leads/${leadId}/custom-fields`, { fields }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Visa details updated");
            setOpen(false);
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update visa details"),
    });

    if (!hasVisa && !embedded) return null;

    const openEdit = () => { setDraft(current); setOpen(true); };
    const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }));
    const handleSave = () => saveMut.mutate(draft);

    const renderValue = (f) => {
        const v = current[f.key];
        if (f.type === "checkbox") {
            return v
                ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                : <span className="inline-flex items-center gap-1 text-slate-400"><Circle className="h-3.5 w-3.5" /> No</span>;
        }
        if (f.type === "date") return <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(v)}</span>;
        return v || <span className="text-slate-300">—</span>;
    };

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                    <h2 className="text-sm font-bold text-gray-800">Visa Details</h2>
                </div>
                <button onClick={openEdit} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
                {VISA_FIELDS.map(f => (
                    <div key={f.key} className="min-w-0">
                        <p className={labelCls}>{f.label}</p>
                        <div className="text-xs font-semibold text-slate-700 break-words">{renderValue(f)}</div>
                    </div>
                ))}
                <div className="col-span-2">
                    <p className={labelCls}>Proof of Visa Approved</p>
                    <div className="text-xs font-semibold text-slate-700">
                        {proofDoc?.url ? (
                            <a href={proofDoc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                                <FileCheck2 className="h-3.5 w-3.5" /> {proofDoc.name || "View document"}
                            </a>
                        ) : (
                            <span className="text-slate-300">— Not uploaded</span>
                        )}
                    </div>
                </div>
            </div>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-blue-500" />
                                <h3 className="text-sm font-bold text-slate-800">Visa Details</h3>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                        </div>

                        <div className="p-5 grid grid-cols-2 gap-3">
                            {VISA_FIELDS.map(f => (
                                <div key={f.key} className={cn("space-y-1", f.type === "checkbox" && "col-span-2")}>
                                    {f.type !== "checkbox" && <label className={labelCls}>{f.label}</label>}
                                    {f.type === "text" && (
                                        <input className={inputCls} value={draft[f.key] || ""} onChange={e => setField(f.key, e.target.value)} />
                                    )}
                                    {f.type === "date" && (
                                        <input type="date" className={inputCls} value={draft[f.key] || ""} onChange={e => setField(f.key, e.target.value)} />
                                    )}
                                    {f.type === "select" && (
                                        <select className={inputCls} value={draft[f.key] || ""} onChange={e => setField(f.key, e.target.value)}>
                                            <option value="">— Select —</option>
                                            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    )}
                                    {f.type === "checkbox" && (
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input type="checkbox" checked={!!draft[f.key]} onChange={e => setField(f.key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" />
                                            <span className="text-xs font-bold text-slate-700">{f.label}</span>
                                        </label>
                                    )}
                                </div>
                            ))}

                            {/* Proof of Visa Approved — uploads to the lead's Documents list */}
                            <div className="col-span-2 space-y-1">
                                <label className={labelCls}>Proof of Visa Approved</label>
                                {proofDoc?.url && (
                                    <a href={proofDoc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                                        <FileCheck2 className="h-3.5 w-3.5" /> {proofDoc.name || "View current document"}
                                    </a>
                                )}
                                <label className={cn(
                                    "flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-bold border border-dashed rounded-lg cursor-pointer transition-colors",
                                    uploadingProof ? "border-slate-200 text-slate-400" : "border-indigo-300 text-indigo-650 hover:bg-indigo-50/50"
                                )}>
                                    {uploadingProof
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                                        : <><UploadCloud className="h-4 w-4" /> {proofDoc?.url ? "Replace document" : "Upload proof document"}</>}
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                        className="hidden"
                                        disabled={uploadingProof}
                                        onChange={e => { uploadProof(e.target.files?.[0]); e.target.value = ""; }}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
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
