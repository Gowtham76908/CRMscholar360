const prisma = require("../utils/prisma");
const chatController = require("../controllers/chatController");

// Mock Express Request and Response
const req = {
    body: {
        targetUserId: "mock-target-id" // Will require a real ID to work fully, but enough to test initial flow
    },
    user: {
        userId: "mock-current-id"
    }
};

const res = {
    status: function (code) {
        console.log(`Response Status: ${code}`);
        return this;
    },
    json: function (data) {
        console.log("Response JSON:", data);
        return this;
    }
};

async function testStartDirectChat() {
    try {
        console.log("--- Starting Test ---");
        // We need real IDs to avoid 404. Let's fetch two random users.
        const users = await prisma.user.findMany({ take: 2 });
        if (users.length < 2) {
            console.error("Not enough users to test.");
            return;
        }

        req.user.userId = users[0].id;
        req.body.targetUserId = users[1].id;

        console.log(`Testing with Current User: ${req.user.userId}, Target: ${req.body.targetUserId}`);

        await chatController.startDirectChat(req, res);

    } catch (error) {
        console.error("Test Script Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testStartDirectChat();
