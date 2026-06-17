import { useState, useRef, useEffect } from "react";
import { Menu, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../lib/roles";
import GlobalSearch from "./GlobalSearch";
import NotificationDropdown from "./NotificationDropdown";
import Avatar from "./Avatar";
import StatusSelector from "./StatusSelector";
import DcodeLogo from "./DcodeLogo";

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
                    <DcodeLogo size="sm" />
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
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                                {/* User info */}
                                <div className="px-4 py-2 border-b border-gray-100 mb-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                </div>

                                {/* Status selector */}
                                <div className="px-4 py-2">
                                    <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Presence</p>
                                    <StatusSelector
                                        currentStatus={onlineStatus}
                                        onSelect={(s) => { updateStatus(s); setProfileOpen(false); }}
                                        loading={statusLoading}
                                    />
                                </div>

                                <div className="border-t border-gray-100 mt-1 pt-1">
                                    <Link
                                        to="/settings"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Settings className="h-4 w-4 text-gray-400" />
                                        Settings
                                    </Link>
                                    <button
                                        onClick={() => { setProfileOpen(false); logout(); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
