import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Zap, Settings2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { getModeFromPath, MODES } from "./NavigationRail";

export default function MobileNav({ onModeClick, unreadCounts = {} }) {
    const location = useLocation();
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const isManager    = isSuperAdmin || user?.role === "MANAGER";
    const activeMode   = getModeFromPath(location.pathname);

    const visibleModes = MODES.filter(m => !m.adminOnly || isManager);

    const handleTap = (mode) => {
        // Always delegate to AppLayout's handleModeClick which handles
        // navigate + panel open/toggle logic
        if (onModeClick) {
            onModeClick(mode.id, mode.defaultPath);
        } else {
            navigate(mode.defaultPath);
        }
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex md:hidden safe-area-pb">
            {visibleModes.map((mode) => {
                const isActive = activeMode === mode.id;
                const badge = unreadCounts[mode.id];
                return (
                    <button
                        key={mode.id}
                        onClick={() => handleTap(mode)}
                        className={cn(
                            "relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                            isActive ? "text-indigo-600" : "text-gray-400"
                        )}
                    >
                        <span className="relative">
                            <mode.icon className="h-5 w-5" />
                            {badge > 0 && (
                                <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                    {badge > 99 ? "99+" : badge}
                                </span>
                            )}
                        </span>
                        <span className="text-[9px] font-semibold">{mode.label}</span>
                        {isActive && (
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-indigo-600 rounded-b-full" />
                        )}
                    </button>
                );
            })}
        </nav>
    );
}
