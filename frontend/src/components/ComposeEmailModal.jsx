import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Send, Mail, Loader2, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";
import api from "../api/axios";

const LEAD_VARS = {
    "{{lead.name}}":    "name",
    "{{lead.phone}}":   "phone",
    "{{lead.email}}":   "email",
    "{{lead.company}}": "company",
};

function applyVars(text, lead) {
    if (!text || !lead) return text;
    return Object.entries(LEAD_VARS).reduce(
        (t, [placeholder, field]) => t.replaceAll(placeholder, lead[field] ?? ""),
        text
    );
}

export default function ComposeEmailModal({ leadId, lead, defaultTo = "", onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({ toEmail: defaultTo || lead?.email || "", subject: "", body: "" });
    const [tplOpen, setTplOpen] = useState(false);

    const { data: templates = [] } = useQuery({
        queryKey: ["email-templates"],
        queryFn: () => api.get("/email-templates").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    const send = useMutation({
        mutationFn: (data) => api.post(`/leads/${leadId}/emails`, data).then((r) => r.data),
        onSuccess: () => {
            toast.success("Email sent successfully");
            qc.invalidateQueries({ queryKey: ["lead-emails", leadId] });
            qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Failed to send email");
        },
    });

    const saveTemplate = useMutation({
        mutationFn: () => api.post("/email-templates", {
            name: form.subject || "Untitled template",
            subject: form.subject,
            body: form.body,
        }),
        onSuccess: () => {
            toast.success("Saved as template");
            qc.invalidateQueries({ queryKey: ["email-templates"] });
        },
        onError: () => toast.error("Failed to save template"),
    });

    const applyTemplate = (tpl) => {
        setForm(f => ({
            ...f,
            subject: applyVars(tpl.subject, lead),
            body: applyVars(tpl.body, lead),
        }));
        setTplOpen(false);
    };

    const canSend = form.toEmail.trim() && form.subject.trim() && form.body.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                            <Mail className="h-4 w-4 text-indigo-600" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">Compose Email</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Template picker */}
                {templates.length > 0 && (
                    <div className="px-5 pt-3 relative">
                        <button
                            onClick={() => setTplOpen(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 border border-indigo-100 transition-colors"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Use template
                            <ChevronDown className="h-3 w-3" />
                        </button>
                        {tplOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setTplOpen(false)} />
                                <div className="absolute top-full mt-1 left-5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[240px] max-h-52 overflow-y-auto">
                                    {templates.map(tpl => (
                                        <button
                                            key={tpl.id}
                                            onClick={() => applyTemplate(tpl)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                        >
                                            <p className="text-sm font-semibold text-gray-800">{tpl.name}</p>
                                            <p className="text-xs text-gray-400 truncate">{tpl.subject}</p>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Fields */}
                <div className="px-5 py-4 space-y-3">
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">To</label>
                        <input
                            type="email"
                            className="mt-1 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="recipient@example.com"
                            value={form.toEmail}
                            onChange={(e) => setForm((f) => ({ ...f, toEmail: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Subject</label>
                        <input
                            type="text"
                            className="mt-1 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="Email subject"
                            value={form.subject}
                            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Message</label>
                        <textarea
                            rows={8}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                            placeholder="Write your message…"
                            value={form.body}
                            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
                            Cancel
                        </button>
                        {form.subject.trim() && form.body.trim() && (
                            <button
                                onClick={() => saveTemplate.mutate()}
                                disabled={saveTemplate.isPending}
                                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                            >
                                {saveTemplate.isPending ? "Saving…" : "Save as template"}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => send.mutate(form)}
                        disabled={!canSend || send.isPending}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {send.isPending ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                        ) : (
                            <><Send className="h-4 w-4" /> Send Email</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
