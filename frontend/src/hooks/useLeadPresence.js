import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

let socket = null;

function getSocket() {
    if (!socket) {
        const base = (import.meta.env.VITE_API_URL ?? "http://localhost:5001/api")
            .replace(/\/api$/, "");
        socket = io(base, { withCredentials: true, autoConnect: true });
    }
    return socket;
}

const AVATAR_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

function colorForUser(userId = "") {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function useLeadPresence(leadId) {
    const { user } = useAuth();
    const [viewers, setViewers] = useState([]);

    useEffect(() => {
        if (!leadId || !user) return;
        const s = getSocket();
        const avatarColor = colorForUser(user.id);

        s.emit("join-lead", { leadId, userId: user.id, userName: user.name, avatarColor });

        const handleViewers = ({ leadId: lid, viewers: list }) => {
            if (lid === leadId) setViewers(list.filter(v => v.userId !== user.id));
        };
        s.on("lead-viewers", handleViewers);

        return () => {
            s.emit("leave-lead", { leadId });
            s.off("lead-viewers", handleViewers);
        };
    }, [leadId, user]);

    return viewers;
}
