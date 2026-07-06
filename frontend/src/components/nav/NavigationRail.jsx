import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Zap, BarChart, Settings2, Command } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../Avatar";
import { cn } from "../../lib/utils";

// ─── Mode definitions ─────────────────────────────────────────────────────────

export const MODES = [
    {
        id: "workload",
        icon: LayoutDashboard,
        label: "Workload",
        defaultPath: "/dashboard",
        paths: ["/dashboard"],
        shortcut: "1",
    },
    {
        id: "crm",
        icon: Users,
        label: "CRM",
        defaultPath: "/leads",
        paths: ["/leads", "/kanban", "/search-leads", "/linkedin-leads", "/deals", "/duplicates"],
        shortcut: "2",
    },
    {
        id: "communicate",
        icon: MessageSquare,
        label: "Communicate",
        defaultPath: "/inbox",
        paths: ["/inbox", "/whatsapp/campaigns", "/whatsapp/auto-replies", "/messages"],
        shortcut: "3",
    },
    {
        id: "automate",
        icon: Zap,
        label: "Automate",
        defaultPath: "/automations",
        paths: ["/automations", "/tasks", "/sprints"],
        shortcut: "4",
    },
    {
        id: "analytics",
        icon: BarChart,
        label: "Analytics",
        defaultPath: "/team-performance",
        paths: ["/team-performance", "/revenue-report", "/leaderboard", "/reports", "/ai-usage", "/employee-report"],
        shortcut: "5",
        adminOnly: true,
    },
    {
        id: "admin",
        icon: Settings2,
        label: "Admin",
        defaultPath: "/team",
        paths: ["/team", "/team-management", "/department-staffing", "/department-queue", "/invoices", "/fasterq", "/integrations", "/settings", "/attendance", "/team-attendance", "/leave"],
        shortcut: "6",
        adminOnly: true,
    },
];

export function getModeFromPath(pathname, search = "") {
    if (pathname === "/leads" && search.includes("view=kanban")) {
        return "workload";
    }
    // A lead detail page (/leads/:id, /leads/:id/journey) inherits the mode of
    // the leads view it was opened from — so a lead opened from the Board View
    // keeps the Board (workload) panel instead of jumping to CRM / All Leads.
    if (pathname.startsWith("/leads/")) {
        const last = typeof localStorage !== "undefined" ? localStorage.getItem("last-leads-path") : null;
        if (last && last.startsWith("/leads") && last.includes("view=kanban")) {
            return "workload";
        }
    }
    for (const mode of MODES) {
        if (mode.paths.some(p => pathname === p || pathname.startsWith(p + "/"))) {
            return mode.id;
        }
    }
    return "workload";
}

// ─── NavigationRail ───────────────────────────────────────────────────────────

export default function NavigationRail({ panelOpen, onModeClick, unreadCounts = {} }) {
    const location = useLocation();
    const { user, onlineStatus } = useAuth();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const isManager = isSuperAdmin || user?.role === "ADMIN" || user?.role === "TEAM_LEADER";
    const activeMode = getModeFromPath(location.pathname, location.search);

    // The Admin mode is shown to everyone; AdminPanel gates individual links
    // so managers/employees only see what they have access to.
    const visibleModes = MODES.filter(m => !m.adminOnly || isManager || m.id === "admin");

    // Keyboard shortcuts for mode switching
    useEffect(() => {
        const handle = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
            const idx = parseInt(e.key) - 1;
            if (idx >= 0 && idx < visibleModes.length) {
                const mode = visibleModes[idx];
                let path = mode.defaultPath;
                if (mode.id === "admin" && user?.role === "EMPLOYEE") {
                    path = "/attendance";
                }
                onModeClick(mode.id, path);
            }
        };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [visibleModes, onModeClick, user]);

    return (
        <aside className="fixed inset-y-0 left-0 z-30 w-16 bg-white border-r border-gray-200 hidden md:flex flex-col items-center py-5">
            {/* Avatar (logo now lives in the context panel header) */}
            <div className="mb-4 cursor-pointer transform hover:scale-105 transition-transform" title={user?.name}>
                <Avatar user={user} size="sm" status={onlineStatus} />
            </div>

            <div className="w-10 h-px bg-gray-100 mb-4" />

            {/* Mode icons */}
            <nav className="flex-1 flex flex-col items-center gap-3 w-full px-2">
                {visibleModes.map((mode) => {
                    const isActive = activeMode === mode.id;
                    const badge = unreadCounts[mode.id];
                    return (
                        <button
                            key={mode.id}
                            onClick={() => {
                                let path = mode.defaultPath;
                                if (mode.id === "admin" && user?.role === "EMPLOYEE") {
                                    path = "/attendance";
                                }
                                onModeClick(mode.id, path);
                            }}
                            title={`${mode.id === "admin" && user?.role === "EMPLOYEE" ? "Settings" : mode.label} (${mode.shortcut})`}
                            className={cn(
                                "relative w-full flex items-center justify-center p-3 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-50/80"
                            )}
                        >
                            <mode.icon className="h-5 w-5" />
                            {/* Active indicator bar */}
                            {isActive && panelOpen && (
                                <span className="absolute -right-px top-1/2 -translate-y-1/2 h-6 w-0.5 bg-indigo-600 rounded-l-full" />
                            )}
                            {/* Unread badge */}
                            {badge > 0 && (
                                <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                    {badge > 99 ? "99+" : badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="w-10 h-px bg-gray-100 my-4" />

            {/* Command palette trigger */}
            <button
                onClick={() => {
                    const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
                    window.dispatchEvent(e);
                }}
                title="Command palette (Ctrl+K)"
                className="p-3 rounded-2xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
                <Command className="h-4 w-4" />
            </button>
        </aside>
    );
}
