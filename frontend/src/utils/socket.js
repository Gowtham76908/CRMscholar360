import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
    if (!socket) {
        const base = (import.meta.env.VITE_API_URL ?? "http://localhost:5001/api")
            .replace(/\/api$/, "");
        socket = io(base, { withCredentials: true, autoConnect: true });
    }
    return socket;
}
