const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./utils/prisma");
const logger = require("./utils/logger");
const { registerChatHandlers } = require("./chatSocket");

let io;

// Minimal cookie-header parser — avoids pulling cookie-parser into the socket path.
function parseCookie(header, name) {
    if (!header) return null;
    for (const part of header.split(";")) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) {
            return decodeURIComponent(part.slice(eq + 1).trim());
        }
    }
    return null;
}

function initSocket(server) {
    const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5000",
        "https://scholar360-testing.vercel.app",
        "https://scholar360-testing.onrender.com"
    ];

    if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
    }

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
                const isAllowed = allowedOrigins.includes(origin) ||
                                  (process.env.NODE_ENV !== "production" && isLocalhost);
                if (isAllowed) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });

    // ── Authentication gate ───────────────────────────────────────────────────
    // Reject any handshake without a valid JWT. Browser clients send the httpOnly
    // `token` cookie (socket.io forwards it with withCredentials: true); non-browser
    // clients may pass it via handshake.auth.token. Identity (userId, userName) is
    // resolved here from the verified token + DB — never trusted from event payloads.
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                parseCookie(socket.handshake.headers?.cookie, "token");

            if (!token) return next(new Error("UNAUTHENTICATED"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where:  { id: decoded.userId },
                select: { id: true, name: true, isActive: true },
            });

            if (!user || !user.isActive) return next(new Error("UNAUTHENTICATED"));

            socket.data.userId   = user.id;
            socket.data.userName = user.name;
            next();
        } catch (err) {
            logger.warn({ err: err.message }, "[Socket] Rejected unauthenticated connection");
            next(new Error("UNAUTHENTICATED"));
        }
    });

    // leadId → Map<socketId, { userId, userName, avatarColor }>
    const leadViewers = new Map();

    function broadcastViewers(leadId) {
        const viewers = leadViewers.has(leadId)
            ? Array.from(leadViewers.get(leadId).values())
            : [];
        io.to(`lead:${leadId}`).emit("lead-viewers", { leadId, viewers });
    }

    io.on("connection", (socket) => {
        registerChatHandlers(socket, io);

        socket.on("join-lead", ({ leadId, avatarColor }) => {
            // Identity comes from the authenticated handshake, not the payload.
            const { userId, userName } = socket.data;
            if (!leadId || !userId) return;
            socket.join(`lead:${leadId}`);
            socket.data.leadId = leadId;

            if (!leadViewers.has(leadId)) leadViewers.set(leadId, new Map());
            leadViewers.get(leadId).set(socket.id, { userId, userName, avatarColor });
            broadcastViewers(leadId);
        });

        socket.on("leave-lead", ({ leadId }) => {
            if (!leadId) return;
            socket.leave(`lead:${leadId}`);
            if (leadViewers.has(leadId)) {
                leadViewers.get(leadId).delete(socket.id);
                if (leadViewers.get(leadId).size === 0) leadViewers.delete(leadId);
                else broadcastViewers(leadId);
            }
        });

        socket.on("disconnect", () => {
            const { leadId } = socket.data ?? {};
            if (!leadId) return;
            if (leadViewers.has(leadId)) {
                leadViewers.get(leadId).delete(socket.id);
                if (leadViewers.get(leadId).size === 0) leadViewers.delete(leadId);
                else broadcastViewers(leadId);
            }
        });
    });

    return io;
}

module.exports = { initSocket, getIO: () => io };
