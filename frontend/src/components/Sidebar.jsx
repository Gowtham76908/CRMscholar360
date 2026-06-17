import {
    LayoutDashboard, Users, CheckSquare, Settings, BarChart,
    Building, MessageSquare, Clock, Calendar, LogOut, SearchCheck,
    Linkedin, Receipt, PhoneCall, Bot, Send, Search,
    Inbox, ChevronLeft, ChevronRight, GitMerge, Trophy,
    UserCheck, AlertCircle, TrendingUp, Zap, UserCog, Puzzle, HandCoins, LayoutGrid, IndianRupee, Sparkles,
    ClipboardList, Network,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { roleLabel } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

const isSuperAdmin  = (r) => r === "SUPER_ADMIN";
const isManager     = (r) => r === "SUPER_ADMIN" || r === "ADMIN";
// EMPLOYEE sees everything not gated by the above

const NAV = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" }
];

const Sidebar = ({ collapsed = false, onToggle }) => {
    const location = useLocation();
    const { user, logout, onlineStatus } = useAuth();
    const role = user?.role;

    return (
        <aside className={cn(
            "fixed inset-y-0 left-0 z-10 hidden md:flex flex-col bg-indigo-50/40 border-r border-gray-200/80 backdrop-blur-md transition-all duration-300",
            collapsed ? "w-14" : "w-64"
        )}>
            {/* Logo */}
            <div className={cn(
                "flex flex-col justify-center border-b border-gray-200/60 overflow-hidden",
                collapsed ? "px-0 items-center h-16" : "px-6 h-20"
            )}>
                {collapsed ? (
                    <span className="font-extrabold text-indigo-600 text-xl">CP</span>
                ) : (
                    <div className="flex flex-col">
                        <span className="font-extrabold text-lg text-indigo-950 leading-tight">Corporate Portal</span>
                        <span className="text-[10px] font-semibold text-indigo-400 tracking-wider mt-0.5">Deep Lavender System</span>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-6 overflow-y-auto space-y-1.5 overflow-x-hidden">
                {NAV.map((item) => {
                    const isActive = location.pathname === item.path ||
                        (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                "relative flex items-center rounded-xl transition-all duration-200 group",
                                collapsed ? "justify-center p-2.5" : "px-4 py-3 text-sm font-semibold",
                                isActive
                                    ? "bg-indigo-100 text-indigo-600 shadow-sm shadow-indigo-100"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <item.icon className={cn(
                                "transition-colors shrink-0",
                                collapsed ? "h-5 w-5" : "mr-3.5 h-5 w-5",
                                isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
                            )} />
                            {!collapsed && (
                                <span className="flex-1 tracking-wide">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className={cn("border-t border-gray-200/60", collapsed ? "p-2 space-y-2" : "p-4 space-y-3")}>
                {/* Export Data Button */}
                {!collapsed && (
                    <button className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-indigo-100/50 mb-2">
                        Export Data
                    </button>
                )}

                {/* Settings & Help */}
                {!collapsed ? (
                    <div className="space-y-1">
                        <Link
                            to="/settings"
                            className="flex items-center gap-3.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 text-sm font-semibold transition-colors"
                        >
                            <Settings className="h-4 w-4 text-gray-400" />
                            <span>Settings</span>
                        </Link>
                        <a
                            href="#"
                            className="flex items-center gap-3.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 text-sm font-semibold transition-colors"
                        >
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                            <span>Help</span>
                        </a>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <Link
                            to="/settings"
                            title="Settings"
                            className="p-2.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                            <Settings className="h-5 w-5" />
                        </Link>
                        <a
                            href="#"
                            title="Help"
                            className="p-2.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                            <AlertCircle className="h-5 w-5" />
                        </a>
                    </div>
                )}

                {/* Collapse Button */}
                <button
                    onClick={onToggle}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={cn(
                        "flex items-center gap-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors",
                        collapsed ? "w-full justify-center p-2" : "w-full px-3 py-1.5 text-xs font-medium"
                    )}
                >
                    {collapsed
                        ? <ChevronRight className="h-4 w-4" />
                        : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>}
                </button>

                {!collapsed && (
                    <>
                        {/* Profile Info */}
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50/80 rounded-xl border border-gray-100">
                            <Avatar user={user} size="sm" status={onlineStatus} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{user?.name || "User"}</p>
                                <p className="text-[10px] font-bold text-gray-400 truncate tracking-wider leading-none mt-0.5">{role ? roleLabel(role) : "—"}</p>
                            </div>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={logout}
                            className="w-full flex items-center px-3 py-2 text-sm font-semibold rounded-lg text-red-600 hover:bg-red-50/50 transition-colors group"
                        >
                            <LogOut className="mr-3 h-4 w-4 text-red-500 group-hover:text-red-600" />
                            Logout
                        </button>
                    </>
                )}

                {collapsed && (
                    <button onClick={logout} title="Logout" className="w-full flex items-center justify-center p-2.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors">
                        <LogOut className="h-5 w-5" />
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
