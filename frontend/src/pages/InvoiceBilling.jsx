import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Dialog from "../components/ui/Dialog";
import {
    Plus, X, IndianRupee, TrendingUp, TrendingDown, Clock, CheckCircle,
    AlertCircle, FileText, Mail, Pencil, Receipt, BarChart3, Banknote,
    RefreshCw, Send, Eye, Trash2, Building2, Save, ChevronRight, Minus,
    Info, Hash, ChevronLeft, Users, Download, Search,
} from "lucide-react";
import api from "../api/axios";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_CFG = {
    DRAFT:          { label: "Draft",    cls: "bg-slate-100 text-slate-600",    icon: FileText },
    SENT:           { label: "Sent",     cls: "bg-blue-50 text-blue-600",       icon: Send },
    PARTIALLY_PAID: { label: "Partial",  cls: "bg-amber-50 text-amber-600",     icon: Clock },
    PAID:           { label: "Paid",     cls: "bg-emerald-50 text-emerald-600", icon: CheckCircle },
    CANCELLED:      { label: "Cancelled",cls: "bg-red-50 text-red-500",         icon: X },
};
const TYPE_CFG = {
    PROFORMA:    { label: "Proforma Invoice", cls: "bg-violet-50 text-violet-600 border-violet-200" },
    TAX_INVOICE: { label: "Tax Invoice",      cls: "bg-indigo-50 text-indigo-600 border-indigo-200" },
};
const EMPTY_ITEM = { description: "", price: "", quantity: 1, taxRate: 18 };

