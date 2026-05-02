import { LayoutDashboard, Users, UserCog, CheckSquare, Settings, Puzzle, BarChart, Building, MessageSquare, Clock, Calendar, LogOut, Trophy, SearchCheck, Linkedin, KanbanSquare, Zap, Receipt, PhoneCall } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import StatusDot from "./StatusDot";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: SearchCheck,   label: "Search Leads",   path: "/search-leads",   adminOnly: true },
    { icon: Linkedin,      label: "LinkedIn Leads", path: "/linkedin-leads", adminOnly: true },
    { icon: KanbanSquare,  label: "Kanban Board",   path: "/kanban" },
    { icon: Zap,           label: "Sprints",        path: "/sprints" },
    { icon: Users, label: "Leads", path: "/leads" },
    { icon: UserCog, label: "Team", path: "/team" },
    { icon: CheckSquare, label: "Tasks", path: "/tasks" },
    { icon: BarChart, label: "Reports", path: "/reports" },
    { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
    { icon: Building, label: "Departments", path: "/departments" },
    { icon: MessageSquare, label: "Messages", path: "/messages" },
    { icon: Clock, label: "Attendance", path: "/attendance" },
    { icon: Calendar, label: "Leave", path: "/leave" },
    { icon: Receipt, label: "Invoices & Billing", path: "/invoices", adminOnly: true },
    { icon: PhoneCall, label: "Salestrail Calls",  path: "/salestrail", adminOnly: true },
    { icon: Puzzle, label: "Integrations", path: "/integrations" },
    { icon: Settings, label: "Settings", path: "/settings" },
];

const Sidebar = () => {
    const location = useLocation();
    const { user, logout, onlineStatus } = useAuth();

    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-10 hidden md:flex flex-col">
            <div className="flex items-center h-16 px-6 border-b border-gray-200">
                {/* Brand Logo */}
                <div className="flex items-center gap-2">
                    <img src="/DCODE.PNG" alt="D-CRM Logo" className="h-8 w-8 object-contain" />
                    <span className="font-bold text-xl text-gray-900">D-CRM</span>
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {sidebarItems.map((item) => {
                    // Hide Search Leads for non-admins
                    if (item.adminOnly && !["SUPER_ADMIN", "ADMIN"].includes(user?.role)) {
                        return null;
                    }

                    // Hide Team link for non-admins
                    if (item.label === "Team" && !["SUPER_ADMIN", "ADMIN"].includes(user?.role)) {
                        return null;
                    }

                    // Hide Reports link for non-admins
                    if (item.label === "Reports" && !["SUPER_ADMIN", "ADMIN"].includes(user?.role)) {
                        return null;
                    }

                    // Hide Departments link for non-admins
                    if (item.label === "Departments" && !["SUPER_ADMIN", "ADMIN"].includes(user?.role)) {
                        return null;
                    }

                    // My Attendance is only for employees
                    if (item.employeeOnly && user?.role !== "EMPLOYEE") {
                        return null;
                    }

                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
                                isActive
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "mr-3 h-5 w-5 transition-colors",
                                    isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                                )}
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 space-y-2">
                {/* User Info */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Avatar user={user} size="sm" status={onlineStatus} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.name || "User"}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email || "No Email"}</p>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={logout}
                    className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors group"
                >
                    <LogOut className="mr-3 h-5 w-5 text-red-500 group-hover:text-red-600" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
