import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
    TrendingUp, Bot, Inbox, Users, Mail, MessageSquare, BarChart2,
    Shield, Zap, ArrowRight, Check, X, AlertCircle, CheckCircle2,
    CalendarCheck, Loader2, Menu, ChevronRight,
    Activity, Bell, Target, Layers,
} from "lucide-react";
import { FaWhatsapp, FaLinkedin } from "react-icons/fa";
import useInView from "../hooks/useInView";
import useCountUp from "../hooks/useCountUp";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

const fadeIn = (visible, delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(16px)",
    transition: `all 0.5s ease ${delay}s`,
});

// ─── Book Demo Modal ──────────────────────────────────────────────────────────

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900">Book a free demo</h2>
                        <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                            <CalendarCheck size={12} /> 45-minute personalised walkthrough
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="px-7 py-6">
                    {success ? (
                        <div className="text-center py-6">
                            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 size={28} className="text-green-500" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Demo booked!</h3>
                            <p className="text-sm text-zinc-500 mb-6">We'll send a calendar invite shortly.</p>
                            <button onClick={onClose}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors">
                                Close
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={14} /> {error}
                                </div>
                            )}
                            {[
                                { label: "Company name", name: "companyName", type: "text", placeholder: "Acme Corp" },
                                { label: "Business email", name: "email", type: "email", placeholder: "you@company.com" },
                                { label: "Phone number", name: "phone", type: "tel", placeholder: "+91 9XXXXXXXXX" },
                            ].map(({ label, name, type, placeholder }) => (
                                <div key={name}>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{label} *</label>
                                    <input
                                        type={type} name={name} required placeholder={placeholder}
                                        value={form[name]} onChange={handleChange}
                                        className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                                    />
                                </div>
                            ))}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "Preferred date", name: "date", type: "date" },
                                    { label: "Preferred time", name: "time", type: "time" },
                                ].map(({ label, name, type }) => (
                                    <div key={name}>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{label}</label>
                                        <input
                                            type={type} name={name} min={type === "date" ? today : undefined}
                                            value={form[name]} onChange={handleChange}
                                            className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all mt-1 disabled:opacity-60"
                                style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 4px 14px rgba(249,115,22,0.3)" }}>
                                {loading ? <><Loader2 size={15} className="animate-spin" /> Booking…</> : "Book demo"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ onDemo }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => {
            const next = window.scrollY > 20;
            setScrolled(prev => prev === next ? prev : next);
        };
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    return (
        <header className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur shadow-sm border-b border-zinc-100" : "bg-transparent"}`}>
            <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <img src="/DCODE.PNG" alt="D-CRM" className="h-8 w-8 object-contain" />
                    <span className="font-bold text-zinc-900 tracking-tight text-base">D-CRM</span>
                </div>

                <nav className="hidden md:flex items-center gap-7">
                    {["Features", "Integrations", "Pricing", "Contact"].map(item => (
                        <a key={item} href={`#${item.toLowerCase()}`}
                            className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
                            {item}
                        </a>
                    ))}
                </nav>

                <div className="hidden md:flex items-center gap-3">
                    <Link to="/login" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition-colors">
                        Sign in
                    </Link>
                    <button onClick={onDemo}
                        className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-all hover:-translate-y-px"
                        style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 3px 10px rgba(249,115,22,0.3)" }}>
                        Book demo
                    </button>
                </div>

                <button className="md:hidden text-zinc-600" onClick={() => setMenuOpen(!menuOpen)}>
                    <Menu size={22} />
                </button>
            </div>

            {menuOpen && (
                <div className="md:hidden bg-white border-t border-zinc-100 px-5 py-4 space-y-3 shadow-lg">
                    {["Features", "Integrations", "Pricing", "Contact"].map(item => (
                        <a key={item} href={`#${item.toLowerCase()}`}
                            onClick={() => setMenuOpen(false)}
                            className="block text-sm text-zinc-600 hover:text-zinc-900 font-medium py-1">
                            {item}
                        </a>
                    ))}
                    <div className="pt-2 flex flex-col gap-2">
                        <Link to="/login" onClick={() => setMenuOpen(false)}
                            className="text-sm font-semibold text-zinc-600 py-2 text-center border border-zinc-200 rounded-lg">
                            Sign in
                        </Link>
                        <button onClick={() => { onDemo(); setMenuOpen(false); }}
                            className="text-sm font-semibold text-white py-2 rounded-lg"
                            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
                            Book demo
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

const floatingCards = [
    { icon: TrendingUp, label: "Lead Pipeline",   sub: "Capture, score & assign leads",        color: "text-orange-500",  bg: "bg-orange-50",  delay: "0s",   dur: "5s",   pos: { top: "10%",    right: "-20%" } },
    { icon: Bot,        label: "AI Automation",   sub: "Smart follow-ups on autopilot",         color: "text-violet-600",  bg: "bg-violet-50",  delay: "1.4s", dur: "6.5s", pos: { bottom: "30%", right: "-18%" } },
    { icon: Bell,       label: "Smart Reminders", sub: "Never miss a follow-up again",          color: "text-sky-600",     bg: "bg-sky-50",     delay: "0.7s", dur: "4.8s", pos: { top: "40%",    left: "-18%"  } },
    { icon: Activity,   label: "Unified Inbox",   sub: "WhatsApp, email & calls in one place",  color: "text-emerald-600", bg: "bg-emerald-50", delay: "2s",   dur: "5.6s", pos: { bottom: "12%", left: "-14%"  } },
];

function HeroSection({ onDemo }) {
    const navigate = useNavigate();

    return (
        <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 bg-white overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 80% 60% at 60% -10%, #fff7ed 0%, transparent 70%)" }} />

            <div className="max-w-6xl mx-auto px-5 sm:px-8">
                <div className="grid lg:grid-cols-2 gap-14 items-center">
                    <div className="animate-fade-up">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-orange-500 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full mb-6">
                            <Zap size={11} /> AI-powered CRM
                        </span>
                        <h1 className="text-4xl sm:text-5xl xl:text-[56px] font-extrabold text-zinc-900 leading-[1.08] tracking-tight mb-6">
                            Your Team's<br />
                            <span className="text-orange-500">Relationship</span><br />
                            Operating System
                        </h1>
                        <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-lg mb-8">
                            Manage leads, communication, automation and customer relationships in one place. Built for teams that move fast.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={onDemo}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-lg transition-all hover:-translate-y-0.5"
                                style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 6px 20px rgba(249,115,22,0.35)" }}>
                                Get started <ArrowRight size={15} />
                            </button>
                            <button onClick={() => navigate("/login")}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 px-5 py-3 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-all">
                                Watch demo
                            </button>
                        </div>
                        <p className="text-xs text-zinc-400 mt-4 flex items-center gap-1.5">
                            <Check size={12} className="text-emerald-500" /> No credit card required
                        </p>
                    </div>

                    <div className="relative hidden lg:block">
                        <div className="bg-white border border-zinc-100 rounded-2xl shadow-2xl shadow-zinc-200/60 overflow-hidden">
                            <div className="bg-zinc-50 border-b border-zinc-100 px-5 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <img src="/DCODE.PNG" alt="D-CRM" className="h-5 w-5 object-contain opacity-70" />
                                    <span className="text-xs font-semibold text-zinc-400">D-CRM Dashboard</span>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-zinc-200" />
                                    <div className="w-2 h-2 rounded-full bg-zinc-200" />
                                    <div className="w-2 h-2 rounded-full bg-orange-300" />
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Platform Modules</p>
                                {[
                                    { icon: TrendingUp, label: "Lead Management", color: "text-orange-500", bg: "bg-orange-50"  },
                                    { icon: Bot,        label: "AI Automation",   color: "text-violet-600", bg: "bg-violet-50"  },
                                    { icon: Inbox,      label: "Unified Inbox",   color: "text-sky-600",    bg: "bg-sky-50"     },
                                    { icon: Users,      label: "Team & Roles",    color: "text-emerald-600",bg: "bg-emerald-50" },
                                    { icon: BarChart2,  label: "Analytics",       color: "text-amber-500",  bg: "bg-amber-50"   },
                                ].map(({ icon: Icon, label, color, bg }) => (
                                    <div key={label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
                                        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                                            <Icon size={14} className={color} />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-700">{label}</span>
                                        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {floatingCards.map(({ icon: Icon, label, sub, color, bg, delay, dur, pos }) => (
                            <div key={label}
                                className="absolute flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-xl px-3.5 py-2.5 shadow-lg border border-white/80 w-52"
                                style={{ animation: `float-slow ${dur} ease-in-out infinite`, animationDelay: delay, ...pos }}>
                                <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon size={14} className={color} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider leading-none mb-0.5">{label}</p>
                                    <p className="text-xs font-semibold text-zinc-700 truncate">{sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Features Section ─────────────────────────────────────────────────────────

const features = [
    { icon: TrendingUp,  title: "Lead Management",      desc: "Capture, score and track every lead from all channels in one pipeline.",         color: "text-orange-500",  bg: "bg-orange-50"  },
    { icon: Bot,         title: "AI Automation",         desc: "Trigger smart follow-ups, reminders and assignments automatically.",             color: "text-violet-600",  bg: "bg-violet-50"  },
    { icon: Inbox,       title: "Unified Inbox",         desc: "All messages — WhatsApp, email, calls — in a single shared workspace.",          color: "text-sky-600",     bg: "bg-sky-50"     },
    { icon: FaWhatsapp,  title: "WhatsApp Integration",  desc: "Send broadcasts, templates and auto-replies via WhatsApp Business.",             color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Mail,        title: "Email Integration",     desc: "Track opens, clicks and send campaigns directly from the CRM.",                  color: "text-rose-500",    bg: "bg-rose-50"    },
    { icon: BarChart2,   title: "Analytics",             desc: "Real-time dashboards on pipeline health, team performance and conversion.",       color: "text-amber-500",   bg: "bg-amber-50"   },
    { icon: Shield,      title: "Role Management",       desc: "Granular access control for admins, managers and sales reps.",                   color: "text-zinc-600",    bg: "bg-zinc-100"   },
    { icon: FaLinkedin,  title: "LinkedIn Leads",        desc: "Import and enrich leads directly from LinkedIn profiles at scale.",              color: "text-blue-600",    bg: "bg-blue-50"    },
];

function FeaturesSection() {
    const [ref, visible] = useInView();
    return (
        <section id="features" className="py-24 bg-white" ref={ref}>
            <div className="max-w-6xl mx-auto px-5 sm:px-8">
                <div className="text-center mb-14" style={fadeIn(visible)}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-orange-500 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full mb-4">
                        <Layers size={11} /> Platform Features
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 mt-4 leading-tight">
                        Everything your team needs
                    </h2>
                    <p className="mt-4 text-base text-zinc-500 max-w-xl mx-auto">
                        One platform to replace your disconnected tools — CRM, inbox, automation, analytics and more.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {features.map(({ icon: Icon, title, desc, color, bg }, i) => (
                        <div key={title}
                            className="group bg-white border border-zinc-100 rounded-xl p-5 hover:border-orange-200 hover:shadow-md transition-all duration-300"
                            style={fadeIn(visible, i * 0.06)}>
                            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                                <Icon size={18} className={color} />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-900 mb-1.5">{title}</h3>
                            <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── AI Automation Showcase ───────────────────────────────────────────────────

const workflowSteps = [
    { icon: Target,       label: "Lead Created",    sub: "New lead enters pipeline",                  color: "text-orange-500",  bg: "bg-orange-50 border-orange-200"  },
    { icon: MessageSquare,label: "Welcome Message", sub: "Personalised intro sent via WhatsApp",      color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200"},
    { icon: Bell,         label: "Reminder",        sub: "Auto follow-up after 24 hours",             color: "text-sky-600",     bg: "bg-sky-50 border-sky-200"        },
    { icon: Activity,     label: "Follow-Up",       sub: "Smart re-engagement sequence",              color: "text-violet-600",  bg: "bg-violet-50 border-violet-200"  },
];

function AutomationSection() {
    const [ref, visible] = useInView();
    return (
        <section className="py-24" style={{ background: "#fafafa" }} ref={ref}>
            <div className="max-w-5xl mx-auto px-5 sm:px-8">
                <div className="text-center mb-14" style={fadeIn(visible)}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-orange-500 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full mb-4">
                        <Bot size={11} /> AI Automation
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 mt-4">Works while you sleep</h2>
                    <p className="mt-4 text-base text-zinc-500 max-w-xl mx-auto">
                        Set up once. D-CRM handles follow-ups, reminders, and lead nurturing automatically.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-0 max-w-3xl mx-auto">
                    {workflowSteps.map(({ icon: Icon, label, sub, color, bg }, i) => (
                        <div key={label} className="flex flex-col sm:flex-row items-center flex-1">
                            <div className={`flex-1 w-full bg-white border ${bg} rounded-xl p-5 text-center shadow-sm`}
                                style={fadeIn(visible, i * 0.12)}>
                                <div className={`w-10 h-10 rounded-xl bg-white border ${bg} flex items-center justify-center mx-auto mb-3`}>
                                    <Icon size={18} className={color} />
                                </div>
                                <p className="text-sm font-bold text-zinc-900">{label}</p>
                                <p className="text-xs text-zinc-400 mt-1 leading-snug">{sub}</p>
                            </div>
                            {i < workflowSteps.length - 1 && (
                                <div className="flex sm:flex-col items-center justify-center px-2 py-2 sm:py-0">
                                    <ChevronRight size={16} className="text-orange-300 rotate-90 sm:rotate-0" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Stats Section ────────────────────────────────────────────────────────────

const stats = [
    { label: "Lead sources supported",    value: 8,  suffix: ""  },
    { label: "Automation trigger types",  value: 12, suffix: "+" },
    { label: "Integrations available",    value: 10, suffix: "+" },
    { label: "Team roles & permissions",  value: 5,  suffix: ""  },
];

function StatItem({ label, value, suffix, trigger }) {
    const count = useCountUp(value, 1800, trigger);
    const display = count >= 1000 ? `${(count / 1000).toFixed(count >= 100000 ? 0 : 1)}K` : count;
    return (
        <div className="text-center">
            <p className="text-4xl sm:text-5xl font-extrabold text-zinc-900 tabular-nums">{display}{suffix}</p>
            <p className="mt-2 text-sm text-zinc-500 font-medium">{label}</p>
        </div>
    );
}

function StatsSection() {
    const [ref, visible] = useInView(0.3);
    return (
        <section className="py-20 bg-white" ref={ref}>
            <div className="max-w-5xl mx-auto px-5 sm:px-8">
                <p className="text-center text-xs font-semibold tracking-widest uppercase text-zinc-400 mb-10">Platform at a glance</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12">
                    {stats.map((s) => (
                        <StatItem key={s.label} {...s} trigger={visible} />
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const testimonials = [
    { quote: "Finally a CRM that actually reduces manual work. The AI automation handles follow-ups so the team can focus on closing.", name: "Sales Manager", title: "B2B Technology Company", initials: "SM", color: "bg-orange-500"  },
    { quote: "Moving everything into one platform made a real difference. No more switching between WhatsApp, email and spreadsheets.",  name: "Growth Lead",   title: "EdTech Startup",          initials: "GL", color: "bg-violet-500" },
    { quote: "The lead scoring and pipeline visibility changed how we prioritise. The team adopted it quickly with no friction.",        name: "Founder",       title: "Digital Services Agency", initials: "FD", color: "bg-emerald-500"},
];

function TestimonialsSection() {
    const [ref, visible] = useInView();
    return (
        <section className="py-24" style={{ background: "#fafafa" }} ref={ref}>
            <div className="max-w-6xl mx-auto px-5 sm:px-8">
                <div className="text-center mb-14" style={fadeIn(visible)}>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900">What teams say</h2>
                    <p className="mt-4 text-base text-zinc-500">From sales managers to founders using D-CRM daily.</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-6">
                    {testimonials.map(({ quote, name, title, initials, color }, i) => (
                        <div key={name}
                            className="bg-white border border-zinc-100 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow"
                            style={fadeIn(visible, i * 0.1)}>
                            <div className="flex gap-0.5 mb-4">
                                {[...Array(5)].map((_, k) => (
                                    <svg key={k} className="w-4 h-4 text-orange-400 fill-orange-400" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                ))}
                            </div>
                            <p className="text-sm text-zinc-600 leading-relaxed mb-6">"{quote}"</p>
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                    {initials}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900">{name}</p>
                                    <p className="text-xs text-zinc-400">{title}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── CTA Section ──────────────────────────────────────────────────────────────

function CTASection({ onDemo }) {
    const [ref, visible] = useInView();
    return (
        <section className="py-24 bg-white" ref={ref}>
            <div className="max-w-4xl mx-auto px-5 sm:px-8">
                <div className="rounded-2xl px-8 py-16 text-center relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg,#F97316 0%,#EA580C 100%)", boxShadow: "0 20px 60px rgba(249,115,22,0.25)" }}>
                    <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full bg-white/10" />
                    <div className="absolute bottom-[-30px] left-[-30px] w-36 h-36 rounded-full bg-white/10" />
                    <div className="relative z-10" style={fadeIn(visible)}>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
                            Start managing relationships smarter.
                        </h2>
                        <p className="text-base text-orange-100 mb-8 max-w-lg mx-auto">
                            Join teams using D-CRM to close more deals, faster — with less manual work.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <button onClick={onDemo}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 bg-white px-6 py-3 rounded-lg hover:bg-orange-50 transition-all hover:-translate-y-0.5 shadow-md">
                                Get started <ArrowRight size={15} />
                            </button>
                            <Link to="/login"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-white border border-white/40 px-6 py-3 rounded-lg hover:bg-white/10 transition-all">
                                Sign in
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
    return (
        <footer className="border-t border-zinc-100 bg-white py-10">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <img src="/DCODE.PNG" alt="D-CRM" className="h-6 w-6 object-contain" />
                    <span className="text-sm font-bold text-zinc-800">D-CRM</span>
                </div>
                <p className="text-xs text-zinc-400">© {new Date().getFullYear()} D-CRM. All rights reserved.</p>
                <div className="flex items-center gap-5">
                    {["Privacy", "Terms", "Contact"].map(item => (
                        <a key={item} href="#" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">{item}</a>
                    ))}
                </div>
            </div>
        </footer>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    return (
        <div className="min-h-screen bg-white font-sans antialiased">
            <Navbar onDemo={openDemo} />
            <HeroSection onDemo={openDemo} />
            <FeaturesSection />
            <AutomationSection />
            <StatsSection />
            <TestimonialsSection />
            <CTASection onDemo={openDemo} />
            <Footer />
            {demoOpen && <BookDemoModal onClose={() => setDemoOpen(false)} />}
        </div>
    );
}
