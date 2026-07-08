import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, X, Loader2, PlaneTakeoff, ShieldCheck, Users, Wallet } from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";

const BOOKING_TYPES = ["Accommodation", "Flight Ticket", "Transfer / Cab", "Other"];
const STATUS_OPTIONS = ["Pending", "Confirmed", "Rejected"];
const BOOKING_STATUS_OPTIONS = ["Voucher Sent", "Partially Paid", "Fully Paid"];

const emptyBooking = {
    agent_name: "", booking_type: "", provider_details: "", contact_person: "", contact_number: "",
    booking_ref: "", details_submitted_date: "", notes: "",
    status: "Pending",
    booking_cost: "", service_fee: "", travel_date: "", taxes_fees: "",
    payment_due_date: "", confirmation_date: "", booking_status: "",
};

export default function AccommodationAgentModal({ leadId, lead, editIndex, onClose, onSaved, mode = "full" }) {
    const isDecision = mode === "decision";
    const queryClient = useQueryClient();
    const bookings = Array.isArray(lead?.customFields?.accommodation_bookings) ? lead.customFields.accommodation_bookings : [];
    const isAdding = editIndex === bookings.length;

    const [draft, setDraft] = useState(() =>
        isAdding ? { ...emptyBooking } : { ...emptyBooking, ...(bookings[editIndex] || {}) }
    );
    const [addingAgent, setAddingAgent] = useState(false);
    const [customAgent, setCustomAgent] = useState("");

    const saveMut = useMutation({
        mutationFn: (nextList) =>
            api.patch(`/leads/${leadId}/custom-fields`, { fields: { accommodation_bookings: nextList } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Accommodation details updated");
            onSaved?.();
            onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update accommodation details"),
    });

    const { data: agentList = [] } = useQuery({
        queryKey: ["accommodation-agents"],
        queryFn: () => api.get("/accommodation-agents").then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
    const agentNames = agentList.map(a => a.name);

    const createAgentMut = useMutation({
        mutationFn: (name) => api.post("/accommodation-agents", { name }).then(r => r.data),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ["accommodation-agents"] });
            setField("agent_name", created.name);
            setAddingAgent(false);
            setCustomAgent("");
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to add agent"),
    });

    const setField = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

    const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
    const REQUIRED_FIELDS = ["agent_name", "booking_type", "booking_ref", "details_submitted_date"];
    
    const confirmedOk = draft.status !== "Confirmed" || filled(draft.booking_cost);
    const isValid = isDecision ? confirmedOk : (REQUIRED_FIELDS.every((k) => filled(draft[k])) && confirmedOk);

    const handleSave = () => {
        if (!isValid) return;
        const nextList = isAdding
            ? [...bookings, { ...draft }]
            : bookings.map((b, i) => (i === editIndex ? { ...b, ...draft } : b));
        saveMut.mutate(nextList);
    };

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-amber-100 focus:border-amber-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && onClose()}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                        <PlaneTakeoff className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-800">{isDecision ? "Booking Decision" : (isAdding ? "Add Booking/Agent" : (draft.agent_name || "Booking"))}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                  {isDecision ? (
                    <>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                            <PlaneTakeoff className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">{draft.agent_name || "Agent"}</span>
                            {draft.booking_type && <span className="text-[10px] font-bold text-slate-400">· {draft.booking_type}</span>}
                        </div>

                        <div className="space-y-1">
                            <label className={labelCls}>Booking Status <span className="text-rose-500">*</span></label>
                            <select className={inputCls} value={draft.status || "Pending"} onChange={e => setField("status", e.target.value)}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {draft.status === "Confirmed" && (
                            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                                <div className="col-span-2 flex items-center gap-1.5">
                                    <Wallet className="h-3.5 w-3.5 text-amber-600" />
                                    <span className="text-[11px] font-bold text-amber-700">Confirmed Booking Details</span>
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Booking Cost <span className="text-rose-500">*</span></label>
                                    <input className={inputCls} placeholder="e.g. ₹45,000" value={draft.booking_cost || ""} onChange={e => setField("booking_cost", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Service Fee / Markup</label>
                                    <input className={inputCls} placeholder="e.g. ₹5,000" value={draft.service_fee || ""} onChange={e => setField("service_fee", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Travel/Check-in Date</label>
                                    <input type="date" className={inputCls} value={draft.travel_date || ""} onChange={e => setField("travel_date", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Taxes & Fees</label>
                                    <input className={inputCls} placeholder="e.g. ₹1,200" value={draft.taxes_fees || ""} onChange={e => setField("taxes_fees", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Payment Due Date</label>
                                    <input type="date" className={inputCls} value={draft.payment_due_date || ""} onChange={e => setField("payment_due_date", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelCls}>Confirmation Date</label>
                                    <input type="date" className={inputCls} value={draft.confirmation_date || ""} onChange={e => setField("confirmation_date", e.target.value)} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className={labelCls}>Disbursement / Voucher Status</label>
                                    <select className={inputCls} value={draft.booking_status || ""} onChange={e => setField("booking_status", e.target.value)}>
                                        <option value="">— Select —</option>
                                        {BOOKING_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </>
                  ) : (
                    <>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className={labelCls}>Agent/Company <span className="text-rose-500">*</span></label>
                                {!addingAgent && (
                                    <button type="button" onClick={() => { setAddingAgent(true); setCustomAgent(""); }}
                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800">+ Add custom</button>
                                )}
                            </div>
                            {addingAgent ? (
                                <div className="flex gap-1.5">
                                    <input autoFocus className={inputCls} placeholder="Company/Agent name" value={customAgent}
                                        onChange={e => setCustomAgent(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (customAgent.trim() && !createAgentMut.isPending) createAgentMut.mutate(customAgent.trim()); } }} />
                                    <button type="button" disabled={!customAgent.trim() || createAgentMut.isPending}
                                        onClick={() => { if (customAgent.trim()) createAgentMut.mutate(customAgent.trim()); }}
                                        className="shrink-0 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1">
                                        {createAgentMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
                                    </button>
                                    <button type="button" onClick={() => { setAddingAgent(false); setCustomAgent(""); }}
                                        className="shrink-0 px-2 py-1 border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:bg-slate-50">✕</button>
                                </div>
                            ) : (
                                <select className={inputCls} value={draft.agent_name || ""}
                                    onChange={e => setField("agent_name", e.target.value)}>
                                    <option value="">Select Agent/Company</option>
                                    {agentNames.map(b => <option key={b} value={b}>{b}</option>)}
                                    {draft.agent_name && !agentNames.includes(draft.agent_name) && (
                                        <option value={draft.agent_name}>{draft.agent_name}</option>
                                    )}
                                </select>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className={labelCls}>Booking Type <span className="text-rose-500">*</span></label>
                            <select className={inputCls} value={draft.booking_type || ""} onChange={e => setField("booking_type", e.target.value)}>
                                <option value="">— Select —</option>
                                {BOOKING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className={labelCls}>Provider Details (e.g. Hotel / Room / Airline / Route)</label>
                            <input className={inputCls} placeholder="e.g. Double Room at Amber Heights / Flight EK501" value={draft.provider_details || ""} onChange={e => setField("provider_details", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Booking Ref / PNR <span className="text-rose-500">*</span></label>
                            <input className={inputCls} placeholder="e.g. BK-987213" value={draft.booking_ref || ""} onChange={e => setField("booking_ref", e.target.value)} />
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
                            <label className={labelCls}>Request / Submitted Date <span className="text-rose-500">*</span></label>
                            <input type="date" className={inputCls} value={draft.details_submitted_date || ""} onChange={e => setField("details_submitted_date", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelCls}>Notes</label>
                        <textarea rows={2} className={cn(inputCls, "resize-none")} value={draft.notes || ""} onChange={e => setField("notes", e.target.value)} />
                    </div>

                    </>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2 sticky bottom-0 bg-white">
                    <p className="text-[10px] font-semibold text-slate-400">
                        <span className="text-rose-500">*</span> required to save and to advance the workflow
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saveMut.isPending || !isValid}
                            title={isValid ? "" : "Fill all required (*) fields first"}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
