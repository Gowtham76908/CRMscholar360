import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlaneTakeoff, Plus, CheckCircle2, Clock, XCircle, IndianRupee, ClipboardCheck } from "lucide-react";
import AccommodationAgentModal from "./AccommodationAgentModal";

const STAGE_META = {
    ENQUIRY: {
        label: "Enquiry",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        instruction: "Add a note or reminder, then record the booking agent or provider details.",
    },
    ON_PROGRESS: {
        label: "On Progress",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        instruction: "Add the booking vendor/agent(s) before moving to Awaiting Confirmation.",
    },
    AWAITING_CONFIRMATION: {
        label: "Awaiting Confirmation",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        instruction: "Mark a booking as Confirmed with its cost details to move to Booking Confirmed.",
    },
    BOOKING_CONFIRMED: {
        label: "Booking Confirmed",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        instruction: "Raise an invoice and collect full payment to reach Commission Invoicing.",
    },
    COMMISSION_INVOICING: {
        label: "Commission Invoicing",
        badge: "bg-green-50 text-green-700 border-green-200",
        instruction: "Accommodation complete — commission is being invoiced.",
    },
    ARCHIVE: {
        label: "Archive",
        badge: "bg-slate-50 text-slate-700 border-slate-200",
        instruction: "Accommodation & Tickets booking has been archived.",
    },
};

const STATUS_ICON = { Confirmed: CheckCircle2, Rejected: XCircle, Pending: Clock };
const STATUS_COLOR = { Confirmed: "text-emerald-600", Rejected: "text-rose-500", Pending: "text-amber-500" };

export default function LeadAccommodationJourneyCard({ leadId, lead }) {
    const [editIndex, setEditIndex] = useState(null);
    const [modalMode, setModalMode] = useState("full");
    const navigate = useNavigate();

    const accommodationDept = lead?.leadDepartments?.find((d) => d.department === "ACCOMMODATION_TICKETS");
    if (!accommodationDept) return null;

    const bookings = Array.isArray(lead?.customFields?.accommodation_bookings) ? lead.customFields.accommodation_bookings : [];
    const meta = STAGE_META[accommodationDept.stage] || { label: accommodationDept.stage, badge: "bg-slate-50 text-slate-700 border-slate-200", instruction: "" };
    const confirmedCount = bookings.filter((b) => b.status === "Confirmed").length;

    const isDecisionStage = !["ENQUIRY", "ON_PROGRESS"].includes(accommodationDept.stage);

    const openBooking = (idx, m) => { setModalMode(m); setEditIndex(idx); };
    const openAdd = () => openBooking(bookings.length, "full");
    const openDecision = () => {
        if (bookings.length === 0) return openAdd();
        const idx = bookings.findIndex((b) => b.status !== "Confirmed");
        openBooking(idx === -1 ? 0 : idx, "decision");
    };
    const goInvoice = () => navigate(`/invoices?leadId=${leadId}&invoiceForLead=1&department=ACCOMMODATION_TICKETS`);

    const primaryAction =
        accommodationDept.stage === "ENQUIRY" || accommodationDept.stage === "ON_PROGRESS"
            ? { label: "Add Booking/Agent", icon: Plus, onClick: openAdd }
            : accommodationDept.stage === "AWAITING_CONFIRMATION"
            ? { label: "Update Booking Decision", icon: ClipboardCheck, onClick: openDecision }
            : accommodationDept.stage === "BOOKING_CONFIRMED"
            ? { label: "Create Invoice", icon: IndianRupee, onClick: goInvoice }
            : null;

    return (
        <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <PlaneTakeoff className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-gray-800 tracking-wide">ACCOMMODATION JOURNEY</h3>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.badge}`}>
                    {meta.label}
                </span>
            </div>

            {meta.instruction && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 mb-3">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Required Details</p>
                    <p className="text-xs font-semibold text-slate-600">💡 {meta.instruction}</p>
                </div>
            )}

            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">
                        Bookings {bookings.length > 0 && <span className="text-slate-500">· {bookings.length}{confirmedCount > 0 ? ` · ${confirmedCount} confirmed` : ""}</span>}
                    </p>
                    <button type="button" onClick={openAdd} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 hover:text-amber-800">
                        <Plus className="h-3 w-3" /> Add
                    </button>
                </div>
                {bookings.length === 0 ? (
                    <p className="text-xs text-slate-400">No bookings added yet.</p>
                ) : (
                    <div className="space-y-1.5">
                        {bookings.map((b, idx) => {
                            const Icon = STATUS_ICON[b.status] || Clock;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => openBooking(idx, isDecisionStage ? "decision" : "full")}
                                    className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                    <Icon className={`h-3.5 w-3.5 shrink-0 ${STATUS_COLOR[b.status] || "text-slate-400"}`} />
                                    <span className="text-xs font-semibold text-slate-700 truncate">{b.agent_name || `Booking #${idx + 1}`}</span>
                                    <span className="ml-auto text-[10px] font-bold text-slate-400 shrink-0">{b.status || "Pending"}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {primaryAction && (
                <button
                    onClick={primaryAction.onClick}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
                >
                    <primaryAction.icon className="h-3.5 w-3.5" /> {primaryAction.label}
                </button>
            )}

            {editIndex !== null && (
                <AccommodationAgentModal
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
