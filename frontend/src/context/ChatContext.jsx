import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import api from "../api/axios";

// stream-chat (~250 KB) is imported dynamically so it lands in its own async
// chunk instead of the main bundle — the app paints first, then the chat socket
// connects in the background.

// App-wide team-chat presence. Connects to Stream once after login (separate
// from the Messages page UI) so unread counts and "new message" notifications
// work everywhere — not only while the Messages page is open. The Messages page
// reuses this same client instead of opening its own connection.
const ChatContext = createContext(null);

export const useChat = () => useContext(ChatContext) ?? {};

// Events that carry an authoritative running unread total for the current user.
const UNREAD_EVENTS = [
    "notification.message_new",
    "notification.mark_read",
    "notification.mark_unread",
    "message.new",
    "message.read",
];

export const ChatProvider = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [chatClient, setChatClient] = useState(null);
    const [videoCreds, setVideoCreds] = useState(null);
    const [totalUnread, setTotalUnread] = useState(0);

    // Keep the current path in a ref so the message-event handler can decide
    // whether to toast without re-subscribing on every navigation.
    const pathRef = useRef(location.pathname);
    useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

    useEffect(() => {
        if (!user?.id) return;
        let client;
        let cancelled = false;

        const connect = async () => {
            try {
                const [{ data }, { StreamChat }] = await Promise.all([
                    api.post("/chat/token"),
                    import("stream-chat"),
                ]);
                const { token, apiKey, user: su } = data;
                if (cancelled) return;

                client = StreamChat.getInstance(apiKey);
                if (client.userID !== su.id) await client.connectUser(su, token);
                if (cancelled) return;

                setChatClient(client);
                setVideoCreds({ apiKey, user: su, token });
                setTotalUnread(client.user?.total_unread_count ?? 0);

                const onUnread = (event) => {
                    if (typeof event.total_unread_count === "number") {
                        setTotalUnread(event.total_unread_count);
                    }
                };
                UNREAD_EVENTS.forEach((t) => client.on(t, onUnread));

                const onNewMessage = (event) => {
                    const msg = event.message;
                    if (!msg || msg.user?.id === su.id) return;       // ignore my own messages
                    if (pathRef.current.startsWith("/messages")) return; // already in chat
                    const sender = msg.user?.name?.split(" ")[0] || "Someone";
                    const body = msg.text ? (msg.text.length > 80 ? msg.text.slice(0, 80) + "…" : msg.text) : "Sent an attachment";
                    toast.message(`💬 ${sender}`, {
                        description: body,
                        action: { label: "Open", onClick: () => navigate("/messages") },
                    });
                };
                client.on("notification.message_new", onNewMessage);

                client._dcrmHandlers = { onUnread, onNewMessage };
            } catch {
                // Stream not configured / unreachable — chat simply stays unavailable.
            }
        };

        connect();

        // Cleanup runs when the user changes (e.g. logout) or the provider
        // unmounts: detach listeners, disconnect, and reset shared state.
        return () => {
            cancelled = true;
            if (client?._dcrmHandlers) {
                const { onUnread, onNewMessage } = client._dcrmHandlers;
                UNREAD_EVENTS.forEach((t) => client.off(t, onUnread));
                client.off("notification.message_new", onNewMessage);
                delete client._dcrmHandlers;
            }
            client?.disconnectUser().catch(() => {});
            setChatClient(null);
            setVideoCreds(null);
            setTotalUnread(0);
        };
    }, [user?.id, navigate]);

    const clearUnread = useCallback(() => setTotalUnread(0), []);

    return (
        <ChatContext.Provider value={{ chatClient, videoCreds, totalUnread, clearUnread }}>
            {children}
        </ChatContext.Provider>
    );
};
