import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Landmark, Pencil, X, Loader2, CheckCircle2, XCircle, Clock,
    Building2, Phone, User, Hash, CalendarDays, Plus, ShieldCheck,
    Users, Wallet, Percent,
} from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";
import LoanBankModal from "./LoanBankModal";

const STATUS_OPTIONS = ["Pending", "Accepted", "Rejected"];
const DISBURSEMENT_OPTIONS = ["Not Started", "Partial", "Full"];

const STATUS_STYLE = {
    Accepted: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Rejected: "text-rose-700 bg-rose-50 border-rose-200",
    Pending: "text-amber-700 bg-amber-50 border-amber-200",
};
const STATUS_ICON = { Accepted: CheckCircle2, Rejected: XCircle, Pending: Clock };

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

export default function LeadLoanPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const banks = Array.isArray(lead?.customFields?.loan_banks)
        ? lead.customFields.loan_banks
        : [];

    // Add/Edit bank is handled by the shared LoanBankModal (rendered when editIndex != null).
    const [editIndex, setEditIndex] = useState(null);
    const openEdit = (idx) => setEditIndex(idx);
    // Add mode: index just past the end of the list appends a new bank.
    const openAdd = () => setEditIndex(banks.length);

    const saveMut = useMutation({
        mutationFn: (nextList) =>
            api.patch(`/leads/${leadId}/custom-fields`, { fields: { loan_banks: nextList } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Loan details updated");
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update loan details"),
    });

    // Change a bank's status (and its accepted loan details) directly from its card.
    const patchBank = (idx, patch) =>
        saveMut.mutate(banks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

    // Per-bank inline "Accepted → loan details" editor
    const [detailForm, setDetailForm] = useState(null); // { idx, ...fields }

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    const AddButton = (
        <button onClick={openAdd} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Bank
        </button>
    );


    // Renders one bank card with its status control + accepted loan details.
    const renderCard = (b, idx) => {
        const StatusIcon = STATUS_ICON[b.status] || Clock;
        return (
            <div key={idx} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800 truncate">{b.bank_name || `Bank #${idx + 1}`}</h3>
                        {b.loan_type && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                {b.loan_type}
                            </span>
                        )}
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border", STATUS_STYLE[b.status] || STATUS_STYLE.Pending)}>
                            <StatusIcon className="h-3 w-3" /> {b.status || "Pending"}
                        </span>
                    </div>
                    <button onClick={() => openEdit(idx)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors shrink-0">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field icon={Building2} label="Branch">{b.branch}</Field>
                    <Field icon={Hash} label="Application Ref">{b.application_ref}</Field>
                    <Field icon={User} label="Contact Person">{b.contact_person}</Field>
                    <Field icon={Phone} label="Contact Number">{b.contact_number}</Field>
                    <Field icon={CalendarDays} label="Docs Submitted">
                        {b.documents_submitted_date ? new Date(b.documents_submitted_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                    </Field>
                    {b.loan_type === "Secured" && <Field icon={ShieldCheck} label="Collateral">{b.collateral_type}{b.collateral_value ? ` · ${b.collateral_value}` : ""}</Field>}
                    {b.loan_type === "Unsecured" && <Field icon={Users} label="Co-applicant">{b.co_applicant}{b.co_applicant_income ? ` · ${b.co_applicant_income}` : ""}</Field>}
                    {b.notes && (
                        <div className="col-span-2"><Field label="Notes">{b.notes}</Field></div>
                    )}
                </div>

                {/* Status control */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Bank decision</span>
                    <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                        {STATUS_OPTIONS.map(s => (
                            <button
                                key={s}
                                type="button"
                                disabled={saveMut.isPending}
                                onClick={() => {
                                    if (s === "Accepted") {
                                        // Open the loan-details editor; persist status + details together on save.
                                        setDetailForm({
                                            idx,
                                            sanctioned_amount: b.sanctioned_amount || "",
                                            interest_rate: b.interest_rate || "",
                                            loan_tenure: b.loan_tenure || "",
                                            processing_fee: b.processing_fee || "",
                                            moratorium_period: b.moratorium_period || "",
                                            sanction_date: b.sanction_date || "",
                                            disbursement_status: b.disbursement_status || "",
                                        });
                                    } else {
                                        setDetailForm(null);
                                        patchBank(idx, { status: s });
                                    }
                                }}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all",
                                    b.status === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accepted summary */}
                {b.status === "Accepted" && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 relative">
                        <Field icon={Wallet} label="Sanctioned Amount">{b.sanctioned_amount}</Field>
                        <Field icon={Percent} label="Interest Rate">{b.interest_rate}</Field>
                        <Field icon={CalendarDays} label="Loan Tenure">{b.loan_tenure}</Field>
                        <Field icon={Wallet} label="Processing Fee">{b.processing_fee}</Field>
                        <Field icon={Clock} label="Moratorium">{b.moratorium_period}</Field>
                        <Field icon={CalendarDays} label="Sanction Date">
                            {b.sanction_date ? new Date(b.sanction_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                        </Field>
                        <Field icon={Wallet} label="Disbursement">{b.disbursement_status}</Field>

                        <div className="col-span-2 flex justify-end mt-1 border-t border-emerald-100/50 pt-2">
                            <button
                                type="button"
                                onClick={() => setDetailForm({
                                    idx,
                                    sanctioned_amount: b.sanctioned_amount || "",
                                    interest_rate: b.interest_rate || "",
                                    loan_tenure: b.loan_tenure || "",
                                    processing_fee: b.processing_fee || "",
                                    moratorium_period: b.moratorium_period || "",
                                    sanction_date: b.sanction_date || "",
                                    disbursement_status: b.disbursement_status || "",
                                })}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-950 bg-white border border-emerald-200/80 px-2.5 py-1 rounded-md shadow-xs transition-all hover:bg-emerald-50/50"
                            >
                                <Pencil className="h-3 w-3" /> Edit Loan Details
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderDetailModal = () => detailForm === null ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && setDetailForm(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-slate-800">Loan Details — {banks[detailForm.idx]?.bank_name}</h3>
                    </div>
                    <button onClick={() => setDetailForm(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelCls}>Sanctioned Amount *</label>
                            <input className={inputCls} placeholder="e.g. ₹18,00,000" value={detailForm.sanctioned_amount}
                                onChange={e => setDetailForm(s => ({ ...s, sanctioned_amount: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Interest Rate</label>
                            <input className={inputCls} placeholder="e.g. 9.5%" value={detailForm.interest_rate}
                                onChange={e => setDetailForm(s => ({ ...s, interest_rate: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Loan Tenure</label>
                            <input className={inputCls} placeholder="e.g. 10 years" value={detailForm.loan_tenure}
                                onChange={e => setDetailForm(s => ({ ...s, loan_tenure: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Processing Fee</label>
                            <input className={inputCls} placeholder="e.g. ₹10,000" value={detailForm.processing_fee}
                                onChange={e => setDetailForm(s => ({ ...s, processing_fee: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Moratorium Period</label>
                            <input className={inputCls} placeholder="e.g. course + 6 months" value={detailForm.moratorium_period}
                                onChange={e => setDetailForm(s => ({ ...s, moratorium_period: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Sanction Date</label>
                            <input type="date" className={inputCls} value={detailForm.sanction_date}
                                onChange={e => setDetailForm(s => ({ ...s, sanction_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className={labelCls}>Disbursement Status</label>
                            <select className={inputCls} value={detailForm.disbursement_status}
                                onChange={e => setDetailForm(s => ({ ...s, disbursement_status: e.target.value }))}>
                                <option value="">— Select —</option>
                                {DISBURSEMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                    <button onClick={() => setDetailForm(null)} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                        Cancel
                    </button>
                    <button
                        disabled={saveMut.isPending || !String(detailForm.sanctioned_amount || "").trim()}
                        onClick={() => {
                            const { idx, ...details } = detailForm;
                            patchBank(idx, { status: "Accepted", ...details });
                            setDetailForm(null);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Save Details
                    </button>
                </div>
            </div>
        </div>
    );

    if (banks.length === 0) {
        if (!embedded) return null;
        return (
            <>
                <div className="px-5 py-8 text-center space-y-3">
                    <p className="text-xs text-slate-400">No banks added yet.</p>
                    <div className="flex justify-center">{AddButton}</div>
                </div>
                {editIndex !== null && (
                    <LoanBankModal key={editIndex} leadId={leadId} lead={lead} editIndex={editIndex} onClose={() => setEditIndex(null)} />
                )}
            </>
        );
    }

    const acceptedCount = banks.filter(b => b.status === "Accepted").length;

    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            {/* Heading */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-gray-800">Loan Banks</h2>
                <span className="text-xs text-gray-400 font-medium">
                    · {banks.length} bank{banks.length === 1 ? "" : "s"}{acceptedCount > 0 ? ` · ${acceptedCount} accepted` : ""}
                </span>
                <div className="ml-auto">{AddButton}</div>
            </div>

            <div className="divide-y divide-gray-100">
                {banks.map((b, idx) => renderCard(b, idx))}
            </div>

            {editIndex !== null && (
                <LoanBankModal key={editIndex} leadId={leadId} lead={lead} editIndex={editIndex} onClose={() => setEditIndex(null)} />
            )}
            {renderDetailModal()}
        </div>
    );
}
