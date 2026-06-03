import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import NavigationRail, { getModeFromPath } from "../components/nav/NavigationRail";
import ContextPanel from "../components/nav/ContextPanel";
import MobileNav from "../components/nav/MobileNav";
import Navbar from "../components/Navbar";
import CommandPalette from "../components/CommandPalette";
import AssistantWidget from "../components/AssistantWidget";

export default function AppLayout() {
    const { isAuthenticated, loading } = useAuth();
    const { totalUnread } = useChat();
    const location = useLocation();
    const navigate  = useNavigate();

    const [panelOpen, setPanelOpen] = useState(() =>
        localStorage.getItem("nav-panel-open") !== "false"
    );

    const activeMode = useMemo(() => getModeFromPath(location.pathname), [location.pathname]);

    const handleModeClick = useCallback((modeId, defaultPath) => {
        if (modeId === activeMode) {
            // Second click on same mode → toggle panel
            setPanelOpen(v => {
                const next = !v;
                localStorage.setItem("nav-panel-open", String(next));
                return next;
            });
        } else {
            // Different mode → navigate to its default path + open panel
            navigate(defaultPath);
            setPanelOpen(true);
            localStorage.setItem("nav-panel-open", "true");
        }
    }, [activeMode, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Zone 3 left margin: 56px rail + 240px panel (when open)
    const mainLeft = panelOpen ? 296 : 56;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Zone 1 — Navigation Rail (56px) */}
            <NavigationRail
                panelOpen={panelOpen}
                onModeClick={handleModeClick}
                unreadCounts={{ communicate: totalUnread }}
            />

            {/* Zone 2 — Context Panel (240px) */}
            <ContextPanel activeMode={activeMode} open={panelOpen} onClose={() => setPanelOpen(false)} />

            {/* Zone 3 — Main Workspace */}
            <div
                className="flex-1 flex flex-col transition-all duration-300 min-w-0"
                style={{ marginLeft: mainLeft }}
            >
                <Navbar onMenuClick={() => handleModeClick(activeMode, location.pathname)} />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 overflow-auto">
                    <Outlet />
                </main>
            </div>

            {/* Mobile bottom navigation */}
            <MobileNav onModeClick={handleModeClick} unreadCounts={{ communicate: totalUnread }} />

            <CommandPalette />
            <AssistantWidget />
            <Toaster
                position="bottom-right"
                richColors
                closeButton
                toastOptions={{ duration: 4000 }}
            />
        </div>
    );
}
