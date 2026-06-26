import { useState, useRef, useEffect } from "react";
import { Menu, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../lib/roles";
import GlobalSearch from "./GlobalSearch";
import NotificationDropdown from "./NotificationDropdown";
import Avatar from "./Avatar";
import StatusSelector from "./StatusSelector";
import Scholar360Logo from "./Scholar360Logo";

const Navbar = ({ onMenuClick }) => {
    const { user, logout, onlineStatus, updateStatus, statusLoading } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md md:hidden"
                >
                    <Menu className="h-6 w-6" />
                </button>

                {/* Logo — mobile only (desktop shows in NavigationRail) */}
                <Link to="/dashboard" className="md:hidden flex-shrink-0">
                    <Scholar360Logo size="sm" />
                </Link>

                <div className="hidden sm:block w-full max-w-sm">
                    <GlobalSearch />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <NotificationDropdown />

                <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-gray-900">{user?.name || "User"}</p>
                        <p className="text-xs text-gray-500">{user?.role ? roleLabel(user.role) : "Role"}</p>
                    </div>

                    {/* Avatar with profile dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setProfileOpen(o => !o)}
                            className="hover:ring-2 hover:ring-indigo-200 rounded-full transition-all"
                            title="Profile & Status"
                        >
                            <Avatar user={user} size="md" status={onlineStatus} />
                        </button>

                        {profileOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100/80 py-0 z-50 overflow-hidden ring-1 ring-black/5">
                                {/* User header card with subtle gradient background */}
                                <div className="px-4.5 py-4 border-b border-gray-100 bg-gradient-to-br from-indigo-50/30 via-white to-white flex items-center gap-3">
                                    <Avatar user={user} size="sm" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate leading-none mb-1">{user?.name}</p>
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider leading-none mb-1">{user?.role ? roleLabel(user.role) : "Role"}</p>
                                        <p className="text-[10px] text-gray-400 truncate leading-none">{user?.email}</p>
                                    </div>
                                </div>

                                {/* Status selector */}
                                <div className="px-4.5 py-3 border-b border-gray-100/80">
                                    <p className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wider">Presence Status</p>
                                    <StatusSelector
                                        currentStatus={onlineStatus}
                                        onSelect={(s) => { updateStatus(s); setProfileOpen(false); }}
                                        loading={statusLoading}
                                    />
                                </div>

                                <div className="p-1.5 space-y-0.5">
                                    <Link
                                        to="/settings"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                                    >
                                        <Settings className="h-4 w-4 text-gray-400" />
                                        Settings
                                    </Link>
                                    <button
                                        onClick={() => { setProfileOpen(false); logout(); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50/60 rounded-xl transition-colors"
                                    >
                                        <LogOut className="h-4 w-4 text-red-400" />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
