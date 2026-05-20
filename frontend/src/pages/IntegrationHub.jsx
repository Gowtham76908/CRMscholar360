import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../api/axios";
import Sheet from "../components/ui/Sheet";
import {
    Zap, XCircle, AlertCircle, RefreshCw, Settings2,
    ClipboardList, Plug, Loader2, ArrowUpRight, Eye, EyeOff, Copy, CheckCheck,
} from "lucide-react";

// ── SVG icons ─────────────────────────────────────────────────────────────────

const MetaIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#1877F2" />
        <path d="M7 10.5c0-1.38.84-2.5 2-2.5.62 0 1.1.26 1.5.74L12 10.5l1.5-1.76c.4-.48.88-.74 1.5-.74 1.16 0 2 1.12 2 2.5 0 .9-.36 1.7-.94 2.28L12 16.5l-4.06-3.72C7.36 12.2 7 11.4 7 10.5z" fill="white" />
    </svg>
);

const WAIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.49 3.53 1.34 5.02L2 22l5.12-1.32A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#25D366" />
        <path d="M9 8c-.3 0-.8.1-1.1.5-.3.4-1.1 1.1-1.1 2.7s1.1 3.1 1.3 3.3c.2.2 2.1 3.3 5.2 4.5.7.3 1.3.4 1.7.3.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.7-.4-.4-.2-2.1-1-2.4-1.1-.3-.1-.5-.2-.8.2-.2.4-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.8-2.3-2-2.7-.2-.4 0-.6.1-.7l.5-.6c.1-.2.2-.4.3-.6.1-.2 0-.4-.1-.5C10 10.5 9.3 8.7 9 8z" fill="white" />
    </svg>
);

const GoogleIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M22 12.24c0-.74-.07-1.45-.19-2.14H12v4.05h5.61a4.8 4.8 0 01-2.08 3.14v2.62h3.36C20.88 17.95 22 15.3 22 12.24z" fill="#4285F4" />
        <path d="M12 22c2.82 0 5.18-.93 6.91-2.53l-3.36-2.62c-.93.62-2.13.99-3.55.99-2.73 0-5.04-1.84-5.87-4.32H2.65v2.7C4.37 19.72 7.96 22 12 22z" fill="#34A853" />
        <path d="M6.13 13.52A6.05 6.05 0 015.9 12c0-.53.09-1.05.23-1.52V7.78H2.65A10.01 10.01 0 002 12c0 1.61.39 3.13 1.07 4.47l3.06-2.95z" fill="#FBBC05" />
        <path d="M12 5.16c1.54 0 2.92.53 4.01 1.57l3-3C17.17 2.12 14.81 1 12 1 7.96 1 4.37 3.28 2.65 6.78l3.48 2.7C6.96 7 9.27 5.16 12 5.16z" fill="#EA4335" />
    </svg>
);

const EmailIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#7C3AED" />
        <path d="M4 8l8 5 8-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="4" y="7" width="16" height="11" rx="2" stroke="white" strokeWidth="1.5" />
    </svg>
);

const LinkedInIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <path d="M7.5 10h-2v7h2v-7zm-1-3a1.1 1.1 0 110 2.2A1.1 1.1 0 016.5 7zM17 10c-1.2 0-2 .6-2.4 1.2V10h-2v7h2v-3.5c0-1.1.4-1.8 1.3-1.8.9 0 1.1.7 1.1 1.7V17h2v-4c0-1.8-.9-3-2-3z" fill="white" />
    </svg>
);

const SalestrailIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#0F172A" />
        <path d="M7 17l4-5 3 3 4-6" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="17" r="1.2" fill="#F97316" />
    </svg>
);

const WebhookIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#0EA5E9" />
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 10l-4 4-2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="18" cy="12" r="2.5" stroke="white" strokeWidth="1.5" />
    </svg>
);

