import { useState, lazy, Suspense } from "react";
import {
    Chat,
    Channel,
    MessageInput,
    MessageList,
    Thread,
    Window,
    ChannelList,
    useChatContext,
    useChannelStateContext,
    MessageSimple,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";

// Video calling pulls in the heavy @stream-io/video-react-sdk. Load it only
// when a call actually starts, so opening Messages stays light.
const VideoCall = lazy(() => import("../components/VideoCall"));

import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import api from "../api/axios";
import { toast } from "sonner";
import {
    Loader2, Video, Search, Plus, X, UserPlus, Users,
    Check, CheckCheck, MessageSquare, Hash, AtSign,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// ── helpers ───────────────────────────────────────────────────────────────────
const avatarUrl = (name, img) =>
    img || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=FED7AA&color=F97316`;

const statusDot = (status) => {
    const map = { ONLINE: "bg-green-500", BREAK: "bg-yellow-400", OFFLINE: "bg-gray-300" };
    return map[status] || map.OFFLINE;
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

// ── Read receipts / status ────────────────────────────────────────────────────
const CustomMessageStatus = ({ message }) => {
    const { client } = useChatContext();
    if (!message || !client) return null;
    if (message.user?.id !== client.userID) return null;
    const isRead = (message.read_by || []).length > 0;
    if (message.status === "sending")
        return <span className="text-[10px] text-[#71717A] ml-1 italic">sending…</span>;
    if (isRead)
        return <CheckCheck className="h-3 w-3 text-[#F97316] ml-1 inline-block" strokeWidth={3} title="Read" />;
    if (message.status === "received")
        return <CheckCheck className="h-3 w-3 text-[#71717A] ml-1 inline-block" strokeWidth={3} title="Delivered" />;
    return <Check className="h-3 w-3 text-[#71717A] ml-1 inline-block" strokeWidth={3} title="Sent" />;
};

const CustomMessage = (props) => <MessageSimple {...props} MessageStatus={CustomMessageStatus} />;

// ── Typing indicator ──────────────────────────────────────────────────────────
const CustomTypingIndicator = () => {
    const { typing } = useChannelStateContext();
    const { client } = useChatContext();
    if (!typing || !client) return null;
    const names = Object.values(typing)
        .filter(t => t.user?.id !== client.userID)
        .map(t => t.user?.name?.split(" ")[0] || "Someone");
    if (!names.length) return null;
    return (
        <div className="px-4 py-2 bg-white text-[11px] text-[#F97316] font-semibold italic flex items-center gap-2 border-t border-[#E4E4E7]">
            <span className="flex gap-0.5">
                {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-[#F97316] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
            </span>
            <span>{names.length === 1 ? `${names[0]} is typing…` : `${names.join(", ")} are typing…`}</span>
        </div>
    );
};

// ── Channel preview ───────────────────────────────────────────────────────────
const CustomChannelPreview = ({ channel, active, onSelect, latestMessage, unread }) => {
    const { user } = useAuth();
    const members = Object.values(channel.state.members).filter(m => m.user?.id !== user?.id);
    const name    = channel.data.name || members.map(m => m.user?.name).join(", ") || "Chat";
    const img     = channel.data.image || members[0]?.user?.image;
    const otherUser = channel.type === "messaging" ? members[0]?.user : null;
    const status  = otherUser?.online_status || "OFFLINE";
    const time    = latestMessage?.created_at
        ? new Date(latestMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
    const preview = latestMessage?.text || "No messages yet";
    const isGroup = channel.type === "team";

    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mx-1 transition-all text-left ${
                active ? "bg-[#FFF7ED] shadow-sm" : "hover:bg-[#FAFAFA]"
            }`}
        >
            <div className="relative shrink-0">
                {isGroup ? (
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        active ? "bg-[#F97316] text-white" : "bg-[#FED7AA] text-[#F97316]"
                    }`}>
                        <Hash className="h-4 w-4" />
                    </div>
                ) : (
                    <img src={avatarUrl(name, img)} alt={name}
                        className="h-10 w-10 rounded-xl object-cover border border-[#E4E4E7]" />
                )}
                {!isGroup && (
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${statusDot(status)}`} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold truncate ${active ? "text-[#F97316]" : "text-[#18181B]"}`}>{name}</span>
                    <span className="text-[10px] text-[#71717A] shrink-0 ml-1">{time}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-xs truncate ${unread > 0 ? "font-semibold text-[#18181B]" : "text-[#71717A]"}`}>{preview}</span>
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

