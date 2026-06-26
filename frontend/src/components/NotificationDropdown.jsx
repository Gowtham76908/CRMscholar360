import { useState, useRef, useEffect } from "react";
import { Bell, Trophy, Calendar, CheckCheck, ClipboardList, AlertCircle, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const ICON_CONFIG = {
    LEADERBOARD_WINNER: { Icon: Trophy,        cls: "bg-yellow-50 text-yellow-600 border-yellow-100" },
    TASK_ASSIGNED:      { Icon: ClipboardList, cls: "bg-indigo-50 text-indigo-600 border-indigo-100" },
    TASK_COMPLETED:     { Icon: CheckCheck,    cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    TASK_DUE_SOON:      { Icon: Clock,         cls: "bg-amber-50 text-amber-600 border-amber-100" },
    TASK_OVERDUE:       { Icon: AlertCircle,   cls: "bg-red-50 text-red-600 border-red-100" },
    LEAVE_REQUESTED:    { Icon: Calendar,      cls: "bg-blue-50 text-blue-600 border-blue-100" },
    LEAVE_APPROVED:     { Icon: ThumbsUp,      cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    LEAVE_REJECTED:     { Icon: ThumbsDown,    cls: "bg-red-50 text-red-600 border-red-100" },
    DEFAULT:            { Icon: Calendar,      cls: "bg-indigo-50 text-indigo-600 border-indigo-100" },
};

const RenderIcon = ({ type }) => {
    const config = ICON_CONFIG[type] ?? ICON_CONFIG.DEFAULT;
    const I = config.Icon;
    return (
        <div className={`flex-shrink-0 p-2 rounded-xl border flex items-center justify-center ${config.cls}`}>
            <I className="h-4 w-4" />
        </div>
    );
};

const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return "just now";
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const queryClient = useQueryClient();
    const navigate    = useNavigate();

    const { data: notifications = [] } = useQuery({
        queryKey: ["notifications"],
        queryFn: async () => (await api.get("/notifications")).data,
        refetchInterval: 60000,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markOne = useMutation({
        mutationFn: (id) => api.patch(`/notifications/${id}/read`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    const markAll = useMutation({
        mutationFn: () => api.patch("/notifications/read-all"),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    const handleClick = (notification) => {
        if (!notification.isRead) markOne.mutate(notification.id);
        if (notification.link)    navigate(notification.link);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl relative transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center shadow-sm">
                        <span className="text-[8px] font-extrabold text-white leading-none">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3.5 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 ring-1 ring-black/5 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4.5 py-4.5 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-black bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm animate-pulse">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAll.mutate()}
                                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100/60">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    className={`p-4 flex items-start gap-3.5 cursor-pointer transition-colors relative border-l-2 ${
                                        !n.isRead 
                                            ? "bg-indigo-50/20 border-l-indigo-500 hover:bg-indigo-50/40" 
                                            : "border-l-transparent hover:bg-gray-50/80"
                                    }`}
                                >
                                    <RenderIcon type={n.type} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-xs leading-tight ${!n.isRead ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                                {n.title}
                                            </p>
                                            <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
                                                {timeAgo(n.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1 leading-normal line-clamp-2">
                                            {n.message}
                                        </p>
                                    </div>
                                    {!n.isRead && (
                                        <div className="flex-shrink-0 mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-sm" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 text-gray-400">
                                    <Bell className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700">All caught up!</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">You have no new notifications.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