// Coming-soon icons
const HubSpotIcon = ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF7A59" /><circle cx="14" cy="9" r="2.5" fill="white" /><path d="M11 9h-2.5M14 6.5V4M16.5 10l1.5 1.5M11 12l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const SlackIcon = ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#4A154B" /><path d="M9 8a1.5 1.5 0 01-3 0V6a1.5 1.5 0 013 0v2zm0 0h6M15 8a1.5 1.5 0 003 0V6a1.5 1.5 0 00-3 0v2zm0 0v6M15 14a1.5 1.5 0 013 0v2a1.5 1.5 0 01-3 0v-2zm0 0H9M9 14a1.5 1.5 0 01-3 0v-2a1.5 1.5 0 013 0v2zm0 0v-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const ZapierIcon = ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FF4A00" /><path d="M12 4l-1.5 6H5l5 3.5-1.5 6.5L12 16l3.5 4L14 13.5 19 10h-5.5L12 4z" fill="white" /></svg>
);
const AnalyticsIcon = ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#E37400" /><path d="M5 17l4-5 4 3 5-7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ── Provider config ───────────────────────────────────────────────────────────

const PROVIDERS = [
    {
        key: "meta_leads",
        name: "Meta Lead Ads",
        desc: "Capture leads from Facebook & Instagram lead forms using your Meta access token.",
        Icon: MetaIcon,
        grad: "from-blue-500 to-blue-700",
        bg: "bg-blue-50", border: "border-blue-100", chip: "text-blue-700 bg-blue-50",
        oauth: false,
        tags: ["Facebook", "Instagram", "Lead Forms", "Real-time sync"],
        configFields: [
            { key: "accessToken", label: "Meta Access Token", placeholder: "EAAxxxxxxxx…  (Page or User access token)", type: "password" },
            { key: "pageId",      label: "Page ID",           placeholder: "Your Facebook Page numeric ID",              type: "text" },
        ],
    },
    {
        key: "whatsapp_wati",
        name: "WhatsApp (WATI)",
        desc: "Connect your WATI account for WhatsApp messaging and template campaigns.",
        Icon: WAIcon,
        grad: "from-emerald-500 to-green-600",
        bg: "bg-emerald-50", border: "border-emerald-100", chip: "text-emerald-700 bg-emerald-50",
        oauth: false,
        tags: ["WATI API", "Templates", "Campaigns", "Auto-reply"],
        configFields: [
            { key: "endpoint", label: "WATI Endpoint URL", placeholder: "https://live-server-XXXXX.wati.io", type: "text" },
            { key: "token",    label: "API Token",          placeholder: "Bearer token from WATI dashboard", type: "password" },
        ],
    },
    {
        key: "whatsapp_cloud",
        name: "WhatsApp Cloud API",
        desc: "Connect Meta's WhatsApp Business Cloud API directly — no third-party provider.",
        Icon: WAIcon,
        grad: "from-teal-500 to-emerald-600",
        bg: "bg-teal-50", border: "border-teal-100", chip: "text-teal-700 bg-teal-50",
        oauth: false,
        tags: ["Meta Cloud API", "No WATI", "Templates", "Webhooks"],
        configFields: [
            { key: "accessToken",   label: "Permanent Access Token", placeholder: "EAAxxxxxxxx…  (from Meta Developer Console)", type: "password" },
            { key: "phoneNumberId", label: "Phone Number ID",        placeholder: "Numeric phone number ID",                      type: "text" },
            { key: "wabaId",        label: "WhatsApp Business Account ID", placeholder: "Numeric WABA ID",                       type: "text" },
        ],
    },
    {
        key: "google_ads",
        name: "Google Ads",
        desc: "Connect Google Ads to track campaigns and import leads.",
        Icon: GoogleIcon,
        grad: "from-orange-400 to-red-500",
        bg: "bg-orange-50", border: "border-orange-100", chip: "text-orange-700 bg-orange-50",
        oauth: false,
        tags: ["Ad Accounts", "Campaigns", "Offline Conversions", "Lead Import"],
        configFields: [
            { key: "developerToken", label: "Developer Token",    placeholder: "From Google Ads API Center",         type: "password" },
            { key: "customerId",     label: "Customer ID",        placeholder: "123-456-7890 (no dashes required)",  type: "text" },
            { key: "refreshToken",   label: "Refresh Token",      placeholder: "OAuth refresh token",                type: "password" },
        ],
    },
    {
        key: "email_smtp",
        name: "Email / SMTP",
        desc: "Configure SMTP to send transactional emails, follow-ups, and campaigns.",
        Icon: EmailIcon,
        grad: "from-violet-500 to-purple-600",
        bg: "bg-violet-50", border: "border-violet-100", chip: "text-violet-700 bg-violet-50",
        oauth: false,
        tags: ["Custom SMTP", "TLS/SSL", "Tracking Pixel", "Campaigns"],
        configFields: [
            { key: "host",     label: "SMTP Host",     placeholder: "smtp.gmail.com",      type: "text" },
            { key: "port",     label: "Port",          placeholder: "587",                  type: "text",     width: "w-24" },
            { key: "user",     label: "Username",      placeholder: "you@company.com",      type: "text" },
            { key: "pass",     label: "Password",      placeholder: "App password",          type: "password" },
            { key: "fromName", label: "From Name",     placeholder: "D-CRM Notifications",  type: "text" },
        ],
        extras: ["secure"],
    },
    {
        key: "linkedin_serper",
        name: "LinkedIn Lead Search",
        desc: "Search and import LinkedIn leads using the Serper API.",
        Icon: LinkedInIcon,
        grad: "from-sky-600 to-blue-700",
        bg: "bg-sky-50", border: "border-sky-100", chip: "text-sky-700 bg-sky-50",
        oauth: false,
        tags: ["Serper API", "LinkedIn Search", "Lead Import", "Bio Extraction"],
        configFields: [
            { key: "apiKey", label: "Serper API Key", placeholder: "Your Serper API key", type: "password" },
        ],
    },
    {
        key: "salestrail",
        name: "Salestrail Calls",
        desc: "Receive call logs from Salestrail via webhook with Basic Auth.",
        Icon: SalestrailIcon,
        grad: "from-zinc-700 to-zinc-900",
        bg: "bg-zinc-100", border: "border-zinc-200", chip: "text-zinc-700 bg-zinc-100",
        oauth: false,
        tags: ["Call Logs", "Webhook", "Auto Lead Match", "Recording URL"],
        configFields: [
            { key: "user", label: "Webhook Username", placeholder: "From Salestrail settings", type: "text" },
            { key: "pass", label: "Webhook Password", placeholder: "From Salestrail settings", type: "password" },
        ],
        webhookPath: "/api/salestrail/webhook",
    },
    {
        key: "website_webhook",
        name: "Website Contact Form",
        desc: "Post contact form submissions to the DCRM webhook and auto-create leads.",
        Icon: WebhookIcon,
        grad: "from-sky-400 to-cyan-500",
        bg: "bg-sky-50", border: "border-sky-100", chip: "text-sky-700 bg-sky-50",
        oauth: false,
        tags: ["POST endpoint", "Auto Lead", "No Auth required", "JSON body"],
        webhookPath: "/api/webhooks/leads",
        alwaysConnected: true,
    },
];

