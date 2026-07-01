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
import { cn } from "../lib/utils";

export default function AppLayout() {
    const { isAuthenticated, loading } = useAuth();
    const { totalUnread } = useChat();
    const location = useLocation();
    const navigate  = useNavigate();

    // `panelOpen` = pinned open via an explicit click. Starts closed and is
    // session-only (not persisted) so the panel is collapsed on every load.
    const [panelOpen, setPanelOpen] = useState(false);
    // `hovered` = transient hover preview — opens the panel without pinning it.
    const [hovered, setHovered] = useState(false);
    const effectiveOpen = panelOpen || hovered;

    const activeMode = useMemo(() => getModeFromPath(location.pathname, location.search), [location.pathname, location.search]);

    const handleModeClick = useCallback((modeId, defaultPath) => {
        if (modeId === activeMode) {
            // Click on the already-active tab → toggle it open / closed.
            setPanelOpen(v => !v);
        } else {
            // Switch to a different tab → navigate but preserve the pinned state.
            navigate(defaultPath);
        }
    }, [activeMode, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f6ff]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-[#f8f6ff] flex">
            {/* Zones 1 & 2 share a hover region: hovering the rail/panel opens a
                preview; clicking a mode pins it open. */}
            <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                {/* Zone 1 — Navigation Rail (56px) */}
                <NavigationRail
                    panelOpen={effectiveOpen}
                    onModeClick={handleModeClick}
                    unreadCounts={{ communicate: totalUnread }}
                />

                {/* Zone 2 — Context Panel (240px) */}
                <ContextPanel activeMode={activeMode} open={effectiveOpen} pinned={panelOpen} onClose={() => setPanelOpen(false)} />
            </div>

            {/* Zone 3 — Main Workspace */}
            <div
                className={cn(
                    "flex-1 flex flex-col transition-all duration-300 min-w-0",
                    panelOpen ? "ml-0 md:ml-[320px]" : "ml-0 md:ml-16"
                )}
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
