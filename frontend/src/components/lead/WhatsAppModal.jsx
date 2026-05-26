import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, MessageSquare, ChevronDown, Send, Loader2, AlertCircle } from "lucide-react";
import api from "../../api/axios";

export default function WhatsAppModal({ leadId, lead, onClose }) {
    const queryClient = useQueryClient();
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [params, setParams] = useState([]);
    const [open, setOpen] = useState(false);

    const { data: templates = [], isLoading: tplLoading, error: tplError } = useQuery({
        queryKey: ["whatsapp-templates"],
        queryFn: () => api.get("/whatsapp/templates").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    const send = useMutation({
        mutationFn: () => api.post("/whatsapp/send", {
            leadId,
            templateName: selectedTemplate.elementName,
            parameters: params,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-whatsapp", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            onClose();
        },
    });

    const countVars = (body = "") => {
        const matches = body.match(/\{\{\d+\}\}/g);
        return matches ? matches.length : 0;
    };

    // Detect which lead field best matches a variable by scanning context in template body
    const inferField = (body, varIndex) => {
        const placeholder = `{{${varIndex + 1}}}`;
        const idx = body.indexOf(placeholder);
        if (idx === -1) return null;
        const ctx = body.slice(Math.max(0, idx - 60), idx + 60).toLowerCase();
        if (/phone|mobile|number|contact|call/.test(ctx)) return "phone";
        if (/email|mail/.test(ctx)) return "email";
        if (/company|org|business|firm/.test(ctx)) return "company";
        if (/name|dear|hi |hello/.test(ctx)) return "name";
        return null;
    };

    const POSITIONAL = ["name", "phone", "email", "company"];

    const getLeadValue = (field) => {
        switch (field) {
            case "name":    return lead?.name    ?? "";
            case "phone":   return lead?.phone   ?? "";
            case "email":   return lead?.email   ?? "";
            case "company": return lead?.company ?? "";
            default:        return "";
        }
    };

    const handleTemplateSelect = (tpl) => {
        setSelectedTemplate(tpl);
        const varCount = countVars(tpl.body);
        const prefilled = Array.from({ length: varCount }, (_, i) => {
            const inferred = inferField(tpl.body, i);
            return getLeadValue(inferred ?? POSITIONAL[i] ?? "");
        });
        setParams(prefilled);
        setOpen(false);
    };

    const preview = selectedTemplate
        ? params.reduce(
              (body, val, i) => body.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`),
              selectedTemplate.body
          )
        : null;

    const canSend = selectedTemplate && params.every(p => p.trim() !== "");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                            <MessageSquare className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">Send WhatsApp</p>
                            <p className="text-xs text-gray-400">{lead?.name} · {lead?.phone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Template selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                            Template
                        </label>
                        {tplLoading ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading templates...
                            </div>
                        ) : tplError ? (
                            <div className="flex items-center gap-1.5 text-xs text-red-500">
                                <AlertCircle className="h-3.5 w-3.5" /> Failed to load templates. Check WhatsApp Cloud API credentials.
                            </div>
                        ) : templates.length === 0 ? (
                            <p className="text-xs text-gray-400">No approved templates found.</p>
                        ) : (
                            <div className="relative">
                                <button
                                    onClick={() => setOpen(v => !v)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left hover:border-gray-300 transition-colors"
                                >
                                    <span className={selectedTemplate ? "text-gray-900 font-medium" : "text-gray-400"}>
                                        {selectedTemplate ? selectedTemplate.elementName : "Select a template..."}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                </button>
                                {open && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                                        <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                            {templates.map(tpl => (
                                                <button
                                                    key={tpl.id}
                                                    onClick={() => handleTemplateSelect(tpl)}
                                                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                                >
                                                    <p className="text-sm font-semibold text-gray-800">{tpl.elementName}</p>
                                                    <p className="text-xs text-gray-400 truncate mt-0.5">{tpl.body}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Variable inputs */}
                    {selectedTemplate && params.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                                    Variables
                                </label>
                                <span className="text-[10px] text-gray-400">Auto-filled from lead</span>
                            </div>
                            {params.map((val, i) => {
                                const inferred = inferField(selectedTemplate.body, i);
                                const hint = inferred ?? POSITIONAL[i];
                                return (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 w-8">{`{{${i + 1}}}`}</span>
                                    <input
                                        value={val}
                                        onChange={e => {
                                            const next = [...params];
                                            next[i] = e.target.value;
                                            setParams(next);
                                        }}
                                        placeholder={hint ? `e.g. ${hint}` : `Variable ${i + 1}`}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Preview */}
                    {preview && (
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                                Preview
                            </label>
                            {/* Chat bubble — outbound */}
                            <div className="flex justify-end">
                                <div className="max-w-[85%] bg-emerald-500 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                                    {preview}
                                </div>
                            </div>
                        </div>
                    )}

                    {send.error && (
                        <p className="text-xs text-red-500">
                            {send.error?.response?.data?.message || "Send failed. Try again."}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => send.mutate()}
                        disabled={!canSend || send.isPending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                    >
                        {send.isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Send className="h-3.5 w-3.5" />}
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
