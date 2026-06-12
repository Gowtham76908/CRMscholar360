import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../api/axios";
import {
    Loader2, User, Bell, Lock, Download, Trash2, Save, Shield, Smartphone,
    Eye, EyeOff, Camera, X, CheckCircle, Layers, Plus, GripVertical, Clock, Bot,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AuditLogs from "../components/AuditLogs";
import SessionManager from "../components/SessionManager";
import Avatar from "../components/Avatar";
import { cn } from "../lib/utils";

const profileSchema = z.object({
    name: z.string().min(2, "Name required"),
    phone: z.string().optional(),
    department: z.string().optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

const Field = ({ label, error, children }) => (
    <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
        {children}
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
);

const inputCls = (disabled) => cn(
    "w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors",
    disabled ? "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed" : "border-gray-200 bg-white text-gray-900"
);

const TABS = [
    { id: "profile",       icon: User,     label: "Profile" },
    { id: "security",      icon: Lock,     label: "Security" },
    { id: "notifications", icon: Bell,     label: "Notifications" },
    { id: "data",          icon: Download, label: "Data Export" },
];

const ADMIN_TABS = [
    { id: "lead-fields",  icon: Layers,     label: "Lead Fields" },
    { id: "lead-sla",     icon: Clock,      label: "Lead SLA" },
    { id: "ai-assistant", icon: Bot,        label: "AI Assistant" },
    { id: "audit",        icon: Shield,     label: "Audit Logs" },
    { id: "sessions",     icon: Smartphone, label: "Sessions" },
];

// ─── SMTP Settings ────────────────────────────────────────────────────────────

function SmtpSettings() {
    const { data: existing, isLoading } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then((r) => r.data),
    });

    const [form, setForm] = useState({
        smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "",
        smtpFrom: "", smtpSecure: false, testTo: "",
    });

    useEffect(() => {
        if (existing) {
            setForm({
                smtpHost:   existing.smtpHost   || "",
                smtpPort:   String(existing.smtpPort || 587),
                smtpUser:   existing.smtpUser   || "",
                smtpPass:   existing.smtpPass   || "",
                smtpFrom:   existing.smtpFrom   || "",
                smtpSecure: existing.smtpSecure ?? false,
                testTo:     "",
            });
        }
    }, [existing]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const save = useMutation({
        mutationFn: () => api.patch("/company-settings", {
            smtpHost: form.smtpHost || null,
            smtpPort: form.smtpPort ? parseInt(form.smtpPort) : null,
            smtpUser: form.smtpUser || null,
            smtpPass: form.smtpPass || null,
            smtpFrom: form.smtpFrom || null,
            smtpSecure: form.smtpSecure,
        }),
        onSuccess: () => toast.success("SMTP settings saved"),
        onError: () => toast.error("Failed to save"),
    });

    const test = useMutation({
        mutationFn: () => api.post("/company-settings/test-smtp", {
            smtpHost: form.smtpHost,
            smtpPort: parseInt(form.smtpPort) || 587,
            smtpUser: form.smtpUser,
            smtpPass: form.smtpPass,
            smtpFrom: form.smtpFrom,
            smtpSecure: form.smtpSecure,
            testTo: form.testTo || form.smtpUser,
        }),
        onSuccess: () => toast.success("Test email sent! Check your inbox."),
        onError: (e) => toast.error(e.response?.data?.message || "SMTP test failed"),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-500" /> Outbound Email (SMTP)
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">Configure the mail server used to send emails from lead context.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Field label="SMTP Host">
                    <input className={inputCls(false)} placeholder="smtp.gmail.com" value={form.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} />
                </Field>
                <Field label="Port">
                    <input className={inputCls(false)} type="number" placeholder="587" value={form.smtpPort} onChange={(e) => set({ smtpPort: e.target.value })} />
                </Field>
                <Field label="Username / Email">
                    <input className={inputCls(false)} placeholder="you@gmail.com" value={form.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} />
                </Field>
                <Field label="Password / App Password">
                    <input className={inputCls(false)} type="password" placeholder="••••••••••••" value={form.smtpPass} onChange={(e) => set({ smtpPass: e.target.value })} />
                </Field>
                <Field label="From Name (shown as sender)">
                    <input className={inputCls(false)} placeholder="Your Company CRM" value={form.smtpFrom} onChange={(e) => set({ smtpFrom: e.target.value })} />
                </Field>
                <Field label="Secure (SSL/TLS — use for port 465)">
                    <div className="flex items-center gap-3 h-9">
                        <button
                            type="button"
                            onClick={() => set({ smtpSecure: !form.smtpSecure })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.smtpSecure ? "bg-indigo-600" : "bg-gray-200"}`}
                        >
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.smtpSecure ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                        <span className="text-sm text-gray-500">{form.smtpSecure ? "Enabled" : "Disabled"}</span>
                    </div>
                </Field>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Test Connection</p>
                <div className="flex gap-3">
                    <input
                        className={`${inputCls(false)} flex-1`}
                        placeholder="Send test email to… (defaults to username)"
                        value={form.testTo}
                        onChange={(e) => set({ testTo: e.target.value })}
                    />
                    <button
                        onClick={() => test.mutate()}
                        disabled={test.isPending || !form.smtpHost || !form.smtpUser || !form.smtpPass}
                        className="px-4 py-2 text-sm font-semibold border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                        {test.isPending ? <><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Testing…</> : "Send Test Email"}
                    </button>
                </div>
            </div>
            <div className="flex justify-end">
                <button
                    onClick={() => save.mutate()}
                    disabled={save.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                    {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save SMTP Settings
                </button>
            </div>
        </div>
    );
}

// ─── Lead Fields Panel ────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS = {
    TEXT: "Text", TEXTAREA: "Text Area", NUMBER: "Number",
    SELECT: "Dropdown", DATE: "Date", CHECKBOX: "Checkbox",
};

const CUSTOM_FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "SELECT", "DATE", "CHECKBOX"];

function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-indigo-500" : "bg-gray-200"}`}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
    );
}

function FieldRow({ field, onUpdate, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(field.name);
    const qc = useQueryClient();

    const update = useMutation({
        mutationFn: (data) => api.patch(`/custom-fields/${field.id}`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-fields"] }),
        onError: (e) => toast.error(e.response?.data?.message || "Failed to update field"),
    });

    const handleLabelSave = () => {
        if (label.trim() && label !== field.name) update.mutate({ name: label.trim() });
        setEditing(false);
    };

    const handleVisibleToggle = () => update.mutate({ visible: !field.visible });
    const handleRequiredToggle = () => update.mutate({ required: !field.required });

    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl border transition-colors",
            field.visible ? "border-gray-100 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
        )}>
            <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />

            {/* Type badge */}
            <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: field.isSystem ? "#EEF2FF" : "#F3F4F6", color: field.isSystem ? "#4F46E5" : "#6B7280" }}>
                {field.isSystem ? "SYS" : (FIELD_TYPE_LABELS[field.type]?.[0] ?? "?")}
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
                {editing ? (
                    <input
                        autoFocus
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        onBlur={handleLabelSave}
                        onKeyDown={e => { if (e.key === "Enter") handleLabelSave(); if (e.key === "Escape") { setLabel(field.name); setEditing(false); } }}
                        className="w-full text-sm font-semibold text-gray-900 border-b border-indigo-400 outline-none bg-transparent"
                    />
                ) : (
                    <button onClick={() => setEditing(true)} className="text-sm font-semibold text-gray-900 hover:text-indigo-600 text-left truncate w-full">
                        {field.name}
                    </button>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                    {field.fieldKey} · {FIELD_TYPE_LABELS[field.type] ?? field.type}
                    {field.isSystem && " · system"}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">Required</span>
                    <Toggle checked={field.required} onChange={handleRequiredToggle} />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">Visible</span>
                    <Toggle checked={field.visible} onChange={handleVisibleToggle} />
                </div>
                {!field.isSystem && (
                    <button
                        onClick={() => onDelete(field)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Lead SLA Settings ────────────────────────────────────────────────────────

function SlaSettings() {
    const { data: existing, isLoading } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then((r) => r.data),
    });

    const [form, setForm] = useState({ slaWarningDays: 3, slaBreachDays: 7 });

    useEffect(() => {
        if (existing) {
            setForm({
                slaWarningDays: existing.slaWarningDays ?? 3,
                slaBreachDays:  existing.slaBreachDays  ?? 7,
            });
        }
    }, [existing]);

    const save = useMutation({
        mutationFn: () => api.patch("/company-settings", {
            slaWarningDays: Number(form.slaWarningDays),
            slaBreachDays:  Number(form.slaBreachDays),
        }),
        onSuccess: () => toast.success("SLA thresholds saved"),
        onError:   () => toast.error("Failed to save"),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" /> Lead SLA Thresholds
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                    Leads in NEW / CONTACTED / FOLLOW_UP status with no update beyond these thresholds will show SLA badges.
                </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Warning threshold (days)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="365"
                        className={inputCls(false)}
                        value={form.slaWarningDays}
                        onChange={(e) => setForm((f) => ({ ...f, slaWarningDays: e.target.value }))}
                    />
                    <p className="text-xs text-amber-600">Shows an amber "Xd" badge on the lead card.</p>
                </div>
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Breach threshold (days)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="365"
                        className={inputCls(false)}
                        value={form.slaBreachDays}
                        onChange={(e) => setForm((f) => ({ ...f, slaBreachDays: e.target.value }))}
                    />
                    <p className="text-xs text-red-500">Shows a red "SLA" badge and a red card border.</p>
                </div>
            </div>
            <div className="flex justify-end">
                <button
                    onClick={() => save.mutate()}
                    disabled={save.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                    {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save SLA Settings
                </button>
            </div>
        </div>
    );
}

function AssistantSettings() {
    const qc = useQueryClient();
    const { data: existing, isLoading } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then((r) => r.data),
    });

    const [form, setForm] = useState({
        assistantEnabled: true,
        assistantRateLimitPerMin: 30,
        assistantMaxHistoryTurns: 6,
    });

    useEffect(() => {
        if (existing) {
            setForm({
                assistantEnabled:         existing.assistantEnabled         ?? true,
                assistantRateLimitPerMin: existing.assistantRateLimitPerMin ?? 30,
                assistantMaxHistoryTurns: existing.assistantMaxHistoryTurns ?? 6,
            });
        }
    }, [existing]);

    const save = useMutation({
        mutationFn: () => api.patch("/company-settings", {
            assistantEnabled:         Boolean(form.assistantEnabled),
            assistantRateLimitPerMin: Math.max(1, Math.min(600, Number(form.assistantRateLimitPerMin) || 30)),
            assistantMaxHistoryTurns: Math.max(0, Math.min(50,  Number(form.assistantMaxHistoryTurns) || 6)),
        }),
        onSuccess: () => {
            toast.success("AI Assistant settings saved");
            qc.invalidateQueries({ queryKey: ["company-settings"] });
        },
        onError: () => toast.error("Failed to save"),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-500" /> AI Assistant
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                    Controls the in-app chat + voice assistant. Changes take effect within a few seconds for all users.
                </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div>
                    <p className="text-sm font-semibold text-gray-900">Assistant enabled</p>
                    <p className="text-xs text-gray-500 mt-0.5">When off, the chat widget returns a "currently disabled" message.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={form.assistantEnabled}
                    onClick={() => setForm((f) => ({ ...f, assistantEnabled: !f.assistantEnabled }))}
                    className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        form.assistantEnabled ? "bg-indigo-600" : "bg-gray-300",
                    )}
                >
                    <span className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                        form.assistantEnabled ? "translate-x-5" : "translate-x-0.5",
                    )} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Rate limit (requests / user / min)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="600"
                        className={inputCls(false)}
                        value={form.assistantRateLimitPerMin}
                        onChange={(e) => setForm((f) => ({ ...f, assistantRateLimitPerMin: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400">Caps each user's chat sends per minute. 1–600.</p>
                </div>
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Max history turns
                    </label>
                    <input
                        type="number"
                        min="0"
                        max="50"
                        className={inputCls(false)}
                        value={form.assistantMaxHistoryTurns}
                        onChange={(e) => setForm((f) => ({ ...f, assistantMaxHistoryTurns: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400">How many prior exchanges the assistant remembers. 0 disables memory.</p>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => save.mutate()}
                    disabled={save.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                    {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Assistant Settings
                </button>
            </div>
        </div>
    );
}

function LeadFieldsSettings() {
    const qc = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: "", fieldKey: "", type: "TEXT", options: "", required: false });

    const { data: fields = [], isLoading } = useQuery({
        queryKey: ["lead-fields"],
        queryFn: () => api.get("/custom-fields").then(r => r.data),
    });

    const systemFields = fields.filter(f => f.isSystem);
    const customFields = fields.filter(f => !f.isSystem);

    const autoKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const create = useMutation({
        mutationFn: () => api.post("/custom-fields", {
            name: form.name,
            fieldKey: form.fieldKey || autoKey(form.name),
            type: form.type,
            options: form.type === "SELECT" && form.options
                ? form.options.split(",").map(o => o.trim()).filter(Boolean)
                : null,
            required: form.required,
            order: customFields.length + 100,
        }),
        onSuccess: () => {
            toast.success("Field created");
            qc.invalidateQueries({ queryKey: ["lead-fields"] });
            setForm({ name: "", fieldKey: "", type: "TEXT", options: "", required: false });
            setShowAdd(false);
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to create field"),
    });

    const del = useMutation({
        mutationFn: (id) => api.delete(`/custom-fields/${id}`),
        onSuccess: () => {
            toast.success("Field deleted");
            qc.invalidateQueries({ queryKey: ["lead-fields"] });
        },
        onError: () => toast.error("Failed to delete field"),
    });

    const handleDelete = (field) => {
        if (confirm(`Delete field "${field.name}"? This removes it from all leads.`)) del.mutate(field.id);
    };

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

    return (
        <div className="space-y-6">
            {/* System Fields */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-500" /> System Fields
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Built-in lead fields. Toggle visibility and required state, or rename the label.
                        Click a label to rename it inline.
                    </p>
                </div>
                <div className="space-y-2">
                    {systemFields.map(f => (
                        <FieldRow key={f.id} field={f} onDelete={handleDelete} />
                    ))}
                </div>
            </div>

            {/* Custom Fields */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Custom Fields</h2>
                        <p className="text-sm text-gray-400 mt-0.5">Additional fields stored on each lead. Full control over type and options.</p>
                    </div>
                    <button
                        onClick={() => setShowAdd(v => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Field
                    </button>
                </div>

                {showAdd && (
                    <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/40 space-y-3">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">New Custom Field</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Display Name">
                                <input
                                    className={inputCls(false)}
                                    placeholder="e.g. Budget Range"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value, fieldKey: autoKey(e.target.value) }))}
                                />
                            </Field>
                            <Field label="Field Key (auto)">
                                <input
                                    className={inputCls(false)}
                                    placeholder="budget_range"
                                    value={form.fieldKey}
                                    onChange={e => setForm(f => ({ ...f, fieldKey: e.target.value }))}
                                />
                            </Field>
                            <Field label="Type">
                                <select
                                    className={inputCls(false)}
                                    value={form.type}
                                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                >
                                    {CUSTOM_FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
                                </select>
                            </Field>
                            {form.type === "SELECT" && (
                                <Field label="Options (comma-separated)">
                                    <input
                                        className={inputCls(false)}
                                        placeholder="Option A, Option B, Option C"
                                        value={form.options}
                                        onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                                    />
                                </Field>
                            )}
                            <div className="flex items-center gap-2 col-span-2">
                                <input type="checkbox" id="cf-req" checked={form.required}
                                    onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} className="rounded" />
                                <label htmlFor="cf-req" className="text-sm text-gray-700">Required field</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                            <button
                                onClick={() => create.mutate()}
                                disabled={create.isPending || !form.name}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                            >
                                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Save Field
                            </button>
                        </div>
                    </div>
                )}

                {customFields.length === 0 && !showAdd ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                        No custom fields yet. Click "Add Field" to create your first one.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {customFields.map(f => (
                            <FieldRow key={f.id} field={f} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Google Calendar Settings ────────────────────────────────────────────────

function GoogleCalendarSettings() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["gcal-status"],
        queryFn: () => api.get("/google/calendar/status").then(r => r.data),
    });

    const connectMutation = useMutation({
        mutationFn: () => api.get("/google/auth").then(r => r.data),
        onSuccess: ({ url }) => { window.location.href = url; },
        onError: () => toast.error("Failed to initiate Google sign-in"),
    });

    const disconnectMutation = useMutation({
        mutationFn: () => api.post("/google/calendar/disconnect"),
        onSuccess: () => {
            toast.success("Google Calendar disconnected");
            queryClient.invalidateQueries({ queryKey: ["gcal-status"] });
        },
        onError: () => toast.error("Failed to disconnect"),
    });

    if (isLoading) return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
        </div>
    );

    const connected = data?.connected;
    const connectedAt = data?.connectedAt ? new Date(data.connectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 mb-1">Integrations</h2>
                <p className="text-sm text-gray-500 mb-6">Connect third-party services to your account.</p>

                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                            <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Google Calendar</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {connected
                                    ? `Connected${connectedAt ? ` on ${connectedAt}` : ""}. Reminders sync automatically.`
                                    : "Connect to sync reminders and get calendar notifications."}
                            </p>
                        </div>
                    </div>

                    {connected ? (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                                <CheckCircle className="h-3 w-3" /> Connected
                            </span>
                            <button
                                onClick={() => disconnectMutation.mutate()}
                                disabled={disconnectMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                                {disconnectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => connectMutation.mutate()}
                            disabled={connectMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {connectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                            Connect Google
                        </button>
                    )}
                </div>

                {connected && (
                    <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50">
                        <p className="text-xs text-blue-700 font-medium mb-1">How it works</p>
                        <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
                            <li>When you create a reminder, you can add it directly to your Google Calendar.</li>
                            <li>Google Calendar will send you email and popup notifications at the reminder time.</li>
                            <li>Reminders appear as 30-minute events with a 10-minute popup alert.</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Settings Component ──────────────────────────────────────────────────

const Settings = () => {
    const { user, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState(() => {
        return "profile";
    });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const gcal = params.get("gcal");
        if (!gcal) return;
        if (gcal === "connected") toast.success("Google Calendar connected successfully!");
        else if (gcal === "denied") toast.info("Google Calendar connection cancelled.");
        else if (gcal === "no_refresh_token") toast.error("Google sign-in didn't return a refresh token. Please try connecting again.");
        else toast.error("Google Calendar connection failed. Please try again.");
        window.history.replaceState({}, "", window.location.pathname);
    }, []);

    const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: user?.name, phone: user?.phone, department: user?.department },
    });

    const { register: registerPass, handleSubmit: handlePassSubmit, reset: resetPass, formState: { errors: passErrors } } = useForm({
        resolver: zodResolver(passwordSchema),
    });

    const onProfileSubmit = async (data) => {
        setIsSaving(true);
        setMessage({ type: "", text: "" });
        try {
            let photoUploadResponse = null;
            if (selectedPhotoFile) {
                const formData = new FormData();
                formData.append("photo", selectedPhotoFile);
                photoUploadResponse = await api.post("/upload/profile-photo", formData, { headers: { "Content-Type": "multipart/form-data" } });
            }
            const res = await api.patch("/users/profile", data);
            refreshUser(photoUploadResponse?.data?.user || res.data);
            setMessage({ type: "success", text: "Profile updated successfully!" });
            setIsEditMode(false);
            setPhotoPreview(null);
            setSelectedPhotoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Failed to update profile." });
        } finally {
            setIsSaving(false);
        }
    };

    const onPasswordSubmit = async (data) => {
        setIsSaving(true);
        setMessage({ type: "", text: "" });
        try {
            await api.patch("/users/password", { currentPassword: data.currentPassword, newPassword: data.newPassword });
            setMessage({ type: "success", text: "Password changed successfully." });
            resetPass();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Failed to change password." });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setMessage({ type: "error", text: "Image must be under 5MB" }); return; }
        setSelectedPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handlePhotoDelete = async () => {
        if (!confirm("Remove your profile photo?")) return;
        setIsUploadingPhoto(true);
        try {
            await api.delete("/upload/profile-photo");
            refreshUser({ profilePhoto: null });
            toast.success("Profile photo removed");
        } catch { toast.error("Failed to remove photo"); }
        finally { setIsUploadingPhoto(false); }
    };

    const handleCancelEdit = () => {
        setIsEditMode(false); setPhotoPreview(null); setSelectedPhotoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMessage({ type: "", text: "" });
    };

    const handleExport = async () => {
        try {
            const response = await api.get("/leads/export", { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url; link.setAttribute("download", "leads.csv");
            document.body.appendChild(link); link.click(); link.remove();
        } catch { toast.error("Failed to export data."); }
    };

    const allTabs = [
        ...TABS,
        ...(user?.role === "SUPER_ADMIN" ? ADMIN_TABS : []),
        { id: "danger", icon: Trash2, label: "Danger Zone", danger: true },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
                <p className="text-sm text-gray-500">Manage your account and workspace preferences</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <nav className="md:w-52 flex-shrink-0">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 space-y-0.5">
                        {allTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setMessage({ type: "", text: "" }); }}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                                    activeTab === tab.id
                                        ? tab.danger ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-700"
                                        : tab.danger ? "text-red-500 hover:bg-red-50" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <tab.icon className="h-4 w-4 flex-shrink-0" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </nav>

                <div className="flex-1 min-w-0">
                    {message.text && (
                        <div className={cn(
                            "mb-4 flex items-center gap-2 p-3.5 rounded-xl text-sm font-medium",
                            message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                        )}>
                            {message.type === "success" ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <X className="h-4 w-4 flex-shrink-0" />}
                            {message.text}
                        </div>
                    )}

                    {activeTab === "profile" && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-gray-900">Profile Information</h2>
                                {!isEditMode && (
                                    <button onClick={() => setIsEditMode(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-600 text-xs font-semibold rounded-xl hover:bg-indigo-50 transition-colors">
                                        <User className="h-3.5 w-3.5" /> Edit Profile
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-5 pb-5 border-b border-gray-100">
                                <div className="relative">
                                    {photoPreview
                                        ? <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover ring-2 ring-indigo-200" />
                                        : <Avatar user={user} size="xl" />
                                    }
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                                    <p className="text-xs text-gray-400">{user?.email}</p>
                                    {isEditMode && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingPhoto}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-200 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                                                <Camera className="h-3 w-3" /> Change Photo
                                            </button>
                                            {user?.profilePhoto && (
                                                <button type="button" onClick={handlePhotoDelete} disabled={isUploadingPhoto}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 text-xs font-medium rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                                                    <X className="h-3 w-3" /> Remove
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                                <Field label="Display Name">
                                    <input {...registerProfile("name")} disabled={!isEditMode} className={inputCls(!isEditMode)} />
                                </Field>
                                <Field label="Email Address">
                                    <input value={user?.email} disabled className={inputCls(true)} />
                                </Field>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Phone">
                                        <input {...registerProfile("phone")} disabled={!isEditMode} className={inputCls(!isEditMode)} />
                                    </Field>
                                    <Field label="Department">
                                        <input {...registerProfile("department")} disabled={!isEditMode} className={inputCls(!isEditMode)} />
                                    </Field>
                                </div>
                                {isEditMode && (
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={handleCancelEdit} disabled={isSaving}
                                            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={isSaving}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            Save Changes
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>
                    )}

                    {activeTab === "security" && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-gray-900 mb-5">Change Password</h2>
                            <form onSubmit={handlePassSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                                {[
                                    { label: "Current Password", name: "currentPassword", show: showCurrentPass, setShow: setShowCurrentPass },
                                    { label: "New Password",     name: "newPassword",     show: showNewPass,     setShow: setShowNewPass },
                                    { label: "Confirm Password", name: "confirmPassword", show: showConfirmPass, setShow: setShowConfirmPass },
                                ].map(({ label, name, show, setShow }) => (
                                    <Field key={name} label={label} error={passErrors[name]?.message}>
                                        <div className="relative">
                                            <input type={show ? "text" : "password"} {...registerPass(name)} className={cn(inputCls(false), "pr-10")} />
                                            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </Field>
                                ))}
                                <div className="pt-2">
                                    <button type="submit" disabled={isSaving}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === "notifications" && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-gray-900 mb-5">Notification Preferences</h2>
                            <div className="space-y-3">
                                {[
                                    { label: "New Lead Alerts",  desc: "Get notified when a new lead arrives",     defaultChecked: true },
                                    { label: "Task Reminders",   desc: "Receive reminders for upcoming tasks",      defaultChecked: true },
                                    { label: "Follow-up Alerts", desc: "Alerts when leads need follow-up",          defaultChecked: false },
                                    { label: "Team Activity",    desc: "Activity from team members on your leads",  defaultChecked: false },
                                ].map(({ label, desc, defaultChecked }) => (
                                    <div key={label} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{label}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "data" && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-gray-900 mb-2">Data Export</h2>
                            <p className="text-sm text-gray-500 mb-5">Download your CRM data as CSV files.</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Leads Export</p>
                                        <p className="text-xs text-gray-400 mt-0.5">All leads with status, contact info, and scores</p>
                                    </div>
                                    <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                                        <Download className="h-3.5 w-3.5" /> Export CSV
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "lead-fields" && user?.role === "SUPER_ADMIN" && <LeadFieldsSettings />}
                    {activeTab === "lead-sla"    && user?.role === "SUPER_ADMIN" && <SlaSettings />}
                    {activeTab === "ai-assistant" && user?.role === "SUPER_ADMIN" && <AssistantSettings />}
                    {activeTab === "audit"       && user?.role === "SUPER_ADMIN" && <AuditLogs />}
                    {activeTab === "sessions"    && user?.role === "SUPER_ADMIN" && <SessionManager />}

                    {activeTab === "danger" && (
                        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-red-700 mb-1">Danger Zone</h2>
                            <p className="text-sm text-red-400 mb-5">These actions are irreversible. Proceed with caution.</p>
                            <div className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Delete Account</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Permanently delete your account and all associated data.</p>
                                </div>
                                <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors">
                                    <Trash2 className="h-4 w-4" /> Delete Account
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
