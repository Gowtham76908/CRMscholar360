import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, Plus, CheckCircle2, Clock, XCircle, IndianRupee, ClipboardCheck, FileText } from "lucide-react";
import ForexDetailsModal from "./ForexDetailsModal";

const STAGE_META = {
    ENQUIRY: {
        label: "Enquiry",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        instruction: "Fill in Forex Date, Amount, and Service Company Name to proceed.",
    },
    ON_PROGRESS: {
        label: "In Progress",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        instruction: "Upload Forex Receipt and SWIFT Copy (both must be PDF) to move to Completed.",
    },
    PROCESS_COMPLETED: {
        label: "Process Completed",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        instruction: "Raise a Forex invoice and collect full payment to reach Commission Invoicing.",
    },
    COMMISSION_INVOICING: {
        label: "Commission Invoicing",
        badge: "bg-green-50 text-green-700 border-green-200",
        instruction: "Forex complete — commission is being invoiced.",
    },
    ARCHIVE: {
        label: "Archived",
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        instruction: "Forex process archived / cancelled.",
    },
};

export default function LeadForexJourneyCard({ leadId, lead }) {
    const [showModal, setShowModal] = useState(false);
    const navigate = useNavigate();

    const forexDept = lead?.leadDepartments?.find((d) => d.department === "FOREX");
    if (!forexDept) return null; // lead has no Forex service — nothing to show

    const cf = lead?.customFields || {};
    const meta = STAGE_META[forexDept.stage] || { label: forexDept.stage, badge: "bg-slate-50 text-slate-700 border-slate-200", instruction: "" };

    const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
    const hasReceipt = filled(cf.forex_receipt) || (cf.documents || []).some(d => d.name === "Forex Receipt");
    const hasSwift = filled(cf.forex_swift_copy) || (cf.documents || []).some(d => d.name === "Forex SWIFT Copy");

    const goInvoice = () => navigate(`/invoices?leadId=${leadId}&invoiceForLead=1&department=FOREX`);

    const primaryAction =
        forexDept.stage === "ENQUIRY"
            ? { label: "Fill Forex Details", icon: Plus, onClick: () => setShowModal(true) }
            : forexDept.stage === "ON_PROGRESS"
            ? { label: "Upload Forex PDF Documents", icon: ClipboardCheck, onClick: () => setShowModal(true) }
            : forexDept.stage === "PROCESS_COMPLETED"
            ? { label: "Create Forex Invoice", icon: IndianRupee, onClick: goInvoice }
            : null;

    return (
        <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-violet-500" />
                    <h3 className="text-sm font-bold text-gray-800 tracking-wide">FOREX JOURNEY</h3>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.badge}`}>
                    {meta.label}
                </span>
            </div>

            {/* Required details hint */}
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{meta.instruction}</p>

            {/* Summary info list */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-2 mb-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Forex Date</p>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {cf.forex_date ? new Date(cf.forex_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : <span className="text-slate-350 italic">None set</span>}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Amount</p>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {cf.forex_amount || <span className="text-slate-350 italic">None set</span>}
                        </p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Service Company Name</p>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {cf.forex_service_company || <span className="text-slate-350 italic">None set</span>}
                        </p>
                    </div>
                </div>

                {/* Upload status markers */}
                <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-500">
                        {hasReceipt ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span>Receipt</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-500">
                        {hasSwift ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span>SWIFT Copy</span>
                    </div>
                </div>
            </div>

            {/* Stage-progression CTA button */}
            {primaryAction && (
                <button
                    onClick={primaryAction.onClick}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black text-white bg-violet-600 hover:bg-violet-750 hover:shadow-md hover:shadow-violet-100/50 shadow-sm transition-all cursor-pointer"
                >
                    <primaryAction.icon className="h-4 w-4" />
                    {primaryAction.label}
                </button>
            )}

            {showModal && (
                <ForexDetailsModal
                    leadId={leadId}
                    lead={lead}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
