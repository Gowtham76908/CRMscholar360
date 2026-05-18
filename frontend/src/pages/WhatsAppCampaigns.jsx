import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, ChevronRight, Loader2, Send, CheckCheck, Reply, XCircle, Users } from "lucide-react";
import api from "../api/axios";
import NewCampaignModal from "../components/whatsapp/NewCampaignModal";
import { cn } from "../lib/utils";

const STATUS_STYLES = {
    DRAFT:     { chip: "bg-gray-100 text-gray-600",     dot: "bg-gray-400",    label: "Draft" },
    RUNNING:   { chip: "bg-blue-100 text-blue-700",     dot: "bg-blue-500 animate-pulse", label: "Running" },
    PAUSED:    { chip: "bg-amber-100 text-amber-700",   dot: "bg-amber-400",   label: "Paused" },
    COMPLETED: { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Completed" },
    FAILED:    { chip: "bg-red-100 text-red-600",       dot: "bg-red-400",     label: "Failed" },
};

function StatPill({ icon: Icon, label, value, color }) {
    return (
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl", color)}>
            <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
            <div>
                <p className="text-lg font-bold leading-none">{value ?? 0}</p>
                <p className="text-[10px] font-medium opacity-70 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

export default function WhatsAppCampaigns() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["wa-campaigns"],
        queryFn: () => api.get("/whatsapp/campaigns").then(r => r.data),
        refetchInterval: (query) =>
            query.state.data?.campaigns?.some(c => c.status === "RUNNING") ? 5000 : false,
    });

    const campaigns = data?.campaigns ?? [];

    const totals = campaigns.reduce((acc, c) => ({
        total:   acc.total   + (c.totalCount   ?? 0),
        sent:    acc.sent    + (c.sentCount     ?? 0),
        replied: acc.replied + (c.repliedCount  ?? 0),
        failed:  acc.failed  + (c.failedCount   ?? 0),
    }), { total: 0, sent: 0, replied: 0, failed: 0 });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-sm">
                        <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">WhatsApp Campaigns</h1>
                        <p className="text-sm text-gray-500">Bulk message opted-in leads</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    New Campaign
                </button>
            </div>

            {/* Summary stat cards */}
            {campaigns.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatPill icon={Users}     label="Total Recipients" value={totals.total}   color="bg-gray-50 text-gray-700" />
                    <StatPill icon={Send}      label="Messages Sent"    value={totals.sent}    color="bg-emerald-50 text-emerald-700" />
                    <StatPill icon={Reply}     label="Replies"          value={totals.replied} color="bg-blue-50 text-blue-700" />
                    <StatPill icon={XCircle}   label="Failed"           value={totals.failed}  color="bg-red-50 text-red-600" />
                </div>
            )}

            {/* Campaign list */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                </div>
            ) : isError ? (
                <div className="bg-white rounded-2xl border border-red-200 text-center py-12">
                    <p className="text-red-600 font-semibold text-sm">Failed to load campaigns</p>
                    <button onClick={() => refetch()} className="mt-3 text-xs text-red-500 underline">Retry</button>
                </div>
            ) : campaigns.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm text-center py-20 text-gray-400">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="font-semibold text-sm">No campaigns yet</p>
                    <p className="text-xs mt-1">Create your first bulk WhatsApp campaign</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <Plus className="h-4 w-4" /> New Campaign
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(c => {
                        const st = STATUS_STYLES[c.status] ?? STATUS_STYLES.DRAFT;
                        const sentPct = c.totalCount > 0 ? Math.round((c.sentCount / c.totalCount) * 100) : 0;
                        return (
                            <div
                                key={c.id}
                                onClick={() => navigate(`/whatsapp/campaigns/${c.id}`)}
                                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all p-4"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate text-sm">{c.name}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{c.templateName} · {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", st.chip)}>
                                            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                                            {st.label}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-gray-300" />
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.totalCount} total</span>
                                    <span className="flex items-center gap-1 text-emerald-600"><Send className="h-3 w-3" /> {c.sentCount} sent</span>
                                    <span className="flex items-center gap-1 text-blue-600"><CheckCheck className="h-3 w-3" /> {c.repliedCount} replied</span>
                                    {c.failedCount > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" /> {c.failedCount} failed</span>}
                                </div>

                                {/* Progress bar */}
                                {c.totalCount > 0 && (
                                    <div className="mt-2.5">
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                                                style={{ width: `${sentPct}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{sentPct}% sent</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <NewCampaignModal
                    onClose={() => setShowModal(false)}
                    onCreated={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ["wa-campaigns"] }); }}
                />
            )}
        </div>
    );
}
