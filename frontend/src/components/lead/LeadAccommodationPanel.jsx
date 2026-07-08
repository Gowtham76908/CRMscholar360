import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    PlaneTakeoff, Pencil, X, Loader2, CheckCircle2, XCircle, Clock,
    Building2, Phone, User, Hash, CalendarDays, Plus, ShieldCheck,
    Users, Wallet, Percent, MapPin
} from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";
import AccommodationAgentModal from "./AccommodationAgentModal";

const STATUS_OPTIONS = ["Pending", "Confirmed", "Rejected"];
const BOOKING_STATUS_OPTIONS = ["Voucher Sent", "Partially Paid", "Fully Paid"];

const STATUS_STYLE = {
    Confirmed: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Rejected: "text-rose-700 bg-rose-50 border-rose-200",
    Pending: "text-amber-700 bg-amber-50 border-amber-200",
};
const STATUS_ICON = { Confirmed: CheckCircle2, Rejected: XCircle, Pending: Clock };

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

export default function LeadAccommodationPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const bookings = Array.isArray(lead?.customFields?.accommodation_bookings)
        ? lead.customFields.accommodation_bookings
        : [];

    const [editIndex, setEditIndex] = useState(null);
    const openEdit = (idx) => setEditIndex(idx);
    const openAdd = () => setEditIndex(bookings.length);

    const saveMut = useMutation({
        mutationFn: (nextList) =>
            api.patch(`/leads/${leadId}/custom-fields`, { fields: { accommodation_bookings: nextList } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Accommodation details updated");
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update accommodation details"),
    });

    const patchBooking = (idx, patch) =>
        saveMut.mutate(bookings.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

    const [detailForm, setDetailForm] = useState(null);

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-amber-100 focus:border-amber-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    const AddButton = (
        <button onClick={openAdd} className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Booking/Agent
        </button>
    );

    const renderCard = (b, idx) => {
        const StatusIcon = STATUS_ICON[b.status] || Clock;
        return (
            <div key={idx} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800 truncate">{b.agent_name || `Booking #${idx + 1}`}</h3>
                        {b.booking_type && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                {b.booking_type}
                            </span>
                        )}
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border", STATUS_STYLE[b.status] || STATUS_STYLE.Pending)}>
                            <StatusIcon className="h-3 w-3" /> {b.status || "Pending"}
                        </span>
                    </div>
                    <button onClick={() => openEdit(idx)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors shrink-0">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2">
                        <Field icon={MapPin} label="Provider Details">{b.provider_details}</Field>
                    </div>
                    <Field icon={Hash} label="Booking Ref / PNR">{b.booking_ref}</Field>
                    <Field icon={User} label="Contact Person">{b.contact_person}</Field>
                    <Field icon={Phone} label="Contact Number">{b.contact_number}</Field>
                    <Field icon={CalendarDays} label="Request Date">
                        {b.details_submitted_date ? new Date(b.details_submitted_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                    </Field>
                    {b.notes && (
                        <div className="col-span-2"><Field label="Notes">{b.notes}</Field></div>
                    )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Booking status</span>
                    <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                        {STATUS_OPTIONS.map(s => (
                            <button
                                key={s}
                                type="button"
                                disabled={saveMut.isPending}
                                onClick={() => {
                                    if (s === "Confirmed") {
                                        setDetailForm({
                                            idx,
                                            booking_cost: b.booking_cost || "",
                                            service_fee: b.service_fee || "",
                                            travel_date: b.travel_date || "",
                                            taxes_fees: b.taxes_fees || "",
                                            payment_due_date: b.payment_due_date || "",
                                            confirmation_date: b.confirmation_date || "",
                                            booking_status: b.booking_status || "",
                                        });
                                    } else {
                                        setDetailForm(null);
                                        patchBooking(idx, { status: s });
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

                {b.status === "Confirmed" && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 bg-amber-50/20 border border-amber-100/50 rounded-xl p-3 relative">
                        <Field icon={Wallet} label="Booking Cost">{b.booking_cost}</Field>
                        <Field icon={Percent} label="Service Fee / Markup">{b.service_fee}</Field>
                        <Field icon={CalendarDays} label="Travel/Check-in Date">
                            {b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                        </Field>
                        <Field icon={Wallet} label="Taxes & Fees">{b.taxes_fees}</Field>
                        <Field icon={CalendarDays} label="Payment Due Date">
                            {b.payment_due_date ? new Date(b.payment_due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                        </Field>
                        <Field icon={CalendarDays} label="Confirmation Date">
                            {b.confirmation_date ? new Date(b.confirmation_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                        </Field>
                        <Field icon={Wallet} label="Voucher Status">{b.booking_status}</Field>

                        <div className="col-span-2 flex justify-end mt-1 border-t border-amber-100/30 pt-2">
                            <button
                                type="button"
                                onClick={() => setDetailForm({
                                    idx,
                                    booking_cost: b.booking_cost || "",
                                    service_fee: b.service_fee || "",
                                    travel_date: b.travel_date || "",
                                    taxes_fees: b.taxes_fees || "",
                                    payment_due_date: b.payment_due_date || "",
                                    confirmation_date: b.confirmation_date || "",
                                    booking_status: b.booking_status || "",
                                })}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-950 bg-white border border-amber-200/80 px-2.5 py-1 rounded-md shadow-xs transition-all hover:bg-amber-50/50"
                            >
                                <Pencil className="h-3 w-3" /> Edit Booking Details
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
                        <Wallet className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-800">Booking Details — {bookings[detailForm.idx]?.agent_name}</h3>
                    </div>
                    <button onClick={() => setDetailForm(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelCls}>Booking Cost *</label>
                            <input className={inputCls} placeholder="e.g. ₹45,000" value={detailForm.booking_cost}
                                onChange={e => setDetailForm(s => ({ ...s, booking_cost: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Service Fee / Markup</label>
                            <input className={inputCls} placeholder="e.g. ₹5,000" value={detailForm.service_fee}
                                onChange={e => setDetailForm(s => ({ ...s, service_fee: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Travel/Check-in Date</label>
                            <input type="date" className={inputCls} value={detailForm.travel_date}
                                onChange={e => setDetailForm(s => ({ ...s, travel_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Taxes & Fees</label>
                            <input className={inputCls} placeholder="e.g. ₹1,200" value={detailForm.taxes_fees}
                                onChange={e => setDetailForm(s => ({ ...s, taxes_fees: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Payment Due Date</label>
                            <input type="date" className={inputCls} value={detailForm.payment_due_date}
                                onChange={e => setDetailForm(s => ({ ...s, payment_due_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Confirmation Date</label>
                            <input type="date" className={inputCls} value={detailForm.confirmation_date}
                                onChange={e => setDetailForm(s => ({ ...s, confirmation_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className={labelCls}>Voucher Status</label>
                            <select className={inputCls} value={detailForm.booking_status}
                                onChange={e => setDetailForm(s => ({ ...s, booking_status: e.target.value }))}>
                                <option value="">— Select —</option>
                                {BOOKING_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                    <button onClick={() => setDetailForm(null)} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                        Cancel
                    </button>
                    <button
                        disabled={saveMut.isPending || !String(detailForm.booking_cost || "").trim()}
                        onClick={() => {
                            const { idx, ...details } = detailForm;
                            patchBooking(idx, { status: "Confirmed", ...details });
                            setDetailForm(null);
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Save Details
                    </button>
                </div>
            </div>
        </div>
    );

    if (bookings.length === 0) {
        if (!embedded) return null;
        return (
            <>
                <div className="px-5 py-8 text-center space-y-3">
                    <p className="text-xs text-slate-400">No bookings added yet.</p>
                    <div className="flex justify-center">{AddButton}</div>
                </div>
                {editIndex !== null && (
                    <AccommodationAgentModal key={editIndex} leadId={leadId} lead={lead} editIndex={editIndex} onClose={() => setEditIndex(null)} />
                )}
            </>
        );
    }

    const confirmedCount = bookings.filter(b => b.status === "Confirmed").length;

    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <PlaneTakeoff className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold text-gray-800">Accommodation & Tickets Bookings</h2>
                <span className="text-xs text-gray-400 font-medium">
                    · {bookings.length} booking{bookings.length === 1 ? "" : "s"}{confirmedCount > 0 ? ` · ${confirmedCount} confirmed` : ""}
                </span>
                <div className="ml-auto">{AddButton}</div>
            </div>

            <div className="divide-y divide-gray-100">
                {bookings.map((b, idx) => renderCard(b, idx))}
            </div>

            {editIndex !== null && (
                <AccommodationAgentModal key={editIndex} leadId={leadId} lead={lead} editIndex={editIndex} onClose={() => setEditIndex(null)} />
            )}
            {renderDetailModal()}
        </div>
    );
}
