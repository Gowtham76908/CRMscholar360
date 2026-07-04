const { AccessToken } = require("livekit-server-sdk");
const prisma = require("../utils/prisma");
const { decrypt } = require("../utils/encrypt");
const { ApiError } = require("../utils/apiError");
const logger = require("../utils/logger");

// Read LiveKit creds from Integration table first, fall back to env vars.
async function getLivekitCreds() {
    try {
        const row = await prisma.integration.findUnique({ where: { platform: "livekit" } });
        if (row?.isConnected && row.config) {
            const cfg = row.config;
            const apiKey    = cfg.apiKey    ? decrypt(cfg.apiKey)    : null;
            const apiSecret = cfg.apiSecret ? decrypt(cfg.apiSecret) : null;
            const url       = cfg.url       || null;
            if (apiKey && apiSecret && url) return { apiKey, apiSecret, url };
        }
    } catch { /* fallthrough to env */ }
    return {
        apiKey:    process.env.LIVEKIT_API_KEY    || null,
        apiSecret: process.env.LIVEKIT_API_SECRET || null,
        url:       process.env.LIVEKIT_URL        || null,
    };
}

const avatarUrl = (u) =>
    u.profilePhoto
        ? `${process.env.BACKEND_URL || "http://localhost:5001"}${u.profilePhoto}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "User")}`;

// GET /api/chat/token?room=<roomName>  — LiveKit access token for a video call room
const createToken = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const room = req.query.room;
        if (!room) throw new ApiError(400, "VALIDATION_ERROR", "room is required");

        const { apiKey, apiSecret, url } = await getLivekitCreds();
        if (!apiKey || !apiSecret) {
            throw new ApiError(503, "INTEGRATION_NOT_CONFIGURED", "LiveKit is not configured. Add credentials in Integration Hub → LiveKit Video.");
        }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

        const at = new AccessToken(apiKey, apiSecret, {
            identity: userId,
            name: user?.name || userId,
            ttl: "4h",
        });
        at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });

        const token = await at.toJwt();

        res.json({ token, url, room });
    } catch (err) {
        return next(err);
    }
};

// GET /api/chat/channels  — list channels the caller belongs to
const getChannels = async (req, res, next) => {
    try {
        const { userId } = req.user;

        const memberships = await prisma.chatMember.findMany({
            where: { userId },
            include: {
                channel: {
                    include: {
                        members: {
                            include: {
                                user: { select: { id: true, name: true, profilePhoto: true, onlineStatus: true } },
                            },
                        },
                        messages: {
                            where: { deletedAt: null },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            include: { author: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
            orderBy: { joinedAt: "asc" },
        });

        // Unread = messages from others sent after the caller last read the channel.
        // Fall back to joinedAt when they've never opened it, so pre-existing history
        // and messages sent before they joined are not counted as unread.
        const unreadCounts = await Promise.all(
            memberships.map(({ channel, lastReadAt, joinedAt }) =>
                prisma.chatMessage.count({
                    where: {
                        channelId: channel.id,
                        deletedAt: null,
                        authorId: { not: userId },
                        createdAt: { gt: lastReadAt ?? joinedAt },
                    },
                })
            )
        );

        const channels = memberships.map(({ channel }, i) => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            createdById: channel.createdById,
            createdAt: channel.createdAt,
            members: channel.members.map(m => ({
                id: m.user.id,
                name: m.user.name,
                image: avatarUrl(m.user),
                onlineStatus: m.user.onlineStatus,
                role: m.role,
            })),
            lastMessage: channel.messages[0] || null,
            unreadCount: unreadCounts[i],
        }));

        res.json(channels);
    } catch (err) {
        return next(err);
    }
};

// POST /api/chat/group  — create a named group channel
const createGroupChannel = async (req, res, next) => {
    try {
        const { name, members } = req.body;
        const creatorId = req.user.userId;

        if (!name?.trim()) throw new ApiError(400, "VALIDATION_ERROR", "Group name is required");
        if (!members?.length) throw new ApiError(400, "VALIDATION_ERROR", "At least one member is required");

        const memberIds = [...new Set([creatorId, ...members])];

        const users = await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true } });
        if (users.length === 0) throw new ApiError(404, "NOT_FOUND", "No valid members found");

        const validIds = users.map(u => u.id);

        const channel = await prisma.chatChannel.create({
            data: {
                name: name.trim(),
                type: "team",
                createdById: creatorId,
                members: {
                    create: validIds.map(id => ({
                        userId: id,
                        role: id === creatorId ? "admin" : "member",
                    })),
                },
            },
        });

        res.status(201).json({ message: "Channel created successfully", channelId: channel.id });
    } catch (err) {
        return next(err);
    }
};

