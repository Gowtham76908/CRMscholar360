import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../api/axios";
import Sheet from "../components/ui/Sheet";
import {
    Zap, XCircle, AlertCircle, RefreshCw, Settings2,
    ClipboardList, Plug, Loader2, ArrowUpRight, Eye, EyeOff, Copy, CheckCheck,
    CheckCircle2, Wifi, WifiOff, Activity, Clock, ShieldAlert, TrendingUp,
    ChevronLeft, ChevronRight, Search, Filter, KeyRound, Code2, HelpCircle,
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
const FasterqIcon = ({ s = 26 }) => (
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

const GCalIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="1" />
        <rect x="3" y="6" width="18" height="15" rx="2" fill="white" stroke="#4285F4" strokeWidth="1.5" />
        <rect x="3" y="6" width="18" height="5" rx="2" fill="#4285F4" />
        <path d="M8 3v4M16 3v4" stroke="#4285F4" strokeWidth="1.8" strokeLinecap="round" />
        <text x="12" y="18" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#4285F4">31</text>
    </svg>
);

const LiveKitIcon = ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#111827" />
        <circle cx="12" cy="12" r="3" fill="#4ADE80" />
        <path d="M12 5a7 7 0 010 14" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M12 8a4 4 0 010 8" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d="M19 12a7 7 0 01-7 7" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3" />
    </svg>
);

