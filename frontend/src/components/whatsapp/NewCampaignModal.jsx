import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, ChevronDown, Send, Loader2, AlertCircle, CheckSquare, Square, Search, ShieldAlert } from "lucide-react";
import api from "../../api/axios";

const STEPS = ["Template", "Select Leads", "Preview & Send"];

export default function NewCampaignModal({ onClose, onCreated }) {
    const [step, setStep] = useState(0);
    const [name, setName] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [params, setParams] = useState([]);
    const [tplOpen, setTplOpen] = useState(false);
    const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { data: templates = [], isLoading: tplLoading, error: tplError } = useQuery({
        queryKey: ["whatsapp-templates"],
        queryFn: () => api.get("/whatsapp/templates").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    const { data: leadsData, isLoading: leadsLoading } = useQuery({
        queryKey: ["leads-for-campaign", search, statusFilter],
        queryFn: () => api.get("/leads", {
            params: { search: search || undefined, status: statusFilter || undefined, limit: 100 },
        }).then(r => r.data),
        enabled: step === 1,
    });

    const leads = leadsData?.data ?? leadsData?.leads ?? (Array.isArray(leadsData) ? leadsData : []);

    const countVars = (body = "") => {
        const m = body.match(/\{\{\d+\}\}/g);
        return m ? m.length : 0;
    };

    const handleTemplateSelect = (tpl) => {
        setSelectedTemplate(tpl);
        const count = countVars(tpl.body);
        setParams(Array(count).fill(""));
        setTplOpen(false);
    };

    const preview = selectedTemplate
        ? params.reduce((body, val, i) => body.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`), selectedTemplate.body)
        : null;

    const toggleLead = (id) => {
        setSelectedLeadIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedLeadIds.size === leads.length) {
            setSelectedLeadIds(new Set());
        } else {
            setSelectedLeadIds(new Set(leads.map(l => l.id)));
        }
    };

    const createMutation = useMutation({
        mutationFn: (data) => api.post("/whatsapp/campaigns", data),
        onSuccess: (res) => {
            // Auto-start immediately
            const campaignId = res.data.campaign.id;
            return api.post(`/whatsapp/campaigns/${campaignId}/start`).then(() => onCreated());
        },
    });

    const saveDraftMutation = useMutation({
        mutationFn: (data) => api.post("/whatsapp/campaigns", data),
        onSuccess: () => onCreated(),
    });

    const buildPayload = () => ({
        name,
        templateName: selectedTemplate.elementName,
        parameters: params,
        leadIds: Array.from(selectedLeadIds),
    });

    const canProceedStep0 = name.trim() && selectedTemplate && params.every(p => p.trim() !== "");
    const canProceedStep1 = selectedLeadIds.size > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <p className="text-sm font-bold text-gray-900">New WhatsApp Campaign</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            {STEPS.map((s, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${i === step ? "bg-emerald-500 text-white" : i < step ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        {i + 1}. {s}
                                    </span>
                                    {i < STEPS.length - 1 && <span className="text-gray-200">›</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5">

                    {/* Step 0: Template */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Campaign Name</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. May Follow-up Campaign"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Template</label>
                                {tplLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading templates...
                                    </div>
                                ) : tplError ? (
                                    <div className="flex items-center gap-1.5 text-xs text-red-500">
                                        <AlertCircle className="h-3.5 w-3.5" /> Failed to load templates
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={() => setTplOpen(v => !v)}
                                            className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left hover:border-gray-300 transition-colors"
                                        >
                                            <span className={selectedTemplate ? "text-gray-900 font-medium" : "text-gray-400"}>
                                                {selectedTemplate ? selectedTemplate.elementName : "Select a template..."}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        </button>
                                        {tplOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setTplOpen(false)} />
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

                            {selectedTemplate && params.length > 0 && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">Variables</label>
                                    {params.map((val, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400 w-8">{`{{${i + 1}}}`}</span>
                                            <input
                                                value={val}
                                                onChange={e => { const n = [...params]; n[i] = e.target.value; setParams(n); }}
                                                placeholder={`Variable ${i + 1}`}
                                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {preview && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Preview</label>
                                    <div className="flex justify-end">
                                        <div className="max-w-[85%] bg-emerald-500 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                                            {preview}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1: Lead selector */}
                    {step === 1 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-amber-700 font-medium">Leads without WhatsApp opt-in or a phone number will be skipped automatically when the campaign runs.</p>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search by name or phone..."
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">All statuses</option>
                                    <option value="NEW">New</option>
                                    <option value="CONTACTED">Contacted</option>
                                    <option value="FOLLOW_UP">Follow Up</option>
                                    <option value="CONVERTED">Converted</option>
                                    <option value="LOST">Lost</option>
                                </select>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                {/* Select all row */}
                                <div
                                    onClick={toggleAll}
                                    className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    {selectedLeadIds.size === leads.length && leads.length > 0
                                        ? <CheckSquare className="h-4 w-4 text-emerald-500" />
                                        : <Square className="h-4 w-4 text-gray-300" />
                                    }
                                    <span className="text-xs font-bold text-gray-600">
                                        {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} selected` : "Select all"}
                                    </span>
                                </div>

                                <div className="max-h-72 overflow-y-auto">
                                    {leadsLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                                        </div>
                                    ) : leads.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-gray-400">
                                            No opted-in leads found
                                        </div>
                                    ) : (
                                        leads.map(lead => (
                                            <div
                                                key={lead.id}
                                                onClick={() => toggleLead(lead.id)}
                                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                {selectedLeadIds.has(lead.id)
                                                    ? <CheckSquare className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                    : <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{lead.name}</p>
                                                    <p className="text-xs text-gray-400">{lead.phone}</p>
                                                </div>
                                                <span className="text-xs text-gray-400 flex-shrink-0">{lead.status}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview & Send */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 font-medium">Campaign Name</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{name}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 font-medium">Template</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedTemplate?.elementName}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-4">
                                    <p className="text-xs text-emerald-600 font-medium">Opted-in Recipients</p>
                                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">{selectedLeadIds.size}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Message Preview</label>
                                <div className="flex justify-end">
                                    <div className="max-w-[85%] bg-emerald-500 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                                        {preview}
                                    </div>
                                </div>
                            </div>

                            {createMutation.error && (
                                <p className="text-xs text-red-500">
                                    {createMutation.error?.response?.data?.error ?? "Failed to create campaign"}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
                    <button
                        onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                        {step === 0 ? "Cancel" : "Back"}
                    </button>

                    <div className="flex gap-2">
                        {step < 2 ? (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
                                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                Next →
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => saveDraftMutation.mutate(buildPayload())}
                                    disabled={saveDraftMutation.isPending || createMutation.isPending}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 font-medium rounded-xl transition-colors disabled:opacity-40"
                                >
                                    {saveDraftMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> : null}
                                    Save as Draft
                                </button>
                                <button
                                    onClick={() => createMutation.mutate(buildPayload())}
                                    disabled={createMutation.isPending || saveDraftMutation.isPending}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    {createMutation.isPending
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Send className="h-3.5 w-3.5" />
                                    }
                                    Create & Start
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