// ── Channel header ────────────────────────────────────────────────────────────
const CustomChannelHeader = ({ onCall, onAddMember, onShowMembers }) => {
    const { channel } = useChatContext();
    const { user } = useAuth();
    const members = Object.values(channel?.state?.members || {}).filter(m => m.user?.id !== user?.id);
    const name    = channel?.data?.name || members.map(m => m.user?.name).join(", ") || "Chat";
    const isTeam  = channel?.type === "team";
    const memberCount = Object.values(channel?.state?.members || {}).length;
    const otherUser   = !isTeam ? members[0]?.user : null;
    const status      = otherUser?.online_status || "OFFLINE";
    const statusLabel = { ONLINE: "Online", BREAK: "On Break", OFFLINE: "Offline" }[status] || "Offline";
    const statusColor = { ONLINE: "text-green-600", BREAK: "text-yellow-600", OFFLINE: "text-[#71717A]" }[status] || "text-[#71717A]";

    return (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E4E7] bg-white shrink-0">
            <div className="flex items-center gap-3">
                {isTeam ? (
                    <div className="h-9 w-9 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center">
                        <Hash className="h-4 w-4 text-[#F97316]" />
                    </div>
                ) : (
                    <div className="relative">
                        <img src={avatarUrl(name, otherUser?.image)} alt={name}
                            className="h-9 w-9 rounded-xl object-cover border border-[#E4E4E7]" />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${statusDot(status)}`} />
                    </div>
                )}
                <div>
                    <p className="font-bold text-[#18181B] text-sm leading-tight">{name}</p>
                    <p className={`text-[11px] font-medium ${isTeam ? "text-[#71717A]" : statusColor}`}>
                        {isTeam ? `${memberCount} member${memberCount !== 1 ? "s" : ""}` : statusLabel}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                {isTeam && (
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
                <button onClick={() => onCall?.(channel?.id)}
                    className="p-2 rounded-xl bg-[#F97316] text-white hover:bg-[#FB923C] transition-colors shadow-sm" title="Video call">
                    <Video className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const Messages = () => {
    const { user } = useAuth();
    const { chatClient, videoCreds } = useChat();
    const [isCreating,    setIsCreating]    = useState(false);
    const [activeCall,    setActiveCall]    = useState(null);
    const [userSearch,    setUserSearch]    = useState("");
    const [activeChannel, setActiveChannel] = useState(null);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showMembers,   setShowMembers]   = useState(false);

    const { data: allUsers } = useQuery({
        queryKey: ["chatUsers"],
        queryFn:  () => api.get("/chat/users").then(r => r.data),
        enabled:  !!user,
    });

    const startDM = async (targetId) => {
        try {
            const { data } = await api.post("/chat/start", { targetUserId: targetId });
            const ch = chatClient.channel("messaging", data.cid.split(":")[1]);
            await ch.watch();
            setActiveChannel(ch);
            setUserSearch("");
        } catch {
            toast.error("Could not start chat. Please try again.");
        }
    };

    const filteredUsers = (allUsers || []).filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    // Chat connection is owned by ChatContext (connects once after login).
    if (!chatClient) return (
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#FAFAFA]">
            <div className="h-12 w-12 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center mb-4">
                <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
            </div>
            <p className="text-sm font-medium text-[#71717A]">Connecting to chat…</p>
        </div>
    );

    return (
        <div className="h-[calc(100vh-4rem)] bg-white rounded-2xl overflow-hidden border border-[#E4E4E7] shadow-sm flex">
            <Chat client={chatClient} theme="messaging light">
                {activeCall ? (
                    <Suspense fallback={
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-3">
                            <Loader2 className="animate-spin h-8 w-8 text-[#F97316]" />
                            <p className="text-gray-400 text-sm">Loading call…</p>
                        </div>
                    }>
                        <VideoCall creds={videoCreds} callId={activeCall} onLeave={() => setActiveCall(null)} />
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
                                    client={chatClient}
                                    users={allUsers}
                                    currentUser={user}
                                    setActiveChannel={setActiveChannel}
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
                                                    <div className="relative">
                                                        <img src={avatarUrl(u.name, u.image)} alt={u.name}
                                                            className="h-9 w-9 rounded-xl object-cover border border-[#E4E4E7]" />
                                                    </div>
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
                                            <ChannelList
                                                filters={{ type: "team", members: { $in: [user.id] } }}
                                                sort={{ last_message_at: -1 }}
                                                options={{ limit: 10 }}
                                                showChannelSearch={false}
                                                setActiveChannelOnMount={false}
                                                EmptyStateIndicator={() => (
                                                    <div className="px-3 py-3 text-xs text-[#71717A] italic flex items-center gap-2">
                                                        <Hash className="h-3 w-3" /> No groups yet
                                                    </div>
                                                )}
                                                Preview={props => (
                                                    <CustomChannelPreview
                                                        {...props}
                                                        onSelect={() => {
                                                            props.setActiveChannel(props.channel);
                                                            setActiveChannel(props.channel);
                                                        }}
                                                        active={activeChannel?.id === props.channel.id}
                                                    />
                                                )}
                                            />
                                        </div>

                                        {/* Direct Messages */}
                                        <div className="px-2">
                                            <div className="flex items-center gap-2 px-2 py-1.5 mt-2">
                                                <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest">Direct Messages</span>
                                            </div>
                                            <ChannelList
                                                filters={{ type: "messaging", members: { $in: [user.id] }, name: { $exists: false } }}
                                                sort={{ last_message_at: -1 }}
                                                options={{ limit: 20 }}
                                                showChannelSearch={false}
                                                setActiveChannelOnMount={false}
                                                EmptyStateIndicator={() => (
                                                    <div className="px-3 py-3 text-xs text-[#71717A] italic flex items-center gap-2">
                                                        <AtSign className="h-3 w-3" /> No direct messages
                                                    </div>
                                                )}
                                                Preview={props => (
                                                    <CustomChannelPreview
                                                        {...props}
                                                        onSelect={() => {
                                                            props.setActiveChannel(props.channel);
                                                            setActiveChannel(props.channel);
                                                        }}
                                                        active={activeChannel?.id === props.channel.id}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── Chat area ───────────────────────────────────────── */}
                        <div className="flex-1 flex flex-col bg-white min-w-0">
                            <Channel
                                channel={activeChannel}
                                Message={CustomMessage}
                                TypingIndicator={CustomTypingIndicator}
                            >
                                <Window>
                                    {activeChannel ? (
                                        <>
                                            <CustomChannelHeader
                                                onCall={id => setActiveCall(id)}
                                                onAddMember={() => setShowAddMember(true)}
                                                onShowMembers={() => setShowMembers(true)}
                                            />
                                            <MessageList
                                                messageActions={["react", "reply", "edit", "delete", "flag", "pin"]}
                                                enableReactionClick
                                                threadList
                                            />
                                            <MessageInput focus />

                                            {showAddMember && (
                                                <AddMemberModal
                                                    channel={activeChannel}
                                                    onClose={() => setShowAddMember(false)}
                                                    allUsers={allUsers}
                                                    currentUser={user}
                                                />
                                            )}
                                            {showMembers && (
                                                <MemberListModal
                                                    channel={activeChannel}
                                                    onClose={() => setShowMembers(false)}
                                                    currentUser={user}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <EmptyState />
                                    )}
                                </Window>
                                <Thread />
                            </Channel>
                        </div>
                    </div>
                )}
            </Chat>
        </div>
    );
};

// ── Create Group panel ────────────────────────────────────────────────────────
const CreateGroupView = ({ onClose, client, users, currentUser, setActiveChannel }) => {
    const [selected, setSelected] = useState([]);
    const [name, setName]         = useState("");
    const [search, setSearch]     = useState("");

    const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const create = async () => {
        if (!name.trim()) { toast.warning("Enter a group name"); return; }
        if (!selected.length) { toast.warning("Select at least one member"); return; }
        try {
            // Create the group server-side: the backend upserts every member into
            // Stream BEFORE creating the channel, so the create can't fail with
            // "users don't exist". We then watch the returned channel locally.
            const { data } = await api.post("/chat/group", {
                name: name.trim(),
                members: selected,
            });
            const ch = client.channel("team", data.cid.split(":")[1]);
            await ch.watch();
            setActiveChannel(ch);
            onClose();
        } catch (e) {
            toast.error(`Failed to create group: ${e.response?.data?.message || e.message}`);
        }
    };

    const visible = (users || []).filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="border-b border-[#E4E4E7] bg-[#FFF7ED] p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wide">New Group</span>
                <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <input
                placeholder="Group name…"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316] bg-white"
            />
            <input
                placeholder="Search members…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F97316] bg-white"
            />
            <div className="max-h-36 overflow-y-auto space-y-1 bg-white rounded-xl border border-[#E4E4E7] p-1">
                {visible.map(u => (
                    <button key={u.id} onClick={() => toggle(u.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                            selected.includes(u.id) ? "bg-[#FFF7ED] text-[#F97316]" : "hover:bg-[#FAFAFA] text-[#18181B]"
                        }`}>
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
            <button onClick={create}
                className="w-full py-2 bg-[#F97316] text-white rounded-xl text-sm font-semibold hover:bg-[#FB923C] transition-colors shadow-sm">
                Create Group
            </button>
        </div>
    );
};

