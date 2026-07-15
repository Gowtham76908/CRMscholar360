import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Loader2, UploadCloud, CheckCircle2, FileText, Banknote, CalendarDays, Landmark } from "lucide-react";
import api from "../../api/axios";
import { Modal } from "../Modal";
import { cn } from "../../lib/utils";

export default function ForexDetailsModal({ leadId, lead, onClose }) {
    const queryClient = useQueryClient();
    const cf = lead?.customFields || {};

    const [draft, setDraft] = useState({
        forex_date: cf.forex_date || "",
        forex_amount: cf.forex_amount || "",
        forex_service_company: cf.forex_service_company || "",
    });

    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [uploadingSwift, setUploadingSwift] = useState(false);

    const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }));

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
            const docs = res.data?.documents || res.data?.customFields?.documents || [];
            const uploadedDoc = docs.find(d => d.name === documentName);
            const url = uploadedDoc?.url || "";

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
            toast.success("Forex details saved");
            onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to save details"),
    });

    const handleSave = () => saveMut.mutate(draft);

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    const receiptUrl = cf.forex_receipt || (cf.documents || []).find(d => d.name === "Forex Receipt")?.url;
    const swiftUrl = cf.forex_swift_copy || (cf.documents || []).find(d => d.name === "Forex SWIFT Copy")?.url;

    return (
        <Modal isOpen={true} onClose={onClose} title="Update Forex Details">
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {/* Forex Identity form */}
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

                {/* Document Uploads section */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Required Document Uploads</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Receipt */}
                        <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between gap-3">
                            <div>
                                <h5 className="text-xs font-bold text-slate-700">Forex Receipt</h5>
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Exchange receipt (PDF only)</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {receiptUrl ? (
                                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 justify-center px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                        <CheckCircle2 className="h-3 w-3" /> View
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic text-center">Not uploaded</span>
                                )}
                                <label className={cn(
                                    "inline-flex items-center gap-1 justify-center px-2 py-1 rounded-lg text-[10px] font-bold border bg-white transition-colors cursor-pointer",
                                    uploadingReceipt ? "border-slate-200 text-slate-400" : "border-violet-200 text-violet-650 hover:bg-violet-50/55"
                                )}>
                                    {uploadingReceipt ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                    <span>{receiptUrl ? "Replace" : "Upload"}</span>
                                    <input type="file" accept=".pdf" className="hidden" disabled={uploadingReceipt} onChange={e => { uploadFile(e.target.files?.[0], "receipt"); e.target.value = ""; }} />
                                </label>
                            </div>
                        </div>

                        {/* SWIFT copy */}
                        <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between gap-3">
                            <div>
                                <h5 className="text-xs font-bold text-slate-700">SWIFT Copy</h5>
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">MT103 / SWIFT doc (PDF only)</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {swiftUrl ? (
                                    <a href={swiftUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 justify-center px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                        <CheckCircle2 className="h-3 w-3" /> View
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic text-center">Not uploaded</span>
                                )}
                                <label className={cn(
                                    "inline-flex items-center gap-1 justify-center px-2 py-1 rounded-lg text-[10px] font-bold border bg-white transition-colors cursor-pointer",
                                    uploadingSwift ? "border-slate-200 text-slate-400" : "border-violet-200 text-violet-650 hover:bg-violet-50/55"
                                )}>
                                    {uploadingSwift ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                    <span>{swiftUrl ? "Replace" : "Upload"}</span>
                                    <input type="file" accept=".pdf" className="hidden" disabled={uploadingSwift} onChange={e => { uploadFile(e.target.files?.[0], "swift"); e.target.value = ""; }} />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-gray-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saveMut.isPending} className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                        {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Changes"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
