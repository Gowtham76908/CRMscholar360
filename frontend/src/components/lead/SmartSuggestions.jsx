import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, MessageSquare, Mail, Clock, CheckSquare, AlertTriangle, Lightbulb, X, ChevronDown, ChevronUp } from "lucide-react";
import api from "../../api/axios";
import { useState } from "react";

const ICON_MAP = {
    phone:   Phone,
    message: MessageSquare,
    mail:    Mail,
    clock:   Clock,
    check:   CheckSquare,
    alert:   AlertTriangle,
};

const PRIORITY_STYLE = {
    HIGH:   { bar: "bg-red-500",   badge: "bg-red-50 text-red-700 border-red-200",    label: "HIGH",   labelClass: "text-red-600" },
    MEDIUM: { bar: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "MEDIUM", labelClass: "text-amber-600" },
    LOW:    { bar: "bg-blue-400",  badge: "bg-blue-50 text-blue-700 border-blue-200",   label: "LOW",    labelClass: "text-blue-600" },
};

const CTA_STYLE = {
    call:     "bg-green-600 hover:bg-green-700 text-white",
    whatsapp: "bg-emerald-500 hover:bg-emerald-600 text-white",
    email:    "bg-blue-600 hover:bg-blue-700 text-white",
    note:     "bg-amber-500 hover:bg-amber-600 text-white",
    tasks:    "bg-indigo-600 hover:bg-indigo-700 text-white",
};

function SuggestionCard({ s, leadId, lead, onAction, onDismiss, dismissing }) {
    const [showReason, setShowReason] = useState(false);
    const style = PRIORITY_STYLE[s.priority] ?? PRIORITY_STYLE.MEDIUM;
    const Icon = ICON_MAP[s.icon] ?? Lightbulb;
    const ctaClass = CTA_STYLE[s.ctaAction] ?? CTA_STYLE.note;

    return (
        <div className="relative flex gap-3 p-4 group">
            {/* Priority bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-sm ${style.bar}`} />

            {/* Icon */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${style.badge}`}>
                <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Priority label + dismiss */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${style.labelClass}`}>
                        {style.label} PRIORITY
                    </span>
                    <button
                        onClick={() => onDismiss(s.key)}
                        disabled={dismissing}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Dismiss"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                <p className="text-sm font-bold text-gray-900 leading-tight">{s.headline}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.detail}</p>

                {/* Why / reason toggle */}
                {s.reason && (
                    <button
                        onClick={() => setShowReason(v => !v)}
                        className="mt-1 flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
                    >
                        {showReason ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Why?
                    </button>
                )}
                {showReason && s.reason && (
                    <p className="mt-1.5 text-[11px] text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        {s.reason}
                    </p>
                )}

                <button
                    onClick={() => onAction?.(s.ctaAction, lead)}
                    className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${ctaClass}`}
                >
                    <Icon className="h-3 w-3" />
                    {s.cta}
                </button>
            </div>
        </div>
    );
}

export default function SmartSuggestions({ leadId, lead, onAction }) {
    const queryClient = useQueryClient();

    const { data: suggestions = [], isLoading } = useQuery({
        queryKey: ["lead-suggestions", leadId],
        queryFn: () => api.get(`/leads/${leadId}/suggestions`).then(r => r.data),
        enabled: !!leadId,
        staleTime: 60_000,
    });

    const dismiss = useMutation({
        mutationFn: (key) => api.post(`/leads/${leadId}/suggestions/dismiss`, { key }),
        // Optimistically remove the card immediately
        onMutate: async (key) => {
            await queryClient.cancelQueries({ queryKey: ["lead-suggestions", leadId] });
            const prev = queryClient.getQueryData(["lead-suggestions", leadId]);
            queryClient.setQueryData(["lead-suggestions", leadId], (old = []) =>
                old.filter(s => s.key !== key)
            );
            return { prev };
        },
        onError: (_e, _key, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(["lead-suggestions", leadId], ctx.prev);
        },
    });

    if (isLoading || suggestions.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50">
                <Lightbulb className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                    Smart Suggestions
                </span>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                    {suggestions.length}
                </span>
            </div>

            <div className="divide-y divide-gray-100">
                {suggestions.map((s) => (
                    <SuggestionCard
                        key={s.key}
                        s={s}
                        leadId={leadId}
                        lead={lead}
                        onAction={onAction}
                        onDismiss={(key) => dismiss.mutate(key)}
                        dismissing={dismiss.isPending}
                    />
                ))}
            </div>
        </div>
    );
}
