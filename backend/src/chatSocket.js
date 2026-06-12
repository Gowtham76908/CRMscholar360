const prisma = require("./utils/prisma");
const logger = require("./utils/logger");

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

    // Send a message — saved to DB, then broadcast to the channel room
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

            io.to(`chat:${channelId}`).emit("chat:message", message);
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

            io.to(`chat:${updated.channelId}`).emit("chat:message-updated", updated);
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

            io.to(`chat:${msg.channelId}`).emit("chat:message-deleted", {
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

            io.to(`chat:${msg.channelId}`).emit("chat:reaction", {
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