const HubSpotIcon   = ({ s = 22 }) =><svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF7A59" /><circle cx="14" cy="9" r="2.5" fill="white" /><path d="M11 9h-2.5M14 6.5V4M16.5 10l1.5 1.5M11 12l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>;
const SlackIcon     = ({ s = 22 }) => <svg width={s} height={s} viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#4A154B" /><path d="M9 8a1.5 1.5 0 01-3 0V6a1.5 1.5 0 013 0v2zm0 0h6M15 8a1.5 1.5 0 003 0V6a1.5 1.5 0 00-3 0v2zm0 0v6M15 14a1.5 1.5 0 013 0v2a1.5 1.5 0 01-3 0v-2zm0 0H9M9 14a1.5 1.5 0 01-3 0v-2a1.5 1.5 0 013 0v2zm0 0v-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>;
const ZapierIcon    = ({ s = 22 }) => <svg width={s} height={s} viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FF4A00" /><path d="M12 4l-1.5 6H5l5 3.5-1.5 6.5L12 16l3.5 4L14 13.5 19 10h-5.5L12 4z" fill="white" /></svg>;
const AnalyticsIcon = ({ s = 22 }) => <svg width={s} height={s} viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#E37400" /><path d="M5 17l4-5 4 3 5-7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

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
        fbLogin: true,
        tags: ["Facebook", "Instagram", "Lead Forms", "Real-time sync"],
        configFields: [
            { key: "appId",       label: "App ID",            placeholder: "Meta App ID (App Dashboard → Settings → Basic)", type: "text" },
            { key: "appSecret",   label: "App Secret",        placeholder: "Meta App Secret (App Dashboard → Settings → Basic)", type: "password" },
        ],
        metaKeys: [
            { key: "pageName",   label: "Page",        icon: "📄" },
            { key: "leadCount",  label: "Leads synced", icon: "👥" },
        ],
        setupGuide: {
            title: "How to connect Meta Lead Ads",
            steps: [
                { label: "Create a Meta App", detail: "Go to developers.facebook.com → My Apps → Create App (Business type). Add the Facebook Login and Webhooks products." },
                { label: "Copy App ID & App Secret", detail: "In your app → App Settings → Basic, copy the App ID and App Secret. Paste both into the fields above and click Save." },
                { label: "Add the redirect URI", detail: "In Facebook Login → Settings, add this app's backend callback URL (shown below) to \"Valid OAuth Redirect URIs\"." },
                { label: "Connect with Facebook", detail: "Click \"Connect with Facebook\", sign in, and grant the leads permissions. Then pick the Page you want to sync leads from." },
            ],
            note: "No manual tokens needed — the app handles the OAuth login, grabs a long-lived Page token, and requests the leads_retrieval permission for you.",
            links: [{ label: "Meta for Developers", url: "https://developers.facebook.com/apps" }],
        },
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
            { key: "accessToken",   label: "Permanent Access Token",     placeholder: "EAAxxxxxxxx…  (from Meta Developer Console)", type: "password" },
            { key: "phoneNumberId", label: "Phone Number ID",            placeholder: "Numeric phone number ID",                      type: "text" },
            { key: "wabaId",        label: "WhatsApp Business Account ID", placeholder: "Numeric WABA ID",                            type: "text" },
            { key: "appId",         label: "App ID",                     placeholder: "Meta App ID (from App Dashboard → Settings)",  type: "text" },
            { key: "appSecret",     label: "App Secret",                 placeholder: "Meta App Secret — used to verify webhooks",    type: "password" },
        ],
        metaKeys: [
            { key: "phoneNumber",     label: "Phone number",    icon: "📱" },
            { key: "templatesSynced", label: "Templates synced", icon: "📋" },
        ],
        setupGuide: {
            title: "How to set up WhatsApp Cloud API",
            steps: [
                { label: "Create a Meta App", detail: "Go to developers.facebook.com → Create App → choose Business type. Add the WhatsApp product to your app." },
                { label: "Get your Phone Number ID & WABA ID", detail: "In your app → WhatsApp → Getting Started. You'll see the Phone Number ID and WhatsApp Business Account ID listed on that page." },
                { label: "Generate a Permanent Token", detail: "Go to Meta Business Manager → System Users → Add System User (Admin role). Then assign your WhatsApp app, generate a token with whatsapp_business_messaging and whatsapp_business_management permissions." },
                { label: "Copy your App ID & App Secret", detail: "In your app → App Settings → Basic. Copy the App ID and click \"Show\" next to App Secret. Paste both into the fields above — the App Secret is used to verify incoming webhook signatures from Meta." },
                { label: "Paste & Save", detail: "Enter all the values above and click Save & Activate. The CRM can now send WhatsApp messages to your leads and securely verify webhooks." },
            ],
            note: "The token from the Getting Started page expires in 24 hours — always use a System User permanent token for production. Adding the App Secret here removes the need for a META_APP_SECRET .env variable.",
            links: [{ label: "Meta Business Manager", url: "https://business.facebook.com/settings/system-users" }],
        },
    },
    {
        key: "google_ads",
        name: "Google Ads",
        desc: "Receive leads from Google Ads Lead Form Extensions via webhook.",
        Icon: GoogleIcon,
        grad: "from-orange-400 to-red-500",
        bg: "bg-orange-50", border: "border-orange-100", chip: "text-orange-700 bg-orange-50",
        oauth: false,
        tags: ["Lead Form Extensions", "Webhook", "Auto Lead Import"],
        configFields: [
            { key: "webhookKey", label: "Webhook Key", placeholder: "Secret key you'll set in Google Ads → Lead Form → Webhook", type: "password" },
        ],
        metaKeys: [
            { key: "leadsReceived", label: "Leads Received", icon: "📥" },
        ],
        webhookPath: "/api/google-ads/webhook",
        setupGuide: {
            title: "How to connect Google Ads Lead Form Extensions",
            steps: [
                { label: "Choose a Webhook Key", detail: "Make up any secret string (e.g. \"myads_secret_123\"). Type it in the Webhook Key field above and save. This is your shared secret — you'll enter the same value in Google Ads." },
                { label: "Copy the Webhook URL", detail: "After saving, copy the Webhook URL shown above (ends in /api/google-ads/webhook)." },
                { label: "Open your Google Ads campaign", detail: "In Google Ads, go to your Search or Performance Max campaign → Ads & Extensions → Extensions → Lead Form Extension. Open or create a Lead Form." },
                { label: "Paste the Webhook URL & Key", detail: "Scroll to the \"Lead delivery\" section → choose Webhook. Paste the Webhook URL, then enter the same Webhook Key you chose in step 1." },
                { label: "Send a test lead", detail: "Click \"Send test\" in Google Ads. The CRM will receive a sample lead — check your Leads list to confirm it arrived." },
            ],
            note: "No OAuth or Google account connection needed — leads are pushed to the CRM automatically whenever someone submits a Lead Form ad.",
        },
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
            { key: "fromName", label: "From Name",     placeholder: "scholar360 Notifications",  type: "text" },
        ],
        extras: ["secure"],
        metaKeys: [
            { key: "host",     label: "SMTP host",  icon: "🖥️" },
            { key: "fromName", label: "From name",  icon: "✉️" },
        ],
        setupGuide: {
            title: "How to set up Email / SMTP",
            steps: [
                { label: "Gmail — create an App Password", detail: "In your Google Account → Security → 2-Step Verification must be ON → App Passwords → select \"Mail\" + \"Other\" → Generate. Use the 16-character password here (not your normal Gmail password)." },
                { label: "Fill in the fields", detail: "Host: smtp.gmail.com · Port: 587 · Username: your full Gmail address · Password: the App Password from step 1 · From Name: what recipients see as sender name." },
                { label: "Enable TLS/SSL toggle", detail: "Leave the TLS/SSL toggle ON for port 587 (STARTTLS). Turn it OFF only if your host uses port 25 (unencrypted)." },
                { label: "Save & test", detail: "Click Save & Activate. The CRM will send a test connection to verify credentials." },
            ],
            note: "Other providers: Outlook → smtp-mail.outlook.com:587 | SendGrid → smtp.sendgrid.net:587 (username: apikey, password: your SendGrid API key) | Mailgun → smtp.mailgun.org:587.",
        },
    },
    {
        key: "google_calendar",
        name: "Google Calendar",
        desc: "Connect your Google Calendar to sync reminders and get event notifications.",
        Icon: GCalIcon,
        grad: "from-blue-500 to-sky-600",
        bg: "bg-blue-50", border: "border-blue-100", chip: "text-blue-700 bg-blue-50",
        oauth: true,
        noSync: true,
        endpoints: {
            status:     "/google/calendar/status",
            oauthStart: "/google/auth?popup=1",
            disconnect: "/google/calendar/disconnect",
        },
        tags: ["OAuth", "Reminders Sync", "Event Notifications", "Per-user"],
        setupGuide: {
            title: "How to connect Google Calendar",
            steps: [
                { label: "Click Connect", detail: "Click the Connect button below. A Google sign-in popup will appear." },
                { label: "Sign in with Google", detail: "Choose the Google account whose calendar you want to sync. Grant calendar access when prompted." },
                { label: "Done", detail: "The popup will close automatically. Your reminders will now sync to Google Calendar." },
            ],
            note: "This connection is per-user — each team member connects their own Google account independently.",
        },
    },
    {
        key: "livekit",
        name: "LiveKit Video",
        desc: "Open-source video calling for team channels. Free tier includes 10,000 minutes/month.",
        Icon: LiveKitIcon,
        grad: "from-gray-700 to-gray-900",
        bg: "bg-gray-50", border: "border-gray-200", chip: "text-gray-700 bg-gray-100",
        oauth: false,
        noSync: true,
        tags: ["Video Calls", "WebRTC", "Open Source", "Free Tier"],
        configFields: [
            { key: "apiKey",    label: "API Key",            placeholder: "APIxxxxxxxxxxxxxxx",          type: "password" },
            { key: "apiSecret", label: "API Secret",         placeholder: "Your LiveKit API secret",     type: "password" },
            { key: "url",       label: "WebSocket URL",      placeholder: "wss://your-project.livekit.cloud", type: "text" },
        ],
        metaKeys: [
            { key: "url", label: "Server URL", icon: "🔗" },
        ],
        setupGuide: {
            title: "How to get LiveKit credentials",
            steps: [
                { label: "Create a LiveKit Cloud account", detail: "Go to cloud.livekit.io and sign up for free. The free tier includes 10,000 participant-minutes per month — no credit card required." },
                { label: "Create a project", detail: "Click \"New Project\" in the dashboard. Give it a name and pick the region closest to your users." },
                { label: "Copy your API keys", detail: "In your project → Settings → Keys. Copy the API Key (starts with API…), the API Secret (long random string), and the WebSocket URL (starts with wss://)." },
                { label: "Paste & Save", detail: "Enter all three values in the fields above and click Save & Activate. The video call button in your team chat will work immediately." },
            ],
            note: "Your credentials are encrypted before being stored. Video calls use LiveKit's free tier (10k mins/month). Self-hosting via Docker is also supported if needed.",
            links: [{ label: "LiveKit Cloud Dashboard", url: "https://cloud.livekit.io" }],
        },
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
        metaKeys: [
            { key: "searchQuota", label: "Search quota", icon: "🔍" },
        ],
        setupGuide: {
            title: "How to get a Serper API Key",
            steps: [
                { label: "Sign up at Serper.dev", detail: "Go to serper.dev and create a free account. The free plan includes 2,500 searches — enough to get started." },
                { label: "Copy your API key", detail: "After signing in, your API key is shown on the dashboard homepage. Click to copy it." },
                { label: "Paste & Save", detail: "Paste the key in the field above and click Save & Activate. The CRM will use it to search LinkedIn profiles for leads." },
            ],
            note: "Each lead search uses roughly 1–3 Serper credits. Monitor your quota at serper.dev/dashboard.",
            links: [{ label: "Serper Dashboard", url: "https://serper.dev/dashboard" }],
        },
    },
    {
        key: "fasterq",
        name: "Fasterq Calls",
        desc: "Receive call logs from Fasterq via webhook with Basic Auth.",
        Icon: FasterqIcon,
        grad: "from-zinc-700 to-zinc-900",
        bg: "bg-zinc-100", border: "border-zinc-200", chip: "text-zinc-700 bg-zinc-100",
        oauth: false,
        tags: ["Call Logs", "Webhook", "Auto Lead Match", "Recording URL"],
        configFields: [
            { key: "user", label: "Webhook Username", placeholder: "From Fasterq settings", type: "text" },
            { key: "pass", label: "Webhook Password", placeholder: "From Fasterq settings", type: "password" },
        ],
        webhookPath: "/api/fasterq/webhook",
        setupGuide: {
            title: "How to connect Fasterq",
            steps: [
                { label: "Copy the Webhook URL", detail: "Copy the Webhook URL shown above (ends in /api/fasterq/webhook)." },
                { label: "Open Fasterq settings", detail: "Log in to your Fasterq account → Settings → Integrations → Push API / Webhook." },
                { label: "Paste URL and set credentials", detail: "Enter the Webhook URL. Set a Username and Password of your choice (you make these up — they're for Basic Auth verification). Enter the same Username and Password in the fields above." },
                { label: "Save on both sides", detail: "Save in Fasterq, then Save & Activate in the CRM. Call logs will now sync automatically after each call." },
            ],
            note: "The CRM will match call logs to existing leads by phone number. Unmatched calls are still stored in the call log.",
        },
        metaKeys: [
            { key: "callsSynced",  label: "Calls synced",   icon: "📞" },
            { key: "webhookReady", label: "Webhook",         icon: "🔗" },
        ],
    },
    {
        key: "website_webhook",
        name: "Website Lead Form",
        desc: "Embed a contact form on your website. Leads come directly into the CRM.",
        Icon: WebhookIcon,
        grad: "from-sky-400 to-cyan-500",
        bg: "bg-sky-50", border: "border-sky-100", chip: "text-sky-700 bg-sky-50",
        oauth: false,
        tags: ["Embed Widget", "Auto Lead", "API Key", "Any Website"],
        webhookPath: "/api/public/leads",
        embedWidget: true,
        metaKeys: [
            { key: "leadsReceived", label: "Leads received", icon: "📥" },
        ],
        setupGuide: {
            title: "How to embed the lead form on your website",
            steps: [
                { label: "Generate an API Key", detail: "Click \"Generate Key\" below. A unique key starting with wk_ will be created and saved automatically." },
                { label: "Copy the HTML snippet", detail: "Copy the \"Plain HTML Form\" snippet shown below. It includes a ready-made form and a small JavaScript block that POSTs to your CRM." },
                { label: "Paste into your website", detail: "Paste the snippet anywhere in your website's HTML — inside a page, a modal, or a sidebar. It works on any website: WordPress, Wix, Webflow, plain HTML, etc." },
                { label: "Test it", detail: "Fill in the form on your website and submit. Within seconds a new lead should appear in your CRM Leads list with source \"Website\"." },
            ],
            note: "The API key is tied to your CRM workspace. Anyone with this key can submit leads — keep it out of public repositories. You can regenerate it any time (old embeds will stop working until updated).",
        },
    },
];

