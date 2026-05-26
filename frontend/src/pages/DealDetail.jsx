import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft, IndianRupee, CalendarDays, User, Clock, Building,
    Plus, Receipt, CheckCircle, Send, ExternalLink, Loader2,
    FileText, ChevronDown, X, Pencil, AlertCircle, ChevronRight,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const fmt = (amount, currency = "INR") =>
    `${CURRENCY_SYMBOL[currency] ?? currency + " "}${Number(amount).toLocaleString("en-IN")}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STAGE_CFG = {
    NEW:         { label: "New",         badge: "bg-blue-100 text-blue-800 border-blue-200",     dot: "bg-blue-500"   },
    NEGOTIATION: { label: "Negotiation", badge: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
    WON:         { label: "Won",         badge: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-500"  },
    LOST:        { label: "Lost",        badge: "bg-red-100 text-red-800 border-red-200",         dot: "bg-red-500"    },
};

const INV_STATUS_CFG = {
    DRAFT:          { label: "Draft",          cls: "bg-gray-100 text-gray-600 border-gray-200"      },
    SENT:           { label: "Sent",           cls: "bg-blue-100 text-blue-700 border-blue-200"      },
    PARTIALLY_PAID: { label: "Partial",        cls: "bg-amber-100 text-amber-700 border-amber-200"   },
    PAID:           { label: "Paid",           cls: "bg-green-100 text-green-700 border-green-200"   },
    CANCELLED:      { label: "Cancelled",      cls: "bg-red-100 text-red-600 border-red-200"         },
};

// ─── Create Invoice Modal ──────────────────────────────────────────────────────

function CreateInvoiceModal({ deal, onClose, onCreated }) {
    const DEFAULT_TAX_RATES = [0, 5, 12, 18, 28];
    const [form, setForm] = useState({
        invoiceType: "PROFORMA",
        clientName:  deal.lead?.name  ?? "",
        clientEmail: deal.lead?.email ?? "",
        clientPhone: deal.lead?.phone ?? "",
        clientAddress: "",
        clientGstin: "",
        dueDate: "",
        notes: "",
        items: [{ description: deal.title, price: deal.amount, quantity: 1, taxRate: 0 }],
    });
    const [saving, setSaving] = useState(false);

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setItem = (i, k, v) => setForm(f => {
        const items = [...f.items];
        items[i] = { ...items[i], [k]: v };
        return { ...f, items };
    });
    const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: "", price: 0, quantity: 1, taxRate: 18 }] }));
    const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

    const computedTotal = form.items.reduce((sum, item) => {
        const taxable = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
        return sum + taxable + taxable * ((parseFloat(item.taxRate) || 0) / 100);
    }, 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await api.post(`/deals/${deal.id}/create-invoice`, {
                ...form,
                items: form.items.map(it => ({
                    ...it,
                    price: parseFloat(it.price) || 0,
                    quantity: parseFloat(it.quantity) || 1,
                    taxRate: parseFloat(it.taxRate) || 0,
                })),
            });
            toast.success(`Invoice ${data.invoiceNumber} created`);
            onCreated(data);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create invoice");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-base font-bold text-gray-900">Create Invoice from Deal</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Type */}
                    <div className="flex gap-2">
                        {["PROFORMA", "TAX_INVOICE"].map(t => (
                            <button key={t} type="button"
                                onClick={() => setField("invoiceType", t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    form.invoiceType === t
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                                }`}>
                                {t === "PROFORMA" ? "Proforma" : "Tax Invoice"}
                            </button>
                        ))}
                    </div>

                    {/* Client */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Client Name *</label>
                            <input required value={form.clientName} onChange={e => setField("clientName", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
                            <input type="email" value={form.clientEmail} onChange={e => setField("clientEmail", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Phone</label>
                            <input value={form.clientPhone} onChange={e => setField("clientPhone", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">GSTIN</label>
                            <input value={form.clientGstin} onChange={e => setField("clientGstin", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Due Date</label>
                            <input type="date" value={form.dueDate} onChange={e => setField("dueDate", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line Items</label>
                            <button type="button" onClick={addItem}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Add item
                            </button>
                        </div>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Description</th>
                                        <th className="text-right px-2 py-2 font-semibold text-gray-500 w-20">Price</th>
                                        <th className="text-right px-2 py-2 font-semibold text-gray-500 w-14">Qty</th>
                                        <th className="text-right px-2 py-2 font-semibold text-gray-500 w-16">Tax %</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {form.items.map((item, i) => (
                                        <tr key={i}>
                                            <td className="px-3 py-1.5">
                                                <input value={item.description} onChange={e => setItem(i, "description", e.target.value)}
                                                    placeholder="Item description"
                                                    className="w-full border-0 outline-none text-sm text-gray-800 bg-transparent" />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <input type="number" min="0" value={item.price} onChange={e => setItem(i, "price", e.target.value)}
                                                    className="w-full border-0 outline-none text-sm text-right text-gray-800 bg-transparent" />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <input type="number" min="1" value={item.quantity} onChange={e => setItem(i, "quantity", e.target.value)}
                                                    className="w-full border-0 outline-none text-sm text-right text-gray-800 bg-transparent" />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <select value={item.taxRate} onChange={e => setItem(i, "taxRate", e.target.value)}
                                                    className="w-full border-0 outline-none text-sm text-right text-gray-800 bg-transparent">
                                                    {DEFAULT_TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                                </select>
                                            </td>
                                            <td className="px-2">
                                                {form.items.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end mt-2 pr-2">
                            <span className="text-sm font-black text-gray-900">
                                Total: ₹{computedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
                        <textarea rows={2} value={form.notes} onChange={e => setField("notes", e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                </form>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Create Invoice
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Mark Paid Modal ───────────────────────────────────────────────────────────

function MarkPaidModal({ invoice, onClose, onPaid }) {
    const [amount, setAmount] = useState(invoice.balance?.toString() ?? invoice.total?.toString() ?? "");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/invoices/${invoice.id}/payments`, {
                amount: parseFloat(amount),
                type: "CREDIT",
                description: "Payment received",
            });
            toast.success("Payment recorded");
            onPaid();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to record payment");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-gray-900">Record Payment</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                    <p className="text-xs text-gray-500">Invoice <span className="font-semibold text-gray-800">{invoice.invoiceNumber}</span> · Balance: <span className="font-semibold text-gray-800">₹{Number(invoice.balance ?? invoice.total).toLocaleString("en-IN")}</span></p>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Amount</label>
                        <input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Send Email Modal ──────────────────────────────────────────────────────────

function SendEmailModal({ invoice, onClose }) {
    const [email, setEmail] = useState(invoice.clientEmail ?? "");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/invoices/${invoice.id}/send-email`, { recipientEmail: email });
            toast.success(`Invoice sent to ${email}`);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to send email");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-gray-900">Send Invoice</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                    <p className="text-xs text-gray-500">Sending <span className="font-semibold text-gray-800">{invoice.invoiceNumber}</span></p>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Recipient Email</label>
                        <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Send
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Invoice Row ───────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onMarkPaid, onSendEmail }) {
    const cfg = INV_STATUS_CFG[invoice.status] ?? INV_STATUS_CFG.DRAFT;
    const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== "PAID";

    return (
        <tr className="hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3">
                <div className="font-semibold text-gray-900 text-sm">{invoice.invoiceNumber}</div>
                <div className="text-[11px] text-gray-400">{invoice.invoiceType === "PROFORMA" ? "Proforma" : "Tax Invoice"}</div>
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                ₹{Number(invoice.total).toLocaleString("en-IN")}
            </td>
            <td className="px-4 py-3">
                <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                    {cfg.label}
                </span>
                {isOverdue && <span className="ml-1 text-[10px] font-bold text-red-500">Overdue</span>}
            </td>
            <td className="px-4 py-3 text-sm text-green-700 font-semibold">
                ₹{Number(invoice.totalPaid ?? 0).toLocaleString("en-IN")}
            </td>
            <td className="px-4 py-3 text-sm text-red-600 font-semibold">
                ₹{Number(invoice.balance ?? invoice.total).toLocaleString("en-IN")}
            </td>
            <td className="px-4 py-3 text-xs text-gray-500">
                {fmtDate(invoice.createdAt)}
                {invoice.dueDate && <div className="text-[11px] text-gray-400">Due {fmtDate(invoice.dueDate)}</div>}
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    <Link to="/invoices" title="Open in Invoices"
                        className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                        <button title="Record payment" onClick={() => onMarkPaid(invoice)}
                            className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                            <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button title="Send email" onClick={() => onSendEmail(invoice)}
                        className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Send className="h-3.5 w-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

// ─── Stage Selector ────────────────────────────────────────────────────────────

const STAGES = ["NEW", "NEGOTIATION", "WON", "LOST"];

function StageSelector({ deal, onStageChange }) {
    const [open, setOpen] = useState(false);
    const cfg = STAGE_CFG[deal.stage] ?? STAGE_CFG.NEW;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors hover:opacity-80 ${cfg.badge}`}
            >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
                <ChevronDown className="h-3 w-3" />
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                    {STAGES.map(s => {
                        const c = STAGE_CFG[s];
                        return (
                            <button key={s}
                                onClick={() => { onStageChange(s); setOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors ${deal.stage === s ? "text-indigo-600" : "text-gray-700"}`}
                            >
                                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                                {c.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Deal Detail Page ──────────────────────────────────────────────────────────

export default function DealDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [showCreateInvoice, setShowCreateInvoice] = useState(false);
    const [markPaidInvoice, setMarkPaidInvoice]     = useState(null);
    const [sendEmailInvoice, setSendEmailInvoice]   = useState(null);

    const { data: deal, isLoading: dealLoading, error: dealError } = useQuery({
        queryKey: ["deal", id],
        queryFn: () => api.get(`/deals/${id}`).then(r => r.data),
    });

    const stageMutation = useMutation({
        mutationFn: (stage) => api.patch(`/deals/${id}`, { stage }).then(r => r.data),
        onSuccess: (updated) => {
            queryClient.setQueryData(["deal", id], updated);
            toast.success(`Stage changed to ${updated.stage}`);
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to update stage"),
    });

    const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
        queryKey: ["deal-invoices", id],
        queryFn: () => api.get(`/deals/${id}/invoices`).then(r => r.data),
        enabled: !!deal,
    });

    const invalidateInvoices = () => queryClient.invalidateQueries({ queryKey: ["deal-invoices", id] });

    if (dealLoading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
    );

    if (dealError || !deal) return (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertCircle className="h-8 w-8 text-red-300" />
            <p className="text-sm text-gray-500">Deal not found or access denied.</p>
            <button onClick={() => navigate("/deals")} className="text-sm text-indigo-600 hover:underline">← Back to Deals</button>
        </div>
    );

    const owner = deal.assignedEmployee?.name ?? deal.createdBy?.name ?? "—";

    const totalInvoiced  = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
    const totalCollected = invoices.reduce((s, i) => s + (i.totalPaid ?? 0), 0);
    const totalOutstanding = totalInvoiced - totalCollected;

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* Back nav */}
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>

            {/* Deal Header Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <StageSelector deal={deal} onStageChange={(s) => stageMutation.mutate(s)} />
                        </div>
                        <h1 className="text-xl font-black text-gray-900 truncate">{deal.title}</h1>
                        <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                            <Building className="h-3.5 w-3.5 shrink-0" />
                            {deal.lead ? (
                                <Link to={`/leads/${deal.lead.id}`} className="hover:text-indigo-600 hover:underline truncate">
                                    {deal.lead.name}{deal.lead.company && ` · ${deal.lead.company}`}
                                </Link>
                            ) : "—"}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-gray-900">{fmt(deal.amount, deal.currency)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{deal.currency}</p>
                    </div>
                </div>

                {/* Meta grid */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Owner</p>
                        <div className="mt-1 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm font-semibold text-gray-800">{owner}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Created</p>
                        <div className="mt-1 flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm text-gray-700">{fmtDate(deal.createdAt)}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Days Open</p>
                        <div className="mt-1 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            <span className={`text-sm font-bold ${deal.daysOpen > 30 ? "text-red-600" : deal.daysOpen > 7 ? "text-orange-500" : "text-green-600"}`}>
                                {deal.daysOpen}d
                            </span>
                        </div>
                    </div>
                    {deal.closedAt && (
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Closed</p>
                            <div className="mt-1 flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-sm text-gray-700">{fmtDate(deal.closedAt)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {deal.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{deal.notes}</p>
                    </div>
                )}
            </div>

            {/* Invoice Section */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-indigo-500" />
                        <h2 className="text-sm font-bold text-gray-900">Invoices</h2>
                        {invoices.length > 0 && (
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {invoices.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setShowCreateInvoice(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Create Invoice
                    </button>
                </div>

                {/* Revenue summary strip (only when invoices exist) */}
                {invoices.length > 0 && (
                    <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
                        <div className="px-5 py-3 text-center">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total Invoiced</p>
                            <p className="text-base font-black text-gray-900 mt-0.5">₹{totalInvoiced.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="px-5 py-3 text-center">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Collected</p>
                            <p className="text-base font-black text-green-600 mt-0.5">₹{totalCollected.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="px-5 py-3 text-center">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Outstanding</p>
                            <p className="text-base font-black text-red-500 mt-0.5">₹{totalOutstanding.toLocaleString("en-IN")}</p>
                        </div>
                    </div>
                )}

                {/* Table */}
                {invoicesLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-3">
                        <FileText className="h-10 w-10 text-gray-200" />
                        <p className="text-sm font-semibold text-gray-500">No invoices yet</p>
                        <p className="text-xs text-gray-400">Create an invoice to start tracking realized revenue.</p>
                        <button onClick={() => setShowCreateInvoice(true)}
                            className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
                            <Plus className="h-3.5 w-3.5" /> Create First Invoice
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {invoices.map(inv => (
                                    <InvoiceRow key={inv.id} invoice={inv}
                                        onMarkPaid={setMarkPaidInvoice}
                                        onSendEmail={setSendEmailInvoice}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreateInvoice && (
                <CreateInvoiceModal
                    deal={deal}
                    onClose={() => setShowCreateInvoice(false)}
                    onCreated={() => { setShowCreateInvoice(false); invalidateInvoices(); }}
                />
            )}
            {markPaidInvoice && (
                <MarkPaidModal
                    invoice={markPaidInvoice}
                    onClose={() => setMarkPaidInvoice(null)}
                    onPaid={() => { setMarkPaidInvoice(null); invalidateInvoices(); }}
                />
            )}
            {sendEmailInvoice && (
                <SendEmailModal
                    invoice={sendEmailInvoice}
                    onClose={() => setSendEmailInvoice(null)}
                />
            )}
        </div>
    );
}