const COMING_SOON = [
    { name: "HubSpot",          Icon: HubSpotIcon,  grad: "from-orange-400 to-amber-500" },
    { name: "Slack",             Icon: SlackIcon,    grad: "from-purple-500 to-fuchsia-600" },
    { name: "Zapier",            Icon: ZapierIcon,   grad: "from-red-500 to-orange-500" },
    { name: "Google Analytics",  Icon: AnalyticsIcon,grad: "from-yellow-500 to-orange-500" },
];

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    if (status === "CONNECTED") return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Connected
        </span>
    );
    if (status === "ERROR") return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <AlertCircle size={10} />Error
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />Disconnected
        </span>
    );
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-orange-600 transition-colors"
        >
            {copied ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

// ── OAuth popup ───────────────────────────────────────────────────────────────

function useOAuthPopup(onSuccess) {
    const [pending, setPending] = useState(false);

    const open = (authUrl) => {
        setPending(true);
        const popup = window.open(authUrl, "dcrm_oauth", "width=600,height=700,scrollbars=yes");
        if (!popup) { toast.error("Popup blocked — allow popups for this site"); setPending(false); return; }

        const handler = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type !== "DCRM_OAUTH") return;
                window.removeEventListener("message", handler);
                setPending(false);
                if (msg.ok) onSuccess(msg.payload);
                else toast.error(msg.payload?.message || "OAuth failed");
            } catch (_) {}
        };
        window.addEventListener("message", handler);

        const timer = setInterval(() => {
            if (popup.closed) { clearInterval(timer); window.removeEventListener("message", handler); setPending(false); }
        }, 500);
    };

    return { pending, open };
}

