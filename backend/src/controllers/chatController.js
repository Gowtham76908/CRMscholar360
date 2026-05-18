const { StreamChat } = require("stream-chat");
const prisma = require("../utils/prisma");

// Initialize Stream Client lazily or ensure env vars are loaded
const getStreamClient = () => {
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_SECRET_KEY) {
        throw new Error("MISSING STREAM CREDENTIALS");
    }
    return StreamChat.getInstance(
        process.env.STREAM_API_KEY,
        process.env.STREAM_SECRET_KEY,
        { timeout: 15000 } // Increase timeout to 15s to prevent timeouts
    );
};

// Create Token & Sync User
const createToken = async (req, res) => {
    try {
        console.log("Chat Token Request Initiated");
        // console.log("User in Request:", req.user); // Debug: Check if user exists

        if (!req.user || !req.user.userId) {
            console.error("User ID missing from request token payload");
            return res.status(401).json({ message: "User authentication failed" });
        }

        const { userId } = req.user;

        // Fetch fresh user data from DB
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const streamClient = getStreamClient();

        // Upsert user in Stream
        const profilePhotoUrl = user.profilePhoto
            ? `${process.env.BACKEND_URL || 'http://localhost:5001'}${user.profilePhoto}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

        const upsertData = {
            id: user.id,
            name: user.name,
            role: user.role === "SUPER_ADMIN" ? "admin" : "user",
            image: profilePhotoUrl,
            online_status: user.onlineStatus,
            last_seen: user.lastSeen ? user.lastSeen.toISOString() : null
        };

        try {
            await streamClient.upsertUser(upsertData);
        } catch (upsertError) {
            console.error("Stream Integration Warning: Failed to upsert user", upsertError.message);
        }

        // Create token
        const token = streamClient.createToken(user.id);

        res.json({
            token,
            apiKey: process.env.STREAM_API_KEY,
            user: {
                id: user.id,
                name: user.name,
                image: upsertData.image,
                role: user.role
            }
        });
    } catch (error) {
        console.error("CRITICAL ERROR creating stream token:", error);
        if (error.response) {
            console.error("Stream API Response Error:", error.response.data);
        }
        res.status(500).json({ message: "Failed to create chat token", error: error.message });
    }
};

// Create Channel (Optional - mostly handled frontend side for DMs, but good for Admin groups)
const createGroupChannel = async (req, res) => {
    try {
        const { name, members, image } = req.body; // members = array of userIds
        const creatorId = req.user.userId;

        if (!members || members.length === 0) {
            return res.status(400).json({ message: "Members are required" });
        }

        const streamClient = getStreamClient();
        const channel = streamClient.channel("team", name.toLowerCase().replace(/\s+/g, "-"), {
            name,
            image,
            created_by_id: creatorId,
            members: [...members, creatorId],
        });

        await channel.create();

        res.json({ message: "Channel created successfully", channelId: channel.id });
    } catch (error) {
        console.error("Error creating channel:", error);
        res.status(500).json({ message: "Failed to create channel" });
    }
};

// Get All Users (For Search Bar) - reusing existing logic effectively, but specific format might be useful
const getUsersForChat = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            console.error("User ID missing from request in getUsersForChat");
            return res.status(401).json({ message: "User authentication failed" });
        }

        const currentUserId = req.user.userId;

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                NOT: { id: currentUserId } // Exclude self
            },
            select: {
                id: true,
                name: true,
                role: true,
                department: true,
                jobTitle: true
                // image: true // Removed as it doesn't exist in schema
            }
        });

        const formattedUsers = users.map(u => ({
            id: u.id,
            name: u.name || "Unknown User",
            role: u.role,
            department: u.department,
            jobTitle: u.jobTitle,
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "Unknown")}`
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error("Error in getUsersForChat:", error);
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
};

// Helper: Upsert User to Stream
const upsertUserToStream = async (user) => {
    const streamClient = getStreamClient();
    const profilePhotoUrl = user.profilePhoto
        ? `${process.env.BACKEND_URL || 'http://localhost:5001'}${user.profilePhoto}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;
    const upsertData = {
        id: user.id,
        name: user.name,
        role: user.role === "SUPER_ADMIN" ? "admin" : "user",
        image: profilePhotoUrl,
        online_status: user.onlineStatus // Custom field for WhatsApp presence
    };
    await streamClient.upsertUser(upsertData);
    return upsertData;
};

// Start Direct Chat (Syncs users first)
const startDirectChat = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user?.userId;
        console.log(`[CHAT_START] Request from ${currentUserId} to ${targetUserId}`);

        if (!targetUserId) {
            return res.status(400).json({ message: "Target user ID is required" });
        }
        if (!currentUserId) {
            return res.status(401).json({ message: "User not authenticated correctly" });
        }

        // Fetch both users
        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({ where: { id: currentUserId } }),
            prisma.user.findUnique({ where: { id: targetUserId } })
        ]);

        if (!currentUser || !targetUser) {
            console.error(`[CHAT_START] User missing: currentUser=${!!currentUser}, targetUser=${!!targetUser}`);
            return res.status(404).json({ message: "One or more users not found in database" });
        }

        // Sync both users to Stream to ensure they exist
        await Promise.all([
            upsertUserToStream(currentUser),
            upsertUserToStream(targetUser)
        ]);

        const streamClient = getStreamClient();

        // Create or get channel without explicit ID (Stream handles DMs logic)
        const channel = streamClient.channel("messaging", {
            members: [currentUserId, targetUserId],
            created_by_id: currentUserId,
            category: 'dm' // Explicitly tag as DM
        });

        await channel.create();

        res.json({
            message: "Chat started successfully",
            channelId: channel.id,
            cid: channel.cid
        });

    } catch (error) {
        console.error("CRITICAL [CHAT_START] error:", error);
        res.status(500).json({ message: "Failed to start chat", error: error.message });
    }
};

// Sync user to Stream (helper exposed as endpoint)
const syncUserToStream = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await upsertUserToStream(user);

        res.status(200).json({
            message: "User synced to Stream successfully",
            user: {
                id: user.id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Error syncing user to Stream:", error);
        res.status(500).json({ message: "Failed to sync user" });
    }
};

// Sync ALL users to Stream (run once after deployment)
const syncAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true }
        });

        console.log(`Syncing ${users.length} users to Stream...`);

        const results = [];
        for (const user of users) {
            try {
                await upsertUserToStream(user);
                results.push({ id: user.id, name: user.name, status: 'success' });
                console.log(`Synced user: ${user.name}`);
            } catch (error) {
                console.error(`Failed to sync user ${user.id}:`, error.message);
                results.push({ id: user.id, name: user.name, status: 'failed', error: error.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`Sync complete: ${successCount}/${users.length} users synced successfully`);

        res.status(200).json({
            message: `Synced ${successCount}/${users.length} users to Stream`,
            results
        });
    } catch (error) {
        console.error("Error syncing all users:", error);
        res.status(500).json({ message: "Failed to sync users", error: error.message });
    }
};

module.exports = {
    createToken,
    createGroupChannel,
    getUsersForChat,
    startDirectChat,
    syncUserToStream,
    syncAllUsers,
    upsertUserToStream,
};
