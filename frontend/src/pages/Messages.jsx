import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Loader2, Video, Search, Plus, X, UserPlus, Users,
    Check, CheckCheck, MessageSquare, Hash, AtSign, Send, Smile,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { cn } from "../lib/utils";

const VideoCall = lazy(() => import("../components/VideoCall"));

// ── helpers ───────────────────────────────────────────────────────────────────
const avatarUrl = (name, img) =>
    img || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=FED7AA&color=F97316`;

const statusDot = (s) =>
    ({ ONLINE: "bg-green-500", BREAK: "bg-yellow-400", OFFLINE: "bg-gray-300" }[s] ?? "bg-gray-300");

const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[#FAFAFA] text-center select-none">
        <div className="h-20 w-20 rounded-3xl bg-[#FFF7ED] border-2 border-[#FED7AA] flex items-center justify-center mb-5 shadow-sm">
            <MessageSquare className="h-9 w-9 text-[#F97316]" />
        </div>
        <h3 className="text-lg font-bold text-[#18181B] mb-1.5">Select a Conversation</h3>
        <p className="text-sm text-[#71717A] max-w-xs leading-relaxed">
            Pick a team channel or direct message from the sidebar to start chatting.
        </p>
    </div>
);

// ── Channel Preview (sidebar item) ───────────────────────────────────────────
const ChannelPreview = ({ channel, active, onSelect, unread, currentUserId }) => {
    const isDm   = channel.type === "dm";
    const other  = isDm ? channel.members.find(m => m.id !== currentUserId) : null;
    const name   = isDm ? (other?.name ?? "Direct Message") : (channel.name ?? "Channel");
    const img    = isDm ? other?.image : null;
    const status = other?.onlineStatus ?? "OFFLINE";
    const preview = channel.lastMessage?.text || "No messages yet";
    const time    = fmtTime(channel.lastMessage?.createdAt);

    return (
        <button
            onClick={onSelect}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mx-1 transition-all text-left",
                active ? "bg-[#FFF7ED] shadow-sm" : "hover:bg-[#FAFAFA]",
            )}
        >
            <div className="relative shrink-0">
                {!isDm ? (
                    <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold",
                        active ? "bg-[#F97316] text-white" : "bg-[#FED7AA] text-[#F97316]",
                    )}>
                        <Hash className="h-4 w-4" />
                    </div>
                ) : (
                    <img src={avatarUrl(name, img)} alt={name}
                        className="h-10 w-10 rounded-xl object-cover border border-[#E4E4E7]" />
                )}
                {isDm && (
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white", statusDot(status))} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-semibold truncate", active ? "text-[#F97316]" : "text-[#18181B]")}>{name}</span>
                    <span className="text-[10px] text-[#71717A] shrink-0 ml-1">{time}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                    <span className={cn("text-xs truncate", unread > 0 ? "font-semibold text-[#18181B]" : "text-[#71717A]")}>{preview}</span>
                    {unread > 0 && (
                        <span className="ml-1 h-4 min-w-4 px-1 shrink-0 bg-[#F97316] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

// ── Channel Header ────────────────────────────────────────────────────────────
const ChannelHeader = ({ channel, currentUserId, onCall, onAddMember, onShowMembers }) => {
    if (!channel) return null;
    const isDm    = channel.type === "dm";
    const other   = isDm ? channel.members.find(m => m.id !== currentUserId) : null;
    const name    = isDm ? (other?.name ?? "Direct Message") : (channel.name ?? "Channel");
    const img     = isDm ? other?.image : null;
    const status  = other?.onlineStatus ?? "OFFLINE";
    const statusLabel = { ONLINE: "Online", BREAK: "On Break", OFFLINE: "Offline" }[status] ?? "Offline";
    const statusColor = { ONLINE: "text-green-600", BREAK: "text-yellow-600", OFFLINE: "text-[#71717A]" }[status] ?? "text-[#71717A]";

    return (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E4E7] bg-white shrink-0">
            <div className="flex items-center gap-3">
                {!isDm ? (
                    <div className="h-9 w-9 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center">
                        <Hash className="h-4 w-4 text-[#F97316]" />
                    </div>
                ) : (
                    <div className="relative">
                        <img src={avatarUrl(name, img)} alt={name}
                            className="h-9 w-9 rounded-xl object-cover border border-[#E4E4E7]" />
                        <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white", statusDot(status))} />
                    </div>
                )}
                <div>
                    <p className="font-bold text-[#18181B] text-sm leading-tight">{name}</p>
                    <p className={cn("text-[11px] font-medium", isDm ? statusColor : "text-[#71717A]")}>
                        {isDm ? statusLabel : `${channel.members.length} member${channel.members.length !== 1 ? "s" : ""}`}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                {!isDm && (
                    <>
                        <button onClick={onShowMembers}
                            className="p-2 rounded-xl text-[#71717A] hover:text-[#F97316] hover:bg-[#FFF7ED] transition-colors" title="Members">
                            <Users className="h-4 w-4" />
                        </button>
                        <button onClick={onAddMember}
                            className="p-2 rounded-xl text-[#71717A] hover:text-[#F97316] hover:bg-[#FFF7ED] transition-colors" title="Add member">
                            <UserPlus className="h-4 w-4" />
                        </button>
                    </>
                )}
                <button onClick={() => onCall?.(channel.id)}
                    className="p-2 rounded-xl bg-[#F97316] text-white hover:bg-[#FB923C] transition-colors shadow-sm" title="Video call">
                    <Video className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

// ── Single Message Bubble ─────────────────────────────────────────────────────
const MessageBubble = ({ msg, isOwn, onReact, onEdit, onDelete }) => {
    const [showActions, setShowActions] = useState(false);
    const [editing, setEditing]         = useState(false);
    const [editText, setEditText]       = useState(msg.text);

    const submitEdit = () => {
        if (editText.trim() && editText !== msg.text) onEdit(msg.id, editText.trim());
        setEditing(false);
    };

    const reactionEntries = Object.entries(msg.reactions || {}).filter(([, users]) => users.length > 0);

    return (
        <div
            className={cn("group flex gap-2.5 px-4 py-1", isOwn ? "flex-row-reverse" : "flex-row")}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {!isOwn && (
                <img src={avatarUrl(msg.author?.name, msg.author?.profilePhoto)}
                    alt={msg.author?.name}
                    className="h-7 w-7 rounded-full object-cover border border-[#E4E4E7] shrink-0 mt-1" />
            )}
            <div className={cn("max-w-[70%] flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
                {!isOwn && (
                    <span className="text-[10px] font-semibold text-[#71717A] px-1">{msg.author?.name}</span>
                )}
                <div className={cn(
                    "px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                    isOwn
                        ? "bg-[#F97316] text-white rounded-tr-sm"
                        : "bg-white border border-[#E4E4E7] text-[#18181B] rounded-tl-sm shadow-sm",
                )}>
                    {editing ? (
                        <div className="flex gap-2 items-center">
                            <input
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditing(false); }}
                                className="text-sm bg-transparent border-b border-white/50 focus:outline-none flex-1 min-w-0"
                                autoFocus
                            />
                            <button onClick={submitEdit} className="text-white/80 hover:text-white">
                                <Check className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ) : (
                        msg.text
                    )}
                </div>

                {/* Reactions */}
                {reactionEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                        {reactionEntries.map(([emoji, users]) => (
                            <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                                className="flex items-center gap-0.5 bg-white border border-[#E4E4E7] rounded-full px-1.5 py-0.5 text-[11px] hover:bg-[#FFF7ED] transition-colors">
                                <span>{emoji}</span>
                                <span className="text-[#71717A] font-medium">{users.length}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className={cn("flex items-center gap-1.5 px-1", isOwn ? "flex-row-reverse" : "flex-row")}>
                    <span className="text-[9px] text-[#71717A]">{fmtTime(msg.createdAt)}</span>
                    {msg.editedAt && <span className="text-[9px] text-[#71717A] italic">edited</span>}
                    {isOwn && <CheckCheck className="h-2.5 w-2.5 text-[#71717A]" strokeWidth={2.5} />}
                </div>
            </div>

            {/* Hover actions */}
            {showActions && !editing && (
                <div className={cn(
                    "flex items-center gap-1 self-center opacity-0 group-hover:opacity-100 transition-opacity",
                )}>
                    {["👍", "❤️", "😄"].map(emoji => (
                        <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                            className="text-sm p-1 hover:bg-[#FFF7ED] rounded-lg transition-colors">
                            {emoji}
                        </button>
                    ))}
                    {isOwn && (
                        <>
                            <button onClick={() => { setEditing(true); setEditText(msg.text); }}
                                className="p-1 text-[#71717A] hover:text-[#F97316] hover:bg-[#FFF7ED] rounded-lg text-[10px] font-medium transition-colors">
                                Edit
                            </button>
                            <button onClick={() => onDelete(msg.id)}
                                className="p-1 text-[#71717A] hover:text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-medium transition-colors">
                                Delete
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Message Input ─────────────────────────────────────────────────────────────
const MessageInput = ({ onSend, onTyping, onStopTyping }) => {
    const [text, setText]   = useState("");
    const typingTimer       = useRef(null);

    const handleChange = (e) => {
        setText(e.target.value);
        onTyping?.();
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => onStopTyping?.(), 2000);
    };

    const send = () => {
        if (!text.trim()) return;
        onSend(text.trim());
        setText("");
        clearTimeout(typingTimer.current);
        onStopTyping?.();
    };

    return (
        <div className="px-4 py-3 border-t border-[#E4E4E7] bg-white shrink-0">
            <div className="flex items-end gap-2 bg-[#FAFAFA] border border-[#E4E4E7] rounded-2xl px-4 py-2.5 focus-within:border-[#F97316] focus-within:ring-1 focus-within:ring-[#F97316] transition-all">
                <textarea
                    value={text}
                    onChange={handleChange}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Write a message…"
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-[#18181B] placeholder:text-[#71717A] resize-none focus:outline-none max-h-32 leading-relaxed"
                    style={{ overflowY: "auto" }}
                />
                <button onClick={send} disabled={!text.trim()}
                    className="p-1.5 rounded-xl bg-[#F97316] text-white disabled:opacity-40 hover:bg-[#FB923C] transition-colors shrink-0">
                    <Send className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
};

// ── Typing indicator ──────────────────────────────────────────────────────────
const TypingIndicator = ({ typingUsers }) => {
    const names = Object.values(typingUsers);
    if (!names.length) return null;
    return (
        <div className="px-4 py-1.5 text-[11px] text-[#F97316] font-semibold italic flex items-center gap-2">
            <span className="flex gap-0.5">
                {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-[#F97316] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
            </span>
            <span>{names.length === 1 ? `${names[0]} is typing…` : `${names.join(", ")} are typing…`}</span>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const Messages = () => {
    const { user }    = useAuth();
    const queryClient = useQueryClient();
    const { socket, channels, unreadMap, setActiveChannel, refetchChannels } = useChat();

    const [activeChannelId, setActiveChannelId] = useState(null);
    const [messages, setMessages]               = useState([]);
    const [typingUsers, setTypingUsers]         = useState({}); // { userId: userName }
    const [activeCall, setActiveCall]           = useState(null); // { token, url }
    const [isCreating, setIsCreating]           = useState(false);
    const [userSearch, setUserSearch]           = useState("");
    const [showAddMember, setShowAddMember]     = useState(false);
    const [showMembers, setShowMembers]         = useState(false);

    const bottomRef      = useRef(null);
    const typingTimers   = useRef({}); // userId → timer id
    const prevChannelRef = useRef(null);

    const activeChannel = channels.find(c => c.id === activeChannelId) ?? null;

    // ── Fetch messages for active channel ─────────────────────────────────────
    const { isLoading: loadingMessages } = useQuery({
        queryKey: ["chat-messages", activeChannelId],
        queryFn:  () => api.get(`/chat/channels/${activeChannelId}/messages`, { params: { limit: 50 } }).then(r => r.data),
        enabled:  !!activeChannelId,
        staleTime: 0,
        onSuccess: (data) => setMessages(data.messages || []),
    });

    // ── Socket: join/leave channel rooms ─────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        if (prevChannelRef.current) socket.emit("chat:leave", { channelId: prevChannelRef.current });
        if (activeChannelId) {
            socket.emit("chat:join", { channelId: activeChannelId });
            setActiveChannel(activeChannelId);
        } else {
            setActiveChannel(null);
        }
        prevChannelRef.current = activeChannelId;
        setTypingUsers({});
    }, [socket, activeChannelId, setActiveChannel]);

    // ── Socket: incoming events ───────────────────────────────────────────────
    useEffect(() => {
        if (!socket || !activeChannelId) return;

        const onMessage = (msg) => {
            if (msg.channelId !== activeChannelId) return;
            setMessages(prev => [...prev, msg]);
            // Clear typing for that user
            setTypingUsers(prev => { const n = { ...prev }; delete n[msg.author?.id]; return n; });
        };

        const onUpdated = (msg) => {
            if (msg.channelId !== activeChannelId) return;
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
        };

        const onDeleted = ({ messageId, channelId }) => {
            if (channelId !== activeChannelId) return;
            setMessages(prev => prev.filter(m => m.id !== messageId));
        };

        const onTyping = ({ channelId, userId, userName }) => {
            if (channelId !== activeChannelId || userId === user?.id) return;
            clearTimeout(typingTimers.current[userId]);
            setTypingUsers(prev => ({ ...prev, [userId]: userName }));
            typingTimers.current[userId] = setTimeout(() => {
                setTypingUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
            }, 3000);
        };

        const onStopTyping = ({ channelId, userId }) => {
            if (channelId !== activeChannelId) return;
            clearTimeout(typingTimers.current[userId]);
            setTypingUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
        };

        const onReaction = ({ messageId, reactions, channelId }) => {
            if (channelId !== activeChannelId) return;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
        };

        socket.on("chat:message",         onMessage);
        socket.on("chat:message-updated", onUpdated);
        socket.on("chat:message-deleted", onDeleted);
        socket.on("chat:typing",          onTyping);
        socket.on("chat:stop-typing",     onStopTyping);
        socket.on("chat:reaction",        onReaction);

        return () => {
            socket.off("chat:message",         onMessage);
            socket.off("chat:message-updated", onUpdated);
            socket.off("chat:message-deleted", onDeleted);
            socket.off("chat:typing",          onTyping);
            socket.off("chat:stop-typing",     onStopTyping);
            socket.off("chat:reaction",        onReaction);
        };
    }, [socket, activeChannelId, user?.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const sendMessage = (text) => {
        if (!socket || !activeChannelId) return;
        socket.emit("chat:send", { channelId: activeChannelId, text });
    };

    const handleTyping = useCallback(() => {
        if (!socket || !activeChannelId) return;
        socket.emit("chat:typing", { channelId: activeChannelId });
    }, [socket, activeChannelId]);

    const handleStopTyping = useCallback(() => {
        if (!socket || !activeChannelId) return;
        socket.emit("chat:stop-typing", { channelId: activeChannelId });
    }, [socket, activeChannelId]);

    const handleEdit = useCallback((messageId, text) => {
        socket?.emit("chat:edit", { messageId, text });
    }, [socket]);

    const handleDelete = useCallback((messageId) => {
        if (!confirm("Delete this message?")) return;
        socket?.emit("chat:delete", { messageId });
    }, [socket]);

    const handleReact = useCallback((messageId, emoji) => {
        socket?.emit("chat:react", { messageId, emoji });
    }, [socket]);

    const startCall = async (channelId) => {
        try {
            const { data } = await api.get(`/chat/token?room=${channelId}`);
            setActiveCall({ token: data.token, url: data.url });
        } catch {
            toast.error("Could not start video call. LiveKit may not be configured.");
        }
    };

    const startDM = async (targetId) => {
        try {
            const { data } = await api.post("/chat/dm", { targetUserId: targetId });
            await refetchChannels();
            setActiveChannelId(data.channelId);
            setUserSearch("");
        } catch {
            toast.error("Could not start chat.");
        }
    };

    // Users query for search + add-member
    const { data: allUsers } = useQuery({
        queryKey: ["chatUsers"],
        queryFn:  () => api.get("/chat/users").then(r => r.data),
        enabled:  !!user,
        staleTime: 60_000,
    });

    const filteredUsers = (allUsers || []).filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase())
    );

    const groups = channels.filter(c => c.type === "team");
    const dms    = channels.filter(c => c.type === "dm");

    // Group messages by date
    const messagesByDate = messages.reduce((acc, msg) => {
        const key = fmtDate(msg.createdAt);
        if (!acc[key]) acc[key] = [];
        acc[key].push(msg);
        return acc;
    }, {});

    return (
        <div className="h-[calc(100vh-4rem)] bg-white rounded-2xl overflow-hidden border border-[#E4E4E7] shadow-sm flex">
            {activeCall ? (
                <Suspense fallback={
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-3">
                        <Loader2 className="animate-spin h-8 w-8 text-[#F97316]" />
                        <p className="text-gray-400 text-sm">Loading call…</p>
                    </div>
                }>
                    <VideoCall token={activeCall.token} url={activeCall.url} onLeave={() => setActiveCall(null)} />
                </Suspense>
            ) : (
                <div className="flex w-full h-full">
                    {/* ── Sidebar ─────────────────────────────────────────── */}
                    <div className="w-72 shrink-0 border-r border-[#E4E4E7] flex flex-col bg-white">
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between px-4 py-4 border-b border-[#E4E4E7]">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                                    <MessageSquare className="h-3.5 w-3.5 text-[#F97316]" />
                                </div>
                                <span className="font-bold text-[#18181B] text-sm">Messages</span>
                            </div>
                            <button onClick={() => setIsCreating(v => !v)}
                                className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F97316] hover:bg-[#FFF7ED] transition-colors"
                                title="New group">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-3 py-2.5 border-b border-[#E4E4E7]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
                                <input
                                    type="text"
                                    placeholder="Search contacts…"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 text-sm bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] placeholder:text-[#71717A]"
                                />
                            </div>
                        </div>

                        {/* Create group panel */}
                        {isCreating && (
                            <CreateGroupView
                                onClose={() => setIsCreating(false)}
                                users={allUsers}
                                onCreated={(channelId) => {
                                    refetchChannels();
                                    setActiveChannelId(channelId);
                                    setIsCreating(false);
                                }}
                            />
                        )}

                        {/* Channel lists */}
                        <div className="flex-1 overflow-y-auto py-2 space-y-1">
                            {userSearch ? (
                                <div className="px-2">
                                    <p className="px-2 py-1.5 text-[10px] font-bold text-[#71717A] uppercase tracking-widest">Contacts</p>
                                    {filteredUsers.length === 0
                                        ? <p className="px-3 py-4 text-sm text-[#71717A] text-center">No users found</p>
                                        : filteredUsers.map(u => (
                                            <button key={u.id} onClick={() => startDM(u.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#FFF7ED] transition-colors text-left">
                                                <img src={avatarUrl(u.name, u.image)} alt={u.name}
                                                    className="h-9 w-9 rounded-xl object-cover border border-[#E4E4E7]" />
                                                <div>
                                                    <p className="text-sm font-semibold text-[#18181B]">{u.name}</p>
                                                    <p className="text-xs text-[#71717A]">{u.jobTitle || u.role}</p>
                                                </div>
                                            </button>
                                        ))
                                    }
                                </div>
                            ) : (
                                <>
                                    {/* Groups */}
                                    <div className="px-2">
                                        <div className="flex items-center px-2 py-1.5">
                                            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest">Groups</span>
                                        </div>
                                        {groups.length === 0
                                            ? <p className="px-3 py-3 text-xs text-[#71717A] italic flex items-center gap-2"><Hash className="h-3 w-3" /> No groups yet</p>
                                            : groups.map(ch => (
                                                <ChannelPreview key={ch.id} channel={ch}
                                                    active={activeChannelId === ch.id}
                                                    onSelect={() => setActiveChannelId(ch.id)}
                                                    unread={unreadMap[ch.id] || 0}
                                                    currentUserId={user?.id}
                                                />
                                            ))
                                        }
                                    </div>

                                    {/* DMs */}
                                    <div className="px-2">
                                        <div className="flex items-center gap-2 px-2 py-1.5 mt-2">
                                            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest">Direct Messages</span>
                                        </div>
                                        {dms.length === 0
                                            ? <p className="px-3 py-3 text-xs text-[#71717A] italic flex items-center gap-2"><AtSign className="h-3 w-3" /> No direct messages</p>
                                            : dms.map(ch => (
                                                <ChannelPreview key={ch.id} channel={ch}
                                                    active={activeChannelId === ch.id}
                                                    onSelect={() => setActiveChannelId(ch.id)}
                                                    unread={unreadMap[ch.id] || 0}
                                                    currentUserId={user?.id}
                                                />
                                            ))
                                        }
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Chat area ───────────────────────────────────────── */}
                    <div className="flex-1 flex flex-col bg-white min-w-0">
                        {activeChannel ? (
                            <>
                                <ChannelHeader
                                    channel={activeChannel}
                                    currentUserId={user?.id}
                                    onCall={startCall}
                                    onAddMember={() => setShowAddMember(true)}
                                    onShowMembers={() => setShowMembers(true)}
                                />

                                {/* Messages list */}
                                <div className="flex-1 overflow-y-auto bg-[#FAFAFA] py-2">
                                    {loadingMessages ? (
                                        <div className="flex justify-center py-10">
                                            <Loader2 className="h-5 w-5 animate-spin text-[#F97316]" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-2 text-[#71717A]">
                                            <MessageSquare className="h-8 w-8 opacity-30" />
                                            <p className="text-sm">No messages yet. Say hi!</p>
                                        </div>
                                    ) : (
                                        Object.entries(messagesByDate).map(([date, msgs]) => (
                                            <div key={date}>
                                                <div className="flex items-center gap-3 px-4 py-2">
                                                    <div className="flex-1 h-px bg-[#E4E4E7]" />
                                                    <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide">{date}</span>
                                                    <div className="flex-1 h-px bg-[#E4E4E7]" />
                                                </div>
                                                {msgs.map(msg => (
                                                    <MessageBubble key={msg.id} msg={msg}
                                                        isOwn={msg.author?.id === user?.id}
                                                        onReact={handleReact}
                                                        onEdit={handleEdit}
                                                        onDelete={handleDelete}
                                                    />
                                                ))}
                                            </div>
                                        ))
                                    )}
                                    <div ref={bottomRef} />
                                </div>

                                <TypingIndicator typingUsers={typingUsers} />

                                <MessageInput
                                    onSend={sendMessage}
                                    onTyping={handleTyping}
                                    onStopTyping={handleStopTyping}
                                />

                                {showAddMember && (
                                    <AddMemberModal
                                        channel={activeChannel}
                                        allUsers={allUsers}
                                        onClose={() => setShowAddMember(false)}
                                        onAdded={refetchChannels}
                                    />
                                )}
                                {showMembers && (
                                    <MemberListModal
                                        channel={activeChannel}
                                        currentUserId={user?.id}
                                        onClose={() => setShowMembers(false)}
                                        onRemoved={refetchChannels}
                                    />
                                )}
                            </>
                        ) : (
                            <EmptyState />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Create Group panel ────────────────────────────────────────────────────────
const CreateGroupView = ({ onClose, users, onCreated }) => {
    const [selected, setSelected] = useState([]);
    const [name, setName]         = useState("");
    const [search, setSearch]     = useState("");
    const [busy, setBusy]         = useState(false);

    const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const create = async () => {
        if (!name.trim())   { toast.warning("Enter a group name"); return; }
        if (!selected.length) { toast.warning("Select at least one member"); return; }
        setBusy(true);
        try {
            const { data } = await api.post("/chat/group", { name: name.trim(), members: selected });
            onCreated(data.channelId);
        } catch (e) {
            toast.error(`Failed to create group: ${e.response?.data?.error?.message || e.message}`);
        } finally {
            setBusy(false);
        }
    };

    const visible = (users || []).filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="border-b border-[#E4E4E7] bg-[#FFF7ED] p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wide">New Group</span>
                <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B]"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Group name…" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316] bg-white" />
            <input placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316] bg-white" />
            <div className="max-h-36 overflow-y-auto space-y-1 bg-white rounded-xl border border-[#E4E4E7] p-1">
                {visible.map(u => (
                    <button key={u.id} onClick={() => toggle(u.id)}
                        className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                            selected.includes(u.id) ? "bg-[#FFF7ED] text-[#F97316]" : "hover:bg-[#FAFAFA] text-[#18181B]",
                        )}>
                        <div className="h-6 w-6 rounded-lg bg-[#FED7AA] text-[#F97316] flex items-center justify-center text-[10px] font-bold shrink-0">
                            {u.name[0]}
                        </div>
                        <span className="flex-1 text-left truncate">{u.name}</span>
                        {selected.includes(u.id) && <Check className="h-3.5 w-3.5 text-[#F97316]" />}
                    </button>
                ))}
            </div>
            {selected.length > 0 && (
                <p className="text-[10px] text-[#71717A]">{selected.length} member{selected.length !== 1 ? "s" : ""} selected</p>
            )}
            <button onClick={create} disabled={busy}
                className="w-full py-2 bg-[#F97316] text-white rounded-xl text-sm font-semibold hover:bg-[#FB923C] transition-colors shadow-sm disabled:opacity-60">
                {busy ? "Creating…" : "Create Group"}
            </button>
        </div>
    );
};

// ── Add Member Modal ──────────────────────────────────────────────────────────
const AddMemberModal = ({ channel, onClose, allUsers, onAdded }) => {
    const [busy, setBusy] = useState(false);
    const memberIds = channel?.members?.map(m => m.id) || [];
    const available = (allUsers || []).filter(u => !memberIds.includes(u.id));

    const add = async (uid) => {
        setBusy(true);
        try {
            await api.post(`/chat/channels/${channel.id}/members`, { userId: uid });
            toast.success("Member added!");
            onAdded?.();
        } catch {
            toast.error("Failed to add member.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="Add Members" onClose={onClose}>
            {available.length === 0
                ? <p className="text-sm text-[#71717A] text-center py-6">All users are already members</p>
                : available.map(u => (
                    <div key={u.id} className="flex items-center gap-3 py-2">
                        <img src={avatarUrl(u.name, u.image)} alt={u.name}
                            className="h-9 w-9 rounded-xl border border-[#E4E4E7] object-cover" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[#18181B]">{u.name}</p>
                            <p className="text-xs text-[#71717A]">{u.jobTitle || u.role}</p>
                        </div>
                        <button onClick={() => add(u.id)} disabled={busy}
                            className="px-3 py-1.5 bg-[#F97316] text-white text-xs rounded-lg hover:bg-[#FB923C] disabled:opacity-50 transition-colors font-medium">
                            Add
                        </button>
                    </div>
                ))
            }
        </Modal>
    );
};

// ── Member List Modal ─────────────────────────────────────────────────────────
const MemberListModal = ({ channel, currentUserId, onClose, onRemoved }) => {
    const [busy, setBusy] = useState(false);
    const isAdmin = channel?.createdById === currentUserId;

    const remove = async (uid) => {
        if (!confirm("Remove this member?")) return;
        setBusy(true);
        try {
            await api.delete(`/chat/channels/${channel.id}/members/${uid}`);
            toast.success("Removed.");
            onRemoved?.();
        } catch {
            toast.error("Failed to remove.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title={`Members (${channel?.members?.length ?? 0})`} onClose={onClose}>
            {(channel?.members || []).map(m => {
                const isCreator  = m.id === channel?.createdById;
                const canRemove  = isAdmin && !isCreator && m.id !== currentUserId;
                return (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                        <img src={avatarUrl(m.name, m.image)} alt={m.name}
                            className="h-9 w-9 rounded-xl border border-[#E4E4E7] object-cover" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[#18181B] flex items-center gap-1.5">
                                {m.name}
                                {isCreator && (
                                    <span className="text-[9px] font-bold text-[#F97316] bg-[#FFF7ED] border border-[#FED7AA] px-1.5 py-0.5 rounded-full">ADMIN</span>
                                )}
                            </p>
                            <p className="text-xs text-[#71717A]">{m.role || "Member"}</p>
                        </div>
                        {canRemove && (
                            <button onClick={() => remove(m.id)} disabled={busy}
                                className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium">
                                Remove
                            </button>
                        )}
                    </div>
                );
            })}
        </Modal>
    );
};

// ── Reusable Modal shell ──────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-[#E4E4E7]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7]">
                <h2 className="font-bold text-[#18181B]">{title}</h2>
                <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">{children}</div>
        </div>
    </div>
);

export default Messages;
