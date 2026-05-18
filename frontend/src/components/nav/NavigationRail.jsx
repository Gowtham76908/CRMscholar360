import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Zap, Settings2, Command } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../Avatar";
import DcodeLogo from "../DcodeLogo";
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
        paths: ["/leads", "/kanban", "/search-leads", "/linkedin-leads"],
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
        paths: ["/automations", "/sprints", "/tasks", "/reports", "/leaderboard"],
        shortcut: "4",
    },
    {
        id: "admin",
        icon: Settings2,
        label: "Admin",
        defaultPath: "/team",
        paths: ["/team", "/departments", "/invoices", "/salestrail", "/integrations", "/settings", "/attendance", "/leave"],
        shortcut: "5",
        adminOnly: true,
    },
];

export function getModeFromPath(pathname) {
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
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);
    const activeMode = getModeFromPath(location.pathname);

    const visibleModes = MODES.filter(m => !m.adminOnly || isAdmin);

    // Keyboard shortcuts 1–5 for mode switching
    useEffect(() => {
        const handle = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
            const idx = parseInt(e.key) - 1;
            if (idx >= 0 && idx < visibleModes.length) {
                const mode = visibleModes[idx];
                onModeClick(mode.id, mode.defaultPath);
            }
        };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [visibleModes, onModeClick]);

    return (
        <aside className="fixed inset-y-0 left-0 z-30 w-14 bg-white border-r border-gray-200 hidden md:flex flex-col items-center py-3">
            {/* Logo mark */}
            <div className="mb-2" title="Dcode CRM">
                <DcodeLogo size="sm" showText={false} />
            </div>

            <div className="w-8 h-px bg-gray-100 mb-2" />

            {/* Avatar */}
            <div className="mb-3 cursor-pointer" title={user?.name}>
                <Avatar user={user} size="sm" status={onlineStatus} />
            </div>

            <div className="w-8 h-px bg-gray-100 mb-3" />

            {/* Mode icons */}
            <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
                {visibleModes.map((mode) => {
                    const isActive = activeMode === mode.id;
                    const badge = unreadCounts[mode.id];
                    return (
                        <button
                            key={mode.id}
                            onClick={() => onModeClick(mode.id, mode.defaultPath)}
                            title={`${mode.label} (${mode.shortcut})`}
                            className={cn(
                                "relative w-full flex items-center justify-center p-2.5 rounded-xl transition-all duration-150",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                            )}
                        >
                            <mode.icon className="h-5 w-5" />
                            {/* Active indicator bar */}
                            {isActive && panelOpen && (
                                <span className="absolute -right-px top-1/2 -translate-y-1/2 h-5 w-0.5 bg-indigo-600 rounded-l-full" />
                            )}
                            {/* Unread badge */}
                            {badge > 0 && (
                                <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                    {badge > 99 ? "99+" : badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="w-8 h-px bg-gray-100 my-2" />

            {/* Command palette trigger */}
            <button
                onClick={() => {
                    const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
                    window.dispatchEvent(e);
                }}
                title="Command palette (Ctrl+K)"
                className="p-2.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
                <Command className="h-4 w-4" />
            </button>
        </aside>
    );
}
