import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import api from "../api/axios";
import { getSocket } from "../utils/socket";

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext) ?? {};

const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Note 1: D5 (587.33 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain1.gain.setValueAtTime(0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.04);
        gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        
        // Note 2: A5 (880.00 Hz) - harmonious major interval
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.06);
        gain2.gain.setValueAtTime(0, ctx.currentTime + 0.06);
        gain2.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
        
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime + 0.06);
        osc2.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.warn("Failed to play notification sound:", e);
    }
};

export const ChatProvider = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

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
        const onConnectError = (err) => {
            if (err.message === "UNAUTHENTICATED") {
                s.disconnect();
            }
        };

        s.on("connect",       onConnect);
        s.on("disconnect",     onDisconnect);
        s.on("connect_error",  onConnectError);

        if (!s.connected) {
            s.connect();
        } else {
            setConnected(true);
        }

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
                    playNotificationSound();
                    toast.message(`💬 ${sender}`, {
                        description: body,
                        action: { label: "Open", onClick: () => navigate("/messages") },
                    });
                }
            }
        };

        const onNotification = (notif) => {
            playNotificationSound();
            toast.message(notif.title || "🔔 Notification", {
                description: notif.message,
                action: notif.link ? { label: "View", onClick: () => navigate(notif.link) } : undefined,
            });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            if (notif.type === "REMINDER") {
                queryClient.invalidateQueries({ queryKey: ["reminders"] });
            }
        };

        s.on("chat:message", onMessage);
        s.on("notification:new", onNotification);

        return () => {
            s.off("connect",       onConnect);
            s.off("disconnect",     onDisconnect);
            s.off("connect_error",  onConnectError);
            s.off("chat:message", onMessage);
            s.off("notification:new", onNotification);
            s.disconnect();
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
