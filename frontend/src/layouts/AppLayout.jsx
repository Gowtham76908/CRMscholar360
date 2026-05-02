import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function AppLayout() {
    const { isAuthenticated, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

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

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar Desktop */}
            <Sidebar />

            <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300">
                <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Sidebar Overlay (Simple implementation) */}
            {/* In a real app we'd use a Drawer component or Sheet */}
        </div>
    );
}
