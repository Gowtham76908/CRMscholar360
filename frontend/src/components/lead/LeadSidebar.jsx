import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../../api/axios";
import { toast } from "sonner";
import {
    Phone, Mail, Building2, Briefcase, Linkedin,
    Bell, Plus, Loader2, MessageCircle, CheckCircle, XCircle,
    ChevronDown, Sparkles, Calendar,
} from "lucide-react";

const SCORE_CONFIG = (score) => {
    if (score >= 81) return { label: "Premium", bar: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50" };
    if (score >= 61) return { label: "Hot",     bar: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50" };
    if (score >= 31) return { label: "Warm",    bar: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50" };
    return             { label: "Cold",    bar: "bg-gray-400",   text: "text-gray-600",   bg: "bg-gray-50"   };
};

const SOURCE_LABELS = {
    FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GMAIL: "Gmail",
    WEBSITE: "Website", PHONE_CALL: "Phone Call", LINKEDIN: "LinkedIn",
};

const relativeTime = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const formatRemindAt = (dt) => {
    const d = new Date(dt);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === today.toDateString()) return `Today ${timeStr}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${timeStr}`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ` ${timeStr}`;
};

export default function LeadSidebar({ lead, reminders, remindersLoading, leadId }) {
    const queryClient = useQueryClient();
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [reminderMsg, setReminderMsg] = useState("");
    const [reminderAt, setReminderAt] = useState("");
    const [addToGcal, setAddToGcal] = useState(false);
    const [scoreExpanded, setScoreExpanded] = useState(false);

    const { data: gcalStatus } = useQuery({
        queryKey: ["gcal-status"],
        queryFn: () => api.get("/google/calendar/status").then(r => r.data),
        staleTime: 60_000,
    });
    const gcalConnected = gcalStatus?.connected;

    const scoreConf = SCORE_CONFIG(lead.score ?? 0);

    const optInMutation = useMutation({
        mutationFn: (value) => api.patch(`/leads/${leadId}`, {
            whatsappOptIn: value,
            whatsappOptInAt: value ? new Date().toISOString() : null,
        }),
        onSuccess: (_, value) => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            toast.success(value ? "WhatsApp opt-in enabled" : "WhatsApp opt-in removed");
        },
        onError: () => toast.error("Failed to update WhatsApp opt-in"),
    });

    const addReminder = useMutation({
        mutationFn: (data) => api.post("/reminders", data),
        onSuccess: async (res) => {
            queryClient.invalidateQueries({ queryKey: ["lead-reminders", leadId] });
            if (addToGcal && gcalConnected) {
                try {
                    const reminderId = res.data?.id;
                    await api.post("/google/calendar/events", {
                        summary: reminderMsg.trim() || "CRM Reminder",
                        description: `Lead: ${lead?.name || leadId}`,
                        startTime: reminderAt,
                        reminderId,
                        leadId,
                    });
                    toast.success("Reminder set & added to Google Calendar");
                } catch {
                    toast.success("Reminder set (Google Calendar sync failed)");
                }
            } else {
                toast.success("Reminder set");
            }
            setShowReminderForm(false);
            setReminderMsg("");
            setReminderAt("");
            setAddToGcal(false);
        },
    });

    const handleReminderSubmit = (e) => {
        e.preventDefault();
        if (!reminderMsg.trim() || !reminderAt) return;
        addReminder.mutate({ leadId, message: reminderMsg.trim(), remindAt: reminderAt });
    };

    const upcoming = (reminders || []).filter(r => !r.isSent);
    const past     = (reminders || []).filter(r => r.isSent);

    return (
        <aside className="space-y-4">
            {/* Contact Details */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Contact</h3>
                <ul className="space-y-2.5">
                    {lead.phone && (
                        <li className="flex items-center gap-2.5 text-sm">
                            <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <a href={`tel:${lead.phone}`} className="text-gray-800 hover:text-indigo-600 font-medium transition-colors">
                                {lead.phone}
                            </a>
                        </li>
                    )}

                    {/* WhatsApp Opt-in Toggle */}
                    <li className="flex items-center justify-between gap-2.5 py-1 border-t border-gray-100 pt-2.5">
                        <div className="flex items-center gap-2 text-sm">
                            <MessageCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">WhatsApp</span>
                        </div>
                        <button
                            onClick={() => optInMutation.mutate(!lead.whatsappOptIn)}
                            disabled={optInMutation.isPending}
                            title={lead.whatsappOptIn ? "Click to remove consent" : "Click to give consent"}
                            className="flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                            {optInMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                            ) : lead.whatsappOptIn ? (
                                <>
                                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                    <span className="text-green-600">Opted in</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="text-gray-400">Not opted in</span>
                                </>
                            )}
                        </button>
                    </li>
                    {lead.email && (
                        <li className="flex items-center gap-2.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <a href={`mailto:${lead.email}`} className="text-gray-800 hover:text-indigo-600 truncate font-medium transition-colors">
                                {lead.email}
                            </a>
                        </li>
                    )}
                    {lead.company && (
                        <li className="flex items-center gap-2.5 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{lead.company}</span>
                        </li>
                    )}
                    {lead.jobTitle && (
                        <li className="flex items-center gap-2.5 text-sm">
                            <Briefcase className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{lead.jobTitle}</span>
                        </li>
                    )}
                    {lead.linkedinUrl && (
                        <li className="flex items-center gap-2.5 text-sm">
                            <Linkedin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                               className="text-indigo-600 hover:underline truncate">
                                LinkedIn Profile
                            </a>
                        </li>
                    )}
                </ul>
            </div>

            {/* Lead Score */}
            <div className={`border border-gray-200 rounded-xl p-4 shadow-sm ${scoreConf.bg}`}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Lead Score</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border ${scoreConf.text}`}>
                        {scoreConf.label}
                    </span>
                </div>
                <div className="flex items-end gap-2 mb-2">
                    <span className={`text-3xl font-black ${scoreConf.text}`}>{lead.score ?? 0}</span>
                    <span className="text-xs text-gray-400 mb-1">/ 100</span>
                </div>
                <div className="w-full bg-white rounded-full h-1.5 border border-gray-200 mb-3">
                    <div
                        className={`h-1.5 rounded-full transition-all ${scoreConf.bar}`}
                        style={{ width: `${Math.min(100, lead.score ?? 0)}%` }}
                    />
                </div>
                {lead.scoreExplanation?.factors?.length > 0 ? (
                    <>
                        <button
                            onClick={() => setScoreExpanded(v => !v)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors mt-1"
                        >
                            <Sparkles className="h-3 w-3 text-violet-400" />
                            Why this score?
                            <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${scoreExpanded ? "rotate-180" : ""}`} />
                        </button>
                        {scoreExpanded && (
                            <ul className="mt-2 space-y-1 bg-white/60 rounded-lg p-2 border border-white">
                                {lead.scoreExplanation.factors.map((f, i) => (
                                    <li key={i} className="flex items-center gap-1.5 text-xs text-gray-700">
                                        <span className={`font-bold shrink-0 ${f.direction === "up" ? "text-green-600" : "text-red-500"}`}>
                                            {f.direction === "up" ? "↑" : "↓"}
                                        </span>
                                        {f.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                ) : null}
            </div>

            {/* Lead Metadata */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Details</h3>
                <dl className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <dt className="text-gray-500">Source</dt>
                        <dd className="font-medium text-gray-800">{SOURCE_LABELS[lead.source] ?? lead.source}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                        <dt className="text-gray-500">Enquiry</dt>
                        <dd className="font-medium text-gray-800">{lead.enquiryType}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                        <dt className="text-gray-500">Created</dt>
                        <dd className="font-medium text-gray-800">
                            {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </dd>
                    </div>
                    {lead.firstResponseAt && (
                        <div className="flex justify-between text-sm">
                            <dt className="text-gray-500">First Response</dt>
                            <dd className="font-medium text-gray-800">{relativeTime(lead.firstResponseAt)}</dd>
                        </div>
                    )}
                </dl>
            </div>

            {/* Assigned To */}
            {lead.assignedTo && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Assigned To</h3>
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-indigo-700">
                                {lead.assignedTo.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{lead.assignedTo.name}</p>
                            <p className="text-xs text-gray-500 truncate">{lead.assignedTo.email}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Reminders */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Reminders</h3>
                    <button
                        onClick={() => setShowReminderForm(v => !v)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                        title="Add reminder"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </div>

                {showReminderForm && (
                    <form onSubmit={handleReminderSubmit} className="mb-3 space-y-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <input
                            type="text"
                            value={reminderMsg}
                            onChange={e => setReminderMsg(e.target.value)}
                            placeholder="Reminder message"
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <input
                            type="datetime-local"
                            value={reminderAt}
                            onChange={e => setReminderAt(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {gcalConnected && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={addToGcal}
                                    onChange={e => setAddToGcal(e.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                                />
                                <span className="flex items-center gap-1 text-xs text-gray-600">
                                    <Calendar className="h-3 w-3 text-blue-500" /> Add to Google Calendar
                                </span>
                            </label>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={addReminder.isPending}
                                className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {addReminder.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Set Reminder"}
                            </button>
                            <button type="button" onClick={() => setShowReminderForm(false)}
                                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {remindersLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
                ) : upcoming.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">No upcoming reminders</p>
                ) : (
                    <ul className="space-y-2">
                        {upcoming.map(r => (
                            <li key={r.id} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                                <Bell className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-800 font-medium truncate">{r.message}</p>
                                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">{formatRemindAt(r.remindAt)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {past.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-2 text-center">{past.length} past reminder{past.length > 1 ? "s" : ""}</p>
                )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Stats</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { label: "Calls",  value: lead.callLogs?.length ?? 0 },
                        { label: "Notes",  value: lead.notes?.length ?? 0 },
                        { label: "Tasks",  value: lead.tasks?.length ?? 0 },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-lg py-2 border border-gray-100">
                            <p className="text-lg font-black text-gray-900">{value}</p>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