// ── Configure Sheet (generic for API-key providers) ───────────────────────────

function ConfigSheet({ open, onClose, provider, integration, onSaved, backendUrl }) {
    const [form, setForm] = useState({});
    const [show, setShow] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            const initial = {};
            (provider?.configFields || []).forEach(f => { initial[f.key] = ""; });
            setForm(initial);
            setShow({});
        }
    }, [open, provider]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = { config: { ...form } };
            if (provider.extras?.includes("secure")) payload.config.secure = form.secure || false;
            const res = await api.put(`/integration-hub/${provider.key}/configure`, payload);
            if (res.data.ok === false) { toast.error(res.data.message || "Failed"); }
            else { toast.success(res.data.message || "Saved & connected"); onSaved?.(); onClose(); }
        } catch (err) {
            toast.error(err.response?.data?.message || "Save failed");
        } finally { setSaving(false); }
    };

    const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition placeholder-zinc-400";
    const labelCls = "block text-xs font-semibold text-zinc-600 mb-1";
    const webhookUrl = backendUrl + (provider?.webhookPath || "");

    return (
        <Sheet open={open} onClose={onClose} title={`Configure ${provider?.name}`} size="md">
            <Sheet.Body>
                <div className="space-y-4">
                    {provider?.webhookPath && (
                        <div>
                            <p className={labelCls}>Webhook URL</p>
                            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                                <code className="flex-1 text-xs text-zinc-700 break-all">{webhookUrl}</code>
                                <CopyButton text={webhookUrl} />
                            </div>
                            {provider?.alwaysConnected && (
                                <p className="text-xs text-zinc-400 mt-1.5">POST JSON to this URL. No authentication required. Leads are created automatically.</p>
                            )}
                        </div>
                    )}

                    {(provider?.configFields || []).map((f, i) => {
                        const isPass = f.type === "password";
                        const isVisible = show[f.key];
                        return (
                            <div key={f.key} className={f.width || ""}>
                                <label className={labelCls}>{f.label}</label>
                                <div className="relative">
                                    <input
                                        type={isPass && !isVisible ? "password" : "text"}
                                        placeholder={f.placeholder}
                                        value={form[f.key] || ""}
                                        onChange={e => set(f.key, e.target.value)}
                                        className={inputCls + (isPass ? " pr-10" : "")}
                                    />
                                    {isPass && (
                                        <button type="button" onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {provider?.extras?.includes("secure") && (
                        <div className="flex items-center gap-3 p-3.5 bg-zinc-50 rounded-lg border border-zinc-200">
                            <button type="button" onClick={() => set("secure", !form.secure)}
                                className={`relative w-10 h-6 rounded-full transition-colors ${form.secure ? "bg-orange-500" : "bg-zinc-300"}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.secure ? "translate-x-4" : ""}`} />
                            </button>
                            <div>
                                <p className="text-sm font-medium text-zinc-700">Use TLS/SSL</p>
                                <p className="text-xs text-zinc-500">Enable for port 465 (SSL) or 587 (STARTTLS)</p>
                            </div>
                        </div>
                    )}
                </div>
            </Sheet.Body>
            <Sheet.Footer>
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 transition-colors">Cancel</button>
                {!provider?.alwaysConnected && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-all"
                        style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}
                    >
                        {saving ? <><Loader2 size={14} className="animate-spin" />Testing…</> : "Save & Connect"}
                    </button>
                )}
            </Sheet.Footer>
        </Sheet>
    );
}

// ── Logs Sheet ────────────────────────────────────────────────────────────────

function LogsSheet({ open, onClose, platform, name }) {
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ["integration-logs", platform],
        queryFn: () => api.get(`/integration-hub/${platform}/logs?limit=50`).then(r => r.data),
        enabled: open && !!platform,
        refetchInterval: open ? 10000 : false,
    });

    const dot = (s) => s === "SUCCESS" ? "bg-emerald-500" : s === "ERROR" ? "bg-red-500" : "bg-zinc-400";
    const txt = (s) => s === "SUCCESS" ? "text-emerald-700" : s === "ERROR" ? "text-red-600" : "text-zinc-500";

    return (
        <Sheet open={open} onClose={onClose} title={`${name || ""} — Logs`} description="Recent integration events" size="lg">
            <Sheet.Body className="p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-zinc-300" /></div>
                ) : !logs.length ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-300">
                        <ClipboardList size={32} />
                        <p className="text-sm">No events yet</p>
                    </div>
                ) : logs.map(log => (
                    <div key={log.id} className="px-6 py-3.5 border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                        <div className="flex items-start gap-3">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot(log.status)}`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${txt(log.status)}`}>{log.type.replace(/_/g, " ")}</p>
                                <p className="text-sm text-zinc-700">{log.message}</p>
                            </div>
                            <time className="text-[11px] text-zinc-400 shrink-0">{new Date(log.createdAt).toLocaleString()}</time>
                        </div>
                    </div>
                ))}
            </Sheet.Body>
        </Sheet>
    );
}

