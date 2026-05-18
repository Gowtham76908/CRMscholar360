import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Plus, Trash2, Loader2, Clock, Tag } from "lucide-react";
import { toast } from "sonner";
import api from "../api/axios";

const BLANK_FORM = {
    name: "",
    triggerType: "KEYWORD",
    keyword: "",
    timeoutHours: "",
    replyTemplate: "",
    replyParams: "",
};

export default function WhatsAppAutoReplies() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(BLANK_FORM);

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ["wa-auto-replies"],
        queryFn: () => api.get("/whatsapp/auto-replies").then(r => r.data),
    });

    const { data: templates = [] } = useQuery({
        queryKey: ["whatsapp-templates"],
        queryFn: () => api.get("/whatsapp/templates").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    const createMutation = useMutation({
        mutationFn: (data) => api.post("/whatsapp/auto-replies", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wa-auto-replies"] });
            setShowForm(false);
            setForm(BLANK_FORM);
        },
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, active }) => api.patch(`/whatsapp/auto-replies/${id}`, { active }),
        onSuccess: (_, { active }) => {
            queryClient.invalidateQueries({ queryKey: ["wa-auto-replies"] });
            toast.success(active ? "Rule enabled" : "Rule disabled");
        },
        onError: (e) => toast.error(e.response?.data?.error || "Failed to update rule"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/whatsapp/auto-replies/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wa-auto-replies"] });
            toast.success("Rule deleted");
        },
        onError: (e) => toast.error(e.response?.data?.error || "Failed to delete rule"),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const params = form.replyParams
            ? form.replyParams.split(",").map(s => s.trim()).filter(Boolean)
            : [];
        createMutation.mutate({
            name: form.name,
            triggerType: form.triggerType,
            keyword: form.triggerType === "KEYWORD" ? form.keyword : undefined,
            timeoutHours: form.triggerType === "NO_REPLY_TIMEOUT" ? parseInt(form.timeoutHours) : undefined,
            replyTemplate: form.replyTemplate,
            replyParams: params,
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                            <Zap className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Auto Reply Rules</h1>
                            <p className="text-sm text-gray-500">Automatically reply to inbound WhatsApp messages</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Add Rule
                    </button>
                </div>

                {/* New rule form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5 space-y-4">
                        <h2 className="text-sm font-bold text-gray-700">New Auto Reply Rule</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Rule Name</label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Interested reply"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Trigger Type</label>
                                <select
                                    value={form.triggerType}
                                    onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="KEYWORD">Keyword Match</option>
                                    <option value="NO_REPLY_TIMEOUT">No Reply Timeout</option>
                                </select>
                            </div>
                        </div>

                        {form.triggerType === "KEYWORD" ? (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Keyword (case-insensitive contains)</label>
                                <input
                                    required
                                    value={form.keyword}
                                    onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                                    placeholder="e.g. interested"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">No Reply After (hours)</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    value={form.timeoutHours}
                                    onChange={e => setForm(f => ({ ...f, timeoutHours: e.target.value }))}
                                    placeholder="e.g. 24"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Reply Template</label>
                                <select
                                    required
                                    value={form.replyTemplate}
                                    onChange={e => setForm(f => ({ ...f, replyTemplate: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="">Select template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.elementName}>{t.elementName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                                    Template Params <span className="text-gray-400 font-normal">(comma-separated)</span>
                                </label>
                                <input
                                    value={form.replyParams}
                                    onChange={e => setForm(f => ({ ...f, replyParams: e.target.value }))}
                                    placeholder="e.g. Team, 9AM-6PM"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                Save Rule
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                        {createMutation.error && (
                            <p className="text-xs text-red-500">{createMutation.error?.response?.data?.error ?? "Failed to save"}</p>
                        )}
                    </form>
                )}

                {/* Rules list */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                    ) : rules.length === 0 && !showForm ? (
                        <div className="bg-white rounded-2xl border border-gray-200 text-center py-14 text-gray-400">
                            <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-medium">No auto-reply rules yet</p>
                            <p className="text-xs mt-1">Add a rule to automatically respond to inbound messages</p>
                        </div>
                    ) : (
                        rules.map(rule => (
                            <div key={rule.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.triggerType === "KEYWORD" ? "bg-emerald-100" : "bg-orange-100"}`}>
                                    {rule.triggerType === "KEYWORD"
                                        ? <Tag className="h-4 w-4 text-emerald-600" />
                                        : <Clock className="h-4 w-4 text-orange-600" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900">{rule.name}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {rule.triggerType === "KEYWORD"
                                            ? <>Keyword: <span className="font-medium text-gray-700">"{rule.keyword}"</span></>
                                            : <>No reply after <span className="font-medium text-gray-700">{rule.timeoutHours}h</span></>
                                        }
                                        {" → "}
                                        <span className="font-medium text-gray-700">{rule.replyTemplate}</span>
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={rule.active}
                                        onChange={() => toggleMutation.mutate({ id: rule.id, active: !rule.active })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-checked:bg-violet-500 rounded-full peer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                                </label>
                                <button
                                    onClick={() => deleteMutation.mutate(rule.id)}
                                    disabled={deleteMutation.isPending}
                                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