// ─── Atoms ──────────────────────────────────────────────────────────────────
// ─── Atoms ──────────────────────────────────────────────────────────────────
const Badge = ({ status }) => {
    const c = STATUS_CFG[status] || STATUS_CFG.DRAFT;
    const I = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm/5 transition-all ${c.cls}`}>
            <I className="h-3 w-3 shrink-0" />{c.label}
        </span>
    );
};
const TypePill = ({ type }) => {
    const c = TYPE_CFG[type] || TYPE_CFG.PROFORMA;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${c.cls}`}>{c.label}</span>;
};
const Field = ({ label, children, half, className = "" }) => (
    <div className={`flex flex-col gap-1.5 ${half ? "col-span-1" : "col-span-2"} ${className}`}>
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
        {children}
    </div>
);
const Input = ({ className = "", ...props }) => (
    <input
        className={`w-full h-10 px-3.5 text-sm border border-zinc-200 rounded-xl bg-white text-zinc-800 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all ${className}`}
        {...props}
    />
);
const Select = ({ children, className = "", ...props }) => (
    <select
        className={`w-full h-10 px-3.5 text-sm border border-zinc-200 rounded-xl bg-white text-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all ${className}`}
        {...props}
    >
        {children}
    </select>
);

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, accent, count }) => {
    const accents = {
        indigo:  { bg: "bg-indigo-50 border-indigo-100",  icon: "text-indigo-600",  val: "text-indigo-900" },
        emerald: { bg: "bg-emerald-50 border-emerald-100", icon: "text-emerald-600", val: "text-emerald-900" },
        amber:   { bg: "bg-amber-50 border-amber-100",   icon: "text-amber-600",   val: "text-amber-900" },
        red:     { bg: "bg-red-50 border-red-100",     icon: "text-red-600",     val: "text-red-900" },
        violet:  { bg: "bg-violet-50 border-violet-100",  icon: "text-violet-600",  val: "text-violet-900" },
    };
    const a = accents[accent] || accents.indigo;
    return (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex items-start gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
            <div className={`p-3 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${a.bg}`}>
                <Icon className={`h-5 w-5 ${a.icon}`} />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
                {count !== undefined
                    ? <p className={`text-xl sm:text-2xl font-black mt-1 tracking-tight truncate ${a.val}`} title={count}>{count}</p>
                    : <p className={`text-xl sm:text-2xl font-black mt-1 tracking-tight truncate ${a.val}`} title={`₹${fmt(value)}`}>₹{fmt(value)}</p>
                }
                {sub && <p className="text-xs text-zinc-400 mt-1 leading-none font-medium">{sub}</p>}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE / EDIT INVOICE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const CreateInvoiceModal = ({ onClose, editData = null, company, clientPrefill = null }) => {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        invoiceType:   editData?.invoiceType   || "TAX_INVOICE",
        clientName:    editData?.clientName    || clientPrefill?.clientName    || "",
        clientEmail:   editData?.clientEmail   || clientPrefill?.clientEmail   || "",
        clientPhone:   editData?.clientPhone   || clientPrefill?.clientPhone   || "",
        clientAddress: editData?.clientAddress || clientPrefill?.clientAddress || "",
        clientGstin:   editData?.clientGstin   || clientPrefill?.clientGstin   || "",
        dueDate:       editData?.dueDate ? editData.dueDate.split("T")[0] : "",
        notes:         editData?.notes || company?.defaultNotes || "",
    });
    const [items, setItems] = useState(
        editData?.items?.length
            ? editData.items.map((i) => ({ description: i.description, price: i.price, quantity: i.quantity, taxRate: i.taxRate }))
            : [{ ...EMPTY_ITEM }]
    );
    const [error, setError] = useState("");
    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const mutation = useMutation({
        mutationFn: (d) => editData ? api.patch(`/invoices/${editData.id}`, d) : api.post("/invoices", d),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["balance-sheet"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || e.response?.data?.message || "Failed to save invoice"),
    });

    const addItem    = () => setItems((p) => [...p, { ...EMPTY_ITEM }]);
    const removeItem = (i) => setItems((p) => p.filter((_, x) => x !== i));
    const setItem    = (i, k, v) => setItems((p) => { const n = [...p]; n[i] = { ...n[i], [k]: v }; return n; });

    const calcRow = (item) => {
        const taxable = parseFloat(((+item.price || 0) * (+item.quantity || 1)).toFixed(2));
        const tax     = parseFloat((taxable * (+item.taxRate || 0) / 100).toFixed(2));
        return { taxable, tax, amount: parseFloat((taxable + tax).toFixed(2)) };
    };
    const { subtotal, totalTax } = items.reduce(
        (acc, i) => { const r = calcRow(i); return { subtotal: acc.subtotal + r.taxable, totalTax: acc.totalTax + r.tax }; },
        { subtotal: 0, totalTax: 0 }
    );
    // Mirror the backend: same GSTIN state code → CGST+SGST, different → IGST.
    // A client without a GSTIN (B2C) defaults to intrastate.
    const companyState = (company?.gstin || "").trim().slice(0, 2);
    const clientState  = (form.clientGstin || "").trim().slice(0, 2);
    const isInterstate = Boolean(clientState) && Boolean(companyState) && clientState !== companyState;
    const cgst  = isInterstate ? 0 : parseFloat((totalTax / 2).toFixed(2));
    const sgst  = isInterstate ? 0 : parseFloat((totalTax - cgst).toFixed(2));
    const igst  = isInterstate ? parseFloat(totalTax.toFixed(2)) : 0;
    const total = parseFloat((subtotal + totalTax).toFixed(2));

    const submit = () => {
        setError("");
        if (!form.clientName.trim())                               return setError("Client name is required.");
        if (items.some((i) => !i.description.trim() || !i.price)) return setError("All line items need a description and price.");
        
        const formattedItems = items.map((i) => {
            const r = calcRow(i);
            return {
                description: i.description.trim(),
                price: parseFloat(i.price),
                quantity: parseInt(i.quantity, 10) || 1,
                taxRate: parseFloat(i.taxRate) || 0,
                taxableValue: r.taxable,
                amount: r.amount,
            };
        });

        const payload = {
            ...form,
            dueDate: form.dueDate || null,
            subtotal,
            cgst,
            sgst,
            igst,
            total,
            items: formattedItems,
            // Link the invoice to the lead it was raised for (commission-invoicing flow),
            // so full payment auto-advances the lead and credits the consultant's revenue.
            ...(clientPrefill?.leadId ? { leadId: clientPrefill.leadId } : {}),
        };

        mutation.mutate(payload);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg"><Receipt className="h-4 w-4 text-indigo-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">{editData ? "Edit Invoice" : "New Invoice"}</h2>
                            <p className="text-xs text-gray-400">{company?.companyName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="ml-2 p-1.5 hover:bg-gray-100 rounded-lg transition">
                            <X className="h-4 w-4 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">

                        {/* Bill To */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Bill To</span>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-3">
                                <Field label="Client / Company Name *" className="col-span-2">
                                    <Input value={form.clientName} onChange={(e) => setField("clientName", e.target.value)} placeholder="e.g. Magicc Brush" />
                                </Field>
                                <Field label="Email" half>
                                    <Input type="email" value={form.clientEmail} onChange={(e) => setField("clientEmail", e.target.value)} placeholder="client@email.com" />
                                </Field>
                                <Field label="Phone" half>
                                    <Input value={form.clientPhone} onChange={(e) => setField("clientPhone", e.target.value)} placeholder="+91 9876543210" />
                                </Field>
                                <Field label="GSTIN" half>
                                    <Input value={form.clientGstin} onChange={(e) => setField("clientGstin", e.target.value.toUpperCase())} placeholder="29XXXXX1234Z1ZV" className="uppercase" />
                                </Field>
                                <Field label="Due Date" half>
                                    <Input type="date" value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} />
                                </Field>
                                <Field label="Address" className="col-span-2">
                                    <Input value={form.clientAddress} onChange={(e) => setField("clientAddress", e.target.value)} placeholder="Street, City, State - Pincode" />
                                </Field>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Hash className="h-3.5 w-3.5 text-indigo-500" />
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Line Items</span>
                                </div>
                                <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                                    <Plus className="h-3.5 w-3.5" /> Add Item
                                </button>
                            </div>
                            <div className="grid grid-cols-12 gap-1.5 px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <span className="col-span-4">Description</span>
                                <span className="col-span-2 text-right">Price (₹)</span>
                                <span className="col-span-1 text-center">Qty</span>
                                <span className="col-span-2 text-center">GST %</span>
                                <span className="col-span-2 text-right">Amount (₹)</span>
                                <span className="col-span-1" />
                            </div>
                            <div className="px-4 pb-4 space-y-1.5">
                                {items.map((item, idx) => {
                                    const { amount } = calcRow(item);
                                    return (
                                        <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                            <input className="col-span-4 h-9 px-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                value={item.description} onChange={(e) => setItem(idx, "description", e.target.value)} placeholder="Service / product name" />
                                            <input type="number" min="0" step="0.01"
                                                className="col-span-2 h-9 px-2.5 text-sm text-right border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                value={item.price} onChange={(e) => setItem(idx, "price", e.target.value)} placeholder="0.00" />
                                            <input type="number" min="1"
                                                className="col-span-1 h-9 px-2 text-sm text-center border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                value={item.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} />
                                            <select className="col-span-2 h-9 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                value={item.taxRate} onChange={(e) => setItem(idx, "taxRate", e.target.value)}>
                                                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                                            </select>
                                            <div className="col-span-2 h-9 flex items-center justify-end px-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                                                <span className="text-sm font-semibold text-gray-700">₹{fmt(amount)}</span>
                                            </div>
                                            <button onClick={() => removeItem(idx)} disabled={items.length === 1}
                                                className="col-span-1 flex justify-center text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors">
                                                <Minus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <Info className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Notes / Terms</span>
                                <span className="text-[10px] text-gray-400">(optional)</span>
                            </div>
                            <div className="p-4">
                                <textarea className="w-full h-16 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                                    value={form.notes} onChange={(e) => setField("notes", e.target.value)}
                                    placeholder="Payment terms, delivery notes, or any additional info..." />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                            </div>
                        )}
                    </div>

                    {/* Right Summary */}
                    <div className="w-64 shrink-0 border-l border-gray-100 flex flex-col bg-gray-50/60">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Invoice Summary</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Subtotal</span>
                                        <span className="font-semibold text-gray-700">₹{fmt(subtotal)}</span>
                                    </div>
                                    {isInterstate ? (
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>IGST</span>
                                            <span className="font-semibold text-gray-700">₹{fmt(igst)}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>CGST</span>
                                                <span className="font-semibold text-gray-700">₹{fmt(cgst)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>SGST</span>
                                                <span className="font-semibold text-gray-700">₹{fmt(sgst)}</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="h-px bg-gray-100 my-1" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-gray-800">Total</span>
                                        <span className="text-lg font-extrabold text-indigo-600">₹{fmt(total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="bg-white rounded-xl border border-gray-100 p-3">
                                    <p className="text-lg font-bold text-gray-800">{items.length}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Item{items.length !== 1 ? "s" : ""}</p>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 p-3">
                                    <p className="text-xs font-bold text-gray-800 truncate">{form.invoiceType === "PROFORMA" ? "ProForma" : "Tax Inv."}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Type</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 p-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">From</p>
                                <p className="text-xs font-semibold text-gray-700 leading-tight">{company?.companyName || "—"}</p>
                                <p className="text-[10px] text-gray-400 mt-1">GSTIN: {company?.gstin}</p>
                                <p className="text-[10px] text-gray-400">{company?.city}, {company?.state}</p>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 p-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bank</p>
                                <div className="space-y-1 text-[10px] text-gray-500">
                                    <div className="flex justify-between"><span>Bank</span><span className="font-semibold text-gray-700">{company?.bankName}</span></div>
                                    <div className="flex justify-between"><span>A/C</span><span className="font-semibold text-gray-700 text-right max-w-[100px] truncate">{company?.accountNo}</span></div>
                                    <div className="flex justify-between"><span>IFSC</span><span className="font-semibold text-gray-700">{company?.ifsc}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 space-y-2">
                            <button onClick={submit} disabled={mutation.isPending}
                                className="w-full flex items-center justify-center gap-2 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60">
                                {mutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> {editData ? "Update" : "Create Invoice"}</>}
                            </button>
                            <button onClick={onClose} className="w-full h-9 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const CompanySettingsModal = ({ onClose, initialData }) => {
    const qc = useQueryClient();
    const [tab, setTab] = useState("business");
    const [form, setForm] = useState({
        companyName:    initialData?.companyName    || "",
        shortName:      initialData?.shortName      || "",
        gstin:          initialData?.gstin          || "",
        address:        initialData?.address        || "",
        city:           initialData?.city           || "",
        state:          initialData?.state          || "",
        pincode:        initialData?.pincode        || "",
        phone:          initialData?.phone          || "",
        email:          initialData?.email          || "",
        website:        initialData?.website        || "",
        placeOfSupply:  initialData?.placeOfSupply  || "",
        bankName:       initialData?.bankName       || "",
        accountNo:      initialData?.accountNo      || "",
        ifsc:           initialData?.ifsc           || "",
        branch:         initialData?.branch         || "",
        defaultTaxRate: initialData?.defaultTaxRate ?? 18,
        defaultNotes:   initialData?.defaultNotes   || "",
    });
    const [saved, setSaved] = useState(false);

    const mutation = useMutation({
        mutationFn: () => api.patch("/company-settings", form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["company-settings"] });
            setSaved(true);
            setTimeout(() => { setSaved(false); onClose(); }, 800);
        },
    });

    const sf = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const TABS = [
        { key: "business", label: "Business Info" },
        { key: "bank",     label: "Bank Details" },
        { key: "invoice",  label: "Invoice Settings" },
    ];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 rounded-lg"><Building2 className="h-4 w-4 text-violet-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">My Company Details</h2>
                            <p className="text-xs text-gray-400">Appears on all invoices & emails</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-400" /></button>
                </div>

                <div className="flex gap-1 px-5 pt-3 pb-0 shrink-0 border-b border-gray-100">
                    {TABS.map((t) => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === t.key ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {tab === "business" && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Company Name *</label>
                                <Input value={form.companyName} onChange={(e) => sf("companyName", e.target.value)} placeholder="Acme Corporation" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Invoice Prefix</label>
                                <div className="flex items-center gap-2">
                                    <Input value={form.shortName} onChange={(e) => sf("shortName", e.target.value.toUpperCase())} placeholder="ACM" className="uppercase" />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{form.shortName || "ACM"}-1…</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">GSTIN</label>
                                <Input value={form.gstin} onChange={(e) => sf("gstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" className="uppercase" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Address</label>
                                <Input value={form.address} onChange={(e) => sf("address", e.target.value)} placeholder="123 Main Street, Industrial Area" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">City</label>
                                <Input value={form.city} onChange={(e) => sf("city", e.target.value)} placeholder="Mumbai" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">State</label>
                                <Input value={form.state} onChange={(e) => sf("state", e.target.value)} placeholder="Maharashtra" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pincode</label>
                                <Input value={form.pincode} onChange={(e) => sf("pincode", e.target.value)} placeholder="400001" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Place of Supply</label>
                                <Input value={form.placeOfSupply} onChange={(e) => sf("placeOfSupply", e.target.value)} placeholder="27-Maharashtra" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
                                <Input value={form.phone} onChange={(e) => sf("phone", e.target.value)} placeholder="+91 9876543210" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                                <Input type="email" value={form.email} onChange={(e) => sf("email", e.target.value)} placeholder="info@yourcompany.com" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Website</label>
                                <Input value={form.website} onChange={(e) => sf("website", e.target.value)} placeholder="https://www.yourcompany.com" />
                            </div>
                        </div>
                    )}
                    {tab === "bank" && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-3 flex items-start gap-2">
                                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    Bank details will be printed on every invoice and included in email.
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bank Name</label>
                                <Input value={form.bankName} onChange={(e) => sf("bankName", e.target.value)} placeholder="HDFC Bank" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Number</label>
                                <Input value={form.accountNo} onChange={(e) => sf("accountNo", e.target.value)} placeholder="50200012345678" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">IFSC Code</label>
                                <Input value={form.ifsc} onChange={(e) => sf("ifsc", e.target.value.toUpperCase())} placeholder="HDFC0000123" className="uppercase" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Branch</label>
                                <Input value={form.branch} onChange={(e) => sf("branch", e.target.value)} placeholder="Bandra West" />
                            </div>
                        </div>
                    )}
                    {tab === "invoice" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Default GST Rate (%)</label>
                                <Select value={form.defaultTaxRate} onChange={(e) => sf("defaultTaxRate", +e.target.value)} className="w-32">
                                    {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Default Notes / Terms</label>
                                <textarea className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none text-gray-700 placeholder-gray-300"
                                    value={form.defaultNotes} onChange={(e) => sf("defaultNotes", e.target.value)}
                                    placeholder="e.g. Payment due within 15 days." />
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700">
                                <p className="font-semibold mb-1">Invoice Numbering</p>
                                <p>Tax Invoices: <strong>{form.shortName || "SCHOLAR360"}-1</strong>, <strong>{form.shortName || "SCHOLAR360"}-2</strong>… · Proforma: <strong>{form.shortName || "SCHOLAR360"}-PRO-1</strong>…</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                    <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                    <button onClick={() => mutation.mutate()} disabled={mutation.isPending || saved}
                        className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition ${saved ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"} disabled:opacity-70`}>
                        {saved ? <><CheckCircle className="h-4 w-4" /> Saved!</> : mutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEND EMAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const SendEmailModal = ({ invoice, onClose }) => {
    const qc = useQueryClient();
    const [email, setEmail] = useState(invoice.clientEmail || "");
    const [error, setError] = useState("");
    const mutation = useMutation({
        mutationFn: () => api.post(`/invoices/${invoice.id}/send-email`, { recipientEmail: email }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); onClose(); },
        onError: (e) => setError(e.response?.data?.error?.message || e.response?.data?.message || "Failed to send"),
    });
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg"><Mail className="h-4 w-4 text-blue-500" /></div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">Send Invoice</p>
                            <p className="text-xs text-gray-400">{invoice.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 text-sm">
                        <p className="font-semibold text-gray-700">{invoice.clientName}</p>
                        <p className="text-gray-500 text-xs">Total: ₹{fmt(invoice.total)}</p>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Recipient Email *</label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" autoFocus />
                    </div>
                    {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                </div>
                <div className="px-5 pb-5 flex gap-2.5">
                    <button onClick={onClose} className="flex-1 h-9 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !email}
                        className="flex-1 h-9 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                        {mutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADD PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const AddPaymentModal = ({ invoice, onClose }) => {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        amount: "", type: "CREDIT",
        description: "",
        paymentDate: new Date().toISOString().split("T")[0],
    });
    const [error, setError] = useState("");
    const balance = invoice.balance ?? (invoice.total - (invoice.totalPaid || 0));

    const netPaid = useMemo(() => {
        const payments = invoice.payments || [];
        return payments.reduce((acc, p) => {
            return p.type === "CREDIT" ? acc + p.amount : acc - p.amount;
        }, 0);
    }, [invoice.payments]);

    const mutation = useMutation({
        mutationFn: () => api.post(`/invoices/${invoice.id}/payments`, { ...form, amount: parseFloat(form.amount) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["balance-sheet"] }); onClose(); },
        onError: (e) => setError(e.response?.data?.error?.message || e.response?.data?.message || "Failed to record payment"),
    });

    const handleRecord = () => {
        const amt = parseFloat(form.amount);
        if (isNaN(amt) || amt <= 0) {
            setError("Please enter a valid amount");
            return;
        }
        if (form.type === "DEBIT" && amt > netPaid + 0.01) {
            setError(`Refund amount cannot exceed the net paid amount (₹${fmt(netPaid)})`);
            return;
        }
        setError("");
        mutation.mutate();
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 rounded-lg"><Banknote className="h-4 w-4 text-emerald-500" /></div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">Record Payment</p>
                            <p className="text-xs text-gray-400">{invoice.invoiceNumber} · {invoice.clientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "Invoice",  value: invoice.total,          cls: "text-gray-700" },
                            { label: "Paid",     value: invoice.totalPaid || 0, cls: "text-emerald-600" },
                            { label: "Balance",  value: balance,                cls: "text-amber-600" },
                        ].map((x) => (
                            <div key={x.label} className="text-center bg-gray-50 rounded-lg py-2.5 px-1 border border-gray-100">
                                <p className={`text-sm font-bold ${x.cls}`}>₹{fmt(x.value)}</p>
                                <p className="text-[10px] text-gray-400">{x.label}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: "CREDIT", label: "Received",       icon: TrendingDown, active: "border-emerald-400 bg-emerald-50 text-emerald-700" },
                            { key: "DEBIT",  label: "Refund / Debit", icon: TrendingUp,   active: "border-red-400 bg-red-50 text-red-600" },
                        ].map((t) => (
                            <button key={t.key} onClick={() => setForm((f) => ({ ...f, type: t.key }))}
                                className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border-2 text-xs font-semibold transition ${form.type === t.key ? t.active : "border-gray-200 text-gray-500"}`}>
                                <t.icon className="h-3.5 w-3.5" />{t.label}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input type="number" className="pl-8" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                        </div>
                        {form.type === "CREDIT" && balance > 0 && (
                            <button onClick={() => setForm((f) => ({ ...f, amount: balance.toFixed(2) }))} className="text-xs text-indigo-500 hover:underline mt-1">
                                Full balance ₹{fmt(balance)}
                            </button>
                        )}
                        {form.type === "DEBIT" && (
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-[11px] text-gray-500">
                                    Max refundable: <strong className="text-gray-700">₹{fmt(netPaid)}</strong>
                                </span>
                                {netPaid > 0 && (
                                    <button onClick={() => setForm((f) => ({ ...f, amount: netPaid.toFixed(2) }))} className="text-xs text-indigo-500 hover:underline">
                                        Full refund ₹{fmt(netPaid)}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Payment Date</label>
                        <Input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                        <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. NEFT, UPI, Cheque…" />
                    </div>
                    {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                </div>
                <div className="px-5 pb-5 flex gap-2.5">
                    <button onClick={onClose} className="flex-1 h-9 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleRecord} disabled={mutation.isPending || !form.amount}
                        className="flex-1 h-9 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                        {mutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Banknote className="h-4 w-4" /> Record</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const InvoiceDetail = ({ invoice, onClose, onSendEmail, onPayment, onEdit, company }) => {
    const qc = useQueryClient();
    const printRef = useRef(null);
    const { data: detail, isLoading } = useQuery({
        queryKey: ["invoice", invoice.id],
        queryFn: () => api.get(`/invoices/${invoice.id}`).then((r) => r.data),
    });
    const inv = detail || invoice;
    const deletePayment = useMutation({
        mutationFn: (pid) => api.delete(`/invoices/${invoice.id}/payments/${pid}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoice", invoice.id] }); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    });

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;
        const win = window.open("", "_blank", "width=900,height=700");
        win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<title>Invoice ${inv.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px; }
  .inv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .inv-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .inv-box-blue { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; }
  .label { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .name { font-size: 13px; font-weight: 700; color: #111; }
  .sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
  .inv-number { font-size: 18px; font-weight: 800; color: #111; }
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f3f4f6; padding: 8px 10px; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
  th:nth-child(n+3), td:nth-child(n+3) { text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; color: #374151; }
  .totals { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .total-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
  .total-row { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; padding: 3px 0; }
  .total-final { display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 1px solid #d1d5db; padding-top: 6px; margin-top: 4px; }
  .bank-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-top: 16px; }
  .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; color: #6b7280; }
  .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 11px; color: #92400e; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<div class="header-row">
  <div>
    <div class="inv-number">${inv.invoiceNumber}</div>
    <div style="margin-top:4px;font-size:11px;color:#6b7280;">${inv.invoiceType === "TAX_INVOICE" ? "Tax Invoice" : "Proforma Invoice"} &nbsp;·&nbsp; ${fmtDate(inv.date || inv.createdAt)}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:14px;font-weight:800;color:#111;">${company?.companyName || ""}</div>
    ${company?.gstin ? `<div style="font-size:10px;color:#6b7280;">GSTIN: ${company.gstin}</div>` : ""}
    ${company?.address ? `<div style="font-size:10px;color:#6b7280;">${company.address}, ${company.city} ${company.pincode}</div>` : ""}
  </div>
</div>
<div class="inv-grid">
  <div class="inv-box">
    <div class="label">Bill To</div>
    <div class="name">${inv.clientName || ""}</div>
    ${inv.clientGstin ? `<div class="sub">GSTIN: ${inv.clientGstin}</div>` : ""}
    ${inv.clientAddress ? `<div class="sub">${inv.clientAddress}</div>` : ""}
    ${inv.clientPhone ? `<div class="sub">${inv.clientPhone}</div>` : ""}
    ${inv.clientEmail ? `<div class="sub">${inv.clientEmail}</div>` : ""}
  </div>
  <div class="inv-box">
    <div class="label">Invoice Details</div>
    ${inv.poNumber ? `<div class="sub">PO: ${inv.poNumber}</div>` : ""}
    ${inv.dueDate ? `<div class="sub">Due: ${fmtDate(inv.dueDate)}</div>` : ""}
    <div class="sub">Status: ${inv.status}</div>
  </div>
</div>
<table>
  <thead><tr><th>#</th><th>Description</th><th>Price</th><th>Qty</th><th>Taxable</th><th>Tax</th><th>Amount</th></tr></thead>
  <tbody>
    ${(inv.items || []).map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.description}</td>
      <td>₹${fmt(item.price)}</td>
      <td>${item.quantity}</td>
      <td>₹${fmt(item.taxableValue)}</td>
      <td>₹${fmt(item.amount - item.taxableValue)} (${item.taxRate}%)</td>
      <td><strong>₹${fmt(item.amount)}</strong></td>
    </tr>`).join("")}
  </tbody>
</table>
<div class="totals">
  <div class="total-box">
    <div class="label">Tax Breakdown</div>
    <div class="total-row"><span>Taxable Amount</span><span>₹${fmt(inv.subtotal)}</span></div>
    ${inv.cgst > 0 ? `<div class="total-row"><span>CGST</span><span>₹${fmt(inv.cgst)}</span></div><div class="total-row"><span>SGST</span><span>₹${fmt(inv.sgst)}</span></div>` : ""}
    ${inv.igst > 0 ? `<div class="total-row"><span>IGST</span><span>₹${fmt(inv.igst)}</span></div>` : ""}
    <div class="total-final" style="color:#4338ca"><span>Total</span><span>₹${fmt(inv.total)}</span></div>
  </div>
  <div class="total-box">
    <div class="label">Payment Summary</div>
    <div class="total-row"><span>Invoice Total</span><span>₹${fmt(inv.total)}</span></div>
    <div class="total-row" style="color:#059669"><span>Amount Received</span><span>₹${fmt(inv.totalPaid || 0)}</span></div>
    <div class="total-final" style="color:#d97706"><span>Balance Due</span><span>₹${fmt(inv.balance ?? (inv.total - (inv.totalPaid || 0)))}</span></div>
  </div>
</div>
${(company?.bankName || company?.accountNo) ? `
<div class="bank-box">
  <div class="label">Bank Details</div>
  <div class="bank-grid">
    ${company.bankName ? `<span>Bank: <strong>${company.bankName}</strong></span>` : ""}
    ${company.accountNo ? `<span>A/C: <strong>${company.accountNo}</strong></span>` : ""}
    ${company.ifsc ? `<span>IFSC: <strong>${company.ifsc}</strong></span>` : ""}
    ${company.branch ? `<span>Branch: <strong>${company.branch}</strong></span>` : ""}
  </div>
</div>` : ""}
${inv.notes ? `<div class="notes"><strong>Note: </strong>${inv.notes}</div>` : ""}
</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-violet-50 rounded-xl shrink-0"><Receipt className="h-4 w-4 text-violet-600" /></div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-zinc-800">{inv.invoiceNumber}</span>
                                <TypePill type={inv.invoiceType} />
                                <Badge status={inv.status} />
                            </div>
                            <p className="text-xs text-zinc-400 truncate">{inv.clientName} · {fmtDate(inv.createdAt)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg shrink-0 transition-colors"><X className="h-4 w-4 text-zinc-400" /></button>
                </div>

                {/* Modal Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 space-y-6">
                    {/* Invoice Paper Preview Sheet */}
                    <div ref={printRef} className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6 max-w-3xl mx-auto">
                        
                        {/* Paper Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-zinc-100">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Company Detail</span>
                                <div className="text-base font-black text-zinc-850">{company?.companyName}</div>
                                {company?.gstin && <p className="text-[11px] text-zinc-500 mt-1 font-medium">GSTIN: <span className="text-zinc-700 font-bold">{company.gstin}</span></p>}
                                {company?.address && <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed max-w-xs">{company.address}, {company.city} - {company.pincode}</p>}
                            </div>
                            <div className="sm:text-right">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Document details</span>
                                <div className="text-lg font-black text-zinc-800">{inv.invoiceNumber}</div>
                                <div className="text-xs text-zinc-500 mt-1 font-medium">
                                    Date: <span className="text-zinc-700 font-bold">{fmtDate(inv.date || inv.createdAt)}</span>
                                </div>
                                {inv.dueDate && (
                                    <div className="text-xs text-zinc-500 mt-0.5 font-medium">
                                        Due Date: <span className="text-zinc-700 font-bold">{fmtDate(inv.dueDate)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Addresses Info Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Bill To</span>
                                <div className="text-xs font-bold text-zinc-800">{inv.clientName}</div>
                                {inv.clientGstin && <p className="text-[11px] text-zinc-500 mt-1.5 font-medium">GSTIN: <span className="text-zinc-700 font-bold">{inv.clientGstin}</span></p>}
                                {inv.clientAddress && <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{inv.clientAddress}</p>}
                                {inv.clientPhone && <p className="text-[11px] text-zinc-500 mt-1">Phone: {inv.clientPhone}</p>}
                                {inv.clientEmail && <p className="text-[11px] text-violet-600 mt-0.5 font-medium">{inv.clientEmail}</p>}
                            </div>
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 flex flex-col justify-between">
                                <div>
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Invoice Summary</span>
                                    <div className="space-y-1">

                                        {inv.poNumber && (
                                            <div className="flex justify-between text-[11px] text-zinc-500">
                                                <span>PO Number</span>
                                                <span className="font-bold text-zinc-700">{inv.poNumber}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[11px] text-zinc-500">
                                            <span>Status</span>
                                            <span className="font-bold text-zinc-700 uppercase">{inv.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border border-zinc-100 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-50 border-b border-zinc-100">
                                    <tr className="bg-zinc-50/70 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-3 py-2.5 text-left w-8">#</th>
                                        <th className="px-3 py-2.5 text-left">Description</th>
                                        <th className="px-3 py-2.5 text-right">Price</th>
                                        <th className="px-3 py-2.5 text-center w-12">Qty</th>
                                        <th className="px-3 py-2.5 text-right">Taxable</th>
                                        <th className="px-3 py-2.5 text-right">Tax</th>
                                        <th className="px-3 py-2.5 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {(inv.items || []).map((item, i) => (
                                        <tr key={item.id || i} className="hover:bg-zinc-50/40 transition-colors">
                                            <td className="px-3 py-2.5 text-zinc-400">{i + 1}</td>
                                            <td className="px-3 py-2.5 font-semibold text-zinc-800">{item.description}</td>
                                            <td className="px-3 py-2.5 text-right text-zinc-650">₹{fmt(item.price)}</td>
                                            <td className="px-3 py-2.5 text-center text-zinc-650">{item.quantity}</td>
                                            <td className="px-3 py-2.5 text-right text-zinc-650">₹{fmt(item.taxableValue)}</td>
                                            <td className="px-3 py-2.5 text-right text-zinc-450">
                                                ₹{fmt(item.amount - item.taxableValue)} <span className="text-[9px] font-bold px-1 py-0.5 bg-zinc-100 text-zinc-500 rounded">{item.taxRate}%</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-zinc-900">₹{fmt(item.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Breakdown Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2.5">Tax Breakdown</span>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between text-zinc-500"><span>Taxable Amount</span><span className="font-semibold text-zinc-700">₹{fmt(inv.subtotal)}</span></div>
                                    {inv.cgst > 0 && (
                                        <>
                                            <div className="flex justify-between text-zinc-500"><span>CGST</span><span className="font-semibold text-zinc-700">₹{fmt(inv.cgst)}</span></div>
                                            <div className="flex justify-between text-zinc-500"><span>SGST</span><span className="font-semibold text-zinc-700">₹{fmt(inv.sgst)}</span></div>
                                        </>
                                    )}
                                    {inv.igst > 0 && <div className="flex justify-between text-zinc-500"><span>IGST</span><span className="font-semibold text-zinc-700">₹{fmt(inv.igst)}</span></div>}
                                    <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold text-sm text-violet-750"><span>Invoice Total</span><span className="text-violet-600 font-extrabold">₹{fmt(inv.total)}</span></div>
                                </div>
                            </div>
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2.5">Payment Summary</span>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between text-zinc-500"><span>Total Due</span><span className="font-semibold text-zinc-700">₹{fmt(inv.total)}</span></div>
                                    <div className="flex justify-between text-emerald-600"><span>Amount Paid</span><span className="font-bold">₹{fmt(inv.totalPaid || 0)}</span></div>
                                    <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold text-sm text-amber-700">
                                        <span>Balance Due</span>
                                        <span>₹{fmt(inv.balance ?? (inv.total - (inv.totalPaid || 0)))}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        {(company?.bankName || company?.accountNo) && (
                            <div className="bg-zinc-50/30 rounded-xl border border-zinc-100 p-4">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Bank Transfer Details</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                    <div><span className="text-zinc-400 block text-[10px]">Bank</span><strong className="text-zinc-700">{company.bankName || "—"}</strong></div>
                                    <div><span className="text-zinc-400 block text-[10px]">Account No</span><strong className="text-zinc-700">{company.accountNo || "—"}</strong></div>
                                    <div><span className="text-zinc-400 block text-[10px]">IFSC Code</span><strong className="text-zinc-700">{company.ifsc || "—"}</strong></div>
                                    <div><span className="text-zinc-400 block text-[10px]">Branch</span><strong className="text-zinc-700">{company.branch || "—"}</strong></div>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {inv.notes && (
                            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800">
                                <strong className="text-[10px] uppercase tracking-wider block mb-1">Notes / Terms:</strong>
                                <p className="leading-relaxed">{inv.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Metadata & History Section */}
                    <div className="max-w-3xl mx-auto space-y-4">
                        {/* Payment History */}
                        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-3">Payment Log / Transactions</span>
                            {isLoading ? (
                                <p className="text-xs text-zinc-400 text-center py-4">Loading transaction history…</p>
                            ) : (inv.payments || []).length === 0 ? (
                                <div className="text-center py-6 bg-zinc-50/50 rounded-xl border border-zinc-100">
                                    <Banknote className="h-6 w-6 text-zinc-300 mx-auto mb-1.5" />
                                    <p className="text-xs text-zinc-400 font-medium">No transaction records found for this invoice.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {(inv.payments || []).map((p) => (
                                        <div key={p.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${p.type === "CREDIT" ? "bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/60" : "bg-red-50/40 border-red-100 hover:bg-red-50/60"}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${p.type === "CREDIT" ? "bg-emerald-500" : "bg-red-550"}`} />
                                                <div>
                                                    <p className={`text-xs font-bold ${p.type === "CREDIT" ? "text-emerald-800" : "text-red-700"}`}>{p.type === "CREDIT" ? "+" : "−"}₹{fmt(p.amount)}</p>
                                                    {p.description && <p className="text-[10px] text-zinc-500 mt-0.5">{p.description}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] text-zinc-400 font-bold">{fmtDate(p.paymentDate)}</span>
                                                <button onClick={() => deletePayment.mutate(p.id)} className="text-zinc-300 hover:text-red-500 transition-colors p-1 hover:bg-zinc-100 rounded-lg">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Email Logs */}
                        {inv.emailSentAt && (
                            <div className="flex items-center justify-center gap-2 bg-violet-50/30 border border-violet-100/50 rounded-xl py-3 px-4 text-xs text-violet-700">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span>Latest invoice email was dispatched to <strong className="font-bold text-violet-850">{inv.emailSentTo}</strong> on <span className="font-semibold">{fmtDate(inv.emailSentAt)}</span></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
                    <button onClick={onClose} className="text-xs font-bold text-zinc-450 hover:text-zinc-650 transition-colors">Close Preview</button>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition shadow-sm">
                            <Download className="h-3.5 w-3.5 text-zinc-500" /> Download PDF
                        </button>
                        <button onClick={() => { onClose(); onEdit(invoice); }} className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition shadow-sm">
                            <Pencil className="h-3.5 w-3.5 text-zinc-500" /> Edit Invoice
                        </button>
                        <button onClick={() => { onClose(); onSendEmail(invoice); }} className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-violet-650 bg-violet-50 border border-violet-100 rounded-xl hover:bg-violet-100/80 transition">
                            <Mail className="h-3.5 w-3.5" /> Send Email
                        </button>
                        {inv.status !== "PAID" && (
                            <button onClick={() => { onClose(); onPayment(invoice); }} className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-sm">
                                <Banknote className="h-3.5 w-3.5" /> Record Payment
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE SHEET TAB
// ═══════════════════════════════════════════════════════════════════════════════
const BalanceSheet = () => {
    const { data, isLoading } = useQuery({
        queryKey: ["balance-sheet"],
        queryFn: () => api.get("/invoices/balance-sheet").then((r) => r.data),
    });
    if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm">Loading ledger…</div>;
    if (!data) return null;
    const { summary, ledger } = data;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Receipt}      label="Total Invoiced"  value={summary.totalInvoiced}   sub={`${summary.invoiceCount} invoices`}  accent="indigo" />
                <StatCard icon={TrendingDown} label="Total Received"  value={summary.totalReceived}   sub={`${summary.paidCount} fully paid`}   accent="emerald" />
                <StatCard icon={TrendingUp}   label="Outstanding"     value={summary.totalOutstanding} sub={`${summary.partialCount} partial`}  accent="amber" />
                <StatCard icon={AlertCircle}  label="Overdue Balance" value={ledger.filter((i) => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== "PAID").reduce((s, i) => s + i.balance, 0)} sub={`${summary.overdueCount} overdue`} accent="red" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Accounts Receivable Ledger</h3>
                    <span className="text-xs text-gray-400">{ledger.length} entries</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {["Invoice #","Client","Date","Due Date","Invoice","Credited","Balance","Status"].map((h, i) => (
                                    <th key={h} className={`px-4 py-3 font-semibold text-gray-500 ${i >= 4 && i <= 6 ? "text-right" : i === 7 ? "text-center" : "text-left"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ledger.map((row) => {
                                const overdue = row.dueDate && new Date(row.dueDate) < new Date() && row.status !== "PAID";
                                return (
                                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-indigo-600">{row.invoiceNumber}</td>
                                        <td className="px-4 py-3 text-gray-700 font-medium">{row.clientName}</td>
                                        <td className="px-4 py-3 text-gray-500">{fmtDate(row.date)}</td>
                                        <td className={`px-4 py-3 font-medium ${overdue ? "text-red-500" : "text-gray-500"}`}>{fmtDate(row.dueDate)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{fmt(row.total)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">₹{fmt(row.totalPaid)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>₹{fmt(row.balance)}</td>
                                        <td className="px-4 py-3 text-center"><Badge status={row.status} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-indigo-800">TOTAL</td>
                                <td className="px-4 py-3 text-right text-xs font-bold text-indigo-800">₹{fmt(summary.totalInvoiced)}</td>
                                <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">₹{fmt(summary.totalReceived)}</td>
                                <td className="px-4 py-3 text-right text-xs font-bold text-amber-700">₹{fmt(summary.totalOutstanding)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                    {ledger.length === 0 && (
                        <div className="text-center py-12 text-gray-300">
                            <BarChart3 className="h-10 w-10 mx-auto mb-2" />
                            <p className="text-sm">No data yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT LIST
// ═══════════════════════════════════════════════════════════════════════════════
const ClientList = ({ invoices, onSelectClient, onNewInvoice }) => {
    const [search, setSearch] = useState("");

    const clients = useMemo(() => {
        const map = new Map();
        for (const inv of invoices) {
            const key = inv.clientName.trim().toLowerCase();
            if (!map.has(key)) {
                map.set(key, {
                    clientName:    inv.clientName,
                    clientEmail:   inv.clientEmail   || "",
                    clientPhone:   inv.clientPhone   || "",
                    clientAddress: inv.clientAddress || "",
                    clientGstin:   inv.clientGstin   || "",
                    invoices:      [],
                });
            }
            map.get(key).invoices.push(inv);
        }
        return Array.from(map.values())
            .map((c) => {
                const totalInvoiced = c.invoices.reduce((s, i) => s + i.total, 0);
                const totalPaid     = c.invoices.reduce((s, i) => s + (i.totalPaid || 0), 0);
                const balance       = c.invoices.reduce((s, i) => s + (i.balance ?? (i.total - (i.totalPaid || 0))), 0);
                const lastDate      = c.invoices[0]?.createdAt;
                const hasOverdue    = c.invoices.some(
                    (i) => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== "PAID"
                );
                return { ...c, totalInvoiced, totalPaid, balance, lastDate, hasOverdue };
            })
            .filter((c) =>
                !search ||
                c.clientName.toLowerCase().includes(search.toLowerCase()) ||
                c.clientEmail.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => b.totalInvoiced - a.totalInvoiced);
    }, [invoices, search]);

    if (invoices.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-12 text-center">
                <Users className="h-12 w-12 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-zinc-700">No clients yet</p>
                <p className="text-xs text-zinc-400 mt-1">Create your first invoice to register a client</p>
                <button onClick={onNewInvoice}
                    className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition shadow-sm">
                    <Plus className="h-3.5 w-3.5" /> New Invoice
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Search bar */}
            <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center justify-between gap-4 shadow-sm">
                <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        className="w-full h-9 pl-9 pr-4 text-xs border border-zinc-200 rounded-xl bg-white text-zinc-800 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                        placeholder="Search client name or email…" value={search} onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <span className="text-xs font-semibold text-zinc-400">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Grid of client cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => {
                    const isPaid    = client.balance <= 0;
                    const isOverdue = client.hasOverdue && !isPaid;
                    const paidPct   = client.totalInvoiced > 0 ? (client.totalPaid / client.totalInvoiced) * 100 : 0;
                    return (
                        <div key={client.clientName} onClick={() => onSelectClient(client)}
                            className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group relative overflow-hidden">
                            {isOverdue && <div className="absolute top-0 right-0 bg-red-500 text-[9px] font-black text-white px-3 py-0.5 rounded-bl-lg uppercase tracking-wider shadow-sm">Overdue</div>}
                            {isPaid && <div className="absolute top-0 right-0 bg-emerald-500 text-[9px] font-black text-white px-3 py-0.5 rounded-bl-lg uppercase tracking-wider shadow-sm">Cleared</div>}
                            <div>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                                        <span className="text-sm font-bold text-violet-600">
                                            {client.clientName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-zinc-800 text-sm group-hover:text-violet-600 transition-colors truncate">{client.clientName}</h3>
                                        {client.clientGstin && <p className="text-[10px] text-zinc-400 font-medium">GSTIN: {client.clientGstin}</p>}
                                        <p className="text-[10px] text-zinc-400 mt-1 truncate">{client.clientEmail || "No Email"}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-5 pt-4 border-t border-zinc-100/60">
                                <div className="grid grid-cols-2 gap-2 text-left mb-3">
                                    <div>
                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Total Billed</p>
                                        <p className="text-xs font-black text-zinc-800">₹{fmt(client.totalInvoiced)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Balance Due</p>
                                        <p className={`text-xs font-black ${isPaid ? "text-emerald-600" : isOverdue ? "text-red-500" : "text-amber-500"}`}>₹{fmt(client.balance)}</p>
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${isPaid ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${paidPct}%` }} />
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{client.invoices.length} invoice{client.invoices.length !== 1 ? "s" : ""}</span>
                                    <span className="text-[10px] text-zinc-400">Last: {fmtDate(client.lastDate)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
const ClientDetail = ({ client, company, onBack, onNewInvoice, onView, onEdit, onSendEmail, onPayment, onDelete }) => {
    const [activeTab, setActiveTab] = useState("invoices");

    const allPayments = useMemo(() =>
        client.invoices
            .flatMap((inv) => (inv.payments || []).map((p) => ({
                ...p,
                invoiceNumber: inv.invoiceNumber,
                invoiceTotal:  inv.total,
            })))
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)),
        [client]
    );

    const totalCredit = allPayments.filter((p) => p.type === "CREDIT").reduce((s, p) => s + p.amount, 0);
    const totalDebit  = allPayments.filter((p) => p.type === "DEBIT").reduce((s, p) => s + p.amount, 0);

    return (
        <div className="space-y-5">
            {/* Client Header */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-gradient-to-br from-indigo-50/20 to-transparent">
                    {/* Back button */}
                    <button onClick={onBack}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-zinc-500 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:text-zinc-700 transition shrink-0 shadow-sm">
                        <ChevronLeft className="h-3.5 w-3.5" /> Back to Clients
                    </button>

                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0 border border-violet-200">
                            <span className="text-sm font-black text-violet-700">
                                {client.clientName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-zinc-800 truncate">{client.clientName}</h2>
                            <div className="flex items-center gap-3.5 flex-wrap mt-1">
                                {client.clientGstin   && <span className="text-[10px] font-semibold text-zinc-400">GST: {client.clientGstin}</span>}
                                {client.clientEmail   && <span className="text-[10px] font-semibold text-zinc-400">{client.clientEmail}</span>}
                                {client.clientPhone   && <span className="text-[10px] font-semibold text-zinc-400">{client.clientPhone}</span>}
                                {client.clientAddress && <span className="text-[10px] font-semibold text-zinc-400 truncate max-w-[200px]">{client.clientAddress}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Quick action */}
                    <button onClick={() => onNewInvoice(client)}
                        className="flex items-center gap-1.5 h-9 px-4 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition shrink-0 shadow-sm">
                        <Plus className="h-3.5 w-3.5" /> New Invoice
                    </button>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-zinc-100 border-t border-zinc-100 bg-white">
                    {[
                        { label: "Total Invoiced", value: client.totalInvoiced, cls: "text-zinc-800" },
                        { label: "Amount Paid",    value: client.totalPaid,     cls: "text-emerald-600" },
                        { label: "Balance Due",    value: client.balance,       cls: client.balance > 0 ? "text-amber-500" : "text-emerald-600" },
                        { label: "Invoices Logged", count: client.invoices.length, cls: "text-violet-600" },
                    ].map((s) => (
                        <div key={s.label} className="px-5 py-4 text-center">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-xl font-black mt-1 tracking-tight ${s.cls}`}>
                                {s.count !== undefined ? s.count : `₹${fmt(s.value)}`}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-zinc-100 p-1 rounded-xl w-fit shadow-sm">
                {[
                    { key: "invoices",  label: "Invoices",        icon: Receipt,  count: client.invoices.length },
                    { key: "payments",  label: "Payment History", icon: Banknote, count: allPayments.length },
                ].map(({ key, label, icon: Icon, count }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === key ? "bg-violet-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${activeTab === key ? "bg-violet-500 text-white" : "bg-zinc-100 text-zinc-500"}`}>{count}</span>
                    </button>
                ))}
            </div>

            {/* Invoices Tab */}
            {activeTab === "invoices" && (
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                    {client.invoices.length === 0 ? (
                        <div className="text-center py-16">
                            <Receipt className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-zinc-700">No invoices yet</p>
                            <button onClick={() => onNewInvoice(client)} className="mt-2 text-xs font-bold text-violet-600 hover:underline">
                                Create first invoice →
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-50/50 border-b border-zinc-100">
                                    <tr>
                                        {["Invoice #","Date","Due Date","Total","Paid","Balance","Status","Actions"].map((h, i) => (
                                            <th key={h} className={`px-4 py-3.5 font-bold text-zinc-400 uppercase tracking-wider text-[10px] ${[3,4,5].includes(i) ? "text-right" : i === 7 ? "text-center" : "text-left"}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {client.invoices.map((inv) => (
                                        <tr key={inv.id} className="border-b border-zinc-100/50 hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <button onClick={() => onView(inv)} className="font-extrabold text-violet-600 hover:text-violet-850">{inv.invoiceNumber}</button>
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-500 font-medium">{fmtDate(inv.createdAt)}</td>
                                            <td className="px-4 py-3.5 text-zinc-500 font-medium">{fmtDate(inv.dueDate)}</td>
                                            <td className="px-4 py-3.5 text-right font-bold text-zinc-800">₹{fmt(inv.total)}</td>
                                            <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">₹{fmt(inv.totalPaid || 0)}</td>
                                            <td className={`px-4 py-3.5 text-right font-bold ${(inv.balance ?? 0) > 0 ? "text-amber-500" : "text-emerald-600"}`}>₹{fmt(inv.balance ?? 0)}</td>
                                            <td className="px-4 py-3.5"><Badge status={inv.status} /></td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center justify-center gap-1">
                                                    {[
                                                        { icon: Eye,     title: "View",    cls: "hover:text-violet-600 hover:bg-violet-50",   action: () => onView(inv) },
                                                        { icon: Mail,    title: "Email",   cls: "hover:text-blue-600 hover:bg-blue-50",       action: () => onSendEmail(inv) },
                                                        inv.status !== "PAID" && { icon: Banknote, title: "Payment", cls: "hover:text-emerald-600 hover:bg-emerald-50", action: () => onPayment(inv) },
                                                        { icon: Pencil,  title: "Edit",    cls: "hover:text-amber-600 hover:bg-amber-50",     action: () => onEdit(inv) },
                                                        { icon: Trash2,  title: "Delete",  cls: "hover:text-red-500 hover:bg-red-50",         action: () => onDelete(inv) },
                                                    ].filter(Boolean).map(({ icon: Icon, title, cls, action }) => (
                                                        <button key={title} onClick={action} title={title} className={`p-1.5 rounded-lg text-zinc-300 transition-colors ${cls}`}>
                                                            <Icon className="h-3.5 w-3.5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-zinc-50 border-t border-zinc-100 font-bold text-zinc-700">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3.5 text-xs text-zinc-400">TOTAL ({client.invoices.length} invoices)</td>
                                        <td className="px-4 py-3.5 text-right text-xs font-black text-zinc-800">₹{fmt(client.totalInvoiced)}</td>
                                        <td className="px-4 py-3.5 text-right text-xs font-black text-emerald-600">₹{fmt(client.totalPaid)}</td>
                                        <td className={`px-4 py-3.5 text-right text-xs font-black ${client.balance > 0 ? "text-amber-500" : "text-emerald-600"}`}>₹{fmt(client.balance)}</td>
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Payments Tab */}
            {activeTab === "payments" && (
                <div className="space-y-4">
                    {/* Payments summary layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow transition-shadow">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Received</p>
                            <p className="text-2xl font-black text-emerald-600 mt-1">₹{fmt(totalCredit)}</p>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">{allPayments.filter((p) => p.type === "CREDIT").length} credits</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow transition-shadow">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Refunded</p>
                            <p className="text-2xl font-black text-red-500 mt-1">₹{fmt(totalDebit)}</p>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">{allPayments.filter((p) => p.type === "DEBIT").length} debits</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow transition-shadow">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Balance Due</p>
                            <p className={`text-2xl font-black mt-1 ${client.balance > 0 ? "text-amber-500" : "text-emerald-600"}`}>₹{fmt(client.balance)}</p>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">across {client.invoices.length} invoices</p>
                        </div>
                    </div>

                    {/* Transaction list */}
                    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-zinc-100">
                            <h3 className="text-sm font-bold text-zinc-800">All Transactions</h3>
                        </div>
                        {allPayments.length === 0 ? (
                            <div className="text-center py-16">
                                <Banknote className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                                <p className="text-sm font-bold text-zinc-700">No transactions recorded yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-zinc-50/50 border-b border-zinc-100">
                                        <tr>
                                            {["Date","Invoice","Type","Description","Amount"].map((h, i) => (
                                                <th key={h} className={`px-4 py-3.5 font-bold text-zinc-400 uppercase tracking-wider text-[10px] ${i === 4 ? "text-right" : "text-left"}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allPayments.map((p) => (
                                            <tr key={p.id} className="border-b border-zinc-100/50 hover:bg-zinc-50/60 transition-colors">
                                                <td className="px-4 py-3.5 text-zinc-500 font-medium">{fmtDate(p.paymentDate)}</td>
                                                <td className="px-4 py-3.5 font-extrabold text-violet-600">{p.invoiceNumber}</td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.type === "CREDIT" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                                        {p.type === "CREDIT" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                                        {p.type === "CREDIT" ? "Received" : "Refund"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-500 font-medium">{p.description || "—"}</td>
                                                <td className={`px-4 py-3.5 text-right font-black ${p.type === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                                                    {p.type === "CREDIT" ? "+" : "−"}₹{fmt(p.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-zinc-50 border-t border-zinc-100 font-bold text-zinc-700">
                                        <tr>
                                            <td colSpan={4} className="px-4 py-3.5 text-xs text-zinc-400">NET RECEIVED</td>
                                            <td className={`px-4 py-3.5 text-right text-xs font-black ${totalCredit - totalDebit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                ₹{fmt(totalCredit - totalDebit)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function InvoiceBilling() {
    const [tab, setTab]                   = useState("clients");
    const [selectedClient, setSelectedClient] = useState(null);
    const [showCreate, setShowCreate]     = useState(false);
    const [createPrefill, setCreatePrefill] = useState(null);
    const [editInv, setEditInv]           = useState(null);
    const [emailInv, setEmailInv]         = useState(null);
    const [payInv, setPayInv]             = useState(null);
    const [viewInv, setViewInv]           = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [confirmDeleteInv, setConfirmDeleteInv] = useState(null);
    const [filterStatus, setFilterStatus] = useState("");
    const [filterType, setFilterType]     = useState("");
    const [search, setSearch]             = useState("");
    const qc = useQueryClient();

    const { data: company, isLoading: companyLoading } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then((r) => r.data),
    });

    const { data: invoicesResp, isLoading } = useQuery({
        queryKey: ["invoices"],
        queryFn: () => api.get("/invoices").then((r) => r.data),
    });
    // Handle both paginated { data: [...] } and legacy flat-array responses
    const invoices = Array.isArray(invoicesResp) ? invoicesResp : (invoicesResp?.data ?? []);

    const deleteMut = useMutation({
        mutationFn: (id) => api.delete(`/invoices/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["balance-sheet"] });
        },
    });

    // Open create modal, optionally pre-filled with a client
    const openNewInvoice = (client = null) => {
        setCreatePrefill(client);
        setShowCreate(true);
    };

    // Deep-link from a lead (e.g. the SALES journey or the "Create/Update Invoice"
    // button on Lead Details): /invoices?leadId=<id>&invoiceForLead=1
    //  - if the lead already has an invoice → open the latest one (view/pay/edit)
    //  - otherwise → open a create modal pre-filled from the lead, linked to it,
    //    so full payment auto-advances the lead to Commission Invoicing.
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const leadId = searchParams.get("leadId");
        // `newInvoice` kept for backward-compat with the older redirect.
        if (!leadId || !(searchParams.get("invoiceForLead") || searchParams.get("newInvoice"))) return;
        let cancelled = false;

        (async () => {
            try {
                const existing = await api.get("/invoices", { params: { leadId, limit: 1 } }).then((r) => r.data?.data ?? r.data ?? []);
                if (cancelled) return;
                if (Array.isArray(existing) && existing.length > 0) {
                    // Fetch full invoice (with items) for the detail modal.
                    const full = await api.get(`/invoices/${existing[0].id}`).then((r) => r.data);
                    if (!cancelled) setViewInv(full);
                    return;
                }
                const lead = await api.get(`/leads/${leadId}`).then((r) => r.data).catch(() => ({}));
                if (cancelled) return;
                openNewInvoice({
                    leadId,
                    clientName:    lead.name    || "",
                    clientEmail:   lead.email   || "",
                    clientPhone:   lead.phone   || "",
                    clientAddress: lead.address || "",
                    clientGstin:   "",
                });
            } catch {
                if (!cancelled) openNewInvoice({ leadId });
            } finally {
                // Clear params so a refresh doesn't reopen the modal.
                if (!cancelled) setSearchParams({}, { replace: true });
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When a client is selected from the list, sync with latest invoice data
    const handleSelectClient = (client) => {
        setSelectedClient(client);
        setTab("clients");
    };

    // Keep selectedClient in sync with latest invoice data after mutations
    const syncedClient = useMemo(() => {
        if (!selectedClient) return null;
        const key = selectedClient.clientName.trim().toLowerCase();
        const map = new Map();
        for (const inv of invoices) {
            const k = inv.clientName.trim().toLowerCase();
            if (!map.has(k)) {
                map.set(k, {
                    clientName:    inv.clientName,
                    clientEmail:   inv.clientEmail   || "",
                    clientPhone:   inv.clientPhone   || "",
                    clientAddress: inv.clientAddress || "",
                    clientGstin:   inv.clientGstin   || "",
                    invoices:      [],
                });
            }
            map.get(k).invoices.push(inv);
        }
        const raw = map.get(key);
        if (!raw) return null;
        const totalInvoiced = raw.invoices.reduce((s, i) => s + i.total, 0);
        const totalPaid     = raw.invoices.reduce((s, i) => s + (i.totalPaid || 0), 0);
        const balance       = raw.invoices.reduce((s, i) => s + (i.balance ?? (i.total - (i.totalPaid || 0))), 0);
        return { ...raw, totalInvoiced, totalPaid, balance };
    }, [selectedClient, invoices]);

    // Global stats (all invoices)
    const totalInvoiced    = invoices.reduce((s, i) => s + i.total, 0);
    const totalReceived    = invoices.reduce((s, i) => s + (i.totalPaid || 0), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + (i.balance ?? 0), 0);

    // All invoices tab filtered list
    const filtered = invoices.filter((inv) => {
        if (filterStatus && inv.status !== filterStatus) return false;
        if (filterType   && inv.invoiceType !== filterType) return false;
        if (search && !inv.clientName.toLowerCase().includes(search.toLowerCase()) && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // Unique client count
    const clientCount = useMemo(() => {
        const s = new Set(invoices.map((i) => i.clientName.trim().toLowerCase()));
        return s.size;
    }, [invoices]);

    return (
        <div className="p-6 space-y-5 min-h-full bg-gray-50/40">

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Invoices & Billing</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Manage clients · create invoices · track payments</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSettings(true)}
                        className="flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm">
                        <Building2 className="h-3.5 w-3.5 text-violet-500" /> My Company
                    </button>
                    <button onClick={() => openNewInvoice()}
                        className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm">
                        <Plus className="h-3.5 w-3.5" /> New Invoice
                    </button>
                </div>
            </div>

            {/* ── Company Banner ──────────────────────────────────────────── */}
            {!companyLoading && company && (
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="p-2 bg-violet-50 rounded-lg"><Building2 className="h-4 w-4 text-violet-500" /></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">{company.companyName}</p>
                        <p className="text-[11px] text-gray-400">GSTIN: {company.gstin} · {company.address}, {company.city} · {company.phone}</p>
                    </div>
                    <button onClick={() => setShowSettings(true)} className="text-[11px] text-indigo-500 hover:underline shrink-0 font-medium">Edit</button>
                </div>
            )}

            {/* ── Stats ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users}        label="Total Clients"   count={clientCount}    sub={`${invoices.length} invoices`} accent="violet" />
                <StatCard icon={Receipt}      label="Total Invoiced"  value={totalInvoiced}  sub={`across all clients`}          accent="indigo" />
                <StatCard icon={TrendingDown} label="Amount Received" value={totalReceived}  sub={`${invoices.filter((i) => i.status === "PAID").length} fully paid`} accent="emerald" />
                <StatCard icon={TrendingUp}   label="Outstanding"     value={totalOutstanding} sub={`${invoices.filter((i) => ["SENT","PARTIALLY_PAID"].includes(i.status)).length} pending`} accent="amber" />
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex gap-1.5 bg-zinc-100/80 p-1 border border-zinc-200/50 rounded-2xl w-fit shadow-sm">
                {[
                    { key: "clients",  label: "Clients",       icon: Users },
                    { key: "invoices", label: "All Invoices",  icon: FileText },
                    { key: "balance",  label: "Balance Sheet", icon: BarChart3 },
                ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => { setTab(key); if (key !== "clients") setSelectedClient(null); }}
                        className={`flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${tab === key ? "bg-white text-violet-600 shadow-sm border border-zinc-200/40" : "text-zinc-400 hover:text-zinc-700"}`}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ─────────────────────────────────────────────── */}

            {/* CLIENTS TAB */}
            {tab === "clients" && (
                isLoading
                    ? <div className="text-center py-16 text-gray-400 text-sm">Loading clients…</div>
                    : syncedClient
                        ? <ClientDetail
                            client={syncedClient}
                            company={company}
                            onBack={() => setSelectedClient(null)}
                            onNewInvoice={openNewInvoice}
                            onView={setViewInv}
                            onEdit={setEditInv}
                            onSendEmail={setEmailInv}
                            onPayment={setPayInv}
                            onDelete={(inv) => setConfirmDeleteInv(inv)}
                          />
                        : <ClientList
                            invoices={invoices}
                            onSelectClient={handleSelectClient}
                            onNewInvoice={() => openNewInvoice()}
                          />
            )}

            {/* ALL INVOICES TAB */}
            {tab === "invoices" && (
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-md overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-150/60 bg-zinc-50/30 flex flex-wrap items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <input
                                className="w-full h-10 pl-9.5 pr-4 text-xs border border-zinc-200 rounded-xl bg-white text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all shadow-sm/5"
                                placeholder="Search client or invoice…" value={search} onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="h-10 px-3.5 text-xs border border-zinc-200 rounded-xl bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all shadow-sm/5 min-w-[130px]"
                            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <span className="ml-auto text-xs font-bold text-zinc-400">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-16 text-zinc-400 text-sm">Loading invoices…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16">
                            <Receipt className="h-10 w-10 text-zinc-350 mx-auto mb-2.5" />
                            <p className="text-sm font-bold text-zinc-700">No invoices found</p>
                            <button onClick={() => openNewInvoice()} className="mt-2 text-xs font-bold text-violet-650 hover:underline">Create your first invoice →</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-zinc-50 border-b border-zinc-150/60 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        {["Invoice #","Client","Date","Total","Paid","Balance","Status","Actions"].map((h, i) => (
                                            <th key={h} className={`px-5 py-3.5 font-bold ${[3,4,5].includes(i) ? "text-right" : i === 7 ? "text-center" : "text-left"}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {filtered.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-zinc-50/40 transition-colors duration-150">
                                            <td className="px-5 py-3.5">
                                                <button onClick={() => setViewInv(inv)} className="font-extrabold text-violet-650 hover:text-violet-850 hover:underline">{inv.invoiceNumber}</button>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <button onClick={() => { setTab("clients"); handleSelectClient({ clientName: inv.clientName }); }}
                                                    className="font-bold text-zinc-800 hover:text-violet-600 transition-colors text-left block">
                                                    {inv.clientName}
                                                </button>
                                                {inv.clientEmail && <p className="text-zinc-400 text-[10px] mt-0.5 font-medium">{inv.clientEmail}</p>}
                                            </td>
                                            <td className="px-5 py-3.5 text-zinc-500 font-semibold">{fmtDate(inv.createdAt)}</td>
                                            <td className="px-5 py-3.5 text-right font-black text-zinc-850">₹{fmt(inv.total)}</td>
                                            <td className="px-5 py-3.5 text-right font-bold text-emerald-600">₹{fmt(inv.totalPaid || 0)}</td>
                                            <td className={`px-5 py-3.5 text-right font-black ${(inv.balance ?? 0) > 0 ? "text-amber-500" : "text-emerald-600"}`}>₹{fmt(inv.balance ?? 0)}</td>
                                            <td className="px-5 py-3.5"><Badge status={inv.status} /></td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-center gap-1">
                                                    {[
                                                        { icon: Eye,     title: "View",    cls: "hover:text-violet-600 hover:bg-violet-50",   action: () => setViewInv(inv) },
                                                        { icon: Mail,    title: "Email",   cls: "hover:text-blue-600 hover:bg-blue-50",       action: () => setEmailInv(inv) },
                                                        inv.status !== "PAID" && { icon: Banknote, title: "Payment", cls: "hover:text-emerald-600 hover:bg-emerald-50", action: () => setPayInv(inv) },
                                                        { icon: Pencil,  title: "Edit",    cls: "hover:text-amber-600 hover:bg-amber-50",     action: () => setEditInv(inv) },
                                                        { icon: Trash2,  title: "Delete",  cls: "hover:text-red-500 hover:bg-red-50",         action: () => setConfirmDeleteInv(inv) },
                                                    ].filter(Boolean).map(({ icon: Icon, title, cls, action }) => (
                                                        <button key={title} onClick={action} title={title} className={`p-1.5 rounded-lg text-zinc-350 transition-colors ${cls}`}>
                                                            <Icon className="h-3.5 w-3.5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* BALANCE SHEET TAB */}
            {tab === "balance" && <BalanceSheet />}

            {/* ── Modals ──────────────────────────────────────────────────── */}
            {showCreate   && <CreateInvoiceModal onClose={() => { setShowCreate(false); setCreatePrefill(null); }} company={company} clientPrefill={createPrefill} />}
            {editInv      && <CreateInvoiceModal editData={editInv} onClose={() => setEditInv(null)} company={company} />}
            {emailInv     && <SendEmailModal invoice={emailInv} onClose={() => setEmailInv(null)} />}
            {payInv       && <AddPaymentModal  invoice={payInv}  onClose={() => setPayInv(null)} />}
            {viewInv      && (
                <InvoiceDetail
                    invoice={viewInv} company={company}
                    onClose={() => setViewInv(null)}
                    onSendEmail={setEmailInv}
                    onPayment={setPayInv}
                    onEdit={setEditInv}
                />
            )}
            {showSettings && <CompanySettingsModal initialData={company} onClose={() => setShowSettings(false)} />}

            <Dialog
                open={!!confirmDeleteInv}
                variant="danger"
                title={`Delete invoice ${confirmDeleteInv?.invoiceNumber}?`}
                description="This will permanently delete the invoice and cannot be undone."
                confirmLabel="Delete"
                loading={deleteMut.isPending}
                onConfirm={() => { deleteMut.mutate(confirmDeleteInv.id); setConfirmDeleteInv(null); }}
                onCancel={() => setConfirmDeleteInv(null)}
            />
        </div>
    );
}
