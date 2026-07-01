import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    GraduationCap, ExternalLink, Pencil, X, Loader2, CheckCircle2,
    Circle, Globe, BookOpen, CalendarDays, FileCheck2, Plus,
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

    const openEdit = (idx) => {
        setEditIndex(idx);
        setDraft({ ...emptyUniv, ...universities[idx] });
    };

    // Add mode: index just past the end of the list appends a new university.
    const openAdd = () => {
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
                            <label className={labelCls}>Country</label>
                            <input className={inputCls} value={draft.univ_country || ""} onChange={e => setField("univ_country", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelCls}>University Name</label>
                            <input className={inputCls} value={draft.univ_name || ""} onChange={e => setField("univ_name", e.target.value)} />
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
                <span className="text-xs text-gray-400 font-medium">· {universities.length} shortlisted</span>
                <div className="ml-auto">{AddButton}</div>
            </div>

            <div className="divide-y divide-gray-100">
                {universities.map((u, idx) => (
                    <div key={idx} className="px-5 py-4">
                        {/* Subheading: university name */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">
                                    {u.univ_name || `University #${idx + 1}`}
                                </h3>
                                {u.completed ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                        <CheckCircle2 className="h-3 w-3" /> Completed
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                        <Circle className="h-3 w-3" /> In progress
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => openEdit(idx)}
                                className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                        </div>

                        {/* All fields regarding the university */}
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
                    </div>
                ))}
            </div>

            {renderModal()}
        </div>
    );
}
