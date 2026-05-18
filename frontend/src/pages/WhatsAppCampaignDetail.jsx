import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Pause, RotateCcw, Loader2, MessageSquare, Sparkles, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import api from "../api/axios";

const STATUS_STYLES = {
    QUEUED:      "bg-gray-100 text-gray-600",
    SENT:        "bg-blue-100 text-blue-700",
    DELIVERED:   "bg-indigo-100 text-indigo-700",
    READ:        "bg-purple-100 text-purple-700",
    REPLIED:     "bg-emerald-100 text-emerald-700",
    FOLLOWED_UP: "bg-teal-100 text-teal-700",
    FAILED:      "bg-red-100 text-red-600",
};

const CAMPAIGN_STATUS_STYLES = {
    DRAFT:     "bg-gray-100 text-gray-600",
    RUNNING:   "bg-blue-100 text-blue-700 animate-pulse",
    PAUSED:    "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED:    "bg-red-100 text-red-600",
};

export default function WhatsAppCampaignDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: campaign, isLoading, isError } = useQuery({
        queryKey: ["wa-campaign", id],
        queryFn: () => api.get(`/whatsapp/campaigns/${id}`).then(r => r.data),
        refetchInterval: (query) => query.state.data?.status === "RUNNING" ? 5000 : false,
    });

    const startMutation = useMutation({
        mutationFn: () => api.post(`/whatsapp/campaigns/${id}/start`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-campaign", id] }),
    });
    const pauseMutation = useMutation({
        mutationFn: () => api.post(`/whatsapp/campaigns/${id}/pause`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-campaign", id] }),
    });
    const resumeMutation = useMutation({
        mutationFn: () => api.post(`/whatsapp/campaigns/${id}/resume`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-campaign", id] }),
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (isError || !campaign) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center">
                <div>
                    <p className="text-red-600 font-semibold">Failed to load campaign</p>
                    <button onClick={() => navigate("/whatsapp/campaigns")} className="mt-3 text-sm text-indigo-600 underline">Back to campaigns</button>
                </div>
            </div>
        );
    }
    if (!campaign) return null;

    const progressPct = campaign.totalCount > 0
        ? Math.round((campaign.sentCount / campaign.totalCount) * 100)
        : 0;

    const stats = [
        { label: "Total", value: campaign.totalCount, color: "text-gray-700" },
        { label: "Sent", value: campaign.sentCount, color: "text-blue-600" },
        { label: "Delivered", value: campaign.deliveredCount, color: "text-indigo-600" },
        { label: "Read", value: campaign.readCount, color: "text-purple-600" },
        { label: "Replied", value: campaign.repliedCount, color: "text-emerald-600" },
        { label: "Failed", value: campaign.failedCount, color: "text-red-500" },
    ];

    // Compute AI insights from campaign stats
    const aiInsights = (() => {
        if (campaign.sentCount === 0) return null;
        const insights = [];
        const deliveryRate = campaign.sentCount > 0 ? (campaign.deliveredCount / campaign.sentCount) * 100 : 0;
        const readRate = campaign.deliveredCount > 0 ? (campaign.readCount / campaign.deliveredCount) * 100 : 0;
        const replyRate = campaign.readCount > 0 ? (campaign.repliedCount / campaign.readCount) * 100 : 0;
        const failRate = campaign.totalCount > 0 ? (campaign.failedCount / campaign.totalCount) * 100 : 0;

        if (replyRate >= 20) insights.push({ type: "positive", icon: TrendingUp, text: `Strong reply rate of ${replyRate.toFixed(0)}% — this template resonates well. Consider reusing it for similar segments.` });
        else if (campaign.repliedCount > 0) insights.push({ type: "neutral", icon: CheckCircle2, text: `${campaign.repliedCount} lead${campaign.repliedCount > 1 ? "s" : ""} replied (${replyRate.toFixed(0)}% of reads). Follow up personally with replied leads for higher conversion.` });

        if (readRate >= 50) insights.push({ type: "positive", icon: TrendingUp, text: `${readRate.toFixed(0)}% of delivered messages were read — above-average open rate for WhatsApp campaigns.` });
        else if (deliveryRate > 0 && readRate < 30) insights.push({ type: "neutral", icon: AlertTriangle, text: `Read rate is ${readRate.toFixed(0)}%. Consider sending at peak hours (10–11am or 5–7pm) or shortening the template message.` });

        if (failRate > 10) insights.push({ type: "warning", icon: AlertTriangle, text: `${campaign.failedCount} messages failed (${failRate.toFixed(0)}%). Check that phone numbers are valid and these leads have WhatsApp opt-in.` });

        if (insights.length === 0 && campaign.status === "COMPLETED") insights.push({ type: "neutral", icon: CheckCircle2, text: `Campaign completed — ${campaign.sentCount} messages sent. Replies and delivery confirmations may still arrive within 24h.` });

        return insights.length > 0 ? insights : null;
    })();

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto space-y-5">
                {/* Back + header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate("/whatsapp/campaigns")} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${CAMPAIGN_STATUS_STYLES[campaign.status] ?? CAMPAIGN_STATUS_STYLES.DRAFT}`}>
                                    {campaign.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">Template: <span className="font-medium text-gray-700">{campaign.templateName}</span></p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        {campaign.status === "DRAFT" && (
                            <button
                                onClick={() => startMutation.mutate()}
                                disabled={startMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                Start
                            </button>
                        )}
                        {campaign.status === "RUNNING" && (
                            <button
                                onClick={() => pauseMutation.mutate()}
                                disabled={pauseMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                {pauseMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                                Pause
                            </button>
                        )}
                        {campaign.status === "PAUSED" && (
                            <button
                                onClick={() => resumeMutation.mutate()}
                                disabled={resumeMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                {resumeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                Resume
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {stats.map(s => (
                        <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Progress bar */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span>Progress</span>
                        <span>{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* AI Performance Insights */}
                {aiInsights && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-violet-500" />
                            <h3 className="text-sm font-semibold text-violet-700">Campaign Insights</h3>
                        </div>
                        <div className="space-y-2.5">
                            {aiInsights.map((insight, i) => {
                                const Icon = insight.icon;
                                const colorMap = {
                                    positive: "text-emerald-600",
                                    warning: "text-amber-600",
                                    neutral: "text-violet-600",
                                };
                                return (
                                    <div key={i} className="flex items-start gap-2">
                                        <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${colorMap[insight.type]}`} />
                                        <p className="text-xs text-gray-700 leading-relaxed">{insight.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Recipients table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100">
                        <h2 className="text-sm font-bold text-gray-700">Recipients ({campaign.recipients?.length ?? 0})</h2>
                    </div>
                    {!campaign.recipients?.length ? (
                        <div className="text-center py-10 text-gray-400 text-sm">No recipients</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Lead</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Phone</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Sent At</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Reply</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {campaign.recipients.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <a href={`/leads/${r.leadId}`} className="font-medium text-gray-900 hover:text-emerald-600 transition-colors">
                                                {r.lead?.name ?? "—"}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{r.phone}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status] ?? STATUS_STYLES.QUEUED}`}>
                                                {r.status}
                                            </span>
                                            {r.failReason && (
                                                <p className="text-xs text-red-400 mt-0.5 max-w-xs truncate" title={r.failReason}>{r.failReason}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs">
                                            {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.replyText ? (
                                                <div className="max-w-xs">
                                                    <span className="text-xs text-emerald-600 font-medium">← </span>
                                                    <span className="text-xs text-gray-700">{r.replyText}</span>
                                                    {r.repliedAt && (
                                                        <p className="text-xs text-gray-400 mt-0.5">{new Date(r.repliedAt).toLocaleString()}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