const COMING_SOON = [
    { name: "HubSpot",          Icon: HubSpotIcon,   grad: "from-orange-400 to-amber-500" },
    { name: "Slack",             Icon: SlackIcon,     grad: "from-purple-500 to-fuchsia-600" },
    { name: "Zapier",            Icon: ZapierIcon,    grad: "from-red-500 to-orange-500" },
    { name: "Google Analytics",  Icon: AnalyticsIcon, grad: "from-yellow-500 to-orange-500" },
];

const PLATFORM_LABELS = Object.fromEntries(PROVIDERS.map(p => [p.key, p.name]));

// ── Helpers ───────────────────────────────────────────────────────────────────

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
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-violet-600 transition-colors">
            {copied ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ integrations }) {
    const alwaysKeys   = new Set(PROVIDERS.filter(p => p.alwaysConnected).map(p => p.key));
    const connected    = integrations.filter(i => i.status === "CONNECTED" && !alwaysKeys.has(i.platform)).length
        + PROVIDERS.filter(p => p.alwaysConnected).length;
    const disconnected = integrations.filter(i => i.status === "DISCONNECTED" && !alwaysKeys.has(i.platform)).length;
    const errors       = integrations.filter(i => i.status === "ERROR").length;
    const syncable     = integrations.filter(i => i.status === "CONNECTED" && i.lastSynced);
    const lastSync     = syncable.length
        ? new Date(Math.max(...syncable.map(i => new Date(i.lastSynced))))
        : null;
    const total        = PROVIDERS.length;
    const syncPct      = total > 0 ? Math.round((connected / total) * 100) : 0;

    const webhookProviders = integrations.filter(i =>
        ["fasterq", "website_webhook"].includes(i.platform) && i.status === "CONNECTED"
    );
    const webhookOk = webhookProviders.length > 0;

    const stats = [
        {
            label: "Connected",
            value: connected,
            sub: `of ${total} integrations`,
            Icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100",
        },
        {
            label: "Disconnected",
            value: disconnected,
            sub: errors > 0 ? `${errors} with errors` : "awaiting setup",
            Icon: WifiOff,
            color: errors > 0 ? "text-red-500" : "text-zinc-500",
            bg: errors > 0 ? "bg-red-50" : "bg-zinc-50",
            border: errors > 0 ? "border-red-100" : "border-zinc-100",
        },
        {
            label: "Webhook Status",
            value: webhookOk ? "Active" : "Inactive",
            sub: webhookOk ? `${webhookProviders.length} webhook${webhookProviders.length > 1 ? "s" : ""} live` : "no webhooks connected",
            Icon: webhookOk ? Wifi : WifiOff,
            color: webhookOk ? "text-sky-600" : "text-zinc-400",
            bg: webhookOk ? "bg-sky-50" : "bg-zinc-50",
            border: webhookOk ? "border-sky-100" : "border-zinc-100",
        },
        {
            label: "Sync Health",
            value: `${syncPct}%`,
            sub: errors > 0 ? `${errors} failing` : "all healthy",
            Icon: Activity,
            color: errors > 0 ? "text-orange-500" : "text-violet-600",
            bg: errors > 0 ? "bg-orange-50" : "bg-violet-50",
            border: errors > 0 ? "border-orange-100" : "border-violet-100",
        },
        {
            label: "Last Sync",
            value: lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
            sub: lastSync ? lastSync.toLocaleDateString() : "no syncs yet",
            Icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {stats.map((s, i) => (
                <motion.div key={s.label}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3 }}
                    className={`bg-white rounded-2xl border ${s.border} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
                    <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                        <s.Icon size={15} className={s.color} />
                    </div>
                    <p className={`text-lg font-extrabold leading-none ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] font-semibold text-zinc-700 mt-0.5">{s.label}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">{s.sub}</p>
                </motion.div>
            ))}
        </div>
    );
}

