import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, X, Loader2, ShieldCheck, Users, Wallet } from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";

const LOAN_TYPES = ["Secured", "Unsecured"];
const STATUS_OPTIONS = ["Pending", "Accepted", "Rejected"];
const DISBURSEMENT_OPTIONS = ["Not Started", "Partial", "Full"];

const emptyBank = {
    bank_name: "", loan_type: "", branch: "", contact_person: "", contact_number: "",
    application_ref: "", documents_submitted_date: "", notes: "",
    collateral_type: "", collateral_value: "",
    co_applicant: "", co_applicant_income: "",
    status: "Pending",
    sanctioned_amount: "", interest_rate: "", loan_tenure: "", processing_fee: "",
    moratorium_period: "", sanction_date: "", disbursement_status: "",
};

/**
 * Add/Edit Bank modal — a self-contained, reusable dialog for one bank on a lead's
 * `customFields.loan_banks` array. Render it only while open (editIndex != null) and
 * pass a `key={editIndex}` so it re-initialises its draft each time it opens.
 *
 *   editIndex === banks.length → add mode (append)
 *   editIndex <  banks.length → edit that bank
 *
 * Used by both the Loan tab (LeadLoanPanel) and the sidebar Loan Journey card so
 * the "Add Bank" experience is identical wherever it's triggered.
 */
