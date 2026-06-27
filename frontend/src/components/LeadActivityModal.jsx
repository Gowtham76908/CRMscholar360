import { useQuery } from "@tanstack/react-query";
import { Loader2, Circle, User, Phone, Mail, FileText, CheckCircle, AlertCircle, ArrowRight, X } from "lucide-react";
import api from "../api/axios";

// Helper to humanize enum strings (e.g. UNIVERSITY_SHORTLISTING -> University Shortlisting)
const humanize = (str) => {
    if (!str || typeof str !== "string") return "";
    return str
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatValue = (key, val) => {
    if (val === null || val === undefined) return "—";
    if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
        try {
            return new Date(val).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
        } catch (e) {
            return String(val);
        }
    }
    return String(val);
};

const LeadActivityModal = ({ lead, onClose }) => {
    const { data: rawData, isLoading } = useQuery({
        queryKey: ["lead-activities", lead.id],
        queryFn: async () => {
            const res = await api.get(`/leads/${lead.id}/activities`);
            return res.data;
        }
    });

    const activities = Array.isArray(rawData)
        ? rawData
        : (rawData?.data ?? rawData?.activities ?? []);

    const getIcon = (action) => {
        if (!action || typeof action !== "string") return <Circle className="h-4 w-4 text-slate-400" />;
        const act = action.toUpperCase();
        if (act.includes("CREATED")) return <User className="h-4 w-4 text-indigo-600" />;
        if (act.includes("STAGE") || act.includes("STATUS")) return <CheckCircle className="h-4 w-4 text-emerald-600" />;
        if (act.includes("CALL")) return <Phone className="h-4 w-4 text-sky-600" />;
        if (act.includes("EMAIL")) return <Mail className="h-4 w-4 text-amber-600" />;
        if (act.includes("NOTE")) return <FileText className="h-4 w-4 text-violet-600" />;
        if (act.includes("MERGED")) return <AlertCircle className="h-4 w-4 text-purple-600" />;
        return <Circle className="h-4 w-4 text-slate-400" />;
    };

    const getIconBg = (action) => {
        if (!action || typeof action !== "string") return "bg-slate-100";
        const act = action.toUpperCase();
        if (act.includes("CREATED")) return "bg-indigo-50 border border-indigo-100";
        if (act.includes("STAGE") || act.includes("STATUS")) return "bg-emerald-50 border border-emerald-100";
        if (act.includes("CALL")) return "bg-sky-50 border border-sky-100";
        if (act.includes("EMAIL")) return "bg-amber-50 border border-amber-100";
        if (act.includes("NOTE")) return "bg-violet-50 border border-violet-100";
        if (act.includes("MERGED")) return "bg-purple-50 border border-purple-100";
        return "bg-slate-100 border border-slate-200";
    };

    const renderMetadata = (activity) => {
        const meta = activity.metadata;
        if (!meta) return null;

        // 1. Stage transitions
        if (activity.action?.toUpperCase().includes("STAGE")) {
            const { from, to, department } = meta;
            if (from || to) {
                return (
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                        {from ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                                {humanize(from)}
                            </span>
                        ) : (
                            <span className="text-slate-400 italic">None</span>
                        )}
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                            {humanize(to)}
                        </span>
                        {department && (
                            <span className="text-[10px] text-slate-400 font-medium ml-1">
                                ({humanize(department)} Department)
                            </span>
                        )}
                    </div>
                );
            }
        }

        // 2. Changes object (e.g. Lead updates)
        if (meta.changes && typeof meta.changes === "object") {
            return (
                <div className="mt-2 space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                    {Object.entries(meta.changes).map(([key, val]) => (
                        <div key={key} className="flex items-start gap-1">
                            <span className="font-semibold text-slate-600 capitalize">{key.replace(/_/g, " ")}:</span>
                            <span className="text-slate-800 break-all">{formatValue(key, val)}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // 3. Fallbacks
        if (meta.newStatus) {
            return (
                <p className="mt-1 text-xs text-slate-600">
                    Changed to <span className="font-bold text-slate-800">{meta.newStatus}</span>
                </p>
            );
        }

        if (meta.duration) {
            return (
                <p className="mt-1 text-xs text-slate-500">
                    Duration: <span className="font-semibold text-slate-700">{meta.duration}s</span>
                </p>
            );
        }

        // Final generic fallback
        const cleanJson = JSON.stringify(meta);
        if (cleanJson && cleanJson !== "{}") {
            return (
                <div className="mt-2 text-[10px] text-slate-400 font-mono break-all max-h-20 overflow-y-auto bg-slate-50/50 p-1.5 rounded">
                    {cleanJson}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div>
                    <h3 className="text-lg font-black text-slate-900 leading-none">
                        Activity Timeline
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                        History for <span className="text-indigo-600 font-semibold">{lead.name}</span>
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        <p className="text-xs text-slate-400 mt-3 font-medium">Fetching history...</p>
                    </div>
                ) : activities?.length > 0 ? (
                    <div className="flow-root">
                        <ul className="-mb-8">
                            {activities.map((activity, activityIdx) => (
                                <li key={activity.id}>
                                    <div className="relative pb-8">
                                        {activityIdx !== activities.length - 1 && (
                                            <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                                        )}
                                        <div className="relative flex items-start gap-4">
                                            {/* Icon block */}
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${getIconBg(activity.action)}`}>
                                                {getIcon(activity.action)}
                                            </div>

                                            {/* Content detail */}
                                            <div className="min-w-0 flex-1 pt-1">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-800 capitalize leading-snug">
                                                            {humanize(activity.action)}
                                                        </h4>
                                                        {renderMetadata(activity)}
                                                    </div>
                                                    <div className="text-right flex-shrink-0 text-[10px] text-slate-400 font-medium">
                                                        <div>{new Date(activity.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                                        <div>{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        {activity.user?.name && (
                                                            <div className="mt-1 text-indigo-500/80 font-bold">{activity.user.name}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center py-16 text-slate-400 text-sm font-medium">
                        No activity recorded yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadActivityModal;
