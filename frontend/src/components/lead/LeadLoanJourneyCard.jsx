import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Plus, CheckCircle2, Clock, XCircle, IndianRupee, ClipboardCheck } from "lucide-react";
import LoanBankModal from "./LoanBankModal";

// Loan workflow stages → sidebar copy. Mirrors the SALES "Student Journey" card so
// every department has the same at-a-glance "what's needed next" surface, with the
// Add Bank action available right here in the details column.
const STAGE_META = {
    ENQUIRY: {
        label: "Enquiry",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        instruction: "Add a note or reminder, then record the banks you're applying to.",
    },
    LOAN_DOCUMENTATION: {
        label: "Loan Documentation",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        instruction: "Add the bank(s) the student is applying to before moving to Awaiting Approval.",
    },
    AWAITING_APPROVAL: {
        label: "Awaiting Approval",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        instruction: "Mark a bank as Accepted with its sanctioned amount to move to Approved.",
    },
    APPROVED: {
        label: "Approved",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        instruction: "Raise an invoice and collect full payment to reach Commission Invoicing.",
    },
    REJECTED: {
        label: "Rejected",
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        instruction: "All banks declined this loan.",
    },
    COMMISSION_INVOICING: {
        label: "Commission Invoicing",
        badge: "bg-green-50 text-green-700 border-green-200",
        instruction: "Loan complete — commission is being invoiced.",
    },
};

const STATUS_ICON = { Accepted: CheckCircle2, Rejected: XCircle, Pending: Clock };
const STATUS_COLOR = { Accepted: "text-emerald-600", Rejected: "text-rose-500", Pending: "text-amber-500" };

/**
 * Sidebar "Loan Journey" card — the LOAN department's equivalent of the SALES
 * Student Journey panel. Shows the current loan stage, what's required to advance,
 * the banks recorded so far, and an Add Bank button that opens the shared
 * LoanBankModal directly from the details column.
 */
export default function LeadLoanJourneyCard({ leadId, lead }) {
    const [editIndex, setEditIndex] = useState(null);
    const [modalMode, setModalMode] = useState("full"); // "full" (identity) | "decision"
    const navigate = useNavigate();

    const loanDept = lead?.leadDepartments?.find((d) => d.department === "LOAN");
    if (!loanDept) return null; // lead has no Loan service — nothing to show

    const banks = Array.isArray(lead?.customFields?.loan_banks) ? lead.customFields.loan_banks : [];
    const meta = STAGE_META[loanDept.stage] || { label: loanDept.stage, badge: "bg-slate-50 text-slate-700 border-slate-200", instruction: "" };
    const acceptedCount = banks.filter((b) => b.status === "Accepted").length;

    // Past documentation, editing a bank is about its decision/loan terms; during
    // documentation it's about the bank's identity fields.
    const isDecisionStage = !["ENQUIRY", "LOAN_DOCUMENTATION"].includes(loanDept.stage);

    const openBank = (idx, m) => { setModalMode(m); setEditIndex(idx); };
    const openAdd = () => openBank(banks.length, "full");
    // Awaiting Approval action: open the first not-yet-accepted bank to set its decision.
    const openDecision = () => {
        if (banks.length === 0) return openAdd();
        const idx = banks.findIndex((b) => b.status !== "Accepted");
        openBank(idx === -1 ? 0 : idx, "decision");
    };
    const goInvoice = () => navigate(`/invoices?leadId=${leadId}&invoiceForLead=1&department=LOAN`);

    // The primary action mirrors what's needed to advance to the next stage — the
    // same "dynamic CTA" idea as the SALES Student Journey. Terminal stages have none.
    const primaryAction =
        loanDept.stage === "ENQUIRY" || loanDept.stage === "LOAN_DOCUMENTATION"
            ? { label: "Add Bank", icon: Plus, onClick: openAdd }
            : loanDept.stage === "AWAITING_APPROVAL"
            ? { label: "Update Bank Decision", icon: ClipboardCheck, onClick: openDecision }
            : loanDept.stage === "APPROVED"
            ? { label: "Create Invoice", icon: IndianRupee, onClick: goInvoice }
            : null;

    return (
        <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-gray-800 tracking-wide">LOAN JOURNEY</h3>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.badge}`}>
                    {meta.label}
                </span>
            </div>

            {/* Required details hint */}
            {meta.instruction && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 mb-3">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Required Details</p>
                    <p className="text-xs font-semibold text-slate-600">💡 {meta.instruction}</p>
                </div>
            )}

            {/* Banks summary */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">
                        Banks {banks.length > 0 && <span className="text-slate-500">· {banks.length}{acceptedCount > 0 ? ` · ${acceptedCount} accepted` : ""}</span>}
                    </p>
                    <button type="button" onClick={openAdd} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-800">
                        <Plus className="h-3 w-3" /> Add
                    </button>
                </div>
                {banks.length === 0 ? (
                    <p className="text-xs text-slate-400">No banks added yet.</p>
                ) : (
                    <div className="space-y-1.5">
                        {banks.map((b, idx) => {
                            const Icon = STATUS_ICON[b.status] || Clock;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => openBank(idx, isDecisionStage ? "decision" : "full")}
                                    className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                    <Icon className={`h-3.5 w-3.5 shrink-0 ${STATUS_COLOR[b.status] || "text-slate-400"}`} />
                                    <span className="text-xs font-semibold text-slate-700 truncate">{b.bank_name || `Bank #${idx + 1}`}</span>
                                    <span className="ml-auto text-[10px] font-bold text-slate-400 shrink-0">{b.status || "Pending"}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Dynamic primary action — matches the condition to advance from this stage */}
            {primaryAction && (
                <button
                    onClick={primaryAction.onClick}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                >
                    <primaryAction.icon className="h-3.5 w-3.5" /> {primaryAction.label}
                </button>
            )}

            {editIndex !== null && (
                <LoanBankModal
                    key={`${modalMode}-${editIndex}`}
                    leadId={leadId}
                    lead={lead}
                    editIndex={editIndex}
                    mode={modalMode}
                    onClose={() => setEditIndex(null)}
                />
            )}
        </div>
    );
}
