import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import {
    LayoutDashboard, Inbox, Plus, Users, KanbanSquare, Star,
    MessageSquare, Send, Zap as ZapIcon, Bot, CheckSquare,
    BarChart, Trophy, UserCog, Building, Receipt,
    PhoneCall, SearchCheck, Linkedin, Puzzle, Settings,
    Clock, Calendar, ChevronRight, TrendingUp, IndianRupee, AlertCircle, Sparkles,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_DOT = {
    NEW:       "bg-blue-500",
    CONTACTED: "bg-indigo-500",
    FOLLOW_UP: "bg-amber-500",
    CONVERTED: "bg-emerald-500",
    LOST:      "bg-red-400",
};

function PanelLink({ to, icon: Icon, label, count, active, dot }) {
    const location = useLocation();
    const isActive = active ?? (location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to)));
    return (
        <Link
            to={to}
            className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors group",
                isActive
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
        >
            {dot && <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />}
            {Icon && <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", isActive ? "text-indigo-600" : "text-gray-400")} />}
            <span className="flex-1 truncate">{label}</span>
            {count != null && count > 0 && (
                <span className={cn(
                    "text-[10px] font-bold px-1.5 rounded-full",
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
        <div className="mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 mb-1">{title}</p>
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

// ─── Mode panels ──────────────────────────────────────────────────────────────

function WorkloadPanel() {
    return (
        <PanelSection title="Today">
            <PanelLink to="/dashboard" icon={LayoutDashboard} label="My Day" />
        </PanelSection>
    );
}

function CRMPanel() {
    const { data: stats = {} } = useQuery({
        queryKey: ["crm-panel-stats"],
        queryFn: () =>
            api.get("/leads", { params: { limit: 500 } }).then(r => {
                const leads = r.data.data || r.data || [];
                return Array.isArray(leads)
                    ? leads.reduce((acc, l) => {
                          acc[l.status] = (acc[l.status] || 0) + 1;
                          acc.total = (acc.total || 0) + 1;
                          return acc;
                      }, {})
                    : {};
            }),
        staleTime: 60_000,
    });

    const statuses = [
        { id: "NEW",       label: "New" },
        { id: "CONTACTED", label: "Contacted" },
        { id: "FOLLOW_UP", label: "Follow Up" },
        { id: "CONVERTED", label: "Converted" },
        { id: "LOST",      label: "Lost" },
    ];

    return (
        <>
            <PanelSection title="Pipeline">
                <PanelLink to="/leads" icon={Users} label="All Leads" count={stats.total} />
                {statuses.map(s => (
                    <PanelLink
                        key={s.id}
                        to={`/leads?status=${s.id}`}
                        label={s.label}
                        count={stats[s.id]}
                        dot={STATUS_DOT[s.id]}
                    />
                ))}
            </PanelSection>

            <PanelSection title="Views">
                <PanelLink to="/leads?mine=true" icon={Star} label="My Leads" />
                <PanelLink to="/leads?score_min=61" icon={Star} label="Hot Leads" />
                {/* <PanelLink to="/kanban" icon={KanbanSquare} label="Kanban Board" /> */}
                <PanelLink to="/search-leads" icon={SearchCheck} label="Search Leads" />
                <PanelLink to="/linkedin-leads" icon={Linkedin} label="LinkedIn Leads" />
            </PanelSection>

            <PanelSection title="Deals">
                <PanelLink to="/deals" icon={TrendingUp} label="All Deals" />
                <PanelLink to="/deals/pipeline" icon={KanbanSquare} label="Pipeline" />
            </PanelSection>

            <div className="px-2.5 pt-1">
                <Link
                    to="/leads?new=1"
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                    <Plus className="h-3.5 w-3.5" /> New Lead
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
        RUNNING:   "text-emerald-600 bg-emerald-50",
        DRAFT:     "text-gray-500 bg-gray-100",
        COMPLETED: "text-blue-600 bg-blue-50",
        PAUSED:    "text-amber-600 bg-amber-50",
        FAILED:    "text-red-600 bg-red-50",
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
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
                    >
                        <Plus className="h-3 w-3" /> New Campaign
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
    const totalCount  = Array.isArray(automations) ? automations.length : 0;

    return (
        <>
            <PanelSection title="Automations">
                <PanelLink to="/automations" icon={Bot} label="All Rules" count={totalCount} />
                <PanelLink to="/automations?filter=active" icon={ZapIcon} label="Active" count={activeCount} />
            </PanelSection>

            <PanelSection title="Work">
                {/* <PanelLink to="/sprints" icon={ZapIcon} label="Sprints" /> */}
                <PanelLink to="/tasks" icon={CheckSquare} label="My Tasks" />
            </PanelSection>
        </>
    );
}

function AnalyticsPanel() {
    return (
        <PanelSection title="Analytics">
            <PanelLink to="/team-performance"  icon={TrendingUp}   label="Team Performance" />
            <PanelLink to="/revenue-report"    icon={IndianRupee}  label="Revenue Report" />
            <PanelLink to="/leaderboard"       icon={Trophy}       label="Leaderboard" />
            <PanelLink to="/reports"           icon={BarChart}     label="Reports" />
            <PanelLink to="/ai-usage"          icon={Sparkles}     label="AI Usage" />
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
                <PanelLink to="/team"        icon={UserCog}    label="Team" />
                {isSuperAdmin && <PanelLink to="/departments" icon={Building} label="Departments" />}
                <PanelLink to="/attendance"  icon={Clock}      label="Attendance" />
                <PanelLink to="/leave"       icon={Calendar}   label="Leave" />
            </PanelSection>

            <PanelSection title="Billing">
                <PanelLink to="/invoices" icon={Receipt} label="Invoices" />
            </PanelSection>

            <PanelSection title="Leads">
                <PanelLink to="/fasterq" icon={PhoneCall} label="Fasterq Calls" />
                {isManager && <PanelLink to="/unassigned-leads" icon={AlertCircle} label="Unassigned Leads" />}
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
    workload:    "Workload",
    crm:         "CRM",
    communicate: "Communicate",
    automate:    "Automate",
    analytics:   "Analytics",
    admin:       "Admin",
};

const PANEL_COMPONENTS = {
    workload:    WorkloadPanel,
    crm:         CRMPanel,
    communicate: CommunicatePanel,
    automate:    AutomatePanel,
    analytics:   AnalyticsPanel,
    admin:       AdminPanel,
};

// ─── ContextPanel (Zone 2) ────────────────────────────────────────────────────

export default function ContextPanel({ activeMode, open, onClose }) {
    const ActivePanel = PANEL_COMPONENTS[activeMode] ?? WorkloadPanel;

    return (
        <>
            {/* Desktop sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-14 z-20 w-60 bg-white border-r border-gray-200 hidden md:flex flex-col transition-transform duration-300",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex items-center px-4 h-14 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {PANEL_TITLES[activeMode]}
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-3">
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
                                {PANEL_TITLES[activeMode]}
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
