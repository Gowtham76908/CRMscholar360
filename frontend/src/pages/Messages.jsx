import { useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
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
import {
    StreamVideo,
    StreamVideoClient,
    StreamCall,
    StreamTheme,
    SpeakerLayout,
    CallControls,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Loader2, Video, Search, Plus, X, User, UserPlus, Users, Check, CheckCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Custom Empty State for when no chat is selected
const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
        <div className="bg-indigo-100 p-4 rounded-full mb-4">
            <User className="h-12 w-12 text-indigo-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Conversation</h3>
        <p className="text-gray-500 max-w-sm">
            Choose a contact from the sidebar or start a new chat to begin messaging.
        </p>
    </div>
);

// WhatsApp-style Message Status Ticks
const CustomMessageStatus = ({ message }) => {
    const { client } = useChatContext();
    if (!message || !client) return null;
    
    // Only show ticks for my own messages
    const isMe = message.user?.id === client.userID;
    if (!isMe) return null;

    const status = message.status;
    // In Stream, message.read_by is an array of users who have read the message
    const readBy = message.read_by || [];
    const isRead = readBy.length > 0;

    if (status === 'sending') {
        return <span className="text-[10px] text-gray-400 ml-1 opacity-50 italic">sending...</span>;
    }

    if (isRead) {
        return <CheckCheck className="h-3.5 w-3.5 text-blue-500 ml-1 inline-block" strokeWidth={3} title="Read" />;
    }

    if (status === 'received') {
        return <CheckCheck className="h-3.5 w-3.5 text-gray-400 ml-1 inline-block" strokeWidth={3} title="Delivered" />;
    }

    return <Check className="h-3.5 w-3.5 text-gray-400 ml-1 inline-block" strokeWidth={3} title="Sent" />;
};

// WhatsApp-style Custom Message component
const CustomMessage = (props) => {
    return (
        <MessageSimple 
            {...props} 
            MessageStatus={CustomMessageStatus}
        />
    );
};

// WhatsApp-style Typing Indicator
const CustomTypingIndicator = () => {
    const { typing } = useChannelStateContext();
    const { client } = useChatContext();

    if (!typing || !client) return null;

    const typingUsers = Object.values(typing)
        .filter(t => t.user?.id !== client.userID)
        .map(t => t.user?.name || "Someone");

    if (typingUsers.length === 0) return null;

    return (
        <div className="px-4 py-1.5 bg-white/95 backdrop-blur-sm text-[11px] text-indigo-600 font-bold italic animate-pulse border-t border-indigo-50 flex items-center gap-2">
            <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
            </div>
            <span>
                {typingUsers.length === 1 
                    ? `${typingUsers[0]} is typing...` 
                    : `${typingUsers.join(", ")} are typing...`}
            </span>
        </div>
    );
};

const Messages = () => {
    const { user } = useAuth();
    const [chatClient, setChatClient] = useState(null);
    const [videoClient, setVideoClient] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [activeCall, setActiveCall] = useState(null);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [activeChannel, setActiveChannel] = useState(null);
    const [initError, setInitError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showMemberList, setShowMemberList] = useState(false);
    const [showMessageInfo, setShowMessageInfo] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);

    // Fetch users for search
    const { data: allUsers } = useQuery({
        queryKey: ["chatUsers"],
        queryFn: async () => (await api.get("/chat/users")).data,
        enabled: !!user
    });

    // Initialize Clients
    useEffect(() => {
        let _chatClient;
        let _videoClient;
        let isViewMounted = true;

        const init = async () => {
            setLoading(true);
            setInitError(null);
            console.log("Starting Stream initialization...");
            
            try {
                const response = await api.post("/chat/token");
                const { token, apiKey, user: streamUser } = response.data;

                if (!isViewMounted) return;

                const client = StreamChat.getInstance(apiKey);
                
                // Only connect if not already connected to the same user
                if (client.userID !== streamUser.id) {
                    await client.connectUser(streamUser, token);
                }
                
                _chatClient = client;

                const vClient = new StreamVideoClient({ apiKey, user: streamUser, token });
                _videoClient = vClient;

                if (isViewMounted) {
                    setChatClient(client);
                    setVideoClient(vClient);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Stream init error:", error);
                if (isViewMounted) {
                    setInitError("Failed to connect to chat server. Please check your connection.");
                    setLoading(false);
                }
            }
        };

        if (user) {
            init();
        } else {
            setLoading(false);
        }

        return () => {
            isViewMounted = false;
            if (_chatClient) _chatClient.disconnectUser().catch(console.error);
            if (_videoClient) _videoClient.disconnectUser().catch(console.error);
        };
    }, [user]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white">
                <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mb-4" />
                <p className="text-gray-500 font-medium animate-pulse">Connecting to chat...</p>
            </div>
        );
    }

    if (initError) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                    <X className="h-10 w-10 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
                <p className="text-gray-500 max-w-xs mb-6">{initError}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (!chatClient || !videoClient) return null;

    const startDirectChat = async (otherUserId) => {
        try {
            // Call backend to sync users and create channel
            const response = await api.post("/chat/start", { targetUserId: otherUserId });
            const { cid } = response.data;

            // We can now access the channel locally since backend created it
            const channel = chatClient.channel("messaging", cid.split(":")[1]);
            await channel.watch(); // Watch ensures we have latest state

            setActiveChannel(channel);
            setUserSearchTerm(""); // Clear search

        } catch (error) {
            console.error("Failed to start chat:", error);
            alert("Could not start chat. Please try again.");
        }
    };

    const filteredUsers = allUsers?.filter(u =>
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
    ) || [];

    return (
        <div className="h-[calc(100vh-4rem)] bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
            {/* Unified Chat Provider */}
            <Chat client={chatClient} theme="messaging light">
                {activeCall ? (
                    <VideoCallComponent client={videoClient} callId={activeCall} onLeave={() => setActiveCall(null)} />
                ) : (
                    <div className="flex w-full h-full">
                        {/* Sidebar */}
                        <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                                <h2 className="font-bold text-xl text-gray-800 tracking-tight">Messages</h2>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="p-2 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors"
                                    title="New Group"
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                            </div>

                            {/* User Search Bar */}
                            <div className="p-3 bg-white border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search contacts..."
                                        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            {isCreating && (
                                <CreateGroupView
                                    onClose={() => setIsCreating(false)}
                                    client={chatClient}
                                    users={allUsers}
                                    currentUser={user}
                                    setActiveChannel={setActiveChannel}
                                />
                            )}

                            {/* Search Results OR Channel List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {userSearchTerm ? (
                                    <div className="p-2 space-y-1">
                                        <h3 className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Contacts</h3>
                                        {filteredUsers.length === 0 && <p className="px-4 py-2 text-sm text-gray-400 text-center">No users found</p>}
                                        {filteredUsers.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => startDirectChat(u.id)}
                                                className="w-full flex items-center p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-left group"
                                            >
                                                <div className="relative">
                                                    <img src={u.image} alt={u.name} className="h-10 w-10 rounded-full border border-gray-100 object-cover" />
                                                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{u.name}</div>
                                                    <div className="text-xs text-gray-500">{u.role}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        {/* Groups Section */}
                                        <div className="pt-2">
                                            <div className="px-4 py-2 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                <span>Teams / Groups</span>
                                                <span className="bg-gray-200 text-gray-600 px-1.5 rounded-full text-[10px]">beta</span>
                                            </div>
                                            <ChannelList
                                                filters={{ type: "team", members: { $in: [user.id] } }}
                                                sort={{ last_message_at: -1 }}
                                                options={{ limit: 10 }}
                                                showChannelSearch={false}
                                                setActiveChannelOnMount={false}
                                                EmptyStateIndicator={() => <div className="px-4 py-2 text-sm text-gray-400 italic">No groups yet</div>}
                                                Preview={(props) => (
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

                                        {/* Direct Messages Section */}
                                        <div className="pt-2">
                                            <h3 className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Direct Messages</h3>
                                            <ChannelList
                                                filters={{
                                                    type: "messaging",
                                                    members: { $in: [user.id] },
                                                    name: { $exists: false }
                                                }}
                                                sort={{ last_message_at: -1 }}
                                                options={{ limit: 20 }}
                                                showChannelSearch={false}
                                                setActiveChannelOnMount={false}
                                                EmptyStateIndicator={() => <div className="px-4 py-2 text-sm text-gray-400 italic">No direct messages</div>}
                                                Preview={(props) => (
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
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Chat Window */}
                        <div className="flex-1 flex flex-col bg-white min-w-0 relative">
                            <Channel 
                                channel={activeChannel}
                                Message={CustomMessage}
                                TypingIndicator={CustomTypingIndicator}
                            >
                                <Window>
                                    {activeChannel ? (
                                        <>
                                            <CustomChannelHeader
                                                onCall={(id) => setActiveCall(id)}
                                                onAddMember={() => setShowAddMember(true)}
                                                onShowMembers={() => setShowMemberList(true)}
                                            />
                                            <MessageList
                                                messageActions={['react', 'reply', 'edit', 'delete', 'flag', 'pin']}
                                                enableReactionClick={true}
                                                threadList={true}
                                                customMessageActions={{
                                                    'Message Info': (message) => {
                                                        // Only show in group chats
                                                        if (activeChannel?.type === 'team') {
                                                            setSelectedMessage(message);
                                                            setShowMessageInfo(true);
                                                        }
                                                    }
                                                }}
                                            />
                                            {/* Explicitly enable file uploads and focus */}
                                            <MessageInput focus />

                                            {/* Member Management Modals */}
                                            {showAddMember && (
                                                <AddMemberModal
                                                    channel={activeChannel}
                                                    onClose={() => setShowAddMember(false)}
                                                    allUsers={allUsers}
                                                    currentUser={user}
                                                />
                                            )}
                                            {showMemberList && (
                                                <MemberListModal
                                                    channel={activeChannel}
                                                    onClose={() => setShowMemberList(false)}
                                                    currentUser={user}
                                                />
                                            )}
                                            {showMessageInfo && selectedMessage && (
                                                <MessageInfoModal
                                                    message={selectedMessage}
                                                    channel={activeChannel}
                                                    onClose={() => {
                                                        setShowMessageInfo(false);
                                                        setSelectedMessage(null);
                                                    }}
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

// Custom Channel Preview for the List
const CustomChannelPreview = ({ channel, active, onSelect, latestMessage }) => {
    const { user } = useAuth();
    const members = Object.values(channel.state.members).filter(m => m.user?.id !== user?.id);
    const displayImage = channel.data.image || members[0]?.user?.image;
    const displayName = channel.data.name || members.map(m => m.user?.name).join(", ");

    // Format date
    const lastMessageDate = latestMessage?.created_at ? new Date(latestMessage.created_at) : new Date(channel.data.created_at);
    const timeString = lastMessageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-center p-3 border-b border-gray-50 transition-colors ${active ? "bg-indigo-50 border-l-4 border-l-indigo-600" : "hover:bg-gray-50 border-l-4 border-l-transparent"}`}
        >
            <div className={`relative ${active ? "ring-2 ring-indigo-200 rounded-full" : ""}`}>
                <img src={displayImage || "https://ui-avatars.com/api/?name=" + displayName} alt={displayName} className="h-12 w-12 rounded-full object-cover" />
                {/* Online status indicator could go here */}
            </div>
            <div className="ml-3 flex-1 overflow-hidden text-left">
                <div className="flex justify-between items-baseline">
                    <span className={`text-sm font-semibold truncate ${active ? "text-indigo-900" : "text-gray-900"}`}>{displayName}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeString}</span>
                </div>
                <div className={`text-xs truncate mt-0.5 ${latestMessage?.status === 'unread' ? "font-bold text-gray-900" : "text-gray-500"}`}>
                    {latestMessage?.text || "No messages yet"}
                </div>
            </div>
        </button>
    );
};


// Custom Header with Video Call Button
const CustomChannelHeader = ({ onCall, onAddMember, onShowMembers }) => {
    const { channel, client } = useChatContext();
    const { user } = useAuth();

    // Derive all display variables from channel state
    const members = Object.values(channel?.state?.members || {}).filter(m => m.user?.id !== user?.id);
    const displayName = channel?.data?.name || members.map(m => m.user?.name).join(", ") || "Chat";
    const isTeamChannel = channel?.type === 'team';
    const isAdmin = channel?.data?.created_by_id === user?.id;
    const totalMemberCount = Object.values(channel?.state?.members || {}).length;
    const memberSubtext = isTeamChannel
        ? `${totalMemberCount} member${totalMemberCount !== 1 ? 's' : ''}`
        : members[0]?.user?.name || "";

    const startCall = () => {
        if (!channel?.id) {
            console.error('Channel not available');
            return;
        }
        const callId = channel.id;
        onCall(callId);
    };

    // Calculate display status for DMs
    const isDM = channel?.type === 'messaging';
    const otherMember = members[0]?.user;
    const onlineStatus = otherMember?.online_status || (otherMember?.online ? 'ONLINE' : 'OFFLINE');

    const getStatusUI = () => {
        if (!isDM || !otherMember) return null;
        switch (onlineStatus) {
            case 'ONLINE':
                return { text: 'Online', color: 'bg-green-500', textColor: 'text-green-600' };
            case 'BREAK':
                return { text: 'On Break', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
            default:
                return { text: 'Offline', color: 'bg-gray-400', textColor: 'text-gray-400' };
        }
    };

    const statusUI = getStatusUI();

    return (
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {displayName[0]?.toUpperCase()}
                    </div>
                    {statusUI && (
                        <div className={`absolute bottom-0 right-0 h-3 w-3 ${statusUI.color} border-2 border-white rounded-full shadow-sm`}></div>
                    )}
                </div>
                <div>
                    <div className="font-bold text-gray-900 leading-tight">
                        {displayName}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {statusUI ? (
                            <span className={`text-[11px] font-semibold ${statusUI.textColor} uppercase tracking-wider`}>
                                {statusUI.text}
                            </span>
                        ) : (
                            <div className="text-xs text-gray-500 cursor-pointer hover:text-indigo-600" onClick={onShowMembers}>
                                {memberSubtext}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isTeamChannel && onShowMembers && (
                    <button
                        onClick={onShowMembers}
                        className="p-2.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 hover:shadow-md transition-all active:scale-95"
                        title="View Members"
                    >
                        <Users className="h-5 w-5" />
                    </button>
                )}
                {isTeamChannel && onAddMember && (
                    <button
                        onClick={onAddMember}
                        className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 hover:shadow-md transition-all active:scale-95"
                        title={`Add Member ${isAdmin ? '(Admin)' : '(Testing)'}`}
                    >
                        <UserPlus className="h-5 w-5" />
                    </button>
                )}
                <button
                    onClick={startCall}
                    className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95"
                    title="Start Video Call"
                >
                    <Video className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

// Video Call Interface
const VideoCallComponent = ({ client, callId, onLeave }) => {
    const [call, setCall] = useState(null);
    const [callError, setCallError] = useState(null);
    const callRef = useRef(null);

    useEffect(() => {
        const c = client.call("default", callId);
        callRef.current = c;
        c.join({ create: true })
            .then(() => setCall(c))
            .catch((err) => {
                console.error("Failed to join call:", err);
                setCallError("Failed to connect to call. Please try again.");
            });

        return () => {
            callRef.current?.leave().catch(console.error);
        };
    }, [client, callId]);

    if (callError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-4">
                <p className="text-red-400">{callError}</p>
                <button onClick={onLeave} className="bg-red-600 text-white px-4 py-2 rounded-lg">Go Back</button>
            </div>
        );
    }

    if (!call) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-3">
                <Loader2 className="animate-spin h-8 w-8 text-indigo-400" />
                <p className="text-gray-400">Connecting to call...</p>
            </div>
        );
    }

    return (
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <div className="w-full h-full flex flex-col bg-gray-950 text-white relative">
                    <div className="absolute top-4 left-4 z-50">
                        <button onClick={onLeave} className="bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium shadow-lg backdrop-blur-sm transition-colors">
                            End Call
                        </button>
                    </div>
                    <StreamTheme>
                        <SpeakerLayout />
                        <CallControls onLeave={onLeave} />
                    </StreamTheme>
                </div>
            </StreamCall>
        </StreamVideo>
    );
};

// Create Group Modal
const CreateGroupView = ({ onClose, client, users, currentUser, setActiveChannel }) => {
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState("");

    const handleCreate = async () => {
        if (!groupName) return alert("Please enter a group name");
        if (selectedUsers.length === 0) return alert("Select at least one member");

        try {
            // Step 1: Sync all selected users to Stream Chat first
            console.log("Syncing selected users to Stream Chat:", selectedUsers);
            for (const userId of selectedUsers) {
                try {
                    await api.post("/chat/sync-user", { userId });
                } catch (syncError) {
                    console.error(`Failed to sync user ${userId}:`, syncError);
                    // Continue anyway - user might already be synced
                }
            }

            // Step 2: Generate a unique ID for the team channel
            const channelId = `group-${Date.now()}`;

            // Step 3: Create the channel with all members
            const channel = client.channel("team", channelId, {
                name: groupName,
                members: [currentUser.id, ...selectedUsers],
                created_by_id: currentUser.id
            });

            await channel.create();

            // Immediately set as active channel
            setActiveChannel(channel);
            onClose();
        } catch (error) {
            console.error("Error creating group:", error);
            alert(`Failed to create group: ${error.message || "Please try again."}`);
        }
    };

    const toggleUser = (id) => {
        if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(u => u !== id));
        else setSelectedUsers([...selectedUsers, id]);
    };

    return (
        <div className="p-4 border-b border-gray-200 bg-indigo-50/50 space-y-3 shadow-inner">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm text-indigo-900">Create New Group</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>

            <input
                placeholder="Group Name (e.g. Marketing Team)"
                className="w-full p-2 border border-gray-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
            />

            <div className="text-xs font-medium text-gray-500 uppercase mt-2">Select Members</div>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-white border border-gray-200 rounded p-1">
                {users?.map(u => (
                    <div
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        className={`p-2 text-sm cursor-pointer rounded flex justify-between items-center ${selectedUsers.includes(u.id) ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50"}`}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">{u.name[0]}</div>
                            <span>{u.name}</span>
                        </div>
                        {selectedUsers.includes(u.id) && <div className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </div>
                ))}
            </div>

            <button onClick={handleCreate} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium transition-colors shadow-sm">
                Create Group
            </button>
        </div>
    );
};

// Add Member Modal
const AddMemberModal = ({ channel, onClose, allUsers, currentUser }) => {
    const [loading, setLoading] = useState(false);

    const currentMemberIds = Object.keys(channel?.state?.members || {});
    console.log("Current member IDs:", currentMemberIds);
    console.log("All users:", allUsers?.map(u => ({ id: u.id, name: u.name })));

    const availableUsers = allUsers?.filter(u => !currentMemberIds.includes(u.id)) || [];
    console.log("Available users to add:", availableUsers?.map(u => ({ id: u.id, name: u.name })));

    const handleAddMember = async (userId) => {
        setLoading(true);
        try {
            // Step 1: Sync user to Stream Chat first
            console.log("Syncing user to Stream:", userId);
            await api.post("/chat/sync-user", { userId });

            // Step 2: Add member to channel
            console.log("Adding member to channel:", userId);
            await channel.addMembers([userId]);

            alert("Member added successfully!");
        } catch (error) {
            console.error("Failed to add member:", error);
            alert(`Failed to add member: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Add Members</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Debug Info */}
                    <div className="mb-3 p-2 bg-gray-100 rounded text-xs">
                        <div>Total Users: {allUsers?.length || 0}</div>
                        <div>Current Members: {currentMemberIds.length}</div>
                        <div>Available to Add: {availableUsers.length}</div>
                    </div>

                    {availableUsers.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            {allUsers?.length > 0
                                ? "All users are already members of this group"
                                : "No users available to add"}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {availableUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                        <img src={user.image} alt={user.name} className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                                        <div>
                                            <div className="font-semibold text-gray-900">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.role}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAddMember(user.id)}
                                        disabled={loading}
                                        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Member List Modal
const MemberListModal = ({ channel, onClose, currentUser }) => {
    const [loading, setLoading] = useState(false);

    const members = Object.values(channel?.state?.members || {});
    const isAdmin = channel?.data?.created_by_id === currentUser?.id;

    const handleRemoveMember = async (userId) => {
        if (!confirm("Are you sure you want to remove this member?")) return;

        setLoading(true);
        try {
            await channel.removeMembers([userId]);
            alert("Member removed successfully!");
        } catch (error) {
            console.error("Failed to remove member:", error);
            alert("Failed to remove member. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Members ({members.length})</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Member List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {members.map(member => {
                            const isCreator = member.user_id === channel?.data?.created_by_id;
                            const canRemove = isAdmin && !isCreator && member.user_id !== currentUser?.id;

                            return (
                                <div key={member.user_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}`}
                                            alt={member.user?.name}
                                            className="h-10 w-10 rounded-full object-cover border border-gray-200"
                                        />
                                        <div>
                                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                {member.user?.name}
                                                {isCreator && (
                                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Admin</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{member.user?.role || "Member"}</div>
                                        </div>
                                    </div>
                                    {canRemove && (
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            disabled={loading}
                                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Message Info Modal - Shows who read the message in groups
const MessageInfoModal = ({ message, channel, onClose }) => {
    const allMembers = Object.values(channel?.state?.members || {});
    const readBy = message?.readBy || [];

    // Get members who have read the message
    const readMembers = allMembers.filter(member =>
        readBy.some(reader => reader.id === member.user_id)
    );

    // Get members who haven't read yet
    const unreadMembers = allMembers.filter(member =>
        !readBy.some(reader => reader.id === member.user_id) &&
        member.user_id !== message?.user?.id // Exclude message sender
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Message Info</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Read Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <span className="text-blue-600">✓✓</span> Read ({readMembers.length})
                        </h3>
                        {readMembers.length === 0 ? (
                            <p className="text-sm text-gray-400 italic pl-6">No one has read this message yet</p>
                        ) : (
                            <div className="space-y-2">
                                {readMembers.map(member => {
                                    const readInfo = readBy.find(r => r.id === member.user_id);
                                    return (
                                        <div key={member.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                                            <img
                                                src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}`}
                                                alt={member.user?.name}
                                                className="h-8 w-8 rounded-full object-cover border border-gray-200"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">{member.user?.name}</div>
                                                {readInfo?.last_read && (
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(readInfo.last_read).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Unread Section */}
                    {unreadMembers.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <span className="text-gray-400">○</span> Not Read Yet ({unreadMembers.length})
                            </h3>
                            <div className="space-y-2">
                                {unreadMembers.map(member => (
                                    <div key={member.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg opacity-60">
                                        <img
                                            src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}`}
                                            alt={member.user?.name}
                                            className="h-8 w-8 rounded-full object-cover border border-gray-200 grayscale"
                                        />
                                        <div className="text-sm font-medium text-gray-500">{member.user?.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
