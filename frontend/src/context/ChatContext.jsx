import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import api from "../api/axios";
import { getSocket } from "../utils/socket";

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext) ?? {};

// A single shared AudioContext, unlocked on the user's first interaction so the
// browser autoplay policy doesn't silently block notification sounds. Creating a
// new AudioContext per notification hits the browser's context limit, so we reuse
// this one for the app's lifetime.
let sharedAudioCtx = null;

const getAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
    return sharedAudioCtx;
};

// Resume the AudioContext on the first user gesture (click / keypress / touch).
// After this runs once, notification sounds play reliably for the whole session.
const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
};

// Ask for OS-level notification permission so we can alert the user even when the
// CRM tab is in the background. Also gated behind the first user gesture.
const requestNotificationPermission = () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }
};

// Show a native OS notification (with the system sound) when the tab isn't focused.
// Returns true if a native notification was shown, so callers can skip the toast.
const showBrowserNotification = (title, body, onClick) => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission !== "granted") return false;
    if (typeof document !== "undefined" && document.visibilityState === "visible") return false;
    try {
        const n = new Notification(title, { body, icon: "/SCHOLAR360.PNG" });
        if (onClick) {
            n.onclick = () => {
                window.focus();
                onClick();
                n.close();
            };
        }
        return true;
    } catch {
        return false;
    }
};

const playChime = (ctx) => {
    try {
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

const playNotificationSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    // A suspended context has a frozen clock, so scheduling notes now would place
    // them in the past once it resumes. Resume first, then schedule once running.
    if (ctx.state === "suspended") {
        ctx.resume().then(() => playChime(ctx)).catch((e) => {
            console.warn("Failed to resume audio for notification sound:", e);
        });
    } else {
        playChime(ctx);
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

    // Unlock audio + request OS notification permission on the first user gesture,
    // so notification sounds aren't blocked by the browser autoplay policy and we
    // can show native notifications when the tab is backgrounded.
    useEffect(() => {
        const onFirstInteraction = () => {
            unlockAudio();
            requestNotificationPermission();
        };
        window.addEventListener("click", onFirstInteraction, { once: true });
        window.addEventListener("keydown", onFirstInteraction, { once: true });
        window.addEventListener("touchstart", onFirstInteraction, { once: true });
        return () => {
            window.removeEventListener("click", onFirstInteraction);
            window.removeEventListener("keydown", onFirstInteraction);
            window.removeEventListener("touchstart", onFirstInteraction);
        };
    }, []);

    // Fetch channel list from REST
    const fetchChannels = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data } = await api.get("/chat/channels");
            setChannels(data);
            // Seed unread badges from server so counts survive reloads / offline messages.
            setUnreadMap(prev => {
                const next = { ...prev };
                for (const ch of data) {
                    if (ch.id === activeChIdRef.current) {
                        delete next[ch.id];
                    } else if (ch.unreadCount > 0) {
                        next[ch.id] = ch.unreadCount;
                    }
                }
                return next;
            });
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
            setChannels(prev => {
                const exists = prev.some(ch => ch.id === msg.channelId);
                if (!exists) {
                    fetchChannels();
                    return prev;
                }
                return prev.map(ch =>
                    ch.id === msg.channelId ? { ...ch, lastMessage: msg } : ch
                );
            });

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
                    // Native OS notification when the tab is backgrounded; in-app toast otherwise.
                    showBrowserNotification(`💬 ${sender}`, body, () => navigate("/messages"));
                    toast.message(`💬 ${sender}`, {
                        description: body,
                        action: { label: "Open", onClick: () => navigate("/messages") },
                    });
                }
            }
        };

        const onNotification = (notif) => {
            // Chat messages have their own toast (see onMessage). Here we only need
            // the bell to update, so refresh the notifications query and stop.
            if (notif.type === "CHAT_MESSAGE") {
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
                return;
            }
            playNotificationSound();
            showBrowserNotification(
                notif.title || "🔔 Notification",
                notif.message,
                notif.link ? () => navigate(notif.link) : undefined,
            );
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
            // Persist the read state so the badge and bell stay cleared after reload.
            api.post(`/chat/channels/${channelId}/read`)
                .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
                .catch(() => { /* non-fatal: badge already cleared client-side */ });
        }
    }, [queryClient]);

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
