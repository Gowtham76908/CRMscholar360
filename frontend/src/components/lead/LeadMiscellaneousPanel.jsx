import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, Pencil, X, Loader2, Calendar, ArrowRight, AlertCircle } from "lucide-react";
import api from "../../api/axios";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function LeadMiscellaneousPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const cf = lead?.customFields || {};
    const serviceType = cf.misc_service_type || "";
    const description = cf.misc_description || "";
    const dueDate = cf.misc_due_date || "";

    const miscDept = lead?.leadDepartments?.find(d => d.department === "MISCELLANEOUS");
    const currentStage = miscDept?.stage || "ENQUIRY";

    const { data: allDefs = [] } = useQuery({
        queryKey: ["lead-fields"],
        queryFn: () => api.get("/custom-fields").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    const miscDef = allDefs.find(d => d.fieldKey === "misc_service_type");
    const baseOptions = miscDef?.options || [
        "Admissions Support",
        "Visa Assistance",
        "Courier Service",
        "Document Translation",
        "Certificate Attestation"
    ];

    const [open, setOpen] = useState(false);
    const [draftType, setDraftType] = useState(serviceType);
    const [draftDesc, setDraftDesc] = useState(description);
    const [draftDueDate, setDraftDueDate] = useState(dueDate);
    const [addingCustom, setAddingCustom] = useState(false);
    const [customType, setCustomType] = useState("");

    const optionsSet = new Set(baseOptions);
    if (serviceType && serviceType.trim()) {
        optionsSet.add(serviceType.trim());
    }
    if (draftType && draftType.trim()) {
        optionsSet.add(draftType.trim());
    }
    const options = Array.from(optionsSet);

    const saveMut = useMutation({
        mutationFn: ({ fields }) =>
            api.patch(`/leads/${leadId}/custom-fields`, { fields }),
        onSuccess: (data, { redirectInvoice }) => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-fields"] });
            queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
            toast.success("Miscellaneous details updated");
            setOpen(false);

            if (redirectInvoice) {
                navigate(`/invoices?leadId=${leadId}&invoiceForLead=1&department=MISCELLANEOUS`);
            }
        },
        onError: (err) =>
            toast.error(
                err?.response?.data?.error?.message ||
                err?.response?.data?.message ||
                "Failed to update details"
            ),
    });

    const openEdit = () => {
        setAddingCustom(false);
        setCustomType("");
        setDraftType(serviceType);
        setDraftDesc(description);
        setDraftDueDate(dueDate);
        setOpen(true);
    };

    const handleSave = (redirectInvoice = false) => {
        const finalType = addingCustom ? customType.trim() : draftType.trim();
        saveMut.mutate({
            fields: {
                misc_service_type: finalType,
                misc_description: draftDesc.trim(),
                misc_due_date: draftDueDate || null
            },
            redirectInvoice
        });
    };

    const inputCls =
        "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    // Edit Modal rendering
    const renderModal = () => !open ? null : (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            onClick={() => !saveMut.isPending && setOpen(false)}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-purple-500" />
                        <h3 className="text-sm font-bold text-slate-800">Miscellaneous Details</h3>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Type of Miscellaneous */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label className={labelCls}>Type of Miscellaneous *</label>
                            {!addingCustom && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddingCustom(true);
                                        setCustomType("");
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                >
                                    + Add custom type
                                </button>
                            )}
                        </div>
                        {addingCustom ? (
                            <div className="flex gap-1.5">
                                <input
                                    autoFocus
                                    className={inputCls}
                                    placeholder="Custom service type"
                                    value={customType}
                                    onChange={(e) => setCustomType(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddingCustom(false);
                                        setDraftType(customType);
                                    }}
                                    className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                                >
                                    Set
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddingCustom(false);
                                    }}
                                    className="shrink-0 px-2 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <select
                                className={inputCls}
                                value={draftType}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "__custom__") {
                                        setAddingCustom(true);
                                        setCustomType("");
                                    } else {
                                        setDraftType(v);
                                    }
                                }}
                            >
                                <option value="">Select Service Type</option>
                                {options.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                                <option value="__custom__">+ Add new type...</option>
                            </select>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className={labelCls}>Description</label>
                        <textarea
                            rows={3}
                            className={`${inputCls} resize-none`}
                            placeholder="Enter additional description..."
                            value={draftDesc}
                            onChange={(e) => setDraftDesc(e.target.value)}
                        />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                        <label className={labelCls}>Due Date *</label>
                        <input
                            type="date"
                            className={inputCls}
                            value={draftDueDate ? draftDueDate.split("T")[0] : ""}
                            onChange={(e) => setDraftDueDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                    <button
                        onClick={() => setOpen(false)}
                        disabled={saveMut.isPending}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={
                            saveMut.isPending ||
                            !(addingCustom ? customType.trim() : draftType.trim()) ||
                            !draftDueDate
                        }
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saveMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}{" "}
                        Save
                    </button>
                    {currentStage !== "ENQUIRY" && (
                        <button
                            onClick={() => handleSave(true)}
                            disabled={
                                saveMut.isPending ||
                                !(addingCustom ? customType.trim() : draftType.trim()) ||
                                !draftDueDate
                            }
                            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {saveMut.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}{" "}
                            Save & Create Invoice
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // Left activity bar embedded panel view
    if (embedded) {
        return (
            <div className="bg-white border-0 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <FolderKanban className="h-5 w-5 text-purple-600" />
                        <h2 className="text-base font-bold text-slate-800">Miscellaneous Details</h2>
                    </div>
                    <button
                        onClick={openEdit}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className={labelCls}>Types of Services</p>
                        <div className="text-xs font-semibold text-slate-700 break-words mt-1">
                            {serviceType ? (
                                serviceType
                            ) : (
                                <span className="text-slate-300">— Not specified</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className={labelCls}>Due Date</p>
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mt-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {dueDate ? fmtDate(dueDate) : <span className="text-slate-300">— No due date</span>}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <p className={labelCls}>Description</p>
                        <div className="text-xs font-semibold text-slate-700 break-words mt-1 whitespace-pre-line">
                            {description ? (
                                description
                            ) : (
                                <span className="text-slate-300">— No description</span>
                            )}
                        </div>
                    </div>
                </div>

                {renderModal()}
            </div>
        );
    }

    // Right sidebar widget card view (sales-style compact view)
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
            {/* Header background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-100/30 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                    <FolderKanban className="h-4 w-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Miscellaneous</h3>
                </div>
            </div>

            <div className="space-y-3.5">
                {!serviceType ? (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                {currentStage === "ENQUIRY"
                                    ? "Fill the Miscellaneous Service Type, Description and Due Date to progress the lead stage."
                                    : "Fill the Miscellaneous details and create a separate invoice for commission."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2.5">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-medium text-slate-650">
                            <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider">Service Type</span>
                                <span className="font-bold text-slate-800 truncate block">{serviceType}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider">Due Date</span>
                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                    <Calendar className="h-3 w-3 text-slate-400" /> {fmtDate(dueDate)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={openEdit}
                    className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01] cursor-pointer"
                >
                    {currentStage === "ENQUIRY"
                        ? (serviceType ? "Edit Miscellaneous Details" : "Fill Miscellaneous Details")
                        : "Add Details & Create Invoice"}
                    <ArrowRight className="h-3.5 w-3.5" />
                </button>
            </div>

            {renderModal()}
        </div>
    );
}