// ── Integration Card ──────────────────────────────────────────────────────────

function Card({ p, integration, onConnect, onSync, onDisconnect, onConfigure, onLogs }) {
    const [busy, setBusy] = useState(null);
    const { Icon } = p;
    const status = p.alwaysConnected ? "CONNECTED" : (integration?.status || "DISCONNECTED");
    const connected = status === "CONNECTED";
    const errored = status === "ERROR";

    const act = async (label, fn) => {
        setBusy(label);
        try { await fn(); } finally { setBusy(null); }
    };

    return (
        <div className={`relative bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${errored ? "border-red-200" : "border-zinc-200"} shadow-sm`}>
            <div className={`h-0.5 bg-gradient-to-r ${p.grad}`} />
            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3.5">
                    <div className={`w-11 h-11 rounded-xl ${p.bg} ${p.border} border flex items-center justify-center`}>
                        <Icon s={24} />
                    </div>
                    <StatusBadge status={status} />
                </div>

                <h3 className="text-sm font-bold text-zinc-900 mb-1">{p.name}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">{p.desc}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3.5">
                    {p.tags.map(t => (
                        <span key={t} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.chip}`}>{t}</span>
                    ))}
                </div>

                {/* Last sync */}
                {integration?.lastSynced && (
                    <p className="text-[11px] text-zinc-400 mb-3">
                        Last sync: {new Date(integration.lastSynced).toLocaleString()}
                    </p>
                )}

                {/* Error */}
                {errored && integration?.errorMessage && (
                    <div className="flex gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                        <AlertCircle size={11} className="text-red-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-red-600 leading-snug">{integration.errorMessage}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                    {!connected && !errored ? (
                        <button onClick={onConnect}
                            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-white"
                            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
                            <Plug size={11} />Connect
                        </button>
                    ) : (
                        <>
                            {errored && (
                                <button onClick={onConnect}
                                    className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors">
                                    <RefreshCw size={11} />Reconnect
                                </button>
                            )}
                            {connected && !p.alwaysConnected && (
                                <button onClick={() => act("sync", onSync)} disabled={busy === "sync"}
                                    className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors disabled:opacity-60">
                                    <RefreshCw size={11} className={busy === "sync" ? "animate-spin" : ""} />Sync
                                </button>
                            )}
                            <button onClick={onConfigure}
                                className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors">
                                <Settings2 size={11} />Configure
                            </button>
                            <button onClick={onLogs}
                                className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors">
                                <ClipboardList size={11} />Logs
                            </button>
                            {!p.alwaysConnected && (
                                <button onClick={() => act("disc", onDisconnect)} disabled={busy === "disc"}
                                    className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60">
                                    <XCircle size={11} />{busy === "disc" ? "…" : "Disconnect"}
                                </button>
                            )}
                        </>
                    )}
                    {(!connected && !errored) && p.webhookPath && (
                        <button onClick={onConfigure}
                            className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors">
                            <Settings2 size={11} />Setup
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntegrationHub() {
    const queryClient = useQueryClient();
    const [configSheet, setConfigSheet] = useState(null); // provider key
    const [logsSheet, setLogsSheet] = useState(null);     // { key, name }

    const backendUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace("/api", "")
        : `${window.location.protocol}//${window.location.hostname}:5001`;

    const { data: integrations = [], isLoading } = useQuery({
        queryKey: ["integration-hub"],
        queryFn: () => api.get("/integration-hub").then(r => r.data),
        staleTime: 30000,
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["integration-hub"] });

    const byKey = Object.fromEntries(integrations.map(i => [i.platform, i]));

    const { pending: oauthPending, open: openOAuth } = useOAuthPopup(() => {
        toast.success("Connected successfully");
        refresh();
    });

    const handleConnect = async (p) => {
        if (!p.oauth) { setConfigSheet(p.key); return; }
        try {
            const res = await api.get(`/integration-hub/${p.key}/oauth/start`);
            openOAuth(res.data.authUrl);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to start OAuth");
        }
    };

    const handleSync = async (key) => {
        try {
            const res = await api.post(`/integration-hub/${key}/sync`);
            toast.success(`Synced ${res.data.synced ?? 0} records`);
            refresh();
        } catch (err) { toast.error(err.response?.data?.message || "Sync failed"); }
    };

    const handleDisconnect = async (key) => {
        try {
            await api.delete(`/integration-hub/${key}/disconnect`);
            toast.success("Disconnected");
            refresh();
        } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
    };

    const connectedCount = integrations.filter(i => i.status === "CONNECTED").length
        + PROVIDERS.filter(p => p.alwaysConnected).length;

    const activeProvider = PROVIDERS.find(p => p.key === configSheet);

    return (
        <div className="min-h-full bg-gradient-to-br from-orange-50/30 via-white to-white">
            {/* Header */}
            <div className="px-6 pt-7 pb-5 border-b border-zinc-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
                            <Zap size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-zinc-900 leading-none">Integration Hub</h1>
                            <p className="text-xs text-zinc-400 mt-0.5">All your connections in one place</p>
                        </div>
                    </div>

                    {/* Progress ring */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                            <p className="text-xl font-extrabold text-zinc-900 leading-none">{connectedCount}<span className="text-base font-medium text-zinc-400">/{PROVIDERS.length}</span></p>
                            <p className="text-[10px] text-zinc-400 font-medium">connected</p>
                        </div>
                        <svg className="w-11 h-11 -rotate-90 shrink-0" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#f4f4f5" strokeWidth="3.5" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#f97316" strokeWidth="3.5"
                                strokeDasharray={`${(connectedCount / PROVIDERS.length) * 87.96} 87.96`}
                                strokeLinecap="round"
                                style={{ transition: "stroke-dasharray 0.6s ease" }} />
                        </svg>
                    </div>
                </div>

                {/* Status pills */}
                <div className="max-w-6xl mx-auto mt-4 flex flex-wrap gap-2">
                    {PROVIDERS.map(p => {
                        const s = p.alwaysConnected ? "CONNECTED" : (byKey[p.key]?.status || "DISCONNECTED");
                        return (
                            <button key={p.key}
                                onClick={() => document.getElementById(`card-${p.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors
                                    ${s === "CONNECTED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                      s === "ERROR" ? "bg-red-50 text-red-600 border-red-200" :
                                      "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s === "CONNECTED" ? "bg-emerald-500" : s === "ERROR" ? "bg-red-500" : "bg-zinc-300"}`} />
                                {p.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Cards grid */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => <div key={i} className="h-64 bg-zinc-100 rounded-2xl animate-pulse" />)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                            {PROVIDERS.map(p => (
                                <div key={p.key} id={`card-${p.key}`}>
                                    <Card
                                        p={p}
                                        integration={byKey[p.key]}
                                        onConnect={() => handleConnect(p)}
                                        onSync={() => handleSync(p.key)}
                                        onDisconnect={() => handleDisconnect(p.key)}
                                        onConfigure={() => setConfigSheet(p.key)}
                                        onLogs={() => setLogsSheet({ key: p.key, name: p.name })}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Coming soon */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-zinc-200" />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Coming Soon</span>
                                <div className="h-px flex-1 bg-zinc-200" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {COMING_SOON.map(c => (
                                    <div key={c.name} className="bg-white/50 rounded-2xl border border-dashed border-zinc-200 overflow-hidden opacity-50">
                                        <div className={`h-0.5 bg-gradient-to-r ${c.grad}`} />
                                        <div className="p-4 flex items-center gap-3">
                                            <c.Icon s={22} />
                                            <div>
                                                <p className="text-sm font-bold text-zinc-700">{c.name}</p>
                                                <span className="text-[10px] text-zinc-400 font-medium">Coming soon</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Env hint */}
                        <div className="mt-8 p-4 bg-orange-50/60 border border-orange-100 rounded-xl flex gap-3">
                            <ArrowUpRight size={15} className="text-orange-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-orange-700">
                                OAuth providers require <code className="bg-orange-100 px-1 rounded">META_APP_ID</code>, <code className="bg-orange-100 px-1 rounded">META_APP_SECRET</code>,{" "}
                                <code className="bg-orange-100 px-1 rounded">GOOGLE_CLIENT_ID</code>, <code className="bg-orange-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>, and{" "}
                                <code className="bg-orange-100 px-1 rounded">ENCRYPTION_KEY</code> in your backend <code className="bg-orange-100 px-1 rounded">.env</code>.
                                API-key integrations (WATI, LinkedIn, Salestrail, Email) work immediately.
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Sheets */}
            <ConfigSheet
                open={!!configSheet}
                onClose={() => setConfigSheet(null)}
                provider={activeProvider}
                integration={byKey[configSheet]}
                onSaved={refresh}
                backendUrl={backendUrl}
            />
            <LogsSheet
                open={!!logsSheet}
                onClose={() => setLogsSheet(null)}
                platform={logsSheet?.key}
                name={logsSheet?.name}
            />

            {/* OAuth overlay */}
            {oauthPending && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
                    <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
                        <Loader2 size={28} className="animate-spin text-orange-500" />
                        <p className="text-sm font-semibold text-zinc-700">Waiting for OAuth…</p>
                        <p className="text-xs text-zinc-400">Complete authorization in the popup window</p>
                    </div>
                </div>
            )}
        </div>
    );
}
