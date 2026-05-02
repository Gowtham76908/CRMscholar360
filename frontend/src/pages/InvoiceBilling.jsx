import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, X, IndianRupee, TrendingUp, TrendingDown, Clock, CheckCircle,
    AlertCircle, FileText, Mail, Pencil, Receipt, BarChart3, Banknote,
    RefreshCw, Send, Eye, Trash2, Building2, Save, ChevronRight, Minus,
    Info, Hash, ChevronLeft, Users,
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
const Badge = ({ status }) => {
    const c = STATUS_CFG[status] || STATUS_CFG.DRAFT;
    const I = c.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${c.cls}`}>
            <I className="h-3 w-3" />{c.label}
        </span>
    );
};
const TypePill = ({ type }) => {
    const c = TYPE_CFG[type] || TYPE_CFG.PROFORMA;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${c.cls}`}>{c.label}</span>;
};
const Field = ({ label, children, half, className = "" }) => (
    <div className={`flex flex-col gap-1 ${half ? "col-span-1" : "col-span-2"} ${className}`}>
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
        {children}
    </div>
);
const Input = ({ className = "", ...props }) => (
    <input
        className={`w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition ${className}`}
        {...props}
    />
);
const Select = ({ children, className = "", ...props }) => (
    <select
        className={`w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition ${className}`}
        {...props}
    >
        {children}
    </select>
);

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, accent, count }) => {
    const accents = {
        indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-500",  val: "text-indigo-700",  border: "border-indigo-100" },
        emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700", border: "border-emerald-100" },
        amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   val: "text-amber-700",   border: "border-amber-100" },
        red:     { bg: "bg-red-50",     icon: "text-red-400",     val: "text-red-600",     border: "border-red-100" },
        violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  val: "text-violet-700",  border: "border-violet-100" },
    };
    const a = accents[accent] || accents.indigo;
    return (
        <div className={`bg-white rounded-xl border ${a.border} p-4 flex items-start gap-3 shadow-sm`}>
            <div className={`${a.bg} p-2.5 rounded-lg shrink-0`}>
                <Icon className={`h-4.5 w-4.5 ${a.icon}`} style={{ width: 18, height: 18 }} />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400">{label}</p>
                {count !== undefined
                    ? <p className={`text-xl font-bold mt-0.5 ${a.val}`}>{count}</p>
                    : <p className={`text-xl font-bold mt-0.5 ${a.val}`}>₹{fmt(value)}</p>
                }
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
        invoiceType:   editData?.invoiceType   || "PROFORMA",
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
        onError: (e) => setError(e.response?.data?.message || "Failed to save invoice"),
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
    const cgst  = parseFloat((totalTax / 2).toFixed(2));
    const sgst  = parseFloat((totalTax / 2).toFixed(2));
    const total = parseFloat((subtotal + totalTax).toFixed(2));

    const submit = () => {
        setError("");
        if (!form.clientName.trim())                               return setError("Client name is required.");
        if (items.some((i) => !i.description.trim() || !i.price)) return setError("All line items need a description and price.");
        mutation.mutate({ ...form, items });
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
                        {["PROFORMA", "TAX_INVOICE"].map((t) => (
                            <button key={t} onClick={() => setField("invoiceType", t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${form.invoiceType === t ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"}`}>
                                {t === "PROFORMA" ? "Proforma" : "Tax Invoice"}
                            </button>
                        ))}
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
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>CGST</span>
                                        <span className="font-semibold text-gray-700">₹{fmt(cgst)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>SGST</span>
                                        <span className="font-semibold text-gray-700">₹{fmt(sgst)}</span>
                                    </div>
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
                                <Input value={form.companyName} onChange={(e) => sf("companyName", e.target.value)} placeholder="Your company legal name" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Invoice Prefix</label>
                                <div className="flex items-center gap-2">
                                    <Input value={form.shortName} onChange={(e) => sf("shortName", e.target.value.toUpperCase())} placeholder="HXZ" className="uppercase" />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{form.shortName || "HXZ"}-1…</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">GSTIN</label>
                                <Input value={form.gstin} onChange={(e) => sf("gstin", e.target.value.toUpperCase())} placeholder="33AAHCH4159D1ZT" className="uppercase" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Address</label>
                                <Input value={form.address} onChange={(e) => sf("address", e.target.value)} placeholder="Street address" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">City</label>
                                <Input value={form.city} onChange={(e) => sf("city", e.target.value)} placeholder="Chennai" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">State</label>
                                <Input value={form.state} onChange={(e) => sf("state", e.target.value)} placeholder="Tamil Nadu" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pincode</label>
                                <Input value={form.pincode} onChange={(e) => sf("pincode", e.target.value)} placeholder="600019" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Place of Supply</label>
                                <Input value={form.placeOfSupply} onChange={(e) => sf("placeOfSupply", e.target.value)} placeholder="33-Tamil Nadu" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
                                <Input value={form.phone} onChange={(e) => sf("phone", e.target.value)} placeholder="+91 9994081905" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                                <Input type="email" value={form.email} onChange={(e) => sf("email", e.target.value)} placeholder="you@company.com" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Website</label>
                                <Input value={form.website} onChange={(e) => sf("website", e.target.value)} placeholder="https://yourcompany.com" />
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
                                <Input value={form.bankName} onChange={(e) => sf("bankName", e.target.value)} placeholder="Axis Bank" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Number</label>
                                <Input value={form.accountNo} onChange={(e) => sf("accountNo", e.target.value)} placeholder="924020046598227" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">IFSC Code</label>
                                <Input value={form.ifsc} onChange={(e) => sf("ifsc", e.target.value.toUpperCase())} placeholder="UTIB0001619" className="uppercase" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Branch</label>
                                <Input value={form.branch} onChange={(e) => sf("branch", e.target.value)} placeholder="Thiruvottriyur" />
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
                                <p>Tax Invoices: <strong>{form.shortName || "HXZ"}-1</strong>, <strong>{form.shortName || "HXZ"}-2</strong>… · Proforma: <strong>{form.shortName || "HXZ"}-PRO-1</strong>…</p>
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
        onError: (e) => setError(e.response?.data?.message || "Failed to send"),
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

    const mutation = useMutation({
        mutationFn: () => api.post(`/invoices/${invoice.id}/payments`, { ...form, amount: parseFloat(form.amount) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["balance-sheet"] }); onClose(); },
        onError: (e) => setError(e.response?.data?.message || "Failed to record payment"),
    });

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
                    <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.amount}
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
    const { data: detail, isLoading } = useQuery({
        queryKey: ["invoice", invoice.id],
        queryFn: () => api.get(`/invoices/${invoice.id}`).then((r) => r.data),
    });
    const inv = detail || invoice;
    const deletePayment = useMutation({
        mutationFn: (pid) => api.delete(`/invoices/${invoice.id}/payments/${pid}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoice", invoice.id] }); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    });

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-indigo-50 rounded-lg shrink-0"><Receipt className="h-4 w-4 text-indigo-600" /></div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-gray-800">{inv.invoiceNumber}</span>
                                <TypePill type={inv.invoiceType} />
                                <Badge status={inv.status} />
                            </div>
                            <p className="text-xs text-gray-400 truncate">{inv.clientName} · {fmtDate(inv.createdAt)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0"><X className="h-4 w-4 text-gray-400" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">From</p>
                            <p className="text-xs font-bold text-gray-800">{company?.companyName}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">GSTIN: {company?.gstin}</p>
                            <p className="text-[11px] text-gray-500">{company?.address}</p>
                            <p className="text-[11px] text-gray-500">{company?.city}, {company?.state} - {company?.pincode}</p>
                        </div>
                        <div className="bg-indigo-50/60 rounded-xl p-3.5 border border-indigo-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
                            <p className="text-xs font-bold text-gray-800">{inv.clientName}</p>
                            {inv.clientGstin   && <p className="text-[11px] text-gray-500">GSTIN: {inv.clientGstin}</p>}
                            {inv.clientAddress && <p className="text-[11px] text-gray-500">{inv.clientAddress}</p>}
                            {inv.clientPhone   && <p className="text-[11px] text-gray-500">{inv.clientPhone}</p>}
                            {inv.clientEmail   && <p className="text-[11px] text-indigo-600">{inv.clientEmail}</p>}
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["#","Description","Price","Taxable","Tax","Amount"].map((h, i) => (
                                        <th key={h} className={`px-3 py-2.5 font-semibold text-gray-500 ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(inv.items || []).map((item, i) => (
                                    <tr key={item.id} className="border-t border-gray-50">
                                        <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                                        <td className="px-3 py-2.5 font-medium text-gray-800">{item.description}</td>
                                        <td className="px-3 py-2.5 text-right text-gray-600">₹{fmt(item.price)}</td>
                                        <td className="px-3 py-2.5 text-right text-gray-600">₹{fmt(item.taxableValue)}</td>
                                        <td className="px-3 py-2.5 text-right text-gray-400">₹{fmt(item.amount - item.taxableValue)} <span className="text-[10px]">({item.taxRate}%)</span></td>
                                        <td className="px-3 py-2.5 text-right font-bold text-gray-800">₹{fmt(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Tax Breakdown</p>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between text-gray-500"><span>Taxable Amount</span><span className="font-medium">₹{fmt(inv.subtotal)}</span></div>
                                {inv.cgst > 0 && <><div className="flex justify-between text-gray-500"><span>CGST</span><span className="font-medium">₹{fmt(inv.cgst)}</span></div><div className="flex justify-between text-gray-500"><span>SGST</span><span className="font-medium">₹{fmt(inv.sgst)}</span></div></>}
                                {inv.igst > 0 && <div className="flex justify-between text-gray-500"><span>IGST</span><span className="font-medium">₹{fmt(inv.igst)}</span></div>}
                                <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold text-sm text-indigo-700"><span>Total</span><span>₹{fmt(inv.total)}</span></div>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Payment Summary</p>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between text-gray-500"><span>Invoice Total</span><span className="font-medium">₹{fmt(inv.total)}</span></div>
                                <div className="flex justify-between text-emerald-600"><span>Amount Received</span><span className="font-semibold">₹{fmt(inv.totalPaid || 0)}</span></div>
                                <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold text-sm text-amber-600"><span>Balance Due</span><span>₹{fmt(inv.balance ?? (inv.total - (inv.totalPaid || 0)))}</span></div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Payment History</p>
                        {isLoading ? (
                            <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
                        ) : (inv.payments || []).length === 0 ? (
                            <div className="text-center py-5 bg-gray-50 rounded-xl border border-gray-100">
                                <Banknote className="h-6 w-6 text-gray-200 mx-auto mb-1" />
                                <p className="text-xs text-gray-400">No payments recorded yet</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {(inv.payments || []).map((p) => (
                                    <div key={p.id} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${p.type === "CREDIT" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${p.type === "CREDIT" ? "bg-emerald-500" : "bg-red-400"}`} />
                                            <div>
                                                <p className={`text-xs font-bold ${p.type === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>{p.type === "CREDIT" ? "+" : "−"}₹{fmt(p.amount)}</p>
                                                {p.description && <p className="text-[10px] text-gray-400">{p.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-gray-400">{fmtDate(p.paymentDate)}</span>
                                            <button onClick={() => deletePayment.mutate(p.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bank Details</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                            <span className="text-gray-500">Bank: <strong className="text-gray-700">{company?.bankName}</strong></span>
                            <span className="text-gray-500">A/C: <strong className="text-gray-700">{company?.accountNo}</strong></span>
                            <span className="text-gray-500">IFSC: <strong className="text-gray-700">{company?.ifsc}</strong></span>
                            <span className="text-gray-500">Branch: <strong className="text-gray-700">{company?.branch}</strong></span>
                        </div>
                    </div>

                    {inv.notes && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                            <strong>Note: </strong>{inv.notes}
                        </div>
                    )}
                    {inv.emailSentAt && (
                        <p className="text-[11px] text-gray-400 text-center">Email sent to <strong>{inv.emailSentTo}</strong> on {fmtDate(inv.emailSentAt)}</p>
                    )}
                </div>

                <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                    <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">Close</button>
                    <div className="flex gap-2">
                        <button onClick={() => { onClose(); onEdit(invoice); }} className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button onClick={() => { onClose(); onSendEmail(invoice); }} className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                            <Mail className="h-3.5 w-3.5" /> Email
                        </button>
                        {inv.status !== "PAID" && (
                            <button onClick={() => { onClose(); onPayment(invoice); }} className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                const balance       = totalInvoiced - totalPaid;
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="text-center py-20">
                    <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">No clients yet</p>
                    <p className="text-xs text-gray-300 mt-1">Create your first invoice to add a client</p>
                    <button onClick={onNewInvoice}
                        className="mt-4 flex items-center gap-1.5 mx-auto px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition">
                        <Plus className="h-3.5 w-3.5" /> New Invoice
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Search bar */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <input
                    className="h-8 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56 bg-white"
                    placeholder="Search client…" value={search} onChange={(e) => setSearch(e.target.value)}
                />
                <span className="text-xs text-gray-400 ml-auto">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {["Client","Contact","Invoices","Total Invoiced","Amount Paid","Balance Due","Last Invoice"].map((h, i) => (
                                <th key={h} className={`px-4 py-3 font-semibold text-gray-500 ${[3,4,5].includes(i) ? "text-right" : "text-left"}`}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {clients.map((client) => {
                            const isPaid    = client.balance <= 0;
                            const isOverdue = client.hasOverdue && !isPaid;
                            return (
                                <tr key={client.clientName}
                                    onClick={() => onSelectClient(client)}
                                    className="border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors group">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-indigo-600">
                                                    {client.clientName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{client.clientName}</p>
                                                {client.clientGstin && <p className="text-[10px] text-gray-400">GST: {client.clientGstin}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        {client.clientEmail && <p className="text-gray-600">{client.clientEmail}</p>}
                                        {client.clientPhone && <p className="text-gray-400 text-[10px]">{client.clientPhone}</p>}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs">
                                            {client.invoices.length}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-bold text-gray-800">₹{fmt(client.totalInvoiced)}</td>
                                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">₹{fmt(client.totalPaid)}</td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className={`font-bold ${isPaid ? "text-emerald-600" : isOverdue ? "text-red-500" : "text-amber-600"}`}>
                                            ₹{fmt(client.balance)}
                                        </span>
                                        {isOverdue && <p className="text-[10px] text-red-400 font-medium">Overdue</p>}
                                        {isPaid    && <p className="text-[10px] text-emerald-500 font-medium">Cleared</p>}
                                    </td>
                                    <td className="px-4 py-3.5 text-gray-400">{fmtDate(client.lastDate)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
const ClientDetail = ({ client, company, onBack, onNewInvoice, onView, onEdit, onSendEmail, onPayment, onDelete }) => {
    const [activeTab, setActiveTab] = useState("invoices");

    // Flatten all payments across all invoices, newest first
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

            {/* ── Client Header ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-4">
                    {/* Back */}
                    <button onClick={onBack}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition shrink-0">
                        <ChevronLeft className="h-3.5 w-3.5" /> Clients
                    </button>

                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-indigo-600">
                                {client.clientName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-gray-900 truncate">{client.clientName}</h2>
                            <div className="flex items-center gap-3 flex-wrap mt-0.5">
                                {client.clientGstin   && <span className="text-[11px] text-gray-400">GST: {client.clientGstin}</span>}
                                {client.clientEmail   && <span className="text-[11px] text-gray-400">{client.clientEmail}</span>}
                                {client.clientPhone   && <span className="text-[11px] text-gray-400">{client.clientPhone}</span>}
                                {client.clientAddress && <span className="text-[11px] text-gray-400">{client.clientAddress}</span>}
                            </div>
                        </div>
                    </div>

                    {/* New invoice for this client */}
                    <button onClick={() => onNewInvoice(client)}
                        className="flex items-center gap-1.5 h-8 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shrink-0">
                        <Plus className="h-3.5 w-3.5" /> New Invoice
                    </button>
                </div>

                {/* ── Summary Stats ─────────────────────────────────────── */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                    {[
                        { label: "Total Invoiced", value: client.totalInvoiced, cls: "text-gray-800" },
                        { label: "Amount Paid",    value: client.totalPaid,     cls: "text-emerald-600" },
                        { label: "Balance Due",    value: client.balance,       cls: client.balance > 0 ? "text-amber-600" : "text-emerald-600" },
                        { label: "Invoices",       count: client.invoices.length, cls: "text-indigo-600" },
                    ].map((s) => (
                        <div key={s.label} className="px-5 py-4 text-center">
                            <p className="text-[11px] font-medium text-gray-400">{s.label}</p>
                            <p className={`text-xl font-bold mt-0.5 ${s.cls}`}>
                                {s.count !== undefined ? s.count : `₹${fmt(s.value)}`}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-white border border-gray-100 p-1 rounded-xl w-fit shadow-sm">
                {[
                    { key: "invoices",  label: "Invoices",        icon: Receipt,  count: client.invoices.length },
                    { key: "payments",  label: "Payment History", icon: Banknote, count: allPayments.length },
                ].map(({ key, label, icon: Icon, count }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === key ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                    </button>
                ))}
            </div>

            {/* ── Invoices Tab ──────────────────────────────────────────── */}
            {activeTab === "invoices" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {client.invoices.length === 0 ? (
                        <div className="text-center py-14">
                            <Receipt className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No invoices yet</p>
                            <button onClick={() => onNewInvoice(client)} className="mt-2 text-xs text-indigo-500 hover:underline font-medium">
                                Create first invoice →
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {["Invoice #","Type","Date","Due Date","Total","Paid","Balance","Status","Actions"].map((h, i) => (
                                            <th key={h} className={`px-4 py-3 font-semibold text-gray-500 ${[4,5,6].includes(i) ? "text-right" : i === 8 ? "text-center" : "text-left"}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {client.invoices.map((inv) => (
                                        <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <button onClick={() => onView(inv)} className="font-bold text-indigo-600 hover:text-indigo-800">{inv.invoiceNumber}</button>
                                            </td>
                                            <td className="px-4 py-3"><TypePill type={inv.invoiceType} /></td>
                                            <td className="px-4 py-3 text-gray-500">{fmtDate(inv.createdAt)}</td>
                                            <td className="px-4 py-3 text-gray-500">{fmtDate(inv.dueDate)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-800">₹{fmt(inv.total)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">₹{fmt(inv.totalPaid || 0)}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${(inv.balance ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>₹{fmt(inv.balance ?? 0)}</td>
                                            <td className="px-4 py-3"><Badge status={inv.status} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    {[
                                                        { icon: Eye,     title: "View",    cls: "hover:text-indigo-600 hover:bg-indigo-50",   action: () => onView(inv) },
                                                        { icon: Mail,    title: "Email",   cls: "hover:text-blue-600 hover:bg-blue-50",       action: () => onSendEmail(inv) },
                                                        inv.status !== "PAID" && { icon: Banknote, title: "Payment", cls: "hover:text-emerald-600 hover:bg-emerald-50", action: () => onPayment(inv) },
                                                        { icon: Pencil,  title: "Edit",    cls: "hover:text-amber-600 hover:bg-amber-50",     action: () => onEdit(inv) },
                                                        { icon: Trash2,  title: "Delete",  cls: "hover:text-red-500 hover:bg-red-50",         action: () => window.confirm(`Delete ${inv.invoiceNumber}?`) && onDelete(inv.id) },
                                                    ].filter(Boolean).map(({ icon: Icon, title, cls, action }) => (
                                                        <button key={title} onClick={action} title={title} className={`p-1.5 rounded text-gray-300 transition-colors ${cls}`}>
                                                            <Icon className="h-3.5 w-3.5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Invoice total row */}
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-600">TOTAL ({client.invoices.length} invoices)</td>
                                        <td className="px-4 py-3 text-right text-xs font-bold text-gray-800">₹{fmt(client.totalInvoiced)}</td>
                                        <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">₹{fmt(client.totalPaid)}</td>
                                        <td className={`px-4 py-3 text-right text-xs font-bold ${client.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>₹{fmt(client.balance)}</td>
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Payments Tab ──────────────────────────────────────────── */}
            {activeTab === "payments" && (
                <div className="space-y-4">
                    {/* Payment summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                            <p className="text-xs font-medium text-gray-400">Total Received</p>
                            <p className="text-xl font-bold text-emerald-600 mt-0.5">₹{fmt(totalCredit)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{allPayments.filter((p) => p.type === "CREDIT").length} transactions</p>
                        </div>
                        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
                            <p className="text-xs font-medium text-gray-400">Total Refunded</p>
                            <p className="text-xl font-bold text-red-500 mt-0.5">₹{fmt(totalDebit)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{allPayments.filter((p) => p.type === "DEBIT").length} transactions</p>
                        </div>
                        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
                            <p className="text-xs font-medium text-gray-400">Balance Due</p>
                            <p className={`text-xl font-bold mt-0.5 ${client.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>₹{fmt(client.balance)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">across {client.invoices.length} invoices</p>
                        </div>
                    </div>

                    {/* Payment list */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-800">All Transactions</h3>
                        </div>
                        {allPayments.length === 0 ? (
                            <div className="text-center py-14">
                                <Banknote className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">No payments recorded yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            {["Date","Invoice","Type","Description","Amount"].map((h, i) => (
                                                <th key={h} className={`px-4 py-3 font-semibold text-gray-500 ${i === 4 ? "text-right" : "text-left"}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allPayments.map((p) => (
                                            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                <td className="px-4 py-3 text-gray-500">{fmtDate(p.paymentDate)}</td>
                                                <td className="px-4 py-3 font-semibold text-indigo-600">{p.invoiceNumber}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${p.type === "CREDIT" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                                        {p.type === "CREDIT" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                                        {p.type === "CREDIT" ? "Received" : "Refund"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">{p.description || "—"}</td>
                                                <td className={`px-4 py-3 text-right font-bold ${p.type === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                                                    {p.type === "CREDIT" ? "+" : "−"}₹{fmt(p.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                        <tr>
                                            <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-600">NET RECEIVED</td>
                                            <td className={`px-4 py-3 text-right text-xs font-bold ${totalCredit - totalDebit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
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
    const [filterStatus, setFilterStatus] = useState("");
    const [filterType, setFilterType]     = useState("");
    const [search, setSearch]             = useState("");
    const qc = useQueryClient();

    const { data: company, isLoading: companyLoading } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then((r) => r.data),
    });

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ["invoices"],
        queryFn: () => api.get("/invoices").then((r) => r.data),
    });

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
        return { ...raw, totalInvoiced, totalPaid, balance: totalInvoiced - totalPaid };
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
            <div className="grid grid-cols-4 gap-3">
                <StatCard icon={Users}        label="Total Clients"   count={clientCount}    sub={`${invoices.length} invoices`} accent="violet" />
                <StatCard icon={Receipt}      label="Total Invoiced"  value={totalInvoiced}  sub={`across all clients`}          accent="indigo" />
                <StatCard icon={TrendingDown} label="Amount Received" value={totalReceived}  sub={`${invoices.filter((i) => i.status === "PAID").length} fully paid`} accent="emerald" />
                <StatCard icon={TrendingUp}   label="Outstanding"     value={totalOutstanding} sub={`${invoices.filter((i) => ["SENT","PARTIALLY_PAID"].includes(i.status)).length} pending`} accent="amber" />
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-white border border-gray-100 p-1 rounded-xl w-fit shadow-sm">
                {[
                    { key: "clients",  label: "Clients",       icon: Users },
                    { key: "invoices", label: "All Invoices",  icon: FileText },
                    { key: "balance",  label: "Balance Sheet", icon: BarChart3 },
                ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => { setTab(key); if (key !== "clients") setSelectedClient(null); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
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
                            onDelete={(id) => deleteMut.mutate(id)}
                          />
                        : <ClientList
                            invoices={invoices}
                            onSelectClient={handleSelectClient}
                            onNewInvoice={() => openNewInvoice()}
                          />
            )}

            {/* ALL INVOICES TAB */}
            {tab === "invoices" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                        <input
                            className="h-8 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 bg-white"
                            placeholder="Search client or invoice…" value={search} onChange={(e) => setSearch(e.target.value)}
                        />
                        <select className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="">All Types</option>
                            <option value="PROFORMA">Proforma</option>
                            <option value="TAX_INVOICE">Tax Invoice</option>
                        </select>
                        <span className="ml-auto text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-16 text-gray-400 text-sm">Loading invoices…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16">
                            <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No invoices found</p>
                            <button onClick={() => openNewInvoice()} className="mt-2 text-xs text-indigo-500 hover:underline font-medium">Create your first invoice →</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {["Invoice #","Client","Type","Date","Total","Paid","Balance","Status","Actions"].map((h, i) => (
                                            <th key={h} className={`px-4 py-3 font-semibold text-gray-500 ${[4,5,6].includes(i) ? "text-right" : i === 8 ? "text-center" : "text-left"}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((inv) => (
                                        <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <button onClick={() => setViewInv(inv)} className="font-bold text-indigo-600 hover:text-indigo-800">{inv.invoiceNumber}</button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => { setTab("clients"); handleSelectClient({ clientName: inv.clientName }); }}
                                                    className="font-semibold text-gray-800 hover:text-indigo-600 transition-colors text-left">
                                                    {inv.clientName}
                                                </button>
                                                {inv.clientEmail && <p className="text-gray-400 text-[10px]">{inv.clientEmail}</p>}
                                            </td>
                                            <td className="px-4 py-3"><TypePill type={inv.invoiceType} /></td>
                                            <td className="px-4 py-3 text-gray-500">{fmtDate(inv.createdAt)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-800">₹{fmt(inv.total)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">₹{fmt(inv.totalPaid || 0)}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${(inv.balance ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>₹{fmt(inv.balance ?? 0)}</td>
                                            <td className="px-4 py-3"><Badge status={inv.status} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    {[
                                                        { icon: Eye,     title: "View",    cls: "hover:text-indigo-600 hover:bg-indigo-50",   action: () => setViewInv(inv) },
                                                        { icon: Mail,    title: "Email",   cls: "hover:text-blue-600 hover:bg-blue-50",       action: () => setEmailInv(inv) },
                                                        inv.status !== "PAID" && { icon: Banknote, title: "Payment", cls: "hover:text-emerald-600 hover:bg-emerald-50", action: () => setPayInv(inv) },
                                                        { icon: Pencil,  title: "Edit",    cls: "hover:text-amber-600 hover:bg-amber-50",     action: () => setEditInv(inv) },
                                                        { icon: Trash2,  title: "Delete",  cls: "hover:text-red-500 hover:bg-red-50",         action: () => window.confirm(`Delete ${inv.invoiceNumber}?`) && deleteMut.mutate(inv.id) },
                                                    ].filter(Boolean).map(({ icon: Icon, title, cls, action }) => (
                                                        <button key={title} onClick={action} title={title} className={`p-1.5 rounded text-gray-300 transition-colors ${cls}`}>
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
        </div>
    );
}
