import { useState, useRef, useEffect } from "react";
import { Bell, Trophy, Calendar, CheckCheck, ClipboardList, AlertCircle, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const ICON_MAP = {
    LEADERBOARD_WINNER: <Trophy className="h-4 w-4 text-yellow-500" />,
    TASK_ASSIGNED:      <ClipboardList className="h-4 w-4 text-indigo-500" />,
    TASK_COMPLETED:     <CheckCheck className="h-4 w-4 text-green-500" />,
    TASK_DUE_SOON:      <Clock className="h-4 w-4 text-orange-500" />,
    TASK_OVERDUE:       <AlertCircle className="h-4 w-4 text-red-500" />,
    LEAVE_REQUESTED:    <Calendar className="h-4 w-4 text-blue-500" />,
    LEAVE_APPROVED:     <ThumbsUp className="h-4 w-4 text-green-500" />,
    LEAVE_REJECTED:     <ThumbsDown className="h-4 w-4 text-red-500" />,
    DEFAULT:            <Calendar className="h-4 w-4 text-indigo-500" />,
};

const getIcon = (type) => ICON_MAP[type] ?? ICON_MAP.DEFAULT;

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
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white leading-none">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">
                            Notifications
                            {unreadCount > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAll.mutate()}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    className={`p-3 flex items-start gap-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                                        !n.isRead ? "bg-indigo-50/60" : ""
                                    }`}
                                >
                                    <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-full bg-white shadow-sm border border-gray-100">
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                                            {n.title}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                            {n.message}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {timeAgo(n.createdAt)}
                                        </p>
                                    </div>
                                    {!n.isRead && (
                                        <div className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-sm text-gray-400">
                                No notifications yet.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
