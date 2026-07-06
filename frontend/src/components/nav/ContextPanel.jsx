import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import Scholar360Logo from "../Scholar360Logo";
import {
    LayoutDashboard, Inbox, Plus, Users, KanbanSquare, Star,
    MessageSquare, Send, Zap as ZapIcon, Bot, CheckSquare,
    BarChart, Trophy, UserCog, Building, Receipt,
    PhoneCall, SearchCheck, Linkedin, Puzzle, Settings,
    Clock, Calendar, ChevronRight, TrendingUp, IndianRupee, AlertCircle, Sparkles,
} from "lucide-react";

// Query params that distinguish sibling "views" sharing the same path (e.g. the
// /leads tabs). A query-less link (like "All Leads") stays inactive while one of
// these filtered views is active, so the current tab — not the base — highlights.
const SIBLING_FILTER_KEYS = ["mine", "score_min", "view", "filter", "status"];

function isLinkActive(location, to) {
    const [toPath, toQuery] = to.split("?");
    const onPath = location.pathname === toPath || location.pathname.startsWith(toPath + "/");
    if (!onPath) return false;
    const search = new URLSearchParams(location.search);
    if (toQuery) {
        // Filtered view: active only when all of its query params match the URL.
        const want = new URLSearchParams(toQuery);
        return [...want.entries()].every(([k, v]) => search.get(k) === v);
    }
    // Base view: active unless a sibling filtered view is currently applied.
    return !SIBLING_FILTER_KEYS.some(k => search.has(k));
}

function PanelLink({ to, icon: Icon, label, count, active, dot }) {
    const location = useLocation();
    const isActive = active ?? isLinkActive(location, to);
    return (
        <Link
            to={to}
            className={cn(
                "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 group hover:translate-x-0.5",
                isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
        >
            {dot && <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />}
            {Icon && <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors duration-200", isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600")} />}
            <span className="flex-1 truncate">{label}</span>
            {count != null && count > 0 && (
                <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                )}>
                    {count}
                </span>
            )}
        </Link>
    );
}

function PanelSection({ title, children }) {
    return (
        <div className="mb-6">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3.5 mb-2">{title}</p>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

// ─── Mode panels ──────────────────────────────────────────────────────────────

function WorkloadPanel() {
    return (
        <PanelSection title="Today">
            <PanelLink to="/dashboard" icon={BarChart} label="Dashboard" />
            <PanelLink to="/my-day" icon={LayoutDashboard} label="My Day" />
            <PanelLink to="/leads?view=kanban" icon={KanbanSquare} label="Board View" />
        </PanelSection>
    );
}

// CRM Panel
function CRMPanel() {
    const { data: total } = useQuery({
        queryKey: ["crm-panel-lead-count"],
        queryFn: () => api.get("/leads", { params: { limit: 1 } }).then(r => r.data.total ?? 0),
        staleTime: 60_000,
    });

    return (
        <>
            <PanelSection title="Pipeline">
                <PanelLink to="/leads" icon={Users} label="All Leads" count={total} />
            </PanelSection>

            <PanelSection title="Views">
                <PanelLink to="/leads?mine=true" icon={Star} label="My Leads" />
                <PanelLink to="/leads?score_min=61" icon={Star} label="Hot Leads" />
                <PanelLink to="/search-leads" icon={SearchCheck} label="Search Leads" />
                <PanelLink to="/linkedin-leads" icon={Linkedin} label="LinkedIn Leads" />
            </PanelSection>



            <div className="px-3.5 pt-2">
                <Link
                    to="/leads?new=1"
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-850 font-bold transition-all duration-200 hover:translate-x-0.5"
                >
                    <Plus className="h-4 w-4" /> New Lead
                </Link>
            </div>
        </>
    );
}

function CommunicatePanel() {
    const { data: campaignData } = useQuery({
        queryKey: ["communicate-panel-campaigns"],
        queryFn: () =>
            api.get("/whatsapp/campaigns", { params: { limit: 5 } })
                .then(r => {
                    const d = r.data;
                    return Array.isArray(d) ? d : (d.campaigns ?? d.data ?? []);
                }),
        staleTime: 30_000,
        retry: false,
        throwOnError: false,
    });
    const campaigns = Array.isArray(campaignData) ? campaignData : [];

    const CAMP_STATUS_COLOR = {
        RUNNING: "text-emerald-600 bg-emerald-50",
        DRAFT: "text-gray-500 bg-gray-100",
        COMPLETED: "text-blue-600 bg-blue-50",
        PAUSED: "text-amber-600 bg-amber-50",
        FAILED: "text-red-600 bg-red-50",
    };

    return (
        <>
            <PanelSection title="Inbox">
                <PanelLink to="/inbox" icon={Inbox} label="Inbox" />
                <PanelLink to="/messages" icon={MessageSquare} label="Team Chat" />
            </PanelSection>

            <PanelSection title="WhatsApp Campaigns">
                <PanelLink to="/whatsapp/campaigns" icon={Send} label="All Campaigns" />
                {campaigns.length === 0 && (
                    <Link
                        to="/whatsapp/campaigns"
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs text-indigo-600 hover:bg-indigo-50 transition-colors font-semibold"
                    >
                        <Plus className="h-3.5 w-3.5" /> New Campaign
                    </Link>
                )}
                {campaigns.map(c => (
                    <Link
                        key={c.id}
                        to={`/whatsapp/campaigns/${c.id}`}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        <span className="flex-1 truncate text-xs">{c.name}</span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", CAMP_STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-500")}>
                            {c.status}
                        </span>
                    </Link>
                ))}
            </PanelSection>

            <PanelSection title="Automation">
                <PanelLink to="/whatsapp/auto-replies" icon={ZapIcon} label="Auto-Reply Rules" />
            </PanelSection>
        </>
    );
}

