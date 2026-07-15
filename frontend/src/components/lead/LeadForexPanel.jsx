import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Banknote, Pencil, X, Loader2, CalendarDays, CheckCircle2,
    Building2, FileText, UploadCloud, Globe, Landmark
} from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";

function Field({ icon: Icon, label, children }) {
    return (
        <div className="flex items-start gap-2 min-w-0">
            {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />}
            <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                <div className="text-xs font-semibold text-slate-700 break-words">{children || <span className="text-slate-300">—</span>}</div>
            </div>
        </div>
    );
}

export default function LeadForexPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const cf = lead?.customFields || {};

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({
        forex_date: cf.forex_date || "",
        forex_amount: cf.forex_amount || "",
        forex_service_company: cf.forex_service_company || "",
    });

    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [uploadingSwift, setUploadingSwift] = useState(false);

    const uploadFile = async (file, type) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            toast.error("Only PDF files are allowed");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds 10MB limit");
            return;
        }

        const isReceipt = type === "receipt";
        const documentName = isReceipt ? "Forex Receipt" : "Forex SWIFT Copy";
        const setUploading = isReceipt ? setUploadingReceipt : setUploadingSwift;

        const fd = new FormData();
        fd.append("document", file);
        fd.append("documentName", documentName);

        setUploading(true);
        try {
            const res = await api.post(`/upload/document/${leadId}`, fd, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            // Extract uploaded url
            const docs = res.data?.documents || res.data?.customFields?.documents || [];
            const uploadedDoc = docs.find(d => d.name === documentName);
            const url = uploadedDoc?.url || "";

            // Save the URL to custom fields as well
            await api.patch(`/leads/${leadId}/custom-fields`, {
                fields: { [isReceipt ? "forex_receipt" : "forex_swift_copy"]: url }
            });

            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            toast.success(`${documentName} uploaded successfully`);
        } catch (err) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to upload document");
        } finally {
            setUploading(false);
        }
    };

    const saveMut = useMutation({
        mutationFn: (fields) => api.patch(`/leads/${leadId}/custom-fields`, { fields }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Forex details updated");
            setOpen(false);
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update details"),
    });

    const openEdit = () => {
        setDraft({
            forex_date: cf.forex_date || "",
            forex_amount: cf.forex_amount || "",
            forex_service_company: cf.forex_service_company || "",
        });
        setOpen(true);
    };

    const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }));
    const handleSave = () => saveMut.mutate(draft);

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    const hasForex = lead?.leadDepartments?.some(d => d.department === "FOREX");
    if (!hasForex && !embedded) return null;

    const receiptUrl = cf.forex_receipt || (cf.documents || []).find(d => d.name === "Forex Receipt")?.url;
    const swiftUrl = cf.forex_swift_copy || (cf.documents || []).find(d => d.name === "Forex SWIFT Copy")?.url;

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header banner */}
            <div className="px-5 py-4 bg-gradient-to-r from-violet-50/50 to-white border-b border-gray-150 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-lg bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center shadow-2xs">
                        <Banknote className="h-4 w-4" />
                    </span>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 leading-none">Forex Process</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 leading-none uppercase tracking-wide">Deal execution & transfers</p>
                    </div>
                </div>

                {!open && (
                    <button onClick={openEdit} className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                )}
            </div>

            {open ? (
                <div className="p-5 space-y-4 bg-violet-50/10">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelCls}>Forex Date</label>
                            <input type="date" className={inputCls} value={draft.forex_date} onChange={e => setField("forex_date", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Forex Amount</label>
                            <input type="text" placeholder="e.g. £10,000" className={inputCls} value={draft.forex_amount} onChange={e => setField("forex_amount", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelCls}>Service Company Name</label>
                        <input type="text" placeholder="e.g. Thomas Cook" className={inputCls} value={draft.forex_service_company} onChange={e => setField("forex_service_company", e.target.value)} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-gray-200 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saveMut.isPending} className="px-3.5 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                            {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Changes"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Field icon={CalendarDays} label="Forex Date">
                            {cf.forex_date ? new Date(cf.forex_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                        </Field>
                        <Field icon={Banknote} label="Forex Amount">{cf.forex_amount}</Field>
                        <div className="col-span-2">
                            <Field icon={Landmark} label="Service Company Name">{cf.forex_service_company}</Field>
                        </div>
                    </div>

                    {/* File Uploads Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                        {/* Receipt Upload */}
                        <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between gap-3.5">
                            <div>
                                <h4 className="text-xs font-bold text-slate-700">Forex Receipt</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">Upload exchange transaction receipt (PDF format only)</p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                                {receiptUrl ? (
                                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> View Receipt
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">No receipt uploaded</span>
                                )}

                                <label className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                                    uploadingReceipt ? "border-slate-200 bg-white text-slate-400 cursor-not-allowed" : "border-violet-200 bg-white text-violet-650 hover:bg-violet-50/50"
                                )}>
                                    {uploadingReceipt ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <UploadCloud className="h-3.5 w-3.5" />
                                    )}
                                    <span>{receiptUrl ? "Replace" : "Upload"}</span>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        disabled={uploadingReceipt}
                                        onChange={e => { uploadFile(e.target.files?.[0], "receipt"); e.target.value = ""; }}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* SWIFT Copy Upload */}
                        <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between gap-3.5">
                            <div>
                                <h4 className="text-xs font-bold text-slate-700">SWIFT Copy</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">Upload MT103 / SWIFT copy document (PDF format only)</p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                                {swiftUrl ? (
                                    <a href={swiftUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> View SWIFT Copy
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">No SWIFT copy uploaded</span>
                                )}

                                <label className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                                    uploadingSwift ? "border-slate-200 bg-white text-slate-400 cursor-not-allowed" : "border-violet-200 bg-white text-violet-650 hover:bg-violet-50/50"
                                )}>
                                    {uploadingSwift ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <UploadCloud className="h-3.5 w-3.5" />
                                    )}
                                    <span>{swiftUrl ? "Replace" : "Upload"}</span>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        disabled={uploadingSwift}
                                        onChange={e => { uploadFile(e.target.files?.[0], "swift"); e.target.value = ""; }}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
