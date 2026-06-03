import {
    LayoutDashboard, Users, CheckSquare, Settings, BarChart,
    Building, MessageSquare, Clock, Calendar, LogOut, SearchCheck,
    Linkedin, Receipt, PhoneCall, Bot, Send, Search,
    Inbox, ChevronLeft, ChevronRight, GitMerge, Trophy,
    UserCheck, AlertCircle, TrendingUp, Zap, UserCog, Puzzle, HandCoins, LayoutGrid, IndianRupee, Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

const isSuperAdmin  = (r) => r === "SUPER_ADMIN";
const isManager     = (r) => r === "SUPER_ADMIN" || r === "MANAGER";
// EMPLOYEE sees everything not gated by the above

const NAV = [
    // ── All roles ────────────────────────────────────────────────────────────
    { group: "Workspace", icon: LayoutDashboard, label: "Dashboard",   path: "/dashboard" },
    { group: "Workspace", icon: Users,           label: "Leads",       path: "/leads" },
    { group: "Workspace", icon: HandCoins,       label: "Deals",       path: "/deals" },
    { group: "Workspace", icon: LayoutGrid,      label: "Pipeline",    path: "/deals/pipeline" },
    { group: "Activity",  icon: Inbox,           label: "Inbox",       path: "/inbox" },
    { group: "Activity",  icon: CheckSquare,     label: "Tasks",       path: "/tasks" },
    { group: "Activity",  icon: MessageSquare,   label: "Messages",    path: "/messages" },
    { group: "Activity",  icon: Clock,           label: "Attendance",  path: "/attendance" },
    { group: "Activity",  icon: Calendar,        label: "Leave",       path: "/leave" },
    { group: "Account",   icon: Settings,        label: "Settings",    path: "/settings" },

    // ── Manager + Super Admin ─────────────────────────────────────────────────
    { group: "Team",      icon: AlertCircle,   label: "Unassigned Leads",   path: "/unassigned-leads",  managerOnly: true },
    { group: "Team",      icon: TrendingUp,    label: "Team Performance",   path: "/team-performance",  managerOnly: true },
    { group: "Team",      icon: IndianRupee,   label: "Revenue Report",     path: "/revenue-report",    managerOnly: true },
    { group: "Team",      icon: Trophy,        label: "Leaderboard",        path: "/leaderboard",       managerOnly: true },
    { group: "Team",      icon: PhoneCall,     label: "Salestrail Calls",   path: "/salestrail",        managerOnly: true },
    { group: "Team",      icon: BarChart,      label: "Reports",            path: "/reports",           managerOnly: true },
    { group: "Team",      icon: Sparkles,      label: "AI Usage",           path: "/ai-usage",          managerOnly: true },

    // ── Super Admin only ──────────────────────────────────────────────────────
    { group: "Intelligence", icon: Bot,         label: "Automations",      path: "/automations",            superAdminOnly: true },
    { group: "Intelligence", icon: Send,        label: "WA Campaigns",     path: "/whatsapp/campaigns",     superAdminOnly: true },
    { group: "Intelligence", icon: Zap,         label: "WA Auto Reply",    path: "/whatsapp/auto-replies",  superAdminOnly: true },
    { group: "Admin",        icon: UserCog,     label: "Team",             path: "/team",                   superAdminOnly: true },
    { group: "Admin",        icon: UserCheck,   label: "Team Management",  path: "/team-management",        superAdminOnly: true },
    { group: "Admin",        icon: Building,    label: "Departments",      path: "/departments",            superAdminOnly: true },
    { group: "Admin",        icon: GitMerge,    label: "Duplicates",       path: "/duplicates",             superAdminOnly: true },
    { group: "Admin",        icon: Receipt,     label: "Invoices",         path: "/invoices",               superAdminOnly: true },
    { group: "Admin",        icon: SearchCheck, label: "Search Leads",     path: "/search-leads",           superAdminOnly: true },
    { group: "Admin",        icon: Linkedin,    label: "LinkedIn Leads",   path: "/linkedin-leads",         superAdminOnly: true },
    { group: "Admin",        icon: Puzzle,      label: "Integrations",     path: "/integrations",           superAdminOnly: true },
];

const Sidebar = ({ collapsed = false, onToggle }) => {
    const location = useLocation();
    const { user, logout, onlineStatus } = useAuth();
    const role = user?.role;

    const { data: dashStats } = useQuery({
        queryKey: ["dashboard-stats"],
        queryFn: () => api.get("/leads/stats").then(r => r.data),
        staleTime: 60_000,
        retry: false,
    });
    const overdueCount = dashStats?.overdueFollowUps ?? 0;

    const visible = NAV.filter((item) => {
        if (item.superAdminOnly) return isSuperAdmin(role);
        if (item.managerOnly)    return isManager(role);
        return true;
    });

    // Group them preserving order
    const groups = visible.reduce((acc, item) => {
        if (!acc[item.group]) acc[item.group] = [];
        acc[item.group].push(item);
        return acc;
    }, {});

    return (
        <aside className={cn(
            "fixed inset-y-0 left-0 z-10 hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300",
            collapsed ? "w-14" : "w-64"
        )}>
            {/* Logo */}
            <div className={cn(
                "flex items-center h-16 border-b border-gray-200 overflow-hidden",
                collapsed ? "px-0 justify-center" : "px-6"
            )}>
                <img src="/DCODE.PNG" alt="D-CRM" className="h-8 w-8 object-contain flex-shrink-0" />
                {!collapsed && <span className="ml-2 font-bold text-xl text-gray-900 whitespace-nowrap">D-CRM</span>}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4 overflow-x-hidden">
                {Object.entries(groups).map(([groupLabel, items]) => (
                    <div key={groupLabel}>
                        {!collapsed && (
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">
                                {groupLabel}
                            </p>
                        )}
                        {collapsed && <div className="h-px bg-gray-100 mx-2 mb-2" />}
                        <div className="space-y-0.5">
                            {items.map((item) => {
                                const isActive = location.pathname === item.path ||
                                    (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        title={collapsed ? item.label : undefined}
                                        className={cn(
                                            "relative flex items-center rounded-lg transition-colors group",
                                            collapsed ? "justify-center p-2.5" : "px-3 py-2 text-sm font-medium",
                                            isActive
                                                ? "bg-orange-50 text-orange-700"
                                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "transition-colors shrink-0",
                                            collapsed ? "h-5 w-5" : "mr-3 h-4 w-4",
                                            isActive ? "text-orange-600" : "text-gray-400 group-hover:text-gray-500"
                                        )} />
                                        {!collapsed && (
                                            <>
                                                <span className="flex-1">{item.label}</span>
                                                {item.path === "/leads" && overdueCount > 0 && (
                                                    <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                                        {overdueCount}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {collapsed && item.path === "/leads" && overdueCount > 0 && (
                                            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom */}
            <div className={cn("border-t border-gray-200", collapsed ? "p-2 space-y-2" : "p-4 space-y-2")}>
                <button
                    onClick={onToggle}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={cn(
                        "flex items-center gap-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors",
                        collapsed ? "w-full justify-center p-2.5" : "w-full px-3 py-2 text-xs"
                    )}
                >
                    {collapsed
                        ? <ChevronRight className="h-4 w-4" />
                        : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>}
                </button>

                {!collapsed && (
                    <>
                        <button
                            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 border border-gray-200 rounded-lg hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        >
                            <Search className="h-3.5 w-3.5" />
                            <span className="flex-1 text-left">Search & navigate</span>
                            <kbd className="text-[10px] font-medium bg-gray-100 px-1.5 py-0.5 rounded">Ctrl K</kbd>
                        </button>

                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                            <Avatar user={user} size="sm" status={onlineStatus} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{user?.name || "User"}</p>
                                <p className="text-xs text-gray-500 truncate capitalize">{role?.replace("_", " ").toLowerCase() || "—"}</p>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors group"
                        >
                            <LogOut className="mr-3 h-5 w-5 text-red-500 group-hover:text-red-600" />
                            Logout
                        </button>
                    </>
                )}

                {collapsed && (
                    <button onClick={logout} title="Logout" className="w-full flex items-center justify-center p-2.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="h-5 w-5" />
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
