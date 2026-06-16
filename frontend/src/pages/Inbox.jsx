import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { cn } from "../lib/utils";
import {
    Inbox, Clock, MessageSquare, ArrowRight, CheckCircle,
    Phone, Bell, Sparkles, AlertCircle, User, Loader2, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relTime = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const timeUntil = (date) => {
    const diff = new Date(date).getTime() - Date.now();
    if (diff < 0) return "Overdue";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    return `in ${Math.floor(hrs / 24)}d`;
};


// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, count, color = "text-gray-700", children, empty }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", color)} />
                    <h2 className="text-sm font-bold text-gray-800">{title}</h2>
                    {count > 0 && (
                        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                            {count}
                        </span>
                    )}
                </div>
            </div>
            {count === 0
                ? <p className="text-sm text-gray-400 text-center py-8">{empty ?? "All clear"}</p>
                : <div className="divide-y divide-gray-50">{children}</div>
            }
        </div>
    );
}

// ─── Follow-up lead card ──────────────────────────────────────────────────────

function FollowUpItem({ lead }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
            <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                    {lead.leadDepartments?.[0] && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            {lead.leadDepartments[0].stage?.replace(/_/g, " ")}
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                    {lead.phone || lead.email || "No contact"} · Updated {relTime(lead.updatedAt)}
                </p>
            </div>
            <Link
                to={`/leads/${lead.id}`}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 rounded-lg hover:bg-indigo-50"
            >
                View <ArrowRight className="h-3 w-3" />
            </Link>
        </div>
    );
}

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderItem({ reminder }) {
    const queryClient = useQueryClient();
    const isOverdue = new Date(reminder.remindAt) < new Date();

    const dismiss = useMutation({
        mutationFn: () => api.patch(`/reminders/${reminder.id}`, { dismissed: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inbox-reminders"] });
            toast.success("Reminder dismissed");
        },
    });

    return (
        <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
            <div className={cn(
                "h-9 w-9 rounded-full border flex items-center justify-center flex-shrink-0",
                isOverdue ? "bg-red-50 border-red-100" : "bg-orange-50 border-orange-100"
            )}>
                <Bell className={cn("h-4 w-4", isOverdue ? "text-red-500" : "text-orange-500")} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{reminder.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {reminder.lead?.name && (
                        <span className="text-xs text-gray-500 truncate">{reminder.lead.name}</span>
                    )}
                    <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        isOverdue ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                    )}>
                        {timeUntil(reminder.remindAt)}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {reminder.lead?.id && (
                    <Link
                        to={`/leads/${reminder.lead.id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        View
                    </Link>
                )}
                <button
                    onClick={() => dismiss.mutate()}
                    disabled={dismiss.isPending}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors"
                >
                    {dismiss.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <CheckCircle className="h-3 w-3" />
                    }
                    Done
                </button>
            </div>
        </div>
    );
}

// ─── WhatsApp reply card ──────────────────────────────────────────────────────

function WhatsAppItem({ msg }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
            <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                    {msg.lead?.name ?? msg.phone}
                </p>
                <p className="text-xs text-gray-500 truncate">
                    {(msg.replyText || msg.messageBody)?.slice(0, 80) ?? "WhatsApp reply"} · {relTime(msg.createdAt)}
                </p>
            </div>
            {msg.lead?.id && (
                <Link
                    to={`/leads/${msg.lead.id}?tab=timeline`}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                    View <ArrowRight className="h-3 w-3" />
                </Link>
            )}
        </div>
    );
}

// ─── SLA breach card ─────────────────────────────────────────────────────────

function SLAItem({ lead, breachDays }) {
    const ref = lead.lastActivityAt ?? lead.updatedAt;
    const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
    return (
        <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
            <div className="h-9 w-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                        {days}d inactive
                    </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                    {lead.phone || lead.email || "No contact"}
                    {lead.leadDepartments?.[0] && ` · ${lead.leadDepartments[0].stage?.replace(/_/g, " ")}`}
                </p>
            </div>
            <Link
                to={`/leads/${lead.id}`}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            >
                View <ArrowRight className="h-3 w-3" />
            </Link>
        </div>
    );
}

// ─── Inbox page ───────────────────────────────────────────────────────────────

export default function InboxPage() {
    const { data: followUpLeads = [], isLoading: leadsLoading } = useQuery({
        queryKey: ["inbox-followup"],
        queryFn: () => api.get("/leads", {
            params: { status: "FOLLOW_UP,CONTACTED", sortBy: "updatedAt", sortOrder: "asc", limit: 20 }
        }).then(r => r.data.data || r.data || []),
        staleTime: 30_000,
    });

    const { data: reminders = [], isLoading: remindersLoading } = useQuery({
        queryKey: ["inbox-reminders"],
        queryFn: () => api.get("/reminders").then(r => {
            const all = r.data.data || r.data || [];
            return all
                .filter(rem => !rem.dismissed)
                .filter(rem => new Date(rem.remindAt) <= new Date(Date.now() + 24 * 3600_000))
                .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
        }),
        staleTime: 30_000,
    });

    const { data: waReplies = [] } = useQuery({
        queryKey: ["inbox-wa-replies"],
        queryFn: () => api.get("/whatsapp/messages", { params: { direction: "inbound", limit: 10 } })
            .then(r => r.data.data || r.data || []),
        staleTime: 30_000,
        retry: false,
        throwOnError: false,
    });

    const { data: slaData = { data: [], breachDays: 7 } } = useQuery({
        queryKey: ["inbox-sla-alerts"],
        queryFn: () => api.get("/leads/sla-alerts").then(r => r.data),
        staleTime: 60_000,
        retry: false,
        throwOnError: false,
    });
    const slaLeads = slaData.data ?? [];

    const totalCount = followUpLeads.length + reminders.length + waReplies.length + slaLeads.length;
    const isLoading = leadsLoading || remindersLoading;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inbox</h1>
                        {totalCount > 0 && (
                            <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-indigo-600 text-white text-xs font-bold">
                                {totalCount}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">Your operational attention queue</p>
                </div>
                {isLoading && <Loader2 className="h-5 w-5 animate-spin text-gray-300" />}
            </div>

            {/* AI signal banner — shown when inbox is clear */}
            {!isLoading && totalCount === 0 && (
                <div className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-200 rounded-2xl">
                    <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-violet-800">You're all caught up</p>
                        <p className="text-xs text-violet-600 mt-0.5">
                            No follow-ups overdue, no reminders due, no pending replies.
                        </p>
                    </div>
                </div>
            )}

            {/* SLA breached leads */}
            <Section
                icon={ShieldAlert}
                title="SLA Breached"
                count={slaLeads.length}
                color="text-red-500"
                empty={`No leads inactive for more than ${slaData.breachDays} days`}
            >
                {slaLeads.map(lead => <SLAItem key={lead.id} lead={lead} breachDays={slaData.breachDays} />)}
            </Section>

            {/* Follow-up leads */}
            <Section
                icon={AlertCircle}
                title="Needs Attention"
                count={followUpLeads.length}
                color="text-amber-500"
                empty="No leads awaiting follow-up"
            >
                {followUpLeads.map(lead => <FollowUpItem key={lead.id} lead={lead} />)}
            </Section>

            {/* Due reminders */}
            <Section
                icon={Bell}
                title="Due Reminders"
                count={reminders.length}
                color="text-orange-500"
                empty="No reminders due in the next 24 hours"
            >
                {reminders.map(rem => <ReminderItem key={rem.id} reminder={rem} />)}
            </Section>

            {/* WhatsApp replies */}
            <Section
                icon={MessageSquare}
                title="Recent Replies"
                count={waReplies.length}
                color="text-emerald-500"
                empty="No recent WhatsApp replies"
            >
                {waReplies.map(msg => <WhatsAppItem key={msg.id} msg={msg} />)}
            </Section>
        </div>
    );
}
