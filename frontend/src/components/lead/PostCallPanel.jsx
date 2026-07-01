import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import api from "../../api/axios";
import { toast } from "sonner";
import {
    X, CheckCircle, XCircle, VoicemailIcon, Phone,
    FileText, Bell, ChevronDown, Loader2, Sparkles,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const OUTCOMES = [
    { id: "CONNECTED",   label: "Connected",    icon: CheckCircle,    color: "text-green-600",   bg: "bg-green-50  border-green-200"  },
    { id: "NO_ANSWER",   label: "No Answer",    icon: Phone,          color: "text-amber-600",   bg: "bg-amber-50  border-amber-200"  },
    { id: "VOICEMAIL",   label: "Voicemail",    icon: VoicemailIcon,  color: "text-blue-600",    bg: "bg-blue-50   border-blue-200"   },
    { id: "WRONG_NUM",   label: "Wrong Number", icon: XCircle,        color: "text-red-600",     bg: "bg-red-50    border-red-200"    },
];

const NEXT_STEPS = [
    { id: "FOLLOW_UP",  label: "Schedule Follow-Up" },
    { id: "CONVERTED",  label: "Mark as Converted"  },
    { id: "LOST",       label: "Mark as Lost"       },
    { id: "NONE",       label: "No action needed"   },
];

const QUICK_FOLLOW_UPS = [
    { label: "Tomorrow",    hours: 24 },
    { label: "In 3 days",   hours: 72 },
    { label: "Next week",   hours: 168 },
];

// ─── PostCallPanel ────────────────────────────────────────────────────────────

export default function PostCallPanel({ open, leadId, lead, onClose }) {
    const queryClient = useQueryClient();
    const [outcome,      setOutcome]      = useState(null);
    const [nextStep,     setNextStep]     = useState("FOLLOW_UP");
    const [noteText,     setNoteText]     = useState("");
    const [reminderMsg,  setReminderMsg]  = useState("");
    const [reminderAt,   setReminderAt]   = useState("");
    const [showReminder, setShowReminder] = useState(false);

    // Reset when panel opens
    useEffect(() => {
        if (open) {
            setOutcome(null);
            setNextStep("FOLLOW_UP");
            setNoteText("");
            setReminderMsg("");
            setReminderAt("");
            setShowReminder(false);
        }
    }, [open]);

    // Quick-fill reminder time
    const setQuickFollowUp = (hours) => {
        const d = new Date(Date.now() + hours * 3600_000);
        setReminderAt(d.toISOString().slice(0, 16));
        if (!reminderMsg) setReminderMsg(`Follow up with ${lead?.name ?? "lead"}`);
        setShowReminder(true);
    };

    // ── Mutations ──────────────────────────────────────────────────────────────
    const updateStatus = useMutation({
        mutationFn: (status) => api.patch(`/leads/${leadId}`, { status }),
    });

    const addNote = useMutation({
        mutationFn: (content) => api.post(`/leads/${leadId}/notes`, { content }),
    });

    const addReminder = useMutation({
        mutationFn: (data) => api.post("/reminders", data),
    });

    const handleSubmit = async () => {
        const ops = [];

        // Status change
        if (nextStep === "CONVERTED" || nextStep === "LOST") {
            ops.push(updateStatus.mutateAsync(nextStep));
        } else if (nextStep === "FOLLOW_UP") {
            ops.push(updateStatus.mutateAsync("FOLLOW_UP"));
        }

        // Note — prepend call outcome if selected
        const fullNote = [
            outcome ? `📞 Call outcome: ${OUTCOMES.find(o => o.id === outcome)?.label ?? outcome}` : null,
            noteText.trim() || null,
        ].filter(Boolean).join("\n\n");
        if (fullNote) {
            ops.push(addNote.mutateAsync(fullNote));
        }

        // Reminder
        if (showReminder && reminderMsg.trim() && reminderAt) {
            ops.push(addReminder.mutateAsync({ leadId, message: reminderMsg.trim(), remindAt: reminderAt }));
        }

        try {
            await Promise.all(ops);
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-reminders", leadId] });
            toast.success("Call logged successfully");
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to save some items — please check notes and reminders");
        }
    };

    const isPending = updateStatus.isPending || addNote.isPending || addReminder.isPending;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Slide-up panel */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-2xl transition-transform duration-300 ease-out",
                    open ? "translate-y-0" : "translate-y-full"
                )}
                style={{ willChange: "transform" }}
            >
                <div className="bg-white rounded-t-2xl shadow-2xl border border-gray-200 border-b-0 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center">
                                <Phone className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">Post-Call Log</p>
                                <p className="text-xs text-gray-500">{lead?.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Call outcome */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                How did the call go?
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                                {OUTCOMES.map(({ id, label, icon: Icon, color, bg }) => (
                                    <button
                                        key={id}
                                        onClick={() => setOutcome(id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-center",
                                            outcome === id
                                                ? `${bg} border-current ${color} shadow-sm scale-[1.02]`
                                                : "border-gray-200 bg-white hover:border-gray-300 text-gray-500 hover:text-gray-700"
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4", outcome === id ? color : "")} />
                                        <span className="text-[10px] font-bold leading-tight">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Next step */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                What's next?
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {NEXT_STEPS.map(({ id, label }) => (
                                    <button
                                        key={id}
                                        onClick={() => setNextStep(id)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                                            nextStep === id
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick follow-up shortcuts */}
                        {nextStep === "FOLLOW_UP" && (
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    Schedule follow-up reminder
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                    {QUICK_FOLLOW_UPS.map(({ label, hours }) => (
                                        <button
                                            key={label}
                                            onClick={() => setQuickFollowUp(hours)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setShowReminder(v => !v)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1"
                                    >
                                        <Bell className="h-3 w-3" /> Custom
                                        <ChevronDown className={cn("h-3 w-3 transition-transform", showReminder ? "rotate-180" : "")} />
                                    </button>
                                </div>
                                {showReminder && (
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={reminderMsg}
                                            onChange={e => setReminderMsg(e.target.value)}
                                            placeholder="Reminder message"
                                            className="col-span-2 sm:col-span-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                        <input
                                            type="datetime-local"
                                            value={reminderAt}
                                            onChange={e => setReminderAt(e.target.value)}
                                            className="col-span-2 sm:col-span-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Call note */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <FileText className="h-3 w-3" /> Call notes
                                <span className="font-normal text-gray-400 normal-case tracking-normal">(optional)</span>
                            </p>
                            <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                rows={3}
                                placeholder={`What did you discuss with ${lead?.name ?? "the lead"}?`}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
                            />
                        </div>

                        {/* AI prompt nudge */}
                        {outcome === "CONNECTED" && !noteText && (
                            <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-100 rounded-xl">
                                <Sparkles className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-violet-700">
                                    Adding a note helps the AI score this lead more accurately and generate better follow-up suggestions.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                        >
                            Skip for now
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save & Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
