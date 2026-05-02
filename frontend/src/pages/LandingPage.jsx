import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
    AlertCircle, Clock, EyeOff, TrendingDown, Brain, Bot, TrendingUp,
    CheckCircle2, XCircle, Users, Building2, Rocket, Phone, MessageSquare,
    Link2, Store, Home, GraduationCap, Briefcase, HeartPulse, BookOpen,
    Wrench, BarChart2, Target, ClipboardList, Mail, MessageCircle,
    ArrowRight, Check, X, Zap, Shield, Mic, PhoneCall, Bell, Trophy,
    Activity, LineChart, FileText, Star, Layers, Settings2, Globe,
    ChevronDown, ChevronUp, Menu, CalendarCheck, Loader2, Sparkles,
} from "lucide-react";
import { FaWhatsapp, FaLinkedin, FaFacebook, FaGoogle } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Components
// ─────────────────────────────────────────────────────────────────────────────

const Badge = ({ children, variant = "teal" }) => {
    const styles = {
        teal: "bg-teal-50 text-teal-700 border border-teal-200",
        navy: "bg-indigo-50 text-indigo-700 border border-indigo-200",
        white: "bg-white/10 text-white/90 border border-white/20",
    };
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-widest ${styles[variant]}`}>
            {children}
        </span>
    );
};

const SectionHeader = ({ badge, title, subtitle, light = false }) => (
    <div className="text-center mb-14">
        {badge && <Badge variant={light ? "white" : "teal"}>{badge}</Badge>}
        <h2 className={`mt-4 text-3xl sm:text-4xl font-extrabold leading-tight ${light ? "text-white" : "text-[#1e2d6b]"}`}>
            {title}
        </h2>
        {subtitle && (
            <p className={`mt-4 text-base sm:text-lg max-w-2xl mx-auto ${light ? "text-white/70" : "text-gray-500"}`}>
                {subtitle}
            </p>
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Book Demo Modal
// ─────────────────────────────────────────────────────────────────────────────

function BookDemoModal({ onClose }) {
    const [form, setForm] = useState({ companyName: "", email: "", phone: "", date: "", time: "" });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const today = new Date().toISOString().split("T")[0];

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await axios.post(`${API_BASE}/api/demo-booking`, form);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#1e2d6b] to-[#0d9488] px-7 py-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-extrabold text-white">Book Your Free Demo</h2>
                            <p className="text-teal-200 text-sm mt-1 flex items-center gap-1.5">
                                <CalendarCheck size={13} /> 45-minute personalised walkthrough
                            </p>
                        </div>
                        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors mt-0.5">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-7 py-6">
                    {success ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 size={32} className="text-green-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Demo Booked!</h3>
                            <p className="text-gray-500 text-sm mb-1">A confirmation email with calendar invite has been sent.</p>
                            <p className="text-gray-400 text-xs mb-6">Our team will confirm the details shortly.</p>
                            <button onClick={onClose} className="bg-[#1e2d6b] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#162356] transition-colors text-sm">
                                Close
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={15} /> {error}
                                </div>
                            )}
                            {[
                                { label: "Company Name", name: "companyName", type: "text", placeholder: "Your Company Ltd." },
                                { label: "Business Email", name: "email", type: "email", placeholder: "you@company.com" },
                                { label: "Phone Number", name: "phone", type: "tel", placeholder: "+91 9XXXXXXXXX" },
                            ].map(({ label, name, type, placeholder }) => (
                                <div key={name}>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label} *</label>
                                    <input
                                        type={type} name={name} value={form[name]} onChange={handleChange} required
                                        placeholder={placeholder}
                                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-50 placeholder:text-gray-400"
                                    />
                                </div>
                            ))}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "Preferred Date", name: "date", type: "date", extra: { min: today } },
                                    { label: "Preferred Time", name: "time", type: "time" },
                                ].map(({ label, name, type, extra = {} }) => (
                                    <div key={name}>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label} *</label>
                                        <input
                                            type={type} name={name} value={form[name]} onChange={handleChange} required {...extra}
                                            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-50"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <CalendarCheck size={12} /> A calendar invite will be sent to your email automatically.
                            </p>
                            <button
                                type="submit" disabled={loading}
                                className="w-full bg-gradient-to-r from-[#1e2d6b] to-[#0d9488] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                            >
                                {loading ? <><Loader2 size={15} className="animate-spin" /> Booking...</> : "Book My Free Demo"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Landing Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
    const navigate = useNavigate();
    const [showDemo, setShowDemo] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const openDemo = () => { setShowDemo(true); setMobileMenuOpen(false); };

    return (
        <div className="min-h-screen font-sans text-gray-900 bg-white antialiased">
            {showDemo && <BookDemoModal onClose={() => setShowDemo(false)} />}

            {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
            <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2.5">
                            <img src="/DCODE.PNG" alt="D-CRM" className="h-9 w-9 object-contain" />
                            <span className="font-extrabold text-lg text-[#1e2d6b]">D-CRM <span className="text-teal-500">CRM</span></span>
                        </div>

                        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500">
                            {["features", "pricing", "usecases", "contact"].map(s => (
                                <a key={s} href={`#${s}`} className="hover:text-[#1e2d6b] transition-colors capitalize">{s === "usecases" ? "Use Cases" : s}</a>
                            ))}
                        </div>

                        <div className="hidden md:flex items-center gap-3">
                            <button onClick={openDemo} className="border border-teal-500 text-teal-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-teal-50 transition-colors">
                                Book Demo
                            </button>
                            <button onClick={() => navigate("/login")} className="bg-[#1e2d6b] text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#162356] transition-colors">
                                Sign In
                            </button>
                        </div>

                        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            {mobileMenuOpen ? <X size={22} className="text-gray-600" /> : <Menu size={22} className="text-gray-600" />}
                        </button>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden pb-4 border-t border-gray-100 pt-3 space-y-1">
                            {["features", "pricing", "usecases", "contact"].map(s => (
                                <a key={s} href={`#${s}`} onClick={() => setMobileMenuOpen(false)}
                                    className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#1e2d6b] rounded-lg hover:bg-gray-50 capitalize">
                                    {s === "usecases" ? "Use Cases" : s}
                                </a>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <button onClick={openDemo} className="flex-1 border border-teal-500 text-teal-600 font-semibold py-2 rounded-lg text-sm">Book Demo</button>
                                <button onClick={() => navigate("/login")} className="flex-1 bg-[#1e2d6b] text-white font-semibold py-2 rounded-lg text-sm">Sign In</button>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* ── HERO ───────────────────────────────────────────────────────── */}
            <section className="relative bg-gradient-to-br from-[#0d1a4a] via-[#1e2d6b] to-[#0d4a4a] text-white overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-10 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
                </div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">
                    <div className="flex items-center justify-center gap-3 mb-7">
                        <span className="inline-flex items-center gap-1.5 bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
                            <Sparkles size={11} /> AI Sales Engine
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
                            <Shield size={11} /> Enterprise-Grade
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
                        From Leads to Revenue –<br />
                        <span className="text-teal-400">Fully Automated with AI</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10">
                        The AI-Powered Sales Operating System built for businesses that refuse to leave growth to chance.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={openDemo}
                            className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl shadow-teal-500/20 transition-all transform hover:scale-105">
                            <CalendarCheck size={18} /> Book Free Demo
                        </button>
                        <button onClick={() => navigate("/login")}
                            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold px-8 py-4 rounded-xl text-base backdrop-blur transition-all">
                            Sign In <ArrowRight size={17} />
                        </button>
                    </div>

                    <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
                        {[
                            { n: "3×", l: "Conversion Uplift" },
                            { n: "70%", l: "Less Manual Work" },
                            { n: "30s", l: "Lead Response Time" },
                            { n: "24/7", l: "Automated Engagement" },
                        ].map(({ n, l }) => (
                            <div key={n} className="text-center">
                                <div className="text-3xl font-extrabold text-teal-400">{n}</div>
                                <div className="text-white/55 text-sm mt-1">{l}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PROBLEM ────────────────────────────────────────────────────── */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="The Reality"
                        title="Your Sales Team Is Fighting a Losing Battle"
                        subtitle="Most businesses haemorrhage revenue every day — not because of bad products, but because of broken sales processes."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { Icon: AlertCircle, title: "Lead Leakage", desc: "Up to 80% of leads never receive a timely follow-up, vanishing before a conversation even begins.", color: "text-red-500", bg: "bg-red-50" },
                            { Icon: Clock, title: "Manual Follow-Ups", desc: "Sales reps waste hours on repetitive tasks instead of closing deals and building relationships.", color: "text-amber-500", bg: "bg-amber-50" },
                            { Icon: EyeOff, title: "Zero Visibility", desc: "Managers operate blind — no real-time data on pipeline health, team performance, or lead status.", color: "text-purple-500", bg: "bg-purple-50" },
                            { Icon: TrendingDown, title: "Poor Conversions", desc: "Low conversion rates persist because there's no intelligence guiding who to call, when, and how.", color: "text-blue-500", bg: "bg-blue-50" },
                        ].map(({ Icon, title, desc, color, bg }) => (
                            <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon size={22} className={color} />
                                </div>
                                <h3 className="font-bold text-[#1e2d6b] mb-2">{title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── MARKET GAP ─────────────────────────────────────────────────── */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Market Gap"
                        title="Why Traditional CRMs Are Failing You"
                    />
                    <div className="grid md:grid-cols-2 gap-10 items-center">
                        <div className="bg-[#1e2d6b] rounded-2xl p-8 text-white">
                            <h3 className="font-bold text-lg mb-5 flex items-center gap-2">
                                <XCircle size={20} className="text-red-400" /> What Old CRMs Do
                            </h3>
                            <ul className="space-y-3 text-white/75 text-sm">
                                {[
                                    "Store contact data passively",
                                    "Require 100% manual input",
                                    "Generate static, stale reports",
                                    "Offer zero predictive intelligence",
                                    "Burden teams with admin overhead",
                                ].map(i => (
                                    <li key={i} className="flex items-center gap-2.5">
                                        <X size={14} className="text-red-400 flex-shrink-0" /> {i}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-[#1e2d6b] mb-4">The Uncomfortable Truth</h3>
                            <p className="text-gray-500 mb-4 leading-relaxed">
                                Traditional CRMs were designed as <strong className="text-gray-700">digital filing cabinets</strong>, not revenue engines. They record what happened — they never tell you what to do next. In a world where buyers expect instant, personalised engagement, a passive database is a liability, not an asset.
                            </p>
                            <p className="text-gray-500 leading-relaxed">
                                The gap between <strong className="text-gray-700">data storage and intelligent action</strong> is costing businesses crores in missed opportunity every year.
                            </p>
                            <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                                <p className="text-teal-800 text-sm font-medium">D-CRM bridges this gap — turning your CRM from a passive record into an active revenue driver.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SOLUTION ───────────────────────────────────────────────────── */}
            <section className="py-24 bg-gradient-to-br from-[#f0fdf4] to-[#eff6ff]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <SectionHeader
                        badge="The Solution"
                        title={<>Not Just a CRM.<br />An AI Sales Engine.</>}
                        subtitle="D-CRM is purpose-built to think, act, and convert — transforming your entire sales pipeline from a manual, chaotic process into a fully automated, intelligence-driven revenue machine."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                        {[
                            { Icon: Brain, title: "AI-Driven Intelligence", desc: "Every lead is scored, prioritised, and engaged using machine learning — no human guesswork required.", color: "text-purple-600", bg: "bg-purple-50" },
                            { Icon: Bot, title: "End-to-End Automation", desc: "From first touch to closed deal, every workflow is automated — calls, WhatsApp, follow-ups, and nurturing.", color: "text-teal-600", bg: "bg-teal-50" },
                            { Icon: LineChart, title: "Revenue Visibility", desc: "Real-time dashboards and AI analytics give leaders complete pipeline visibility and actionable insights.", color: "text-blue-600", bg: "bg-blue-50" },
                        ].map(({ Icon, title, desc, color, bg }) => (
                            <div key={title} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left group">
                                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                                    <Icon size={24} className={color} />
                                </div>
                                <h3 className="font-bold text-[#1e2d6b] text-lg mb-2">{title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURES ───────────────────────────────────────────────────── */}
            <section id="features" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Core Features"
                        title="Everything You Need to Win"
                        subtitle="A complete suite of intelligent tools built to capture, qualify, engage, and convert every lead."
                    />

                    {/* Lead Management */}
                    <div className="mb-20 grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <Badge>Core Feature</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">Lead Management — Capture Every Opportunity</h3>
                            <p className="mt-3 text-gray-500 leading-relaxed">
                                Leads arrive from Facebook, Google, your website, landing pages, inbound calls, and more. D-CRM captures every single one instantly into one centralised, prioritised dashboard. No spreadsheets. No manual entry. No leads slipping through.
                            </p>
                            <div className="mt-5 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
                                <strong>Key Advantage:</strong> Multi-source capture API connects to 50+ lead channels with deduplication and instant assignment built in.
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { Icon: Globe, t: "Multi-Source Capture", d: "Facebook, Google, portals, website forms — all unified" },
                                { Icon: Layers, t: "Centralised Dashboard", d: "Single view of all leads, statuses, and history" },
                                { Icon: Activity, t: "Real-Time Tracking", d: "Instant notifications and live lead status updates" },
                                { Icon: Settings2, t: "Auto-Assignment", d: "Smart round-robin or rule-based allocation to reps" },
                            ].map(({ Icon, t, d }) => (
                                <div key={t} className="bg-teal-50 rounded-xl p-4 border border-teal-100 hover:bg-teal-100/70 transition-colors">
                                    <Icon size={18} className="text-teal-600 mb-2" />
                                    <h4 className="font-bold text-[#1e2d6b] text-sm mb-1">{t}</h4>
                                    <p className="text-gray-500 text-xs leading-relaxed">{d}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Lead Qualification */}
                    <div className="mb-20">
                        <div className="text-center mb-10">
                            <Badge>AI Feature</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">Lead Qualification — Stop Chasing the Wrong Leads</h3>
                            <p className="mt-3 text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
                                D-CRM's multi-layer qualification engine automatically filters, scores, and prioritises your leads so your team invests energy where it matters most.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { layer: "Layer 1", Icon: Shield, title: "Initial Filtration", desc: "Removes duplicates and spam automatically before they reach your team.", gradient: "from-blue-500 to-blue-600" },
                                { layer: "Layer 2", Icon: Star, title: "Lead Scoring", desc: "AI assigns a score from 1–100 based on intent signals and behaviour patterns.", gradient: "from-teal-500 to-teal-600" },
                                { layer: "Layer 3", Icon: Zap, title: "Priority Automation", desc: "High-score leads are instantly routed to senior reps with URGENT flags.", gradient: "from-[#1e2d6b] to-[#2a3d8b]" },
                            ].map(({ layer, Icon, title, desc, gradient }) => (
                                <div key={title} className={`bg-gradient-to-br ${gradient} text-white rounded-2xl p-7`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Icon size={18} className="opacity-80" />
                                        <span className="text-xs font-bold opacity-70 uppercase tracking-wider">{layer}</span>
                                    </div>
                                    <h4 className="font-extrabold text-lg mb-2">{title}</h4>
                                    <p className="text-white/75 text-sm leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* WOW Features */}
                    <div className="space-y-12">
                        {/* WOW #1 */}
                        <div className="bg-gradient-to-br from-[#f0fdf4] to-white rounded-3xl p-8 lg:p-10 border border-teal-100">
                            <Badge>WOW Feature #1</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">AI Lead Engagement — Your Sales Engine That Never Sleeps</h3>
                            <p className="mt-3 text-gray-500 text-sm leading-relaxed max-w-2xl">
                                D-CRM's AI Engagement Layer triggers intelligent, personalised outreach the moment a lead enters the system — day or night, weekday or weekend.
                            </p>
                            <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-5">
                                {[
                                    { Icon: PhoneCall, t: "AI-Triggered Calls", d: "Instant automated call attempts within seconds of lead capture — before your competitor even knows the lead exists." },
                                    { Icon: Bell, t: "Automated Nurturing", d: "Multi-touch nurture sequences across calls, WhatsApp, and SMS — tailored to each lead's behaviour and stage." },
                                    { Icon: Zap, t: "Smart Follow-Ups", d: "AI determines the optimal time and channel for every follow-up based on past engagement patterns." },
                                ].map(({ Icon, t, d }) => (
                                    <div key={t} className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm flex flex-col gap-3">
                                        <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
                                            <Icon size={18} className="text-teal-600" />
                                        </div>
                                        <h4 className="font-bold text-[#1e2d6b] text-sm">{t}</h4>
                                        <p className="text-gray-500 text-xs leading-relaxed">{d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* WOW #2 */}
                        <div className="bg-gradient-to-br from-[#eff6ff] to-white rounded-3xl p-8 lg:p-10 border border-blue-100">
                            <Badge variant="navy">WOW Feature #2</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">AI Transcriber — Every Word. Instantly Captured.</h3>
                            <p className="mt-3 text-gray-500 text-sm leading-relaxed max-w-2xl">
                                D-CRM automatically converts every sales call into a searchable, structured text transcript in real time. No manual note-taking. Every conversation becomes a permanent, analysable asset.
                            </p>
                            <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-5">
                                {[
                                    { Icon: Mic, t: "Instant Transcription", d: "Calls are transcribed automatically the moment they end — available for review within seconds." },
                                    { Icon: FileText, t: "Searchable Archives", d: "Search across thousands of calls by keyword, lead name, or topic — find any conversation in under 3 seconds." },
                                    { Icon: BookOpen, t: "Training Intelligence", d: "Use real transcripts to coach underperforming reps and replicate top-performer techniques." },
                                ].map(({ Icon, t, d }) => (
                                    <div key={t} className="bg-white rounded-xl p-5 border border-blue-200 shadow-sm flex flex-col gap-3">
                                        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                                            <Icon size={18} className="text-blue-600" />
                                        </div>
                                        <h4 className="font-bold text-[#1e2d6b] text-sm">{t}</h4>
                                        <p className="text-gray-500 text-xs leading-relaxed">{d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* WOW #3 */}
                        <div className="bg-gradient-to-br from-[#1e2d6b] to-[#0d4a4a] rounded-3xl p-8 lg:p-10 text-white">
                            <Badge variant="white"><Sparkles size={11} /> WOW Feature #3 — The Game Changer</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold">AI Call Analysis — Intelligence That Transforms Sales</h3>
                            <p className="mt-3 text-white/70 text-sm leading-relaxed max-w-2xl">
                                Our proprietary AI Call Analysis engine goes beyond transcription to deliver deep behavioural and intent-based intelligence from every single sales conversation.
                            </p>
                            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {[
                                    { Icon: Target, t: "Customer Intent Detection", d: "AI identifies buying signals, objections, and urgency levels within the conversation — flagging hot prospects automatically." },
                                    { Icon: Activity, t: "Behaviour Insights", d: "Understand sentiment, hesitation patterns, and emotional cues to adapt your sales approach for each lead type." },
                                    { Icon: TrendingUp, t: "Sales Improvement Recs", d: "AI generates personalised coaching recommendations for each rep based on their call patterns and conversion data." },
                                    { Icon: Star, t: "Conversation Scoring", d: "Every call receives an AI quality score — enabling objective, data-driven performance management at scale." },
                                ].map(({ Icon, t, d }) => (
                                    <div key={t} className="bg-white/10 rounded-xl p-5 border border-white/15 flex flex-col gap-3 hover:bg-white/15 transition-colors">
                                        <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                                            <Icon size={18} className="text-teal-300" />
                                        </div>
                                        <h4 className="font-bold text-teal-300 text-sm">{t}</h4>
                                        <p className="text-white/65 text-xs leading-relaxed">{d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* AI Voice Agents */}
                    <div className="mt-16 grid md:grid-cols-2 gap-10 items-start">
                        <div>
                            <Badge>AI Automation</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">AI Voice Agents — Scale Your Outreach Infinitely</h3>
                            <p className="mt-3 text-gray-500 text-sm leading-relaxed">
                                D-CRM's AI Voice Agents are autonomous conversational AI callers that handle initial outreach, qualification calls, and follow-up sequences at a scale no human team can match — running 24/7 without fatigue, sick days, or training costs.
                            </p>
                            <ul className="mt-5 space-y-2.5">
                                {[
                                    "Make hundreds of simultaneous outbound calls",
                                    "Conduct natural, scripted qualification conversations",
                                    "Handle FAQs, objections, and appointment booking",
                                    "Escalate warm leads to human reps automatically",
                                ].map(item => (
                                    <li key={item} className="flex items-center gap-2.5 text-sm text-gray-600">
                                        <Check size={15} className="text-teal-500 flex-shrink-0" /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-[#1e2d6b] rounded-2xl p-7 text-white">
                            <h4 className="font-bold text-lg mb-5 flex items-center gap-2">
                                <TrendingUp size={20} className="text-teal-400" /> The Business Impact
                            </h4>
                            <ul className="space-y-3.5">
                                {[
                                    "10× outreach capacity with zero additional headcount",
                                    "Consistent messaging quality on every single call",
                                    "Instant response to every lead — zero wait time",
                                    "Dramatic reduction in cost per qualified lead",
                                ].map(item => (
                                    <li key={item} className="flex items-start gap-2.5 text-white/75 text-sm">
                                        <ArrowRight size={15} className="text-teal-400 mt-0.5 flex-shrink-0" /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* WhatsApp Chatbot */}
                    <div className="mt-16">
                        <div className="text-center mb-10">
                            <Badge>AI Automation</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">AI WhatsApp Chatbot — Engage Leads Where They Live</h3>
                            <p className="mt-3 text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
                                With over 500 million WhatsApp users in India alone, D-CRM's AI WhatsApp Chatbot delivers instant, intelligent engagement around the clock.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { n: "01", Icon: FaWhatsapp, t: "Instant Response", d: "Lead sends a message → AI responds within 3 seconds, every time, without exception", iconClass: "text-green-500" },
                                { n: "02", Icon: Brain, t: "Smart Qualification", d: "Conversational AI asks the right questions to qualify leads before routing to a human rep", iconClass: "text-teal-600" },
                                { n: "03", Icon: Bell, t: "Continuous Nurturing", d: "Automated drip messages, reminders, and follow-ups keep leads engaged until they're ready to buy", iconClass: "text-blue-600" },
                            ].map(({ n, Icon, t, d, iconClass }) => (
                                <div key={n} className="bg-teal-50 rounded-2xl p-6 border border-teal-100 flex gap-4 hover:shadow-md transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <Icon size={20} className={iconClass} />
                                        </div>
                                        <div className="text-xs font-bold text-teal-400 mt-2 text-center">{n}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#1e2d6b] mb-1.5 text-sm">{t}</h4>
                                        <p className="text-gray-500 text-xs leading-relaxed">{d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── COMMAND CENTRE ─────────────────────────────────────────────── */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Command Centre"
                        title="Total Visibility. Zero Blind Spots."
                        subtitle="The D-CRM Command Dashboard puts your entire sales operation on a single, beautifully designed screen."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { Icon: Layers, t: "Live Pipeline View", d: "Real-time status of all active leads across every stage" },
                            { Icon: Activity, t: "Team Activity Feed", d: "Live log of every call, message, and action taken" },
                            { Icon: Bell, t: "AI Alerts", d: "Proactive nudges for high-priority leads requiring attention" },
                            { Icon: BarChart2, t: "Conversion Metrics", d: "At-a-glance KPIs and trend lines updated in real time" },
                        ].map(({ Icon, t, d }) => (
                            <div key={t} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group">
                                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                                    <Icon size={20} className="text-teal-600" />
                                </div>
                                <h3 className="font-bold text-[#1e2d6b] mb-1.5 text-sm">{t}</h3>
                                <p className="text-gray-500 text-xs leading-relaxed">{d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── HR, ANALYTICS & GAMIFICATION ───────────────────────────────── */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
                    {/* HR + Analytics */}
                    <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div>
                            <Badge>HR & Performance</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">Manage People With the Same Precision as Data</h3>
                            <p className="mt-3 text-gray-500 text-sm leading-relaxed">
                                D-CRM extends beyond sales automation into comprehensive team performance management. Every action taken by every team member is tracked, measured, and analysed.
                            </p>
                            <div className="mt-6 space-y-4">
                                {[
                                    { Icon: Activity, t: "Activity Tracking", d: "Real-time log of calls made, leads contacted, tasks completed, and time spent per rep" },
                                    { Icon: ClipboardList, t: "Performance Scorecards", d: "Automated weekly and monthly scorecards for every team member with trend analysis" },
                                    { Icon: Brain, t: "Coaching Intelligence", d: "AI-generated insights identify which reps need support and what specific improvements will drive results" },
                                ].map(({ Icon, t, d }) => (
                                    <div key={t} className="flex gap-3.5">
                                        <div className="flex-shrink-0 w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center mt-0.5">
                                            <Icon size={15} className="text-teal-600" />
                                        </div>
                                        <div>
                                            <strong className="text-[#1e2d6b] text-sm">{t}</strong>
                                            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Badge>Analytics</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">Reports That Drive Decisions, Not Just Documents</h3>
                            <p className="mt-3 text-gray-500 text-sm leading-relaxed">D-CRM's reporting suite transforms raw sales data into clear, actionable intelligence.</p>
                            <div className="mt-5 grid grid-cols-2 gap-4">
                                {[
                                    { Icon: BarChart2, t: "Real-Time Dashboards", d: "Live metrics — no manual report generation" },
                                    { Icon: Target, t: "Conversion Analytics", d: "Deep-dive by source, rep, campaign, and time period" },
                                    { Icon: TrendingUp, t: "Revenue Forecasting", d: "AI-powered projections with confidence intervals" },
                                    { Icon: FileText, t: "Custom Report Builder", d: "Build board packs and daily huddle reports in minutes" },
                                ].map(({ Icon, t, d }) => (
                                    <div key={t} className="bg-teal-50 rounded-xl p-4 border border-teal-100 hover:bg-teal-100/70 transition-colors">
                                        <Icon size={18} className="text-teal-600 mb-2" />
                                        <h4 className="font-bold text-[#1e2d6b] text-sm">{t}</h4>
                                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">{d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Gamification */}
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="bg-[#1e2d6b] rounded-2xl p-8 text-white">
                            <h3 className="font-bold text-lg mb-5 flex items-center gap-2">
                                <Trophy size={20} className="text-teal-400" /> Gamification Features
                            </h3>
                            <ul className="space-y-3">
                                {[
                                    "Live leaderboards visible to the full team",
                                    "Points, badges, and achievement milestones",
                                    "Weekly and monthly performance challenges",
                                    "Manager-configurable reward triggers",
                                    "Public recognition for top performers",
                                ].map(item => (
                                    <li key={item} className="flex items-center gap-2.5 text-white/75 text-sm">
                                        <Check size={14} className="text-teal-400 flex-shrink-0" /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <Badge>Motivation Engine</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">Leaderboards & Gamification — Fuel Your Team's Competitive Edge</h3>
                            <p className="mt-3 text-gray-500 text-sm leading-relaxed">
                                Sales is a performance sport. When your team can see exactly where they stand relative to their peers in real time, intrinsic motivation skyrockets.
                            </p>
                            <div className="mt-5 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                                <p className="text-teal-800 text-sm">Teams using gamification report <strong>up to 48% higher daily activity rates</strong> and significantly improved morale — without changing headcount.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── TEAM MANAGEMENT ────────────────────────────────────────────── */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <SectionHeader
                        badge="Team Management"
                        title="Built for Teams of Any Size — Scale Without Limits"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                        {[
                            { Icon: Users, t: "Unlimited Users", d: "Add as many sales reps, managers, and admins as your business demands. No per-seat penalties, no hidden charges.", bg: "bg-blue-50", color: "text-blue-600" },
                            { Icon: Building2, t: "Role-Based Hierarchy", d: "Define granular permissions for every role — from field agents to national heads. Everyone sees exactly what they need.", bg: "bg-teal-50", color: "text-teal-600" },
                            { Icon: Rocket, t: "Enterprise Scalability", d: "Whether you have 5 users or 500, D-CRM's architecture performs consistently — fast, reliable, and always available.", bg: "bg-purple-50", color: "text-purple-600" },
                        ].map(({ Icon, t, d, bg, color }) => (
                            <div key={t} className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow group">
                                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                                    <Icon size={24} className={color} />
                                </div>
                                <h3 className="font-bold text-[#1e2d6b] mb-2">{t}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── INTEGRATIONS ───────────────────────────────────────────────── */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Ecosystem"
                        title="Plug D-CRM Into Your Existing Stack — Seamlessly"
                        subtitle="D-CRM is built to integrate, not replace. Our open API architecture connects with the tools your business already relies on."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { Icon: Phone, t: "Telephony Integrations", d: "Connects with all major VoIP providers, IVR systems, and cloud telephony platforms.", bg: "bg-blue-50", color: "text-blue-600" },
                            { Icon: FaWhatsapp, t: "WhatsApp Business API", d: "Official WhatsApp Business API integration — compliant, scalable, and ready for high-volume messaging.", bg: "bg-green-50", color: "text-green-600" },
                            { Icon: Link2, t: "Open API & Webhooks", d: "Connect D-CRM to your ERP, marketing automation, or any custom internal tool via robust REST APIs.", bg: "bg-teal-50", color: "text-teal-600" },
                            { Icon: Store, t: "Lead Portals", d: "Native connectors for 99acres, MagicBricks, JustDial, Sulekha, Facebook Lead Ads, and Google Ads.", bg: "bg-orange-50", color: "text-orange-600" },
                        ].map(({ Icon, t, d, bg, color }) => (
                            <div key={t} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow group">
                                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon size={22} className={color} />
                                </div>
                                <h3 className="font-bold text-[#1e2d6b] mb-2 text-sm">{t}</h3>
                                <p className="text-gray-500 text-xs leading-relaxed">{d}</p>
                            </div>
                        ))}
                    </div>

                    {/* Integration logos row */}
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-50">
                        {[
                            { Icon: FaFacebook, label: "Facebook", color: "text-blue-600" },
                            { Icon: FaGoogle, label: "Google Ads", color: "text-red-500" },
                            { Icon: FaWhatsapp, label: "WhatsApp", color: "text-green-500" },
                            { Icon: FaLinkedin, label: "LinkedIn", color: "text-blue-700" },
                            { Icon: Phone, label: "Telephony", color: "text-gray-600" },
                        ].map(({ Icon, label, color }) => (
                            <div key={label} className="flex flex-col items-center gap-1.5">
                                <Icon size={28} className={color} />
                                <span className="text-xs text-gray-400 font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── BEFORE & AFTER ─────────────────────────────────────────────── */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <SectionHeader
                        badge="Transformation"
                        title="Before & After D-CRM"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl p-8 border-2 border-red-100 text-left">
                            <div className="flex items-center gap-2 mb-5">
                                <XCircle size={20} className="text-red-500" />
                                <h3 className="font-extrabold text-lg text-red-600">BEFORE D-CRM</h3>
                            </div>
                            <ul className="space-y-3 text-sm">
                                {["Leads lost in spreadsheets", "Slow, manual calls", "No automated follow-up system", "5–8% conversion rate"].map(i => (
                                    <li key={i} className="flex items-center gap-2.5 text-gray-600">
                                        <X size={14} className="text-red-400 flex-shrink-0" /> {i}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-gradient-to-br from-[#1e2d6b] to-[#0d9488] rounded-2xl p-8 text-white text-left">
                            <div className="flex items-center gap-2 mb-5">
                                <CheckCircle2 size={20} className="text-teal-300" />
                                <h3 className="font-extrabold text-lg">AFTER D-CRM</h3>
                            </div>
                            <ul className="space-y-3 text-sm">
                                {["Auto-captured leads instantly", "AI calls within 30 seconds", "Fully automated follow-ups", "18–25% conversion rate"].map(i => (
                                    <li key={i} className="flex items-center gap-2.5 text-white/85">
                                        <Check size={14} className="text-teal-300 flex-shrink-0" /> {i}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <p className="mt-6 text-gray-500 text-sm">The difference between these two realities isn't budget or headcount. <strong className="text-teal-600">It's D-CRM.</strong></p>
                </div>
            </section>

            {/* ── COMPETITIVE EDGE ───────────────────────────────────────────── */}
            <section className="py-24 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Competitive Edge"
                        title="D-CRM vs Traditional CRM"
                        subtitle="There is simply no comparison."
                    />
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left px-6 py-4 font-semibold text-gray-500 w-2/5">Capability</th>
                                    <th className="text-center px-6 py-4 font-semibold text-gray-400">Traditional CRM</th>
                                    <th className="text-center px-6 py-4 font-bold text-[#1e2d6b]">D-CRM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ["Lead Response Time", "Hours to days", "Under 30 seconds"],
                                    ["Follow-Up Automation", "Manual reminders only", "Full AI-driven sequences"],
                                    ["Lead Qualification", "None", "Multi-layer AI scoring"],
                                    ["Call Analysis", "Not available", "AI intent + sentiment"],
                                    ["Voice AI Agents", "Not available", "Fully autonomous callers"],
                                    ["WhatsApp Chatbot", "Not available", "Official API integrated"],
                                    ["Performance Coaching", "Manager-dependent", "AI-generated recommendations"],
                                    ["24/7 Operation", "No", "Always on"],
                                ].map(([cap, old, neo], i) => (
                                    <tr key={cap} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                                        <td className="px-6 py-3.5 font-medium text-gray-700 text-sm">{cap}</td>
                                        <td className="px-6 py-3.5 text-center text-gray-400 text-sm">{old}</td>
                                        <td className="px-6 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1.5 text-teal-700 font-semibold text-sm bg-teal-50 px-2.5 py-1 rounded-full">
                                                <Check size={12} /> {neo}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ── USE CASES ──────────────────────────────────────────────────── */}
            <section id="usecases" className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Use Cases"
                        title="Built for Businesses That Mean Business"
                        subtitle="D-CRM adapts to your industry — with proven workflows for every sales context."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { Icon: Home, t: "Real Estate", d: "AI qualifies intent, filters serious buyers, and auto-books site visits — dramatically reducing wasted costs.", bg: "bg-orange-50", color: "text-orange-600" },
                            { Icon: GraduationCap, t: "EdTech & Coaching", d: "AI nurtures interested students until enrolment — automating counselling touchpoints at massive scale.", bg: "bg-blue-50", color: "text-blue-600" },
                            { Icon: Briefcase, t: "Agencies & Consultancies", d: "D-CRM manages your inbound pipeline, nurtures warm prospects, and books discovery calls — without human intervention.", bg: "bg-purple-50", color: "text-purple-600" },
                            { Icon: HeartPulse, t: "Service Businesses", d: "Streamlines complex multi-touch sales cycles and keeps high-value prospects engaged through extended decision timelines.", bg: "bg-red-50", color: "text-red-600" },
                        ].map(({ Icon, t, d, bg, color }) => (
                            <div key={t} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group text-left">
                                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon size={24} className={color} />
                                </div>
                                <h3 className="font-bold text-[#1e2d6b] mb-2">{t}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PRICING ────────────────────────────────────────────────────── */}
            <section id="pricing" className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeader
                        badge="Pricing"
                        title="Simple, Transparent Pricing"
                        subtitle="Pay per user, per month. No setup fees. No long-term contracts. Scale as you grow."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                        {[
                            {
                                users: 1, price: 999, popular: false,
                                features: ["Full CRM dashboard", "Lead capture & tracking", "Task & activity management", "Basic analytics", "Email support"],
                            },
                            {
                                users: 3, price: 2499, popular: false,
                                features: ["Everything in 1-user plan", "Team collaboration tools", "AI lead scoring", "WhatsApp integration", "Priority email support"],
                            },
                            {
                                users: 5, price: 4499, popular: true,
                                features: ["Everything in 3-user plan", "AI Voice Agents", "AI Call Transcription", "Advanced analytics", "Dedicated onboarding"],
                            },
                            {
                                users: 10, price: 7999, popular: false,
                                features: ["Everything in 5-user plan", "AI Call Analysis", "Custom integrations", "Performance gamification", "Priority support + SLA"],
                            },
                        ].map(({ users, price, popular, features }) => (
                            <div key={users} className={`relative rounded-2xl p-7 flex flex-col ${popular
                                ? "bg-gradient-to-br from-[#1e2d6b] to-[#0d4a4a] text-white border-2 border-teal-400 shadow-xl shadow-teal-500/15"
                                : "bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                            }`}>
                                {popular && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-5">
                                    <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${popular ? "text-teal-300" : "text-teal-600"}`}>
                                        {users} User{users > 1 ? "s" : ""}
                                    </div>
                                    <div className={`text-3xl font-extrabold ${popular ? "text-white" : "text-[#1e2d6b]"}`}>
                                        ₹{price.toLocaleString("en-IN")}
                                    </div>
                                    <div className={`text-xs mt-1 ${popular ? "text-teal-200" : "text-gray-400"}`}>
                                        per month + GST
                                    </div>
                                </div>

                                <ul className="space-y-2.5 flex-1 mb-7">
                                    {features.map(f => (
                                        <li key={f} className={`flex items-start gap-2 text-xs ${popular ? "text-white/80" : "text-gray-600"}`}>
                                            <Check size={13} className={`flex-shrink-0 mt-0.5 ${popular ? "text-teal-300" : "text-teal-500"}`} /> {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={openDemo}
                                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${popular
                                        ? "bg-teal-500 hover:bg-teal-400 text-white"
                                        : "border-2 border-[#1e2d6b] text-[#1e2d6b] hover:bg-[#1e2d6b] hover:text-white"
                                    }`}>
                                    Get Started
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Enterprise / More Users CTA */}
                    <div className="rounded-2xl bg-gradient-to-r from-gray-50 to-teal-50 border border-teal-200 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl border border-teal-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <Users size={22} className="text-teal-600" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-[#1e2d6b] text-lg">Need More Than 10 Users?</h3>
                                <p className="text-gray-500 text-sm mt-1 max-w-md">We offer custom enterprise plans with volume discounts, dedicated account management, and white-glove onboarding. Let's build the right plan for your team.</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                            <button onClick={openDemo} className="inline-flex items-center justify-center gap-2 bg-[#1e2d6b] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#162356] transition-colors text-sm whitespace-nowrap">
                                <CalendarCheck size={15} /> Book a Demo
                            </button>
                            <a href="mailto:dcodetechnologiesai@gmail.com" className="inline-flex items-center justify-center gap-2 border-2 border-[#1e2d6b] text-[#1e2d6b] font-bold px-6 py-3 rounded-xl hover:bg-[#1e2d6b] hover:text-white transition-colors text-sm whitespace-nowrap">
                                <Mail size={15} /> Contact Sales
                            </a>
                        </div>
                    </div>

                    {/* ROI */}
                    <div className="mt-16">
                        <div className="text-center mb-10">
                            <Badge>Return on Investment</Badge>
                            <h3 className="mt-4 text-2xl font-extrabold text-[#1e2d6b]">One Conversion Pays for the Entire System</h3>
                            <p className="mt-3 text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">The economics of D-CRM are strikingly simple. A single additional conversion — made possible by faster AI engagement — covers the entire cost.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { Icon: Home, t: "Real Estate Example", d: "1 extra deal closed via AI engagement = ₹1.5L commission. D-CRM plan = fraction of that.", highlight: "Breakeven: Deal #1." },
                                { Icon: GraduationCap, t: "EdTech Example", d: "3 extra enrolments via AI nurturing = ₹1.5L revenue. D-CRM cost = minimal subscription.", highlight: "Breakeven: 3 Students." },
                                { Icon: TrendingUp, t: "Every Deal After That", d: "Pure profit driven by automation — with zero increase in headcount or marketing spend required.", highlight: "100% ROI." },
                            ].map(({ Icon, t, d, highlight }) => (
                                <div key={t} className="bg-teal-50 border border-teal-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                                        <Icon size={20} className="text-teal-700" />
                                    </div>
                                    <h4 className="font-bold text-[#1e2d6b] mb-2 text-sm">{t}</h4>
                                    <p className="text-gray-500 text-xs mb-3 leading-relaxed">{d}</p>
                                    <p className="font-bold text-teal-700 text-sm">{highlight}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── WHY NOW ────────────────────────────────────────────────────── */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <SectionHeader
                        badge="Why Now"
                        title="The AI Revolution in Sales Is Happening — With or Without You"
                        subtitle="We are in the most significant technological shift in the history of sales. AI is not a future concept — it is being deployed by your competitors right now."
                    />
                    <div className="space-y-3 text-left">
                        {[
                            { yr: "2020–2022", desc: "Early adopters test AI sales tools — modest automation, significant advantage", highlight: false },
                            { yr: "2023–2024", desc: "AI becomes mainstream in enterprise sales — SMBs begin to fall behind rapidly", highlight: false },
                            { yr: "2025 — Now", desc: "Full AI automation is table stakes — businesses without it face structural disadvantage", highlight: true },
                            { yr: "2026+", desc: "AI-first companies dominate their categories — the gap becomes insurmountable for laggards", highlight: false },
                        ].map(({ yr, desc, highlight }) => (
                            <div key={yr} className={`flex items-start gap-4 p-4 rounded-xl border ${highlight ? "bg-[#1e2d6b] border-[#1e2d6b] text-white" : "bg-white border-gray-200"}`}>
                                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${highlight ? "bg-teal-400" : "bg-teal-100"}`}>
                                    <div className={`w-2 h-2 rounded-full ${highlight ? "bg-[#1e2d6b]" : "bg-teal-600"}`} />
                                </div>
                                <div>
                                    <div className={`font-bold text-sm ${highlight ? "text-teal-300" : "text-[#1e2d6b]"}`}>{yr}</div>
                                    <div className={`text-sm mt-0.5 ${highlight ? "text-white/80" : "text-gray-500"}`}>{desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────────────────── */}
            <section className="py-28 bg-gradient-to-br from-[#0d1a4a] via-[#1e2d6b] to-[#0d4a4a] text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-10 left-20 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-20 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
                </div>
                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">Let's Automate Your Sales Today</h2>
                    <p className="text-white/65 text-lg mb-3">You've seen the problem. You've seen the solution. You've seen the ROI.</p>
                    <p className="text-white/55 text-sm mb-12">The only question left is: <strong className="text-white">how much revenue are you willing to leave on the table while you wait?</strong></p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 max-w-2xl mx-auto">
                        {[
                            { Icon: Rocket, t: "Quick Deploy", d: "Live in 7 days or less" },
                            { Icon: BookOpen, t: "Full Training", d: "Team onboarding included" },
                            { Icon: Wrench, t: "Dedicated Support", d: "Priority access to our team" },
                            { Icon: TrendingUp, t: "ROI Guarantee", d: "Results or we make it right" },
                        ].map(({ Icon, t, d }) => (
                            <div key={t} className="bg-white/10 border border-white/15 rounded-xl p-4 hover:bg-white/15 transition-colors">
                                <Icon size={22} className="text-teal-400 mb-2 mx-auto" />
                                <div className="font-bold text-sm">{t}</div>
                                <div className="text-white/55 text-xs mt-1">{d}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={openDemo}
                            className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-10 py-4 rounded-xl text-base shadow-xl shadow-teal-500/20 transition-all transform hover:scale-105">
                            <CalendarCheck size={18} /> Book Free Demo
                        </button>
                        <button onClick={() => navigate("/login")}
                            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold px-10 py-4 rounded-xl text-base backdrop-blur transition-all">
                            Sign In <ArrowRight size={17} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────────────── */}
            <footer id="contact" className="bg-[#0d1a4a] text-white py-14">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
                        <div>
                            <div className="flex items-center gap-2.5 mb-3">
                                <img src="/DCODE.PNG" alt="D-CRM" className="h-8 w-8 object-contain" />
                                <span className="font-extrabold text-lg">D-CRM <span className="text-teal-400">CRM</span></span>
                            </div>
                            <p className="text-white/50 text-sm leading-relaxed">The AI-Powered Sales Operating System built for businesses that refuse to leave growth to chance.</p>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4 text-teal-400 text-sm uppercase tracking-wide">Get Started</h4>
                            <div className="space-y-2.5">
                                <button onClick={openDemo} className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
                                    <CalendarCheck size={14} /> Book a Free Demo
                                </button>
                                <button onClick={() => navigate("/login")} className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
                                    <ArrowRight size={14} /> Sign In to Dashboard
                                </button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4 text-teal-400 text-sm uppercase tracking-wide">Contact Us</h4>
                            <div className="space-y-3">
                                <a href="mailto:dcodetechnologiesai@gmail.com" className="flex items-center gap-2.5 text-white/60 hover:text-white text-sm transition-colors">
                                    <Mail size={14} /> dcodetechnologiesai@gmail.com
                                </a>
                                <a href="tel:+919003103018" className="flex items-center gap-2.5 text-white/60 hover:text-white text-sm transition-colors">
                                    <Phone size={14} /> +91 9003103018
                                </a>
                                <a href="https://wa.me/919003103018" className="flex items-center gap-2.5 text-white/60 hover:text-white text-sm transition-colors">
                                    <FaWhatsapp size={14} /> WhatsApp: +91 9003103018
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-white/35 text-xs">© {new Date().getFullYear()} D-CRM by DCODE Technologies. All rights reserved.</p>
                        <div className="flex items-center gap-4 text-white/30">
                            <FaLinkedin size={16} className="hover:text-white/60 cursor-pointer transition-colors" />
                            <FaFacebook size={16} className="hover:text-white/60 cursor-pointer transition-colors" />
                            <FaWhatsapp size={16} className="hover:text-white/60 cursor-pointer transition-colors" />
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