export default function LoanBankModal({ leadId, lead, editIndex, onClose, onSaved, mode = "full" }) {
    const isDecision = mode === "decision";
    const queryClient = useQueryClient();
    const banks = Array.isArray(lead?.customFields?.loan_banks) ? lead.customFields.loan_banks : [];
    const isAdding = editIndex === banks.length;

    const [draft, setDraft] = useState(() =>
        isAdding ? { ...emptyBank } : { ...emptyBank, ...(banks[editIndex] || {}) }
    );
    const [addingBank, setAddingBank] = useState(false); // "Add custom bank" toggle
    const [customBank, setCustomBank] = useState("");

    const saveMut = useMutation({
        mutationFn: (nextList) =>
            api.patch(`/leads/${leadId}/custom-fields`, { fields: { loan_banks: nextList } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Loan details updated");
            onSaved?.();
            onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update loan details"),
    });

    // Bank master list (curated defaults + custom banks saved to the DB). A custom
    // bank a consultant types is persisted here so it shows up as a normal option
    // for every lead thereafter — no "(custom)" tagging.
    const { data: bankList = [] } = useQuery({
        queryKey: ["banks"],
        queryFn: () => api.get("/banks").then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
    const bankNames = bankList.map(b => b.name);

    const createBankMut = useMutation({
        mutationFn: (name) => api.post("/banks", { name }).then(r => r.data),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ["banks"] });
            setField("bank_name", created.name);
            setAddingBank(false);
            setCustomBank("");
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to add bank"),
    });

    const setField = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

    // Mandatory fields — the bank can't be saved (and the lead can't advance out of
    // Loan Documentation) until all of these are filled. Kept in sync with the
    // backend gate in validateLoanStageMove.
    const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
    const REQUIRED_FIELDS = ["bank_name", "loan_type", "documents_submitted_date"];
    // A bank marked Accepted must also carry its sanctioned amount (the condition to
    // advance from Awaiting Approval → Approved).
    const acceptedOk = draft.status !== "Accepted" || filled(draft.sanctioned_amount);
    // Decision mode only edits the outcome (+ loan terms when accepted); the bank's
    // identity fields were already captured during documentation, so they aren't re-required.
    const isValid = isDecision ? acceptedOk : (REQUIRED_FIELDS.every((k) => filled(draft[k])) && acceptedOk);

    const handleSave = () => {
        if (!isValid) return;
        const nextList = isAdding
            ? [...banks, { ...draft }]
            : banks.map((b, i) => (i === editIndex ? { ...b, ...draft } : b));
        saveMut.mutate(nextList);
    };

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && onClose()}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-slate-800">{isDecision ? "Bank Decision" : (isAdding ? "Add Bank" : (draft.bank_name || "Bank"))}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                  {isDecision ? (
                    <>
                        {/* Which bank this decision is for — identity is read-only here */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                            <Landmark className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">{draft.bank_name || "Bank"}</span>
                            {draft.loan_type && <span className="text-[10px] font-bold text-slate-400">· {draft.loan_type}</span>}
                        </div>

                        {/* Decision dropdown */}
                        <div className="space-y-1">
                            <label className={labelCls}>Bank Decision <span className="text-rose-500">*</span></label>
                            <select className={inputCls} value={draft.status || "Pending"} onChange={e => setField("status", e.target.value)}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Accepted → sanctioned loan details */}
                        {draft.status === "Accepted" && (
                            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                                <div className="col-span-2 flex items-center gap-1.5">
                                    <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-[11px] font-bold text-emerald-700">Sanctioned Loan Details</span>
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Sanctioned Amount <span className="text-rose-500">*</span></label>
                                    <input className={inputCls} placeholder="e.g. ₹18,00,000" value={draft.sanctioned_amount || ""} onChange={e => setField("sanctioned_amount", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Interest Rate</label>
                                    <input className={inputCls} placeholder="e.g. 9.5%" value={draft.interest_rate || ""} onChange={e => setField("interest_rate", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Loan Tenure</label>
                                    <input className={inputCls} placeholder="e.g. 10 years" value={draft.loan_tenure || ""} onChange={e => setField("loan_tenure", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Processing Fee</label>
                                    <input className={inputCls} placeholder="e.g. ₹10,000" value={draft.processing_fee || ""} onChange={e => setField("processing_fee", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Moratorium Period</label>
                                    <input className={inputCls} placeholder="e.g. course + 6 months" value={draft.moratorium_period || ""} onChange={e => setField("moratorium_period", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Sanction Date</label>
                                    <input type="date" className={inputCls} value={draft.sanction_date || ""} onChange={e => setField("sanction_date", e.target.value)} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className={labelCls}>Disbursement Status</label>
                                    <select className={inputCls} value={draft.disbursement_status || ""} onChange={e => setField("disbursement_status", e.target.value)}>
                                        <option value="">— Select —</option>
                                        {DISBURSEMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </>
                  ) : (
                    <>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Bank name — dropdown + add custom */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className={labelCls}>Bank <span className="text-rose-500">*</span></label>
                                {!addingBank && (
                                    <button type="button" onClick={() => { setAddingBank(true); setCustomBank(""); }}
                                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800">+ Add custom</button>
                                )}
                            </div>
                            {addingBank ? (
                                <div className="flex gap-1.5">
                                    <input autoFocus className={inputCls} placeholder="New bank name" value={customBank}
                                        onChange={e => setCustomBank(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (customBank.trim() && !createBankMut.isPending) createBankMut.mutate(customBank.trim()); } }} />
                                    <button type="button" disabled={!customBank.trim() || createBankMut.isPending}
                                        onClick={() => { if (customBank.trim()) createBankMut.mutate(customBank.trim()); }}
                                        className="shrink-0 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                                        {createBankMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
                                    </button>
                                    <button type="button" onClick={() => { setAddingBank(false); setCustomBank(""); }}
                                        className="shrink-0 px-2 py-1 border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:bg-slate-50">✕</button>
                                </div>
                            ) : (
                                <select className={inputCls} value={draft.bank_name || ""}
                                    onChange={e => setField("bank_name", e.target.value)}>
                                    <option value="">Select Bank</option>
                                    {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
                                    {/* An existing bank whose name isn't in the list yet still shows as its plain name */}
                                    {draft.bank_name && !bankNames.includes(draft.bank_name) && (
                                        <option value={draft.bank_name}>{draft.bank_name}</option>
                                    )}
                                </select>
                            )}
                        </div>
                        {/* Loan type — drives which fields show below */}
                        <div className="space-y-1">
                            <label className={labelCls}>Loan Type <span className="text-rose-500">*</span></label>
                            <select className={inputCls} value={draft.loan_type || ""} onChange={e => setField("loan_type", e.target.value)}>
                                <option value="">— Select —</option>
                                {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Branch</label>
                            <input className={inputCls} value={draft.branch || ""} onChange={e => setField("branch", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Application Ref No.</label>
                            <input className={inputCls} value={draft.application_ref || ""} onChange={e => setField("application_ref", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Contact Person</label>
                            <input className={inputCls} value={draft.contact_person || ""} onChange={e => setField("contact_person", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Contact Number</label>
                            <input className={inputCls} value={draft.contact_number || ""} onChange={e => setField("contact_number", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Documents Submitted Date <span className="text-rose-500">*</span></label>
                            <input type="date" className={inputCls} value={draft.documents_submitted_date || ""} onChange={e => setField("documents_submitted_date", e.target.value)} />
                        </div>
                    </div>

                    {/* Type-specific fields — the "fields change according to the bank/loan" behaviour */}
                    {draft.loan_type === "Secured" && (
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                            <div className="col-span-2 flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-[11px] font-bold text-emerald-700">Collateral (Secured loan)</span>
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Collateral Type</label>
                                <input className={inputCls} placeholder="Property / FD / LIC…" value={draft.collateral_type || ""} onChange={e => setField("collateral_type", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Collateral Value</label>
                                <input className={inputCls} placeholder="e.g. ₹40,00,000" value={draft.collateral_value || ""} onChange={e => setField("collateral_value", e.target.value)} />
                            </div>
                        </div>
                    )}
                    {draft.loan_type === "Unsecured" && (
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                            <div className="col-span-2 flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-[11px] font-bold text-emerald-700">Co-applicant (Unsecured loan)</span>
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Co-applicant Name</label>
                                <input className={inputCls} value={draft.co_applicant || ""} onChange={e => setField("co_applicant", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Co-applicant Income</label>
                                <input className={inputCls} placeholder="e.g. ₹8,00,000 / yr" value={draft.co_applicant_income || ""} onChange={e => setField("co_applicant_income", e.target.value)} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className={labelCls}>Notes</label>
                        <textarea rows={2} className={cn(inputCls, "resize-none")} value={draft.notes || ""} onChange={e => setField("notes", e.target.value)} />
                    </div>

                    </>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2 sticky bottom-0 bg-white">
                    <p className="text-[10px] font-semibold text-slate-400">
                        <span className="text-rose-500">*</span> required to save and to advance the loan
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saveMut.isPending || !isValid}
                            title={isValid ? "" : "Fill all required (*) fields first"}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
