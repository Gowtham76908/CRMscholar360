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
const createToken = async (req, res, next) => {
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
        return next(error);
    }
};

// Create Channel (Optional - mostly handled frontend side for DMs, but good for Admin groups)
const createGroupChannel = async (req, res, next) => {
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

        return next(error);
    }
};

// Get All Users (For Search Bar) - reusing existing logic effectively, but specific format might be useful
const getUsersForChat = async (req, res, next) => {
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

        return next(error);
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
const startDirectChat = async (req, res, next) => {
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

        return next(error);
    }
};

// Sync user to Stream (helper exposed as endpoint)
const syncUserToStream = async (req, res, next) => {
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

        return next(error);
    }
};

// Sync ALL users to Stream (run once after deployment)
const syncAllUsers = async (req, res, next) => {
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

        return next(error);
    }
};

// Seed demo channels + messages
const seedDemoData = async (req, res, next) => {
    try {
        const streamClient = getStreamClient();
        const creatorId = req.user.userId;

        const users = await prisma.user.findMany({ where: { isActive: true } });
        for (const u of users) await upsertUserToStream(u).catch(() => {});

        const allIds = users.map(u => u.id);
        if (!allIds.includes(creatorId)) allIds.push(creatorId);

        const byDept = (dept) => users.filter(u => u.department === dept).map(u => u.id);
        const pick = (arr, i) => arr[i % arr.length];

        const channels = [
            {
                id: "general-team", name: "General", type: "team", members: allIds,
                messages: [
                    { text: "Good morning everyone! Hope you all had a great weekend 🌞", dept: null },
                    { text: "Don't forget standup at 10am — let's keep it sharp today.", dept: null },
                    { text: "New DCRM features are live on staging — please test before EOD.", dept: "Engineering" },
                    { text: "Sales pipeline looking really strong this week 💪", dept: "Sales" },
                    { text: "Team lunch this Friday at 1pm. Who's in? 🍕", dept: "HR" },
                    { text: "Reminder: fill in your attendance by 6pm!", dept: "HR" },
                    { text: "Great work on the Q3 numbers everyone, seriously 🚀", dept: null },
                ]
            },
            {
                id: "sales-team", name: "Sales Team", type: "team", members: [...byDept("Sales"), creatorId],
                messages: [
                    { text: "Q4 pipeline is looking very healthy — 47 hot leads this week alone 🔥", dept: "Sales" },
                    { text: "New inbound from Meta Ads — Tech Solutions Pvt Ltd. Assigning to Arjun.", dept: "Sales" },
                    { text: "Arjun, Deepa — please update your lead statuses before EOD.", dept: "Sales" },
                    { text: "Anita Bose just converted! Big win 🎉 That's our 3rd enterprise this month.", dept: "Sales" },
                    { text: "Follow-up calls done for today ✅ Two demos scheduled for Thursday.", dept: "Sales" },
                    { text: "Let's hit 200 conversions by month end. We're at 178 right now — so close!", dept: "Sales" },
                    { text: "Sunrise Traders proposal sent. Waiting for their sign-off.", dept: "Sales" },
                ]
            },
            {
                id: "dev-team", name: "Dev Team", type: "team", members: [...byDept("Engineering"), creatorId],
                messages: [
                    { text: "Deployment to staging done ✓ All services healthy.", dept: "Engineering" },
                    { text: "PR review needed for the automation branch — it's been sitting for 2 days.", dept: "Engineering" },
                    { text: "Bug #423 fixed — email notification delay was a cron timing issue. Pushing to prod tonight.", dept: "Engineering" },
                    { text: "New API docs updated in Notion. Please review the webhook section.", dept: "Engineering" },
                    { text: "Heads up: database migration scheduled for Sunday 2am. ~10min downtime.", dept: "Engineering" },
                    { text: "Frontend bundle size down by 18% after tree-shaking cleanup 🎯", dept: "Engineering" },
                ]
            },
            {
                id: "announcements", name: "Announcements", type: "team", members: allIds,
                messages: [
                    { text: "Company all-hands this Friday at 3pm in the main hall. Attendance mandatory.", dept: null },
                    { text: "New WFH policy document has been shared in the company Drive. Please review.", dept: "HR" },
                    { text: "Welcome Lakshmi Rao to the Marketing team! Please give her a warm welcome 🎉", dept: "HR" },
                    { text: "Office will be closed on Monday for the public holiday. Enjoy the long weekend!", dept: "HR" },
                    { text: "Q3 revenue targets exceeded by 12%! Huge thanks to the sales and marketing teams 🏆", dept: null },
                ]
            },
            {
                id: "marketing-team", name: "Marketing", type: "team", members: [...byDept("Marketing"), creatorId],
                messages: [
                    { text: "New campaign for Q4 goes live Monday — all creatives are ready.", dept: "Marketing" },
                    { text: "Google Ads CTR improved to 4.2% this week — best in 6 months!", dept: "Marketing" },
                    { text: "Blog post on automation features published. LinkedIn post scheduled for tomorrow.", dept: "Marketing" },
                    { text: "Meta lead form updated with new qualification questions. Let's see conversion improve.", dept: "Marketing" },
                ]
            },
        ];

        let seededChannels = 0;
        let seededMessages = 0;

        for (const def of channels) {
            const members = def.members.length > 0 ? def.members : allIds;
            const ch = streamClient.channel(def.type, def.id, {
                name: def.name,
                members,
                created_by_id: creatorId,
            });
            await ch.create();
            seededChannels++;

            const deptUsers = def.messages[0]?.dept ? byDept(def.messages[0].dept) : allIds;
            for (let i = 0; i < def.messages.length; i++) {
                const msg = def.messages[i];
                const pool = msg.dept ? byDept(msg.dept) : allIds;
                const senderId = pool.length > 0 ? pick(pool, i) : creatorId;
                await ch.sendMessage({ text: msg.text, user_id: senderId }).catch(() => {});
                seededMessages++;
            }
        }

        res.json({ ok: true, message: `Seeded ${seededChannels} channels with ${seededMessages} messages`, users: users.length });
    } catch (err) {

        return next(err);
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
    seedDemoData,
};
