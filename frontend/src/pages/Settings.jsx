import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../api/axios";
import { Loader2, User, Bell, Lock, Download, Trash2, Save, Shield, Smartphone, Eye, EyeOff, Camera, X, CheckCircle, Mail, SlidersHorizontal, Facebook, Plus, RefreshCw, Link2Off } from "lucide-react";
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
    { id: "profile",       icon: User,       label: "Profile" },
    { id: "security",      icon: Lock,       label: "Security" },
    { id: "notifications", icon: Bell,       label: "Notifications" },
    { id: "data",          icon: Download,   label: "Data Export" },
];

const ADMIN_TABS = [
    { id: "email",         icon: Mail,               label: "Email (SMTP)" },
    { id: "custom-fields", icon: SlidersHorizontal,  label: "Custom Fields" },
    { id: "facebook",      icon: Facebook,            label: "Facebook Leads" },
    { id: "audit",         icon: Shield,              label: "Audit Logs" },
    { id: "sessions",      icon: Smartphone,          label: "Sessions" },
];

// ─── SMTP Settings Panel ─────────────────────────────────────────────────────

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
                <Field label='From Name (shown as sender)'>
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

// ─── Custom Fields Panel ──────────────────────────────────────────────────────

const FIELD_TYPES = ["TEXT", "NUMBER", "SELECT", "DATE", "CHECKBOX"];