// ── Connection Health ─────────────────────────────────────────────────────────

function buildAlerts(integrations) {
    const now = Date.now();
    const alerts = [];

    for (const i of integrations) {
        const prov = PROVIDERS.find(p => p.key === i.platform);
        const label = PLATFORM_LABELS[i.platform] || i.platform;

        if (i.status === "ERROR") {
            alerts.push({ level: "danger", platform: i.platform, label, msg: i.errorMessage || "Connection error — reconnect required" });
        }
        if (i.expiresAt && new Date(i.expiresAt) - now < 3 * 86_400_000 && i.status === "CONNECTED") {
            alerts.push({ level: "warning", platform: i.platform, label, msg: "Access token expires within 3 days — reconnect soon" });
        }
        if (i.status === "CONNECTED" && i.lastSynced && (now - new Date(i.lastSynced)) > 24 * 3_600_000) {
            alerts.push({ level: "warning", platform: i.platform, label, msg: `Last sync was over 24 hours ago — trigger a manual sync` });
        }
        if (i.status === "CONNECTED" && !i.lastSynced && !prov?.alwaysConnected) {
            alerts.push({ level: "info", platform: i.platform, label, msg: "Connected but never synced — run an initial sync" });
        }
    }

    // Check critical integrations that should be connected
    const criticalDisconnected = ["email_smtp", "whatsapp_cloud"].filter(key => {
        const ig = integrations.find(i => i.platform === key);
        return !ig || ig.status !== "CONNECTED";
    });
    if (criticalDisconnected.length > 0) {
        criticalDisconnected.forEach(key => {
            const label = PLATFORM_LABELS[key] || key;
            alerts.push({ level: "info", platform: key, label, msg: `${label} is not connected — set it up to enable messaging` });
        });
    }

    return alerts;
}

