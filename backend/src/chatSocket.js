const prisma = require("./utils/prisma");
const logger = require("./utils/logger");

async function emitToChannel(io, channelId, event, data) {
    try {
        const members = await prisma.chatMember.findMany({
            where: { channelId },
            select: { userId: true },
        });
        for (const m of members) {
            io.to(m.userId).emit(event, data);
        }
    } catch (err) {
        logger.warn({ err: err.message }, `[chatSocket] emitToChannel error for ${event}`);
    }
}

// Persist a bell notification for every member except the author. Deduped per
// channel: while an unread chat notification for a channel exists, we refresh it
// in place instead of stacking a new row for every message.
async function notifyOtherMembers(io, channelId, message) {
    try {
        const channel = await prisma.chatChannel.findUnique({
            where: { id: channelId },
            select: { name: true, type: true },
        });
        const members = await prisma.chatMember.findMany({
            where: { channelId, userId: { not: message.authorId } },
            select: { userId: true },
        });
        if (members.length === 0) return;

        const senderName = message.author?.name || "Someone";
        const title = channel?.type === "dm"
            ? `💬 ${senderName}`
            : `💬 ${senderName} in ${channel?.name || "a channel"}`;
        const preview = message.text.length > 80 ? message.text.slice(0, 80) + "…" : message.text;
        const link = `/messages?channel=${channelId}`;

        for (const { userId } of members) {
            const existing = await prisma.notification.findFirst({
                where: { userId, type: "CHAT_MESSAGE", isRead: false, link },
                select: { id: true },
            });

            const notification = existing
                ? await prisma.notification.update({
                    where: { id: existing.id },
                    data: { title, message: preview, createdAt: new Date() },
                })
                : await prisma.notification.create({
                    data: { userId, title, message: preview, type: "CHAT_MESSAGE", link },
                });

            io.to(userId).emit("notification:new", notification);
        }
    } catch (err) {
        logger.warn({ err: err.message }, "[chatSocket] notifyOtherMembers error");
    }
}

function registerChatHandlers(socket, io) {
    const { userId, userName } = socket.data;

    // Join a channel room — verified against DB membership
    socket.on("chat:join", async ({ channelId }) => {
        if (!channelId) return;
        try {
            const membership = await prisma.chatMember.findUnique({
                where: { channelId_userId: { channelId, userId } },
            });
            if (!membership) return;
            socket.join(`chat:${channelId}`);
        } catch (err) {
            logger.warn({ err: err.message }, "[chatSocket] chat:join error");
        }
    });

    socket.on("chat:leave", ({ channelId }) => {
        if (channelId) socket.leave(`chat:${channelId}`);
    });

    // Send a message — saved to DB, then broadcast to the channel members
    socket.on("chat:send", async ({ channelId, text, parentId }) => {
        if (!channelId || !text?.trim()) return;
        try {
            const membership = await prisma.chatMember.findUnique({
                where: { channelId_userId: { channelId, userId } },
            });
            if (!membership) return;

            const message = await prisma.chatMessage.create({
                data: {
                    channelId,
                    authorId: userId,
                    text: text.trim(),
                    parentId: parentId || null,
                },
                include: {
                    author: { select: { id: true, name: true, profilePhoto: true } },
                },
            });

            await emitToChannel(io, channelId, "chat:message", message);
            await notifyOtherMembers(io, channelId, message);
        } catch (err) {
            logger.warn({ err: err.message }, "[chatSocket] chat:send error");
        }
    });

    // Typing indicators — broadcast only, not persisted
    socket.on("chat:typing", ({ channelId }) => {
        if (!channelId) return;
        socket.to(`chat:${channelId}`).emit("chat:typing", { channelId, userId, userName });
    });

    socket.on("chat:stop-typing", ({ channelId }) => {
        if (!channelId) return;
        socket.to(`chat:${channelId}`).emit("chat:stop-typing", { channelId, userId });
    });

    // Edit a message — only the author can edit
    socket.on("chat:edit", async ({ messageId, text }) => {
        if (!messageId || !text?.trim()) return;
        try {
            const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
            if (!msg || msg.authorId !== userId || msg.deletedAt) return;

            const updated = await prisma.chatMessage.update({
                where: { id: messageId },
                data: { text: text.trim(), editedAt: new Date() },
                include: { author: { select: { id: true, name: true, profilePhoto: true } } },
            });

            await emitToChannel(io, updated.channelId, "chat:message-updated", updated);
        } catch (err) {
            logger.warn({ err: err.message }, "[chatSocket] chat:edit error");
        }
    });

    // Soft-delete — only the author can delete
    socket.on("chat:delete", async ({ messageId }) => {
        if (!messageId) return;
        try {
            const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
            if (!msg || msg.authorId !== userId || msg.deletedAt) return;

            await prisma.chatMessage.update({
                where: { id: messageId },
                data: { deletedAt: new Date() },
            });

            await emitToChannel(io, msg.channelId, "chat:message-deleted", {
                messageId,
                channelId: msg.channelId,
            });
        } catch (err) {
            logger.warn({ err: err.message }, "[chatSocket] chat:delete error");
        }
    });

    // Emoji reactions — toggled per user per emoji
    socket.on("chat:react", async ({ messageId, emoji }) => {
        if (!messageId || !emoji) return;
        try {
            const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
            if (!msg || msg.deletedAt) return;

            const reactions = { ...(msg.reactions || {}) };
            if (!Array.isArray(reactions[emoji])) reactions[emoji] = [];

            const idx = reactions[emoji].indexOf(userId);
            if (idx === -1) {
                reactions[emoji] = [...reactions[emoji], userId];
            } else {
                reactions[emoji] = reactions[emoji].filter(id => id !== userId);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            }

            const updated = await prisma.chatMessage.update({
                where: { id: messageId },
                data: { reactions },
            });

            await emitToChannel(io, msg.channelId, "chat:reaction", {
                messageId,
                reactions: updated.reactions,
                channelId: msg.channelId,
            });
        } catch (err) {
            logger.warn({ err: err.message }, "[chatSocket] chat:react error");
        }
    });
}

module.exports = { registerChatHandlers };