// POST /api/chat/dm  — find-or-create a DM channel between two users
const startDirectChat = async (req, res, next) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user.userId;

        if (!targetUserId) throw new ApiError(400, "VALIDATION_ERROR", "targetUserId is required");
        if (targetUserId === currentUserId) throw new ApiError(400, "VALIDATION_ERROR", "Cannot DM yourself");

        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
        if (!targetUser) throw new ApiError(404, "NOT_FOUND", "Target user not found");

        // Find existing DM where exactly both users are members
        const existing = await prisma.chatChannel.findFirst({
            where: {
                type: "dm",
                AND: [
                    { members: { some: { userId: currentUserId } } },
                    { members: { some: { userId: targetUserId } } },
                ],
            },
            include: { members: { select: { userId: true } } },
        });

        if (existing && existing.members.length === 2) {
            return res.json({ channelId: existing.id, existing: true });
        }

        const channel = await prisma.chatChannel.create({
            data: {
                type: "dm",
                createdById: currentUserId,
                members: {
                    create: [
                        { userId: currentUserId, role: "member" },
                        { userId: targetUserId,  role: "member" },
                    ],
                },
            },
        });

        res.status(201).json({ channelId: channel.id, existing: false });
    } catch (err) {
        return next(err);
    }
};

// GET /api/chat/users  — list active users for the chat search bar
const getUsersForChat = async (req, res, next) => {
    try {
        const currentUserId = req.user.userId;
        const users = await prisma.user.findMany({
            where: { isActive: true, NOT: { id: currentUserId } },
            select: {
                id: true, name: true, role: true,
                department: true, jobTitle: true,
                profilePhoto: true, onlineStatus: true,
            },
        });

        res.json(users.map(u => ({
            id: u.id,
            name: u.name || "Unknown User",
            role: u.role,
            department: u.department,
            jobTitle: u.jobTitle,
            onlineStatus: u.onlineStatus,
            image: avatarUrl(u),
        })));
    } catch (err) {
        return next(err);
    }
};

