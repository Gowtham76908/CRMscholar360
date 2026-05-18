import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Zap, Settings2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { getModeFromPath, MODES } from "./NavigationRail";

export default function MobileNav({ onModeClick }) {
    const location = useLocation();
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const isAdmin   = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);
    const activeMode = getModeFromPath(location.pathname);

    const visibleModes = MODES.filter(m => !m.adminOnly || isAdmin);

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
                return (
                    <button
                        key={mode.id}
                        onClick={() => handleTap(mode)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                            isActive ? "text-indigo-600" : "text-gray-400"
                        )}
                    >
                        <mode.icon className="h-5 w-5" />
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