function ConnectionHealth({ integrations, onScrollToCard }) {
    const alerts = useMemo(() => buildAlerts(integrations), [integrations]);
    if (!alerts.length) return null;

    const levelStyle = {
        danger:  { bg: "bg-red-50",    border: "border-red-100",    icon: "text-red-500",    dot: "bg-red-500",    label: "text-red-700"  },
        warning: { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-500",  dot: "bg-amber-400",  label: "text-amber-700"},
        info:    { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-500",   dot: "bg-blue-400",   label: "text-blue-700" },
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mb-8 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/50">
                <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                    <ShieldAlert size={14} className="text-orange-500" />
                </div>
                <h2 className="text-sm font-bold text-zinc-800">Connection Health</h2>
                <span className="ml-auto text-[11px] font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                    {alerts.length} alert{alerts.length > 1 ? "s" : ""}
                </span>
            </div>
            <div className="divide-y divide-zinc-100">
                {alerts.map((a, i) => {
                    const s = levelStyle[a.level];
                    return (
                        <motion.div key={`${a.platform}-${i}`}
                            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.45 + i * 0.05 }}
                            className={`flex items-start gap-3 px-5 py-3 hover:${s.bg} transition-colors`}>
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                            <div className="flex-1 min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${s.label} mr-2`}>{a.label}</span>
                                <span className="text-xs text-zinc-600">{a.msg}</span>
                            </div>
                            <button onClick={() => onScrollToCard(a.platform)}
                                className="text-[10px] font-semibold text-zinc-400 hover:text-violet-500 transition-colors shrink-0 mt-0.5">
                                View →
                            </button>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}

// ── OAuth popup ───────────────────────────────────────────────────────────────

function useOAuthPopup(onSuccess) {
    const [pending, setPending] = useState(false);

    const open = (authUrl) => {
        setPending(true);
        const popup = window.open(authUrl, "scholar360_oauth", "width=600,height=700,scrollbars=yes");
        if (!popup) { toast.error("Popup blocked — allow popups for this site"); setPending(false); return; }

        const handler = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type !== "SCHOLAR360_OAUTH") return;
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

// ── Configure Sheet ───────────────────────────────────────────────────────────

function ConfigSheet({ open, onClose, provider, integration, onSaved, backendUrl }) {
    const [tab, setTab]           = useState("configure");
    const [form, setForm]         = useState({});
    const [show, setShow]         = useState({});
    const [saving, setSaving]     = useState(false);
    const [apiKey, setApiKey]     = useState("");
    const [showEmbed, setShowEmbed] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [fbPages, setFbPages]     = useState(null);
    const [selectedPage, setSelectedPage] = useState("");
    const [fbBusy, setFbBusy]       = useState(false);

    const { pending: fbPending, open: openFb } = useOAuthPopup((payload) => {
        const pages = payload?.pages || [];
        setFbPages(pages);
        if (pages.length === 1) setSelectedPage(pages[0].id);
        if (!pages.length) toast.error("No Facebook Pages found for this account — you must be a Page admin.");
    });

    const handleFbConnect = async () => {
        if (!form.appId || !form.appSecret) { toast.error("Enter App ID and App Secret first"); return; }
        setFbBusy(true);
        try {
            await api.put(`/integration-hub/${provider.key}/configure`, { config: { appId: form.appId, appSecret: form.appSecret } });
            const res = await api.get(`/integration-hub/${provider.key}/oauth/start`);
            openFb(res.data.authUrl);
        } catch (err) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Could not start Facebook login");
        } finally { setFbBusy(false); }
    };

    const handleSelectPage = async () => {
        if (!selectedPage) { toast.error("Select a Page"); return; }
        setFbBusy(true);
        try {
            const res = await api.post(`/integration-hub/${provider.key}/select-page`, { pageId: selectedPage });
            toast.success(`Connected to ${res.data.pageName}`);
            onSaved?.(); onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not connect Page");
        } finally { setFbBusy(false); }
    };

    useEffect(() => {
        if (open) {
            setTab("configure");
            setActiveStep(0);
            const initial = {};
            (provider?.configFields || []).forEach(f => { initial[f.key] = ""; });
            setForm(initial);
            setShow({});
            setFbPages(null);
            setSelectedPage("");
            if (provider?.embedWidget) {
                const existing = integration?.metadata?.apiKey || "";
                setApiKey(existing);
                setShowEmbed(!!existing);
            }
        }
    }, [open, provider, integration]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const generateApiKey = () => {
        const key = "wk_" + Array.from(crypto.getRandomValues(new Uint8Array(18)))
            .map(b => b.toString(16).padStart(2, "0")).join("");
        setApiKey(key);
        setShowEmbed(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const config = provider?.embedWidget ? { apiKey } : { ...form };
            if (provider?.extras?.includes("secure")) config.secure = form.secure || false;
            const res = await api.put(`/integration-hub/${provider.key}/configure`, { config });
            if (res.data.ok === false) toast.error(res.data.message || "Failed");
            else { toast.success(res.data.message || "Saved & connected"); onSaved?.(); onClose(); }
        } catch (err) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Save failed");
        } finally { setSaving(false); }
    };

    const inputCls = "w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition placeholder-zinc-400 bg-white";
    const labelCls = "block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5";
    const publicUrl = backendUrl + "/api/public/leads";

    const htmlFormCode = apiKey ? `<form id="crm-lead-form">
  <input name="name"  placeholder="Your Name"  required />
  <input name="email" placeholder="Email"       type="email" />
  <input name="phone" placeholder="Phone"       type="tel" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>
<script>
document.getElementById('crm-lead-form').onsubmit = async function(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await fetch('${publicUrl}?key=${apiKey}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (res.ok) alert('Thank you! We will be in touch.');
};
</script>` : "";

    const guide = provider?.setupGuide;
    const hasTabs = !!guide;

    return (
        <Sheet open={open} onClose={onClose} title={null} size="lg">
            {/* Custom header with provider branding + tabs */}
            <div className="px-6 pt-5 pb-0 border-b border-zinc-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider?.grad || "from-zinc-400 to-zinc-600"} flex items-center justify-center shadow-sm`}>
                        {provider?.Icon && <provider.Icon s={20} />}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-zinc-900">{provider?.name}</h2>
                        <p className="text-xs text-zinc-400">{provider?.desc}</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-zinc-400 hover:text-zinc-600 transition-colors">
                        <XCircle size={18} />
                    </button>
                </div>
                {hasTabs && (
                    <div className="flex gap-1">
                        {[
                            { id: "configure", label: "Configure", icon: Settings2 },
                            { id: "guide",     label: "Setup Guide", icon: HelpCircle },
                        ].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                                    tab === t.id
                                        ? "border-violet-500 text-violet-600 bg-violet-50/50"
                                        : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}>
                                <t.icon size={13} />{t.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <Sheet.Body className="!pt-5">
                <AnimatePresence mode="wait">

                {/* ── CONFIGURE TAB ── */}
                {tab === "configure" && (
                    <motion.div key="configure"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-5">

                        {provider?.oauth && !(provider?.configFields || []).length ? (
                            <div className="flex gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                <HelpCircle size={15} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    <span className="font-bold text-blue-800">OAuth connection — </span>
                                    click <span className="font-semibold">Connect</span> on the card to sign in with Google. No credentials to enter here.
                                </p>
                            </div>
                        ) : provider?.embedWidget ? ( /* eslint-disable-line */
                            <>
                                {/* API Key row */}
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <KeyRound size={14} className="text-zinc-400" />
                                        <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">API Key</span>
                                        {apiKey && <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Active</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2.5 min-w-0">
                                            <code className="flex-1 text-xs text-zinc-700 break-all select-all font-mono">
                                                {apiKey || <span className="text-zinc-400 font-sans not-italic">No key yet — click Generate</span>}
                                            </code>
                                            {apiKey && <CopyButton text={apiKey} />}
                                        </div>
                                        <button onClick={generateApiKey}
                                            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 rounded-xl transition-all shadow-sm whitespace-nowrap">
                                            <RefreshCw size={12} />{apiKey ? "Regenerate" : "Generate Key"}
                                        </button>
                                    </div>
                                    {apiKey && <p className="text-[11px] text-zinc-400 flex items-center gap-1"><ShieldAlert size={11} className="text-amber-400" />Keep this private — anyone with this key can submit leads to your CRM.</p>}
                                </div>

                                {showEmbed && apiKey && (
                                    <>
                                        {/* Endpoint */}
                                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">API Endpoint</span>
                                                <CopyButton text={`${publicUrl}?key=${apiKey}`} />
                                            </div>
                                            <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2.5">
                                                <code className="text-xs text-zinc-700 break-all font-mono">{publicUrl}?key={apiKey}</code>
                                            </div>
                                            <p className="text-[11px] text-zinc-400">
                                                POST JSON with{" "}
                                                {["name","email","phone","message"].map((f,i,a) => (
                                                    <span key={f}><code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">{f}</code>{i < a.length-1 ? ", " : ""}</span>
                                                ))}
                                            </p>
                                        </div>

                                        {/* Embed snippet */}
                                        <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800">
                                                <div className="flex items-center gap-2">
                                                    <Code2 size={13} className="text-zinc-400" />
                                                    <span className="text-xs font-semibold text-zinc-300">HTML Embed Snippet</span>
                                                    <span className="text-[10px] text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded-full">paste into your website</span>
                                                </div>
                                                <CopyButton text={htmlFormCode} />
                                            </div>
                                            <pre className="bg-zinc-900 text-emerald-300 text-[11px] font-mono p-4 overflow-x-auto whitespace-pre-wrap break-all leading-[1.7]">{htmlFormCode}</pre>
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {provider?.webhookPath && (
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Webhook URL</span>
                                            <CopyButton text={backendUrl + provider.webhookPath} />
                                        </div>
                                        <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2.5">
                                            <code className="text-xs text-zinc-700 break-all font-mono">{backendUrl + provider.webhookPath}</code>
                                        </div>
                                        <p className="text-[11px] text-zinc-400">Paste this URL into the integration settings on the provider&apos;s side.</p>
                                    </div>
                                )}

                                {(provider?.configFields || []).length > 0 && (
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-4">
                                        <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Credentials</span>
                                        <div className="space-y-4 pt-1">
                                            {(provider?.configFields || []).map(f => {
                                                const isPass    = f.type === "password";
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
                                        </div>
                                    </div>
                                )}

                                {provider?.fbLogin && (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Connect Facebook Page</span>
                                        </div>
                                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                                            Add this redirect URI to your Meta app under <span className="font-semibold">Facebook Login → Settings → Valid OAuth Redirect URIs</span>:
                                        </p>
                                        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2">
                                            <code className="flex-1 text-[11px] text-zinc-700 break-all font-mono">{backendUrl}/api/integration-hub/oauth/meta_leads/callback</code>
                                            <CopyButton text={`${backendUrl}/api/integration-hub/oauth/meta_leads/callback`} />
                                        </div>

                                        {!fbPages ? (
                                            <button type="button" onClick={handleFbConnect} disabled={fbBusy || fbPending}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 rounded-xl transition-all shadow-sm disabled:opacity-60">
                                                {(fbBusy || fbPending) ? <><Loader2 size={14} className="animate-spin" />Connecting…</> : <>Connect with Facebook</>}
                                            </button>
                                        ) : (
                                            <div className="space-y-3">
                                                <label className={labelCls}>Select a Page to sync leads from</label>
                                                <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} className={inputCls}>
                                                    <option value="">— Choose a Page —</option>
                                                    {fbPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={handleSelectPage} disabled={fbBusy || !selectedPage}
                                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl transition-all shadow-sm disabled:opacity-60">
                                                        {fbBusy ? <><Loader2 size={14} className="animate-spin" />Connecting…</> : "Connect Page & Sync"}
                                                    </button>
                                                    <button type="button" onClick={() => setFbPages(null)}
                                                        className="px-4 py-2.5 text-sm font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50">
                                                        Retry
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {provider?.extras?.includes("secure") && (
                                    <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                                        <button type="button" onClick={() => set("secure", !form.secure)}
                                            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${form.secure ? "bg-violet-500" : "bg-zinc-300"}`}>
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.secure ? "translate-x-4" : ""}`} />
                                        </button>
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-700">Use TLS / SSL</p>
                                            <p className="text-xs text-zinc-400">Enable for port 465 (SSL) or 587 (STARTTLS)</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                )}

                {/* ── SETUP GUIDE TAB ── */}
                {tab === "guide" && guide && (
                    <motion.div key="guide"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-4">

                        {/* Step progress bar */}
                        <div className="flex items-center gap-1.5 px-1">
                            {guide.steps.map((_, i) => (
                                <button key={i} onClick={() => setActiveStep(i)}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === activeStep ? "flex-1 bg-violet-500" : i < activeStep ? "w-6 bg-violet-300" : "w-6 bg-zinc-200"}`} />
                            ))}
                        </div>

                        {/* Active step card */}
                        <AnimatePresence mode="wait">
                            <motion.div key={activeStep}
                                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.16 }}
                                className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
                                        {activeStep + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-zinc-900 mb-1.5">{guide.steps[activeStep].label}</p>
                                        <p className="text-sm text-zinc-600 leading-relaxed">{guide.steps[activeStep].detail}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* All steps list */}
                        <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">All Steps</span>
                            </div>
                            <div className="divide-y divide-zinc-100">
                                {guide.steps.map((step, i) => (
                                    <button key={i} onClick={() => setActiveStep(i)}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${i === activeStep ? "bg-violet-50" : "hover:bg-zinc-50"}`}>
                                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border transition-colors shrink-0 ${
                                            i === activeStep ? "bg-violet-500 text-white" :
                                            i < activeStep ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-zinc-200 text-zinc-400"
                                        }`}>
                                            {i < activeStep ? <CheckCircle2 size={13} /> : i + 1}
                                        </span>
                                        <span className={`text-xs font-semibold ${i === activeStep ? "text-violet-700" : i < activeStep ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                                            {step.label}
                                        </span>
                                        {i === activeStep && <ChevronRight size={13} className="ml-auto text-violet-400" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Note callout */}
                        {guide.note && (
                            <div className="flex gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                <HelpCircle size={15} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700 leading-relaxed"><span className="font-bold text-blue-800">Tip: </span>{guide.note}</p>
                            </div>
                        )}

                        {/* External links */}
                        {guide.links?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {guide.links.map((l, i) => (
                                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 rounded-xl transition-all shadow-sm">
                                        <ArrowUpRight size={12} />{l.label}
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* Prev / Next navigation */}
                        <div className="flex items-center justify-between pt-1">
                            <button onClick={() => setActiveStep(s => Math.max(0, s - 1))}
                                disabled={activeStep === 0}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-zinc-100">
                                <ChevronLeft size={14} />Previous
                            </button>
                            {activeStep < guide.steps.length - 1 ? (
                                <button onClick={() => setActiveStep(s => s + 1)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 rounded-xl transition-all shadow-sm">
                                    Next<ChevronRight size={14} />
                                </button>
                            ) : (
                                <button onClick={() => setTab("configure")}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl transition-all shadow-sm">
                                    <CheckCircle2 size={13} />Go to Configure
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </Sheet.Body>

            {tab === "configure" && (
                <Sheet.Footer>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</button>
                    {(provider?.oauth && !(provider?.configFields || []).length) ? null : (provider?.embedWidget ? !!apiKey : !provider?.alwaysConnected) && (
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all shadow-sm"
                            style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}>
                            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : "Save & Activate"}
                        </button>
                    )}
                </Sheet.Footer>
            )}
        </Sheet>
    );
}

// ── Logs Sheet (per-integration) ──────────────────────────────────────────────

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
                        <ClipboardList size={32} /><p className="text-sm">No events yet</p>
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

function Card({ p, integration, onConnect, onSync, onDisconnect, onConfigure, onLogs, cardIndex }) {
    const [busy, setBusy] = useState(null);
    const { Icon } = p;
    const status    = p.alwaysConnected ? "CONNECTED" : (integration?.status || "DISCONNECTED");
    const connected = status === "CONNECTED";
    const errored   = status === "ERROR";
    const meta      = integration?.metadata || {};

    const act = async (label, fn) => { setBusy(label); try { await fn(); } finally { setBusy(null); } };

    const metaRows = (p.metaKeys || []).filter(k => meta[k.key] != null);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: cardIndex * 0.06, duration: 0.3, ease: "easeOut" }}
            whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
            className={`relative bg-white rounded-2xl border overflow-hidden transition-colors duration-200 ${errored ? "border-red-200" : "border-zinc-200"} shadow-sm`}>

            <div className={`h-0.5 bg-gradient-to-r ${p.grad}`} />
            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3.5">
                    <div className={`w-11 h-11 rounded-xl ${p.bg} ${p.border} border flex items-center justify-center`}>
                        <Icon s={24} />
                    </div>
                    <motion.div key={status} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
                        <StatusBadge status={status} />
                    </motion.div>
                </div>

                <h3 className="text-sm font-bold text-zinc-900 mb-1">{p.name}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">{p.desc}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3.5">
                    {p.tags?.map(t => (
                        <span key={t} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.chip}`}>{t}</span>
                    ))}
                </div>

                {/* Provider-specific metadata (when connected) */}
                {connected && metaRows.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 mb-3.5">
                        {metaRows.map(k => (
                            <div key={k.key} className={`${p.bg} ${p.border} border rounded-lg px-2.5 py-1.5`}>
                                <p className="text-[10px] text-zinc-500 font-medium">{k.icon} {k.label}</p>
                                <p className="text-xs font-bold text-zinc-800 truncate">{String(meta[k.key])}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Last sync */}
                {integration?.lastSynced && (
                    <p className="text-[11px] text-zinc-400 mb-3 flex items-center gap-1">
                        <Clock size={10} />Last sync: {new Date(integration.lastSynced).toLocaleString()}
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
                            style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}>
                            <Plug size={11} />Connect
                        </button>
                    ) : (
                        <>
                            {errored && (
                                <button onClick={onConnect}
                                    className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors">
                                    <RefreshCw size={11} />Reconnect
                                </button>
                            )}
                            {connected && !p.alwaysConnected && !p.noSync && (
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
                    {!connected && !errored && p.webhookPath && (
                        <button onClick={onConfigure}
                            className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors">
                            <Settings2 size={11} />Setup
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── All-integrations logs table ───────────────────────────────────────────────

const LOG_PAGE = 20;

const LOG_STATUS_STYLE = {
    SUCCESS: { dot: "bg-emerald-500", text: "text-emerald-700 bg-emerald-50",  label: "Success"  },
    ERROR:   { dot: "bg-red-500",     text: "text-red-700 bg-red-50",           label: "Failed"   },
    INFO:    { dot: "bg-zinc-400",    text: "text-zinc-600 bg-zinc-100",        label: "Info"     },
};

function AllLogsTable() {
    const [page, setPage]         = useState(1);
    const [search, setSearch]     = useState("");
    const [filterStatus, setFilter] = useState("ALL");

    const { data: allLogs = [], isLoading } = useQuery({
        queryKey: ["integration-all-logs"],
        queryFn: () => api.get("/integration-hub/all-logs?limit=200").then(r => r.data),
        staleTime: 15_000,
        refetchInterval: 30_000,
    });

    const filtered = useMemo(() => {
        let rows = allLogs;
        if (filterStatus !== "ALL") rows = rows.filter(l => l.status === filterStatus);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(l =>
                (PLATFORM_LABELS[l.integration?.platform] || l.integration?.platform || "").toLowerCase().includes(q) ||
                l.message?.toLowerCase().includes(q) ||
                l.type?.toLowerCase().includes(q)
            );
        }
        return rows;
    }, [allLogs, filterStatus, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE));
    const pageRows   = filtered.slice((page - 1) * LOG_PAGE, page * LOG_PAGE);

    const handleSearch = v => { setSearch(v); setPage(1); };
    const handleFilter = v => { setFilter(v); setPage(1); };

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                    <TrendingUp size={14} className="text-violet-500" />
                </div>
                <h2 className="text-sm font-bold text-zinc-800">Integration Logs</h2>
                <span className="text-[11px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                    {filtered.length} event{filtered.length !== 1 ? "s" : ""}
                </span>

                <div className="ml-auto flex items-center gap-2">
                    {/* Status filter */}
                    <div className="flex gap-1">
                        {["ALL", "SUCCESS", "ERROR", "INFO"].map(s => (
                            <button key={s} onClick={() => handleFilter(s)}
                                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors
                                    ${filterStatus === s
                                        ? "bg-zinc-800 text-white border-zinc-800"
                                        : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input value={search} onChange={e => handleSearch(e.target.value)}
                            placeholder="Search…"
                            className="pl-7 pr-3 py-1.5 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 w-36" />
                    </div>
                </div>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-zinc-300" /></div>
            ) : pageRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-300">
                    <ClipboardList size={28} /><p className="text-sm">No log entries found</p>
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50/30">
                                    <th className="text-left px-5 py-2.5 font-semibold text-zinc-500 w-36">Integration</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 w-40">Action</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 w-24">Status</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 w-36">Time</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">Message</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                                <AnimatePresence mode="popLayout">
                                    {pageRows.map((log, i) => {
                                        const s = LOG_STATUS_STYLE[log.status] || LOG_STATUS_STYLE.INFO;
                                        const platLabel = PLATFORM_LABELS[log.integration?.platform] || log.integration?.platform || "—";
                                        return (
                                            <motion.tr key={log.id}
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                transition={{ delay: i * 0.02 }}
                                                className="hover:bg-zinc-50 transition-colors">
                                                <td className="px-5 py-3 font-semibold text-zinc-700 truncate max-w-[140px]">{platLabel}</td>
                                                <td className="px-4 py-3 text-zinc-600 font-medium">{log.type.replace(/_/g, " ")}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                                                <td className="px-4 py-3 text-zinc-600 truncate max-w-xs">{log.message}</td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile list */}
                    <div className="md:hidden divide-y divide-zinc-100">
                        {pageRows.map(log => {
                            const s = LOG_STATUS_STYLE[log.status] || LOG_STATUS_STYLE.INFO;
                            const platLabel = PLATFORM_LABELS[log.integration?.platform] || "—";
                            return (
                                <div key={log.id} className="px-5 py-3.5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.text}`}>{s.label}</span>
                                        <span className="text-[10px] text-zinc-400">{new Date(log.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs font-semibold text-zinc-700">{platLabel} — {log.type.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{log.message}</p>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 bg-zinc-50/30">
                    <span className="text-[11px] text-zinc-400">Page {page} of {totalPages}</span>
                    <div className="flex gap-1.5">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft size={13} className="text-zinc-600" />
                        </button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <ChevronRight size={13} className="text-zinc-600" />
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntegrationHub() {
    const queryClient = useQueryClient();
    const [configSheet, setConfigSheet] = useState(null);
    const [logsSheet, setLogsSheet]     = useState(null);

    const backendUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace("/api", "")
        : `${window.location.protocol}//${window.location.hostname}:5001`;

    const { data: integrations = [], isLoading } = useQuery({
        queryKey: ["integration-hub"],
        queryFn: () => api.get("/integration-hub").then(r => r.data),
        staleTime: 30000,
    });

    const { data: gcal } = useQuery({
        queryKey: ["gcal-status"],
        queryFn: () => api.get("/google/calendar/status").then(r => r.data),
        staleTime: 30000,
        retry: false,
    });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
        queryClient.invalidateQueries({ queryKey: ["integration-all-logs"] });
        queryClient.invalidateQueries({ queryKey: ["gcal-status"] });
    };

    const byKey = Object.fromEntries(integrations.map(i => [i.platform, i]));
    byKey.google_calendar = {
        platform: "google_calendar",
        status: gcal?.connected ? "CONNECTED" : "DISCONNECTED",
        lastSynced: gcal?.connectedAt || null,
        metadata: {},
    };

    const { pending: oauthPending, open: openOAuth } = useOAuthPopup(() => {
        toast.success("Connected successfully");
        refresh();
    });

    const alwaysConnectedKeys = new Set(PROVIDERS.filter(p => p.alwaysConnected).map(p => p.key));
    const connectedCount = integrations.filter(i => i.status === "CONNECTED" && !alwaysConnectedKeys.has(i.platform)).length
        + PROVIDERS.filter(p => p.alwaysConnected).length;

    const handleConnect = async (p) => {
        if (!p.oauth) { setConfigSheet(p.key); return; }
        try {
            const startPath = p.endpoints?.oauthStart || `/integration-hub/${p.key}/oauth/start`;
            const res = await api.get(startPath);
            openOAuth(res.data.authUrl || res.data.url);
        } catch (err) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to start OAuth");
        }
    };

    const handleSync = async (key) => {
        try {
            const res = await api.post(`/integration-hub/${key}/sync`);
            toast.success(`Synced ${res.data.synced ?? 0} records`);
            refresh();
        } catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Sync failed"); }
    };

    const handleDisconnect = async (key) => {
        try {
            const prov = PROVIDERS.find(p => p.key === key);
            if (prov?.endpoints?.disconnect) {
                await api.post(prov.endpoints.disconnect);
            } else {
                await api.delete(`/integration-hub/${key}/disconnect`);
            }
            toast.success("Disconnected");
            refresh();
        } catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to disconnect"); }
    };

    const scrollToCard = (platform) => {
        document.getElementById(`card-${platform}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const activeProvider = PROVIDERS.find(p => p.key === configSheet);

    return (
        <div className="min-h-full bg-gradient-to-br from-violet-50/30 via-white to-white">
            {/* Sticky header */}
            <div className="px-6 pt-7 pb-5 border-b border-zinc-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}>
                            <Zap size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-zinc-900 leading-none">Integration Hub</h1>
                            <p className="text-xs text-zinc-400 mt-0.5">Connect your tools — no code required</p>
                        </div>
                    </div>

                    {/* Progress ring */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                            <p className="text-xl font-extrabold text-zinc-900 leading-none">
                                {connectedCount}<span className="text-base font-medium text-zinc-400">/{PROVIDERS.length}</span>
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium">connected</p>
                        </div>
                        <svg className="w-11 h-11 -rotate-90 shrink-0" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#f4f4f5" strokeWidth="3.5" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="3.5"
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
                            <button key={p.key} onClick={() => scrollToCard(p.key)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors
                                    ${s === "CONNECTED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                      s === "ERROR" ? "bg-red-50 text-red-600 border-red-200" :
                                      "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s === "CONNECTED" ? "bg-emerald-500" : s === "ERROR" ? "bg-red-500 animate-pulse" : "bg-zinc-300"}`} />
                                {p.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => <div key={i} className="h-64 bg-zinc-100 rounded-2xl animate-pulse" />)}
                    </div>
                ) : (
                    <>
                        {/* Stats bar */}
                        <StatsBar integrations={integrations} />

                        {/* Connection health alerts */}
                        <ConnectionHealth integrations={integrations} onScrollToCard={scrollToCard} />

                        {/* Integration cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                            {PROVIDERS.map((p, i) => (
                                <div key={p.key} id={`card-${p.key}`}>
                                    <Card
                                        p={p}
                                        integration={byKey[p.key]}
                                        cardIndex={i}
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
                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-zinc-200" />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Coming Soon</span>
                                <div className="h-px flex-1 bg-zinc-200" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {COMING_SOON.map((c, i) => (
                                    <motion.div key={c.name}
                                        initial={{ opacity: 0 }} animate={{ opacity: 0.5 }}
                                        transition={{ delay: 0.6 + i * 0.05 }}
                                        className="bg-white/50 rounded-2xl border border-dashed border-zinc-200 overflow-hidden">
                                        <div className={`h-0.5 bg-gradient-to-r ${c.grad}`} />
                                        <div className="p-4 flex items-center gap-3">
                                            <c.Icon s={22} />
                                            <div>
                                                <p className="text-sm font-bold text-zinc-700">{c.name}</p>
                                                <span className="text-[10px] text-zinc-400 font-medium">Coming soon</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* All logs table */}
                        <AllLogsTable />
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
            <AnimatePresence>
                {oauthPending && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
                            <Loader2 size={28} className="animate-spin text-violet-500" />
                            <p className="text-sm font-semibold text-zinc-700">Waiting for authorization…</p>
                            <p className="text-xs text-zinc-400">Complete the connection in the popup window</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