// ── Add Member Modal ──────────────────────────────────────────────────────────
const AddMemberModal = ({ channel, onClose, allUsers }) => {
    const [busy, setBusy] = useState(false);
    const memberIds = Object.keys(channel?.state?.members || {});
    const available = (allUsers || []).filter(u => !memberIds.includes(u.id));

    const add = async (uid) => {
        setBusy(true);
        try {
            await api.post("/chat/sync-user", { userId: uid });
            await channel.addMembers([uid]);
            toast.success("Member added!");
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
                        <img src={avatarUrl(u.name, u.image)} alt={u.name} className="h-9 w-9 rounded-xl border border-[#E4E4E7] object-cover" />
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
const MemberListModal = ({ channel, onClose, currentUser }) => {
    const [busy, setBusy] = useState(false);
    const members  = Object.values(channel?.state?.members || {});
    const isAdmin  = channel?.data?.created_by_id === currentUser?.id;

    const remove = async (uid) => {
        if (!confirm("Remove this member?")) return;
        setBusy(true);
        try {
            await channel.removeMembers([uid]);
            toast.success("Removed.");
        } catch {
            toast.error("Failed to remove.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title={`Members (${members.length})`} onClose={onClose}>
            {members.map(m => {
                const isCreator = m.user_id === channel?.data?.created_by_id;
                const canRemove = isAdmin && !isCreator && m.user_id !== currentUser?.id;
                return (
                    <div key={m.user_id} className="flex items-center gap-3 py-2">
                        <img
                            src={m.user?.image || avatarUrl(m.user?.name)}
                            alt={m.user?.name}
                            className="h-9 w-9 rounded-xl border border-[#E4E4E7] object-cover"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[#18181B] flex items-center gap-1.5">
                                {m.user?.name}
                                {isCreator && (
                                    <span className="text-[9px] font-bold text-[#F97316] bg-[#FFF7ED] border border-[#FED7AA] px-1.5 py-0.5 rounded-full">ADMIN</span>
                                )}
                            </p>
                            <p className="text-xs text-[#71717A]">{m.user?.role || "Member"}</p>
                        </div>
                        {canRemove && (
                            <button onClick={() => remove(m.user_id)} disabled={busy}
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