function AutomatePanel() {
    const { data: automations = [] } = useQuery({
        queryKey: ["automate-panel-stats"],
        queryFn: () =>
            api.get("/automations").then(r => r.data.data || r.data || []),
        staleTime: 60_000,
        retry: false,
        throwOnError: false,
    });

    const activeCount = Array.isArray(automations) ? automations.filter(a => a.active).length : 0;
    const totalCount = Array.isArray(automations) ? automations.length : 0;

    return (
        <>
            <PanelSection title="Automations">
                <PanelLink to="/automations" icon={Bot} label="All Rules" count={totalCount} />
                <PanelLink to="/automations?filter=active" icon={ZapIcon} label="Active" count={activeCount} />
            </PanelSection>

            <PanelSection title="Work">
                <PanelLink to="/tasks" icon={CheckSquare} label="My Tasks" />
            </PanelSection>
        </>
    );
}

function AnalyticsPanel() {
    return (
        <PanelSection title="Analytics">
            <PanelLink to="/team-performance" icon={TrendingUp} label="Team Performance" />
            <PanelLink to="/revenue-report" icon={IndianRupee} label="Revenue Report" />
            <PanelLink to="/leaderboard" icon={Trophy} label="Leaderboard" />
            <PanelLink to="/reports" icon={BarChart} label="Reports" />
            <PanelLink to="/ai-usage" icon={Sparkles} label="AI Usage" />
        </PanelSection>
    );
}

function AdminPanel() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const isManager = isSuperAdmin || user?.role === "ADMIN";

    return (
        <>
            <PanelSection title="People">
                <PanelLink to="/team" icon={UserCog} label="Team" />
                {isSuperAdmin && <PanelLink to="/department-staffing" icon={Building} label="Dept. Staffing" />}
                <PanelLink to="/attendance" icon={Clock} label="Attendance" />
                {isManager && <PanelLink to="/team-attendance" icon={Users} label="Team Attendance" />}
                <PanelLink to="/leave" icon={Calendar} label="Leave" />
            </PanelSection>

            <PanelSection title="Billing">
                <PanelLink to="/invoices" icon={Receipt} label="Invoices" />
                {isSuperAdmin && <PanelLink to="/finance" icon={IndianRupee} label="Finance Tracker" />}
            </PanelSection>

            <PanelSection title="Leads">
                <PanelLink to="/fasterq" icon={PhoneCall} label="Fasterq Calls" />
                {isManager && <PanelLink to="/department-queue" icon={AlertCircle} label="Department Queue" />}
            </PanelSection>

            <PanelSection title="System">
                {isSuperAdmin && <PanelLink to="/integrations" icon={Puzzle} label="Integrations" />}
                <PanelLink to="/settings" icon={Settings} label="Settings" />
            </PanelSection>
        </>
    );
}

// ─── Panel registry ───────────────────────────────────────────────────────────

const PANEL_TITLES = {
    workload: "Workload",
    crm: "CRM",
    communicate: "Communicate",
    automate: "Automate",
    analytics: "Analytics",
    admin: "Admin",
};

const PANEL_COMPONENTS = {
    workload: WorkloadPanel,
    crm: CRMPanel,
    communicate: CommunicatePanel,
    automate: AutomatePanel,
    analytics: AnalyticsPanel,
    admin: AdminPanel,
};

// ─── ContextPanel (Zone 2) ────────────────────────────────────────────────────

export default function ContextPanel({ activeMode, open, pinned = false, onClose }) {
    const { user } = useAuth();
    const ActivePanel = PANEL_COMPONENTS[activeMode] ?? WorkloadPanel;
    const title = activeMode === "admin" && user?.role === "EMPLOYEE" ? "Settings" : (PANEL_TITLES[activeMode] || "");

    return (
        <>
            {/* Desktop sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-16 z-20 w-64 bg-white border-r border-gray-200 hidden md:flex flex-col transition-transform duration-300",
                    // Pinned open: navbar shifts aside, so the logo can sit at the very
                    // top. Hover preview: navbar still overlaps, so offset below it.
                    pinned ? "pt-0" : "pt-16",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex flex-col items-start justify-center gap-0.5 px-4  border-b border-gray-100">
                    <Scholar360Logo size="xl" showText={false} />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ">
                        Study Abroad Consultancy
                    </span>
                    <p className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest mt-2 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100/30">
                        {title}
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
                    <ActivePanel />
                </div>
            </aside>

            {/* Mobile bottom drawer */}
            {open && (
                <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={onClose}
                    />
                    {/* Drawer */}
                    <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                {title}
                            </p>
                            <button
                                onClick={onClose}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                            >
                                <ChevronRight className="h-4 w-4 rotate-90" />
                            </button>
                        </div>
                        <div className="overflow-y-auto px-2 py-3 pb-safe">
                            <ActivePanel />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
