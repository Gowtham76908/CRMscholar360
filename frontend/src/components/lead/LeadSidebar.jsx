import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../../api/axios";
import { toast } from "sonner";
import { getScoreStyle } from "../../utils/leadScore";
import { fileUrl } from "../../utils/fileUrl";
import {
    Phone, Mail, Building2, Briefcase, Linkedin,
    Plus, Loader2, MessageCircle, CheckCircle, XCircle,
    ChevronDown, Sparkles,
} from "lucide-react";

// Canonical temperature styling, shared with every other lead screen.
const SCORE_CONFIG = getScoreStyle;

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

export default function LeadSidebar({ lead, leadId, hideContact = false, calls, notes, tasks }) {
    const queryClient = useQueryClient();
    const [scoreExpanded, setScoreExpanded] = useState(false);

    const scoreConf = SCORE_CONFIG(lead.score ?? 0);

    const optInMutation = useMutation({
        mutationFn: (value) => api.patch(`/leads/${leadId}`, {
            whatsappOptIn: value,
            whatsappOptInAt: value ? new Date().toISOString() : null,
        }),
        onSuccess: (_, value) => {
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            toast.success(value ? "WhatsApp opt-in enabled" : "WhatsApp opt-in removed");
        },
        onError: () => toast.error("Failed to update WhatsApp opt-in"),
    });

    return (
        <aside className="space-y-4">
            {/* Contact Details — hidden when the hero header already shows phone/email/assignee */}
            {!hideContact && (
            <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
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
            )}

            {/* Lead Score */}
            <div className={`border border-gray-200/70 rounded-2xl p-4 shadow-sm ${scoreConf.bg}`}>
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
            <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
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
                    {lead.resumeUrl && (
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-100 items-center">
                            <dt className="text-gray-500">Resume</dt>
                            <dd className="font-medium text-indigo-600 hover:underline truncate max-w-[70%]">
                                <a href={fileUrl(lead.resumeUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" title={lead.resumeName || "View Resume"}>
                                    📄 {lead.resumeName || "View Resume"}
                                </a>
                            </dd>
                        </div>
                    )}
                </dl>
            </div>

            {/* Quick Stats */}
            <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Stats</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { label: "Calls",  value: calls?.length ?? lead.callLogs?.length ?? 0 },
                        { label: "Notes",  value: notes?.length ?? lead.notes?.length ?? 0 },
                        { label: "Tasks",  value: tasks?.length ?? lead.tasks?.length ?? 0 },
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
