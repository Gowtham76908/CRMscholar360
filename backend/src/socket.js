const { Server } = require("socket.io");

let io;

function initSocket(server) {
    const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5000",
        "https://dcrm-testing.vercel.app",
        "https://dcrm-testing.onrender.com"
    ];

    if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
    }

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                const isAllowed = allowedOrigins.includes(origin) || 
                                  origin.endsWith(".vercel.app") || 
                                  origin.includes("localhost");
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

    // leadId → Map<socketId, { userId, userName, avatarColor }>
    const leadViewers = new Map();

    function broadcastViewers(leadId) {
        const viewers = leadViewers.has(leadId)
            ? Array.from(leadViewers.get(leadId).values())
            : [];
        io.to(`lead:${leadId}`).emit("lead-viewers", { leadId, viewers });
    }

    io.on("connection", (socket) => {
        socket.on("join-lead", ({ leadId, userId, userName, avatarColor }) => {
            if (!leadId || !userId) return;
            socket.join(`lead:${leadId}`);
            socket.data = { leadId, userId };

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
