const prisma = require("../utils/prisma");

async function verifyChatUsersFetch() {
    try {
        console.log("Starting verification of chat user fetch...");

        const currentUserId = "mock-user-id";

        const users = await prisma.user.findMany({
            where: {
                isActive: true, // This field exists
                NOT: { id: currentUserId }
            },
            select: {
                id: true,
                name: true,
                role: true,
                department: true,
                jobTitle: true
                // image: true // This caused the error, ensuring it's not here
            }
        });

        console.log("Successfully fetched users:", users.length);
        if (users.length > 0) {
            console.log("Sample user:", users[0]);
        }
        console.log("VERIFICATION SUCCESS");
    } catch (error) {
        console.error("VERIFICATION FAILED:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyChatUsersFetch();
