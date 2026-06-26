const prisma = require("../utils/prisma");

// Auto-set users to OFFLINE if they've been on BREAK for more than 1 hour
const autoBreakOffline = async () => {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const usersOnBreak = await prisma.user.findMany({
            where: {
                onlineStatus: "BREAK",
                breakStartedAt: { lte: oneHourAgo }
            },
            select: { id: true, name: true }
        });

        if (usersOnBreak.length === 0) return;

        console.log(`[AutoBreakOffline] Setting ${usersOnBreak.length} user(s) to OFFLINE after 1hr on break`);

        await prisma.user.updateMany({
            where: { id: { in: usersOnBreak.map(u => u.id) } },
            data: { onlineStatus: "OFFLINE", breakStartedAt: null }
        });

        await prisma.employeeProfile.updateMany({
            where: { employeeId: { in: usersOnBreak.map(u => u.id) } },
            data: { availabilityStatus: "OFFLINE" }
        });

        await prisma.userStatusLog.createMany({
            data: usersOnBreak.map(u => ({
                userId: u.id,
                status: "OFFLINE",
                note: "Auto-offline: break exceeded 1 hour"
            }))
        });
    } catch (error) {
        console.error("[AutoBreakOffline] Error:", error.message);
    }
};

module.exports = autoBreakOffline;
