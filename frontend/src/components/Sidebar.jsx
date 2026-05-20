import {
    LayoutDashboard, Users, UserCog, CheckSquare, Settings, Puzzle, BarChart,
    Building, MessageSquare, Clock, Calendar, LogOut, SearchCheck,
    Linkedin, Receipt, PhoneCall, Bot, Send, Search,
    Inbox, ChevronLeft, ChevronRight, GitMerge,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";

const NAV_GROUPS = [
    {
        label: "Workspace",
        items: [
            { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
            { icon: Users,           label: "Leads",     path: "/leads" },
        ],
    },
    {
        label: "Activity",
        items: [
            { icon: Inbox,         label: "Inbox",       path: "/inbox" },
            { icon: CheckSquare,   label: "Tasks",       path: "/tasks" },
            { icon: MessageSquare, label: "Messages",    path: "/messages" },
            { icon: Clock,         label: "Attendance",  path: "/attendance" },
            { icon: Calendar,      label: "Leave",       path: "/leave" },
        ],
    },
    {
        label: "Intelligence",
        adminOnly: true,
        items: [
            { icon: BarChart, label: "Reports",     path: "/reports",     adminOnly: true },
            { icon: Bot,      label: "Automations", path: "/automations", adminOnly: true },
        ],
    },
    {
        label: "Communication",
        adminOnly: true,
        items: [
            { icon: Send, label: "WA Campaigns",  path: "/whatsapp/campaigns",    adminOnly: true },
            { icon: Zap,  label: "WA Auto Reply", path: "/whatsapp/auto-replies", adminOnly: true },
        ],
    },
    {
        label: "Admin",
        items: [
            { icon: UserCog,    label: "Team",              path: "/team",          adminOnly: true },
            { icon: Building,   label: "Departments",       path: "/departments",   adminOnly: true },
            { icon: GitMerge,   label: "Duplicates",        path: "/duplicates",    adminOnly: true },
            { icon: Receipt,    label: "Invoices",          path: "/invoices",      adminOnly: true },
            { icon: PhoneCall,  label: "Salestrail Calls",  path: "/salestrail",    adminOnly: true },
            { icon: SearchCheck,label: "Search Leads",      path: "/search-leads",  adminOnly: true },
            { icon: Linkedin,   label: "LinkedIn Leads",    path: "/linkedin-leads",adminOnly: true },
            { icon: Puzzle,     label: "Integrations",      path: "/integrations" },
            { icon: Settings,   label: "Settings",          path: "/settings" },
        ],
    },
];

const isAdmin = (role) => ["SUPER_ADMIN", "ADMIN"].includes(role);

const Sidebar = ({ collapsed = false, onToggle }) => {
    const location = useLocation();
    const { user, logout, onlineStatus } = useAuth();

    return (
        <aside
            className={cn(
                "fixed inset-y-0 left-0 z-10 hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300",
                collapsed ? "w-14" : "w-64"
            )}
        >
            {/* Logo */}
            <div className={cn(
                "flex items-center h-16 border-b border-gray-200 overflow-hidden",
                collapsed ? "px-0 justify-center" : "px-6"
            )}>
                <img src="/DCODE.PNG" alt="D-CRM" className="h-8 w-8 object-contain flex-shrink-0" />
                {!collapsed && (
                    <span className="ml-2 font-bold text-xl text-gray-900 whitespace-nowrap">D-CRM</span>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4 overflow-x-hidden">
                {NAV_GROUPS.map((group) => {
                    const visibleItems = group.items.filter((item) => {
                        if (item.adminOnly && !isAdmin(user?.role)) return false;
                        return true;
                    });
                    if (visibleItems.length === 0) return null;
                    if (group.adminOnly && !isAdmin(user?.role)) return null;

                    return (
                        <div key={group.label}>
                            {!collapsed && (
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">
                                    {group.label}
                                </p>
                            )}
                            {collapsed && (
                                <div className="h-px bg-gray-100 mx-2 mb-2" />
                            )}
                            <div className="space-y-0.5">
                                {visibleItems.map((item) => {
                                    const isActive = location.pathname === item.path ||
                                        (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            title={collapsed ? item.label : undefined}
                                            className={cn(
                                                "flex items-center rounded-lg transition-colors group",
                                                collapsed
                                                    ? "justify-center p-2.5 mx-0"
                                                    : "px-3 py-2 text-sm font-medium",
                                                isActive
                                                    ? "bg-orange-50 text-orange-700"
                                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            )}
                                        >
                                            <item.icon
                                                className={cn(
                                                    "transition-colors shrink-0",
                                                    collapsed ? "h-5 w-5" : "mr-3 h-4 w-4",
                                                    isActive ? "text-orange-600" : "text-gray-400 group-hover:text-gray-500"
                                                )}
                                            />
                                            {!collapsed && item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className={cn("border-t border-gray-200", collapsed ? "p-2 space-y-2" : "p-4 space-y-2")}>
                {/* Collapse toggle */}
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
                        : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>
                    }
                </button>

                {!collapsed && (
                    <>
                        {/* Command palette trigger */}
                        <button
                            onClick={() => {
                                const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
                                window.dispatchEvent(e);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 border border-gray-200 rounded-lg hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        >
                            <Search className="h-3.5 w-3.5" />
                            <span className="flex-1 text-left">Search & navigate</span>
                            <kbd className="text-[10px] font-medium bg-gray-100 px-1.5 py-0.5 rounded">Ctrl K</kbd>
                        </button>

                        {/* User info */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                            <Avatar user={user} size="sm" status={onlineStatus} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{user?.name || "User"}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.email || "No Email"}</p>
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
                    <button
                        onClick={logout}
                        title="Logout"
                        className="w-full flex items-center justify-center p-2.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
