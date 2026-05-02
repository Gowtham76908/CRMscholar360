const prisma = require("./prisma");

/**
 * Calculates a user's Compensatory Off (Comp Off) balance.
 * Earned: Every Sunday where the user was PRESENT.
 * Used: Every APPROVED leave with type 'COMP_OFF'.
 */
const calculateCompOffBalance = async (userId) => {
    try {
        // 1. Earned: Every Sunday (day 0) present
        const attendances = await prisma.attendance.findMany({
            where: { userId, status: "PRESENT" }
        });
        
        // Filter for Sundays (getUTCDay === 0)
        const earned = attendances.filter(a => {
            const d = new Date(a.date);
            return d.getUTCDay() === 0;
        }).length;

        // 2. Used: Approved COMP_OFF leaves
        const leaves = await prisma.leave.findMany({
            where: { userId, leaveType: "COMP_OFF", status: "APPROVED" }
        });
        const used = leaves.reduce((sum, l) => sum + l.totalDays, 0);

        return Math.max(0, earned - used);
    } catch (err) {
        console.error("Error calculating comp off balance:", err);
        return 0;
    }
};

module.exports = {
    calculateCompOffBalance
};
