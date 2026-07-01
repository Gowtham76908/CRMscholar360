import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Wallet, Pencil, X, Loader2, CreditCard, CalendarDays, History,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

const PAYMENT_MODES = ["Bank Transfer", "Credit Card", "Debit Card", "UPI", "Cash", "Cheque", "Other"];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function LeadDepositPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const cf = lead?.customFields || {};

    const current = {
        deposit_amount: cf.deposit_amount || "",
        payment_mode: cf.payment_mode || "",
        payment_date: cf.payment_date || "",
    };
    const history = Array.isArray(cf.deposit_history) ? cf.deposit_history : [];
    const hasDeposit = !!(current.deposit_amount || current.payment_mode || current.payment_date);

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(current);

    // As a standalone card, only surface once a deposit exists. When embedded in the
    // Activity tabs, always render so the user can add one.
    if (!embedded && !hasDeposit && history.length === 0) return null;

    const saveMut = useMutation({
        mutationFn: (fields) => api.patch(`/leads/${leadId}/custom-fields`, { fields }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("Deposit details updated");
            setOpen(false);
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update deposit details"),
    });

    const openEdit = () => {
        setDraft(current);
        setOpen(true);
    };

    const handleSave = () => {
        // Append the new values as a history entry (most recent first).
        const entry = {
            deposit_amount: draft.deposit_amount || "",
            payment_mode: draft.payment_mode || "",
            payment_date: draft.payment_date || "",
            recordedAt: new Date().toISOString(),
            recordedBy: user?.name || "",
        };
        saveMut.mutate({
            deposit_amount: draft.deposit_amount || "",
            payment_mode: draft.payment_mode || "",
            payment_date: draft.payment_date || "",
            deposit_history: [entry, ...history],
        });
    };

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            {/* Heading */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    <h2 className="text-sm font-bold text-gray-800">Deposit</h2>
                </div>
                <button onClick={openEdit} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> {hasDeposit ? "Edit" : "Add"}
                </button>
            </div>

            <div className="px-5 py-4">
                {hasDeposit ? (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className={labelCls}>Amount</p>
                            <p className="text-sm font-bold text-slate-800 break-words">{current.deposit_amount || "—"}</p>
                        </div>
                        <div>
                            <p className={labelCls}>Mode</p>
                            <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                <CreditCard className="h-3.5 w-3.5 text-slate-400" /> {current.payment_mode || "—"}
                            </p>
                        </div>
                        <div>
                            <p className={labelCls}>Date</p>
                            <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(current.payment_date)}
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400">No deposit recorded yet.</p>
                )}

                {/* History */}
                {history.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                            <History className="h-3 w-3" /> History
                        </p>
                        <ul className="space-y-2">
                            {history.map((h, i) => (
                                <li key={i} className="flex items-start gap-2 text-[11px]">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-700">
                                            {h.deposit_amount || "—"} · {h.payment_mode || "—"} · {fmtDate(h.payment_date)}
                                        </p>
                                        <p className="text-slate-400">
                                            {fmtDateTime(h.recordedAt)}{h.recordedBy ? ` · ${h.recordedBy}` : ""}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Edit modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-emerald-500" />
                                <h3 className="text-sm font-bold text-slate-800">Deposit Details</h3>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className={labelCls}>Deposit Amount</label>
                                <input className={inputCls} placeholder="e.g. $5,000 CAD / £3,000" value={draft.deposit_amount || ""} onChange={e => setDraft(d => ({ ...d, deposit_amount: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Mode of Payment</label>
                                <select className={inputCls} value={draft.payment_mode || ""} onChange={e => setDraft(d => ({ ...d, payment_mode: e.target.value }))}>
                                    <option value="">— Select —</option>
                                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>Date of Payment</label>
                                <input type="date" className={inputCls} value={draft.payment_date || ""} onChange={e => setDraft(d => ({ ...d, payment_date: e.target.value }))} />
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button onClick={() => setOpen(false)} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                            <button onClick={handleSave} disabled={saveMut.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
