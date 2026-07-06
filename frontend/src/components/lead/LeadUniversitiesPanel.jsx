import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    GraduationCap, ExternalLink, Pencil, X, Loader2, CheckCircle2,
    Circle, Globe, BookOpen, CalendarDays, FileCheck2, Plus,
    Award, Archive, ChevronDown, RotateCcw, Wallet,
} from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";

// Per-university fields surfaced under each university heading. The shortlist
// fields (country/name/course/link) come from University Shortlisting; the
// application-tracking fields below are filled from this panel's modal.
const RESPONSE_OPTIONS = [
    "Pending", "Conditional Offer", "Unconditional Offer", "Waitlisted", "Rejected",
];
const OFFER_STATUS_OPTIONS = ["Pending", "Received", "Not Received"];

const emptyUniv = { univ_country: "", univ_name: "", univ_course: "", univ_link: "", completed: false };

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

export default function LeadUniversitiesPanel({ leadId, lead, embedded = false }) {
    const queryClient = useQueryClient();
    const universities = Array.isArray(lead?.customFields?.shortlisted_universities)
        ? lead.customFields.shortlisted_universities
        : [];

    const [editIndex, setEditIndex] = useState(null);
    const [draft, setDraft] = useState(emptyUniv);

    // Per-university inline deposit form
    const BUILT_IN_MODES = ["Bank Transfer", "Credit Card", "Debit Card", "UPI", "Cash", "Cheque"];
    const [depositForm, setDepositForm] = useState(null); // { univName, amount, mode, customMode, date, saving }

    const depositMut = useMutation({
        mutationFn: async ({ univName, amount, mode, date }) => {
            const cf = lead?.customFields || {};
            const prevHistory = Array.isArray(cf.deposit_history) ? cf.deposit_history : [];
            const entry = { deposit_amount: amount, payment_mode: mode, payment_date: date, deposit_college: univName, recordedAt: new Date().toISOString() };
            await api.patch(`/leads/${leadId}/custom-fields`, {
                fields: {
                    deposit_amount: amount || cf.deposit_amount || "",
                    payment_mode: mode || cf.payment_mode || "",
                    payment_date: date || cf.payment_date || "",
                    deposit_college: univName,
                    deposit_history: [entry, ...prevHistory],
                }
            });
            const paidOn = date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
            await api.post(`/leads/${leadId}/notes`, {
                content: `💰 Deposit recorded — Amount: ${amount || "—"} · Mode: ${mode || "—"} · Date: ${paidOn} · College: ${univName}`
            });
        },
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success(`Deposit saved for ${vars.univName}`);
            setDepositForm(null);
        },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to save deposit"),
    });

    // Country + university options (same source as the Student Profile shortlisting
    // modal): /countries returns countries with their nested universities.
    const { data: countries = [], refetch: refetchCountries } = useQuery({
        queryKey: ["countries-list"],
        queryFn: () => api.get("/countries").then(r => r.data),
    });
    const [addingCountry, setAddingCountry] = useState(false);
    const [newCountryVal, setNewCountryVal] = useState("");
    const [addingUniv, setAddingUniv] = useState(false);
    const [newUnivVal, setNewUnivVal] = useState("");

    const saveMut = useMutation({
        mutationFn: (nextList) =>
            api.patch(`/leads/${leadId}/custom-fields`, { fields: { shortlisted_universities: nextList } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success("University details updated");
            setEditIndex(null);
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update university details"),
    });

    const addCountryMut = useMutation({
        mutationFn: (name) => api.post("/countries", { name }).then(r => r.data),
        onSuccess: (newCountry) => {
            refetchCountries();
            setField("univ_country", newCountry.name);
            setField("univ_name", "");
            setAddingCountry(false);
            setNewCountryVal("");
            toast.success("Country added");
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to add country"),
    });

    const addUnivMut = useMutation({
        mutationFn: ({ countryId, name }) => api.post(`/countries/${countryId}/universities`, { name }).then(r => r.data),
        onSuccess: (newUniv) => {
            refetchCountries();
            setField("univ_name", newUniv.name);
            setAddingUniv(false);
            setNewUnivVal("");
            toast.success("University added");
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to add university"),
    });

    const selectedCountry = countries.find(c => c.name.toLowerCase() === draft.univ_country?.toLowerCase());

    const resetAddState = () => {
        setAddingCountry(false); setNewCountryVal("");
        setAddingUniv(false); setNewUnivVal("");
    };

    const openEdit = (idx) => {
        resetAddState();
        setEditIndex(idx);
        setDraft({ ...emptyUniv, ...universities[idx] });
    };

    // Add mode: index just past the end of the list appends a new university.
    const openAdd = () => {
        resetAddState();
        setEditIndex(universities.length);
        setDraft({ ...emptyUniv });
    };
    const isAdding = editIndex === universities.length;

    const setField = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

    const handleSave = () => {
        const nextList = isAdding
            ? [...universities, { ...draft }]
            : universities.map((u, i) => (i === editIndex ? { ...u, ...draft } : u));
        saveMut.mutate(nextList);
    };

    // Confirmed-for-admission: any number of universities may be confirmed.
    // Once at least one is confirmed, the confirmed ones show in the main column
    // and the rest move to an "Archived Universities" section. Confirming and
    // revoking act on a single university and don't affect the others.
    const hasConfirmed = universities.some(u => u.confirmed);
    const [showArchived, setShowArchived] = useState(false);

    const confirmUniversity = (idx) =>
        saveMut.mutate(universities.map((u, i) => (i === idx ? { ...u, confirmed: true } : u)));
    const revokeUniversity = (idx) =>
        saveMut.mutate(universities.map((u, i) => (i === idx ? { ...u, confirmed: false } : u)));

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide";

    const AddButton = (
        <button onClick={openAdd} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add University
        </button>
    );

    const renderModal = () => editIndex === null ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saveMut.isPending && setEditIndex(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-800">{isAdding ? "Add University" : (draft.univ_name || "University")}</h3>
                    </div>
                    <button onClick={() => setEditIndex(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className={labelCls}>Country</label>
                                {!addingCountry && (
                                    <button type="button" onClick={() => { setAddingCountry(true); setNewCountryVal(""); }}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">+ Add Country</button>
                                )}
                            </div>
                            {addingCountry ? (
                                <div className="flex gap-1.5">
                                    <input autoFocus className={inputCls} placeholder="New country name" value={newCountryVal}
                                        onChange={e => setNewCountryVal(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newCountryVal.trim()) addCountryMut.mutate(newCountryVal.trim()); } }} />
                                    <button type="button" disabled={addCountryMut.isPending || !newCountryVal.trim()}
                                        onClick={() => newCountryVal.trim() && addCountryMut.mutate(newCountryVal.trim())}
                                        className="shrink-0 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 disabled:opacity-50">Save</button>
                                    <button type="button" onClick={() => { setAddingCountry(false); setNewCountryVal(""); }}
                                        className="shrink-0 px-2 py-1 border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:bg-slate-50">✕</button>
                                </div>
                            ) : (
                                <select className={inputCls} value={selectedCountry?.name || draft.univ_country || ""}
                                    onChange={e => { setField("univ_country", e.target.value); setField("univ_name", ""); }}>
                                    <option value="">Select Country</option>
                                    {countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className={labelCls}>University Name</label>
                                {!addingUniv && draft.univ_country && (
                                    <button type="button" onClick={() => { setAddingUniv(true); setNewUnivVal(""); }}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">+ Add University</button>
                                )}
                            </div>
                            {addingUniv ? (
                                <div className="flex gap-1.5">
                                    <input autoFocus className={inputCls} placeholder="New university name" value={newUnivVal}
                                        onChange={e => setNewUnivVal(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newUnivVal.trim() && selectedCountry) addUnivMut.mutate({ countryId: selectedCountry.id, name: newUnivVal.trim() }); } }} />
                                    <button type="button" disabled={addUnivMut.isPending || !newUnivVal.trim() || !selectedCountry}
                                        onClick={() => newUnivVal.trim() && selectedCountry && addUnivMut.mutate({ countryId: selectedCountry.id, name: newUnivVal.trim() })}
                                        className="shrink-0 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 disabled:opacity-50">Save</button>
                                    <button type="button" onClick={() => { setAddingUniv(false); setNewUnivVal(""); }}
                                        className="shrink-0 px-2 py-1 border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:bg-slate-50">✕</button>
                                </div>
                            ) : (
                                <select className={cn(inputCls, "disabled:opacity-60")} disabled={!draft.univ_country}
                                    value={draft.univ_name || ""}
                                    onChange={e => setField("univ_name", e.target.value)}>
                                    <option value="">{draft.univ_country ? "Select University" : "Select Country first"}</option>
                                    {(selectedCountry?.universities || []).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Course</label>
                            <input className={inputCls} value={draft.univ_course || ""} onChange={e => setField("univ_course", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>University Link</label>
                            <input className={inputCls} value={draft.univ_link || ""} onChange={e => setField("univ_link", e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelCls}>University Response</label>
                            <select className={inputCls} value={draft.university_response || ""} onChange={e => setField("university_response", e.target.value)}>
                                <option value="">— Select —</option>
                                {RESPONSE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Submission Date</label>
                            <input type="date" className={inputCls} value={draft.submission_date || ""} onChange={e => setField("submission_date", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Offer Letter</label>
                            <select className={inputCls} value={draft.offerLetterStatus || ""} onChange={e => setField("offerLetterStatus", e.target.value)}>
                                <option value="">— Select —</option>
                                {OFFER_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>Offer Date</label>
                            <input type="date" className={inputCls} value={draft.offerDate || ""} onChange={e => setField("offerDate", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelCls}>Notes</label>
                        <textarea rows={2} className={cn(inputCls, "resize-none")} value={draft.notes || ""} onChange={e => setField("notes", e.target.value)} />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                            type="checkbox"
                            checked={!!draft.completed}
                            onChange={e => setField("completed", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                        />
                        <span className="text-xs font-bold text-emerald-700">Mark this university as Completed</span>
                    </label>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                    <button onClick={() => setEditIndex(null)} disabled={saveMut.isPending} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saveMut.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                        {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                    </button>
                </div>
            </div>
        </div>
    );

    // Renders one university card. variant: "active" | "confirmed" | "archived".
    const renderCard = (u, idx, variant) => (
        <div key={idx} className={cn("px-5 py-4", variant === "archived" && "bg-slate-50/40")}>
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <h3 className={cn("text-sm font-bold truncate", variant === "archived" ? "text-slate-500" : "text-slate-800")}>
                        {u.univ_name || `University #${idx + 1}`}
                    </h3>
                    {variant === "confirmed" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            <Award className="h-3 w-3" /> Confirmed for Admission
                        </span>
                    )}
                    {variant === "archived" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">
                            <Archive className="h-3 w-3" /> Archived
                        </span>
                    ) : u.completed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                            <Circle className="h-3 w-3" /> In progress
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {variant === "active" && (
                        <button onClick={() => confirmUniversity(idx)} disabled={saveMut.isPending}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50">
                            <Award className="h-3.5 w-3.5" /> Confirm
                        </button>
                    )}
                    {variant === "confirmed" && (
                        <button onClick={() => revokeUniversity(idx)} disabled={saveMut.isPending}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors disabled:opacity-50">
                            <RotateCcw className="h-3.5 w-3.5" /> Revoke
                        </button>
                    )}
                    {variant === "archived" && (
                        <button onClick={() => confirmUniversity(idx)} disabled={saveMut.isPending}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50">
                            <Award className="h-3.5 w-3.5" /> Confirm
                        </button>
                    )}
                    <button onClick={() => openEdit(idx)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field icon={Globe} label="Country">{u.univ_country}</Field>
                <Field icon={BookOpen} label="Course">{u.univ_course}</Field>
                <Field icon={ExternalLink} label="Link">
                    {u.univ_link ? (
                        <a href={u.univ_link} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">
                            {u.univ_link}
                        </a>
                    ) : null}
                </Field>
                <Field icon={FileCheck2} label="University Response">{u.university_response}</Field>
                <Field icon={CalendarDays} label="Submission Date">
                    {u.submission_date ? new Date(u.submission_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                </Field>
                <Field icon={FileCheck2} label="Offer Letter">{u.offerLetterStatus}</Field>
                <Field icon={CalendarDays} label="Offer Date">
                    {u.offerDate ? new Date(u.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null}
                </Field>
                {u.notes && (
                    <div className="col-span-2">
                        <Field label="Notes">{u.notes}</Field>
                    </div>
                )}
            </div>

            {/* Deposit button / inline form */}
            <div className="mt-3 pt-3 border-t border-slate-100">
                {depositForm?.univName === u.univ_name ? (
                    <div className="space-y-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                        <div className="flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-700">Add Deposit — {u.univ_name}</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Deposit Amount (e.g. £5,000)"
                            value={depositForm.amount || ""}
                            onChange={e => setDepositForm(s => ({ ...s, amount: e.target.value }))}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white font-semibold"
                        />
                        <select
                            value={BUILT_IN_MODES.includes(depositForm.mode) ? depositForm.mode : (depositForm.mode ? "__custom__" : "")}
                            onChange={e => {
                                const v = e.target.value;
                                setDepositForm(s => ({ ...s, mode: v, customMode: v === "__custom__" ? "" : undefined }));
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white font-semibold"
                        >
                            <option value="">— Mode of Payment —</option>
                            {BUILT_IN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            <option value="__custom__">➕ Add Custom...</option>
                        </select>
                        {(depositForm.mode === "__custom__") && (
                            <input
                                autoFocus
                                type="text"
                                placeholder="Custom payment mode..."
                                value={depositForm.customMode || ""}
                                onChange={e => setDepositForm(s => ({ ...s, customMode: e.target.value }))}
                                className="w-full px-3 py-2 text-xs border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white font-semibold"
                            />
                        )}
                        <input
                            type="date"
                            value={depositForm.date || ""}
                            onChange={e => setDepositForm(s => ({ ...s, date: e.target.value }))}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white font-semibold"
                        />
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                disabled={depositMut.isPending}
                                onClick={() => {
                                    const resolvedMode = depositForm.mode === "__custom__"
                                        ? (depositForm.customMode || "").trim()
                                        : (depositForm.mode || "");
                                    depositMut.mutate({ univName: u.univ_name, amount: depositForm.amount || "", mode: resolvedMode, date: depositForm.date || "" });
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {depositMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                                Save Deposit
                            </button>
                            <button type="button" onClick={() => setDepositForm(null)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setDepositForm({ univName: u.univ_name, amount: "", mode: "", customMode: "", date: "" })}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                    >
                        <Wallet className="h-3.5 w-3.5" />
                        Add Deposit
                    </button>
                )}
            </div>
        </div>
    );

    if (universities.length === 0) {
        if (!embedded) return null;
        return (
            <>
                <div className="px-5 py-8 text-center space-y-3">
                    <p className="text-xs text-slate-400">No universities shortlisted yet.</p>
                    <div className="flex justify-center">{AddButton}</div>
                </div>
                {renderModal()}
            </>
        );
    }

    return (
        <div className={embedded ? "" : "bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden"}>
            {/* Heading */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-gray-800">Universities</h2>
                <span className="text-xs text-gray-400 font-medium">
                    · {hasConfirmed
                        ? `${universities.filter(u => u.confirmed).length} confirmed`
                        : `${universities.length} shortlisted`}
                </span>
                <div className="ml-auto">{AddButton}</div>
            </div>

            {/* Active — the confirmed universities, or the full shortlist */}
            <div className="divide-y divide-gray-100">
                {hasConfirmed
                    ? universities.map((u, idx) => (u.confirmed ? renderCard(u, idx, "confirmed") : null))
                    : universities.map((u, idx) => renderCard(u, idx, "active"))}
            </div>

            {/* Archived — the non-confirmed universities, collapsible */}
            {hasConfirmed && universities.some(u => !u.confirmed) && (
                <div className="border-t border-gray-100">
                    <button
                        onClick={() => setShowArchived(s => !s)}
                        className="w-full px-5 py-3 flex items-center gap-2 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                        <Archive className="h-3.5 w-3.5" />
                        Archived Universities
                        <span className="text-slate-400 font-medium">· {universities.filter(u => !u.confirmed).length}</span>
                        <ChevronDown className={cn("h-4 w-4 ml-auto text-slate-400 transition-transform", showArchived && "rotate-180")} />
                    </button>
                    {showArchived && (
                        <div className="divide-y divide-gray-100 border-t border-gray-100">
                            {universities.map((u, idx) => (u.confirmed ? null : renderCard(u, idx, "archived")))}
                        </div>
                    )}
                </div>
            )}

            {renderModal()}
        </div>
    );
}