function CustomFieldsSettings() {
    const qc = useQueryClient();
    const [form, setForm] = useState({ name: "", fieldKey: "", type: "TEXT", options: "", required: false, order: 0 });
    const [showAdd, setShowAdd] = useState(false);

    const { data: fields = [], isLoading } = useQuery({
        queryKey: ["custom-fields"],
        queryFn: () => api.get("/custom-fields").then(r => r.data),
    });

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
            order: parseInt(form.order) || 0,
        }),
        onSuccess: () => {
            toast.success("Custom field created");
            qc.invalidateQueries({ queryKey: ["custom-fields"] });
            setForm({ name: "", fieldKey: "", type: "TEXT", options: "", required: false, order: 0 });
            setShowAdd(false);
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to create field"),
    });

    const del = useMutation({
        mutationFn: (id) => api.delete(`/custom-fields/${id}`),
        onSuccess: () => {
            toast.success("Field deleted");
            qc.invalidateQueries({ queryKey: ["custom-fields"] });
        },
        onError: () => toast.error("Failed to delete field"),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-indigo-500" /> Custom Fields
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">Add extra data fields that appear on every lead.</p>
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
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">New Field</p>
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
                                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Order">
                            <input
                                type="number"
                                className={inputCls(false)}
                                value={form.order}
                                onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
                            />
                        </Field>
                        {form.type === "SELECT" && (
                            <div className="col-span-2">
                                <Field label="Options (comma-separated)">
                                    <input
                                        className={inputCls(false)}
                                        placeholder="Option A, Option B, Option C"
                                        value={form.options}
                                        onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                                    />
                                </Field>
                            </div>
                        )}
                        <div className="col-span-2 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="cf-required"
                                checked={form.required}
                                onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
                                className="rounded"
                            />
                            <label htmlFor="cf-required" className="text-sm text-gray-700">Required field</label>
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

            {fields.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No custom fields yet. Click "Add Field" to create one.</p>
            ) : (
                <div className="space-y-2">
                    {fields.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold">
                                    {f.type.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                                    <p className="text-xs text-gray-400">{f.fieldKey} · {f.type}{f.required ? " · Required" : ""}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm(`Delete field "${f.name}"? This removes it from all leads.`)) {
                                        del.mutate(f.id);
                                    }
                                }}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Facebook Lead Ads Panel ──────────────────────────────────────────────────

function FacebookSettings() {
    const qc = useQueryClient();
    const [tokenInput, setTokenInput] = useState("");
    const [pageIdInput, setPageIdInput] = useState("");
    const [selectedForm, setSelectedForm] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);

    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ["fb-status"],
        queryFn: () => api.get("/facebook/status").then(r => r.data),
    });

    const { data: forms = [], isLoading: formsLoading, refetch: refetchForms } = useQuery({
        queryKey: ["fb-forms"],
        queryFn: () => api.get("/facebook/forms").then(r => r.data),
        enabled: status?.connected === true,
        retry: false,
    });

    const connect = useMutation({
        mutationFn: () => api.post("/facebook/connect", { accessToken: tokenInput, pageId: pageIdInput }),
        onSuccess: () => {
            toast.success("Facebook connected successfully");
            qc.invalidateQueries({ queryKey: ["fb-status"] });
            qc.invalidateQueries({ queryKey: ["fb-forms"] });
            setTokenInput(""); setPageIdInput("");
        },
        onError: (e) => toast.error(e.response?.data?.message || "Connection failed"),
    });

    const disconnectMut = useMutation({
        mutationFn: () => api.post("/facebook/disconnect"),
        onSuccess: () => {
            toast.success("Disconnected");
            qc.invalidateQueries({ queryKey: ["fb-status"] });
            qc.invalidateQueries({ queryKey: ["fb-forms"] });
            setSyncResult(null);
        },
        onError: () => toast.error("Failed to disconnect"),
    });

    const handleSync = async () => {
        if (!selectedForm) return toast.error("Select a form first");
        setSyncing(true); setSyncResult(null);
        try {
            const { data } = await api.post("/facebook/sync", { formId: selectedForm });
            setSyncResult(data);
            qc.invalidateQueries({ queryKey: ["leads"] });
            toast.success(`Imported ${data.imported} leads`);
        } catch (e) {
            toast.error(e.response?.data?.message || "Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    if (statusLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-600" /> Facebook Lead Ads
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">Import leads from your Meta Lead Gen forms directly into the CRM.</p>
            </div>

            {!status?.connected ? (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1">
                        <p className="font-semibold">Setup instructions:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>Go to Meta Business Suite → Integrations → CRM (or use a Page Access Token)</li>
                            <li>Generate a <strong>Page Access Token</strong> with <code>leads_retrieval</code> permission</li>
                            <li>Copy your Facebook <strong>Page ID</strong> (found in Page settings)</li>
                            <li>Paste both below and click Connect</li>
                        </ol>
                    </div>
                    <Field label="Page Access Token">
                        <input
                            className={inputCls(false)}
                            type="password"
                            placeholder="EAAxxxxxxxxxxxxxxxxx..."
                            value={tokenInput}
                            onChange={e => setTokenInput(e.target.value)}
                        />
                    </Field>
                    <Field label="Facebook Page ID">
                        <input
                            className={inputCls(false)}
                            placeholder="123456789012345"
                            value={pageIdInput}
                            onChange={e => setPageIdInput(e.target.value)}
                        />
                    </Field>
                    <button
                        onClick={() => connect.mutate()}
                        disabled={connect.isPending || !tokenInput || !pageIdInput}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                        {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                        Connect Facebook
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div>
                            <p className="text-sm font-semibold text-emerald-800">Connected · Page ID: {status.pageId}</p>
                            {status.lastSynced && (
                                <p className="text-xs text-emerald-600 mt-0.5">
                                    Last synced {new Date(status.lastSynced).toLocaleString("en-IN")}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => disconnectMut.mutate()}
                            disabled={disconnectMut.isPending}
                            className="text-xs text-red-500 hover:underline font-semibold"
                        >
                            Disconnect
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Lead Gen Forms</p>
                            <button onClick={() => refetchForms()} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" /> Refresh
                            </button>
                        </div>

                        {formsLoading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading forms…
                            </div>
                        ) : forms.length === 0 ? (
                            <p className="text-sm text-gray-400">No lead gen forms found on this page.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {forms.map(f => (
                                    <label key={f.id} className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors",
                                        selectedForm === f.id ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-300"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="fb-form" value={f.id} checked={selectedForm === f.id}
                                                onChange={() => setSelectedForm(f.id)} className="accent-blue-600" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                                                <p className="text-xs text-gray-400">{f.leads_count ?? "?"} leads · {f.id}</p>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={handleSync}
                            disabled={syncing || !selectedForm}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                        >
                            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Sync Leads Now
                        </button>

                        {syncResult && (
                            <div className="grid grid-cols-3 gap-3 mt-2">
                                {[
                                    { label: "Imported",   value: syncResult.imported,   color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                                    { label: "Duplicates", value: syncResult.duplicates,  color: "bg-amber-50 text-amber-700 border-amber-100" },
                                    { label: "Failed",     value: syncResult.failed,      color: "bg-red-50 text-red-700 border-red-100" },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                                        <p className="text-2xl font-black">{value}</p>
                                        <p className="text-xs font-semibold">{label}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const Settings = () => {
    const { user, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState("profile");
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
        ...(["ADMIN", "SUPER_ADMIN"].includes(user?.role) ? ADMIN_TABS : []),
        { id: "danger", icon: Trash2, label: "Danger Zone", danger: true },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
                <p className="text-sm text-gray-500">Manage your account preferences</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar */}
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

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Feedback banner */}
                    {message.text && (
                        <div className={cn(
                            "mb-4 flex items-center gap-2 p-3.5 rounded-xl text-sm font-medium",
                            message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                        )}>
                            {message.type === "success" ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <X className="h-4 w-4 flex-shrink-0" />}
                            {message.text}
                        </div>
                    )}

                    {/* Profile */}
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

                            {/* Avatar */}
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

                            {/* Form */}
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

                    {/* Security */}
                    {activeTab === "security" && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-gray-900 mb-5">Change Password</h2>
                            <form onSubmit={handlePassSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                                {[
                                    { label: "Current Password", name: "currentPassword", show: showCurrentPass, setShow: setShowCurrentPass, reg: registerPass },
                                    { label: "New Password",     name: "newPassword",     show: showNewPass,     setShow: setShowNewPass,     reg: registerPass },
                                    { label: "Confirm Password", name: "confirmPassword", show: showConfirmPass, setShow: setShowConfirmPass, reg: registerPass },
                                ].map(({ label, name, show, setShow, reg }) => (
                                    <Field key={name} label={label} error={passErrors[name]?.message}>
                                        <div className="relative">
                                            <input type={show ? "text" : "password"} {...reg(name)} className={cn(inputCls(false), "pr-10")} />
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

                    {/* Notifications */}
                    {activeTab === "notifications" && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-gray-900 mb-5">Notification Preferences</h2>
                            <div className="space-y-3">
                                {[
                                    { label: "New Lead Alerts",  desc: "Get notified when a new lead arrives",      defaultChecked: true },
                                    { label: "Task Reminders",   desc: "Receive reminders for upcoming tasks",       defaultChecked: true },
                                    { label: "Follow-up Alerts", desc: "Alerts when leads need follow-up",           defaultChecked: false },
                                    { label: "Team Activity",    desc: "Activity from team members on your leads",   defaultChecked: false },
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

                    {/* Data Export */}
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

                    {/* Admin tabs */}
                    {activeTab === "email"         && ["ADMIN","SUPER_ADMIN"].includes(user?.role) && <SmtpSettings />}
                    {activeTab === "custom-fields" && ["ADMIN","SUPER_ADMIN"].includes(user?.role) && <CustomFieldsSettings />}
                    {activeTab === "facebook"      && ["ADMIN","SUPER_ADMIN"].includes(user?.role) && <FacebookSettings />}
                    {activeTab === "audit"         && ["ADMIN","SUPER_ADMIN"].includes(user?.role) && <AuditLogs />}
                    {activeTab === "sessions"      && ["ADMIN","SUPER_ADMIN"].includes(user?.role) && <SessionManager />}

                    {/* Danger Zone */}
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
