import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import api from "../api/axios";
import { getSocket } from "../utils/socket";

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext) ?? {};

export const ChatProvider = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [connected, setConnected]     = useState(false);
    const [channels, setChannels]       = useState([]);
    const [unreadMap, setUnreadMap]     = useState({}); // { [channelId]: count }
    const [totalUnread, setTotalUnread] = useState(0);

    const pathRef       = useRef(location.pathname);
    const activeChIdRef = useRef(null);

    useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

    // Fetch channel list from REST
    const fetchChannels = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data } = await api.get("/chat/channels");
            setChannels(data);
        } catch {
            // Chat stays empty if server is unreachable
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) fetchChannels();
    }, [fetchChannels]);

    // Single shared socket (reused by useLeadPresence too)
    useEffect(() => {
        if (!user?.id) return;

        const s = getSocket();

        const onConnect    = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        s.on("connect",    onConnect);
        s.on("disconnect", onDisconnect);
        if (s.connected) setConnected(true);

        const onMessage = (msg) => {
            // Update sidebar last-message
            setChannels(prev => prev.map(ch =>
                ch.id === msg.channelId ? { ...ch, lastMessage: msg } : ch
            ));

            // Increment unread badge for channels the user isn't currently viewing
            if (activeChIdRef.current !== msg.channelId && msg.author?.id !== user.id) {
                setUnreadMap(prev => ({
                    ...prev,
                    [msg.channelId]: (prev[msg.channelId] || 0) + 1,
                }));

                // Toast when away from Messages page
                if (!pathRef.current.startsWith("/messages")) {
                    const sender = msg.author?.name?.split(" ")[0] || "Someone";
                    const body   = msg.text?.length > 80 ? msg.text.slice(0, 80) + "…" : msg.text;
                    toast.message(`💬 ${sender}`, {
                        description: body,
                        action: { label: "Open", onClick: () => navigate("/messages") },
                    });
                }
            }
        };

        s.on("chat:message", onMessage);

        return () => {
            s.off("connect",      onConnect);
            s.off("disconnect",   onDisconnect);
            s.off("chat:message", onMessage);
        };
    }, [user?.id, navigate]);

    useEffect(() => {
        setTotalUnread(Object.values(unreadMap).reduce((a, b) => a + b, 0));
    }, [unreadMap]);

    // Called by Messages page when user opens a channel
    const setActiveChannel = useCallback((channelId) => {
        activeChIdRef.current = channelId;
        if (channelId) {
            setUnreadMap(prev => {
                const next = { ...prev };
                delete next[channelId];
                return next;
            });
        }
    }, []);

    const clearUnread = useCallback(() => setUnreadMap({}), []);

    return (
        <ChatContext.Provider value={{
            socket: getSocket(),
            connected,
            channels,
            unreadMap,
            totalUnread,
            clearUnread,
            setActiveChannel,
            refetchChannels: fetchChannels,
        }}>
            {children}
        </ChatContext.Provider>
    );
};