// GET /api/chat/channels/:id/messages?cursor=<messageId>&limit=<n>
const getChannelMessages = async (req, res, next) => {
    try {
        const { id: channelId } = req.params;
        const { userId } = req.user;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const cursor = req.query.cursor;

        const membership = await prisma.chatMember.findUnique({
            where: { channelId_userId: { channelId, userId } },
        });
        if (!membership) throw new ApiError(403, "ACCESS_DENIED", "You are not a member of this channel");

        const where = { channelId, deletedAt: null, parentId: null };
        const messages = await prisma.chatMessage.findMany({
            where: cursor ? { ...where, createdAt: { lt: (await prisma.chatMessage.findUnique({ where: { id: cursor } }))?.createdAt } } : where,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                author: { select: { id: true, name: true, profilePhoto: true } },
                replies: {
                    where: { deletedAt: null },
                    include: { author: { select: { id: true, name: true, profilePhoto: true } } },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        const ordered = messages.reverse();

        res.json({
            messages: ordered,
            hasMore: messages.length === limit,
            nextCursor: ordered.length > 0 ? ordered[0].id : null,
        });
    } catch (err) {
        return next(err);
    }
};

// POST /api/chat/seed  — seed demo channels + messages into Postgres (SUPER_ADMIN only)
const seedDemoData = async (req, res, next) => {
    try {
        const creatorId = req.user.userId;
        const users = await prisma.user.findMany({ where: { isActive: true } });
        if (users.length === 0) return res.json({ ok: false, message: "No active users found" });

        const allIds = users.map(u => u.id);
        if (!allIds.includes(creatorId)) allIds.push(creatorId);

        const byDept = (dept) => users.filter(u => u.department === dept).map(u => u.id);
        const pick = (arr, i) => arr.length > 0 ? arr[i % arr.length] : creatorId;

        const channelDefs = [
            {
                name: "General", type: "team", members: allIds,
                messages: [
                    { text: "Good morning everyone! Hope you all had a great weekend 🌞", pool: null },
                    { text: "Don't forget standup at 10am — let's keep it sharp today.", pool: null },
                    { text: "New scholar360 features are live on staging — please test before EOD.", pool: "Engineering" },
                    { text: "Sales pipeline looking really strong this week 💪", pool: "Sales" },
                    { text: "Team lunch this Friday at 1pm. Who's in? 🍕", pool: "HR" },
                    { text: "Reminder: fill in your attendance by 6pm!", pool: "HR" },
                    { text: "Great work on the Q3 numbers everyone, seriously 🚀", pool: null },
                ],
            },
            {
                name: "Sales Team", type: "team", members: [...byDept("Sales"), creatorId],
                messages: [
                    { text: "Q4 pipeline is looking very healthy — 47 hot leads this week alone 🔥", pool: "Sales" },
                    { text: "New inbound from Meta Ads — Tech Solutions Pvt Ltd. Assigning to Arjun.", pool: "Sales" },
                    { text: "Anita Bose just converted! Big win 🎉 That's our 3rd enterprise this month.", pool: "Sales" },
                    { text: "Follow-up calls done for today ✅ Two demos scheduled for Thursday.", pool: "Sales" },
                ],
            },
            {
                name: "Dev Team", type: "team", members: [...byDept("Engineering"), creatorId],
                messages: [
                    { text: "Deployment to staging done ✓ All services healthy.", pool: "Engineering" },
                    { text: "Bug #423 fixed — email notification delay was a cron timing issue.", pool: "Engineering" },
                    { text: "Frontend bundle size down by 18% after tree-shaking cleanup 🎯", pool: "Engineering" },
                ],
            },
            {
                name: "Announcements", type: "team", members: allIds,
                messages: [
                    { text: "Company all-hands this Friday at 3pm in the main hall. Attendance mandatory.", pool: null },
                    { text: "Welcome Lakshmi Rao to the Marketing team! Please give her a warm welcome 🎉", pool: "HR" },
                    { text: "Q3 revenue targets exceeded by 12%! 🏆", pool: null },
                ],
            },
            {
                name: "Marketing", type: "team", members: [...byDept("Marketing"), creatorId],
                messages: [
                    { text: "New campaign for Q4 goes live Monday — all creatives are ready.", pool: "Marketing" },
                    { text: "Google Ads CTR improved to 4.2% this week — best in 6 months!", pool: "Marketing" },
                ],
            },
        ];

        let seededChannels = 0, seededMessages = 0;

        for (const def of channelDefs) {
            const existing = await prisma.chatChannel.findFirst({ where: { name: def.name, type: def.type } });
            if (existing) {
                logger.info(`[seedChat] Skipping "${def.name}" — already exists`);
                continue;
            }

            const memberIds = [...new Set(def.members.filter(id => allIds.includes(id)))];
            if (memberIds.length === 0) continue;

            const channel = await prisma.chatChannel.create({
                data: {
                    name: def.name,
                    type: def.type,
                    createdById: creatorId,
                    members: {
                        create: memberIds.map(id => ({
                            userId: id,
                            role: id === creatorId ? "admin" : "member",
                        })),
                    },
                },
            });
            seededChannels++;

            const base = Date.now();
            for (let i = 0; i < def.messages.length; i++) {
                const { text, pool } = def.messages[i];
                const senderPool = pool ? byDept(pool) : allIds;
                await prisma.chatMessage.create({
                    data: {
                        channelId: channel.id,
                        authorId: pick(senderPool, i),
                        text,
                        createdAt: new Date(base - (def.messages.length - i) * 60_000),
                    },
                });
                seededMessages++;
            }
        }

        res.json({ ok: true, message: `Seeded ${seededChannels} channels with ${seededMessages} messages`, users: users.length });
    } catch (err) {
        return next(err);
    }
};

// POST /api/chat/channels/:id/read  — mark a channel as read for the caller
const markChannelRead = async (req, res, next) => {
    try {
        const { id: channelId } = req.params;
        const { userId } = req.user;

        const updated = await prisma.chatMember.updateMany({
            where: { channelId, userId },
            data: { lastReadAt: new Date() },
        });
        if (updated.count === 0) {
            throw new ApiError(403, "ACCESS_DENIED", "You are not a member of this channel");
        }

        // Clear any pending chat notifications for this channel from the bell.
        await prisma.notification.updateMany({
            where: { userId, type: "CHAT_MESSAGE", isRead: false, link: `/messages?channel=${channelId}` },
            data: { isRead: true },
        });

        res.json({ message: "Channel marked as read" });
    } catch (err) {
        return next(err);
    }
};

// POST /api/chat/channels/:id/members  — add a member to a group channel
const addMember = async (req, res, next) => {
    try {
        const { id: channelId } = req.params;
        const { userId: requesterId } = req.user;
        const { userId } = req.body;

        if (!userId) throw new ApiError(400, "VALIDATION_ERROR", "userId is required");

        const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
        if (!channel) throw new ApiError(404, "NOT_FOUND", "Channel not found");
        if (channel.type === "dm") throw new ApiError(400, "VALIDATION_ERROR", "Cannot add members to a DM");

        // Only the channel creator (admin) can add members
        const requesterMember = await prisma.chatMember.findUnique({
            where: { channelId_userId: { channelId, userId: requesterId } },
        });
        if (!requesterMember || requesterMember.role !== "admin") {
            throw new ApiError(403, "ACCESS_DENIED", "Only channel admins can add members");
        }

        await prisma.chatMember.upsert({
            where: { channelId_userId: { channelId, userId } },
            create: { channelId, userId, role: "member" },
            update: {},
        });

        res.json({ message: "Member added" });
    } catch (err) {
        return next(err);
    }
};

// DELETE /api/chat/channels/:id/members/:uid  — remove a member from a group channel
const removeMember = async (req, res, next) => {
    try {
        const { id: channelId, uid: targetUserId } = req.params;
        const { userId: requesterId } = req.user;

        const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
        if (!channel) throw new ApiError(404, "NOT_FOUND", "Channel not found");

        const requesterMember = await prisma.chatMember.findUnique({
            where: { channelId_userId: { channelId, userId: requesterId } },
        });
        if (!requesterMember || requesterMember.role !== "admin") {
            throw new ApiError(403, "ACCESS_DENIED", "Only channel admins can remove members");
        }
        if (targetUserId === channel.createdById) {
            throw new ApiError(400, "VALIDATION_ERROR", "Cannot remove the channel creator");
        }

        await prisma.chatMember.deleteMany({ where: { channelId, userId: targetUserId } });

        res.json({ message: "Member removed" });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    createToken,
    getChannels,
    createGroupChannel,
    startDirectChat,
    getUsersForChat,
    getChannelMessages,
    markChannelRead,
    addMember,
    removeMember,
    seedDemoData,
};
