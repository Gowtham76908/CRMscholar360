import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Send, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "../api/axios";

export default function ComposeEmailModal({ leadId, defaultTo = "", onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({ toEmail: defaultTo, subject: "", body: "" });

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
                    <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
                        Cancel
                    </button>
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
