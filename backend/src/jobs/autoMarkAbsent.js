const prisma = require("../utils/prisma");
const { todayIST } = require("../utils/istTime");
const logger = require("../utils/logger");

/**
 * Runs daily at 12:00 PM IST (after the 11:50 AM weekday deadline).
 * Marks users who haven't checked in as ABSENT for today.
 * 
 * Logic:
 * 1. Get all active users (ADMIN, MANAGER, EMPLOYEE)
 * 2. Check if they have an attendance record for today
 * 3. If no record exists, create one with status ABSENT
 */
async function autoMarkAbsent() {
    const today = todayIST();
    
    try {
        // Get all active users (excluding SUPER_ADMIN who may not need attendance)
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: { in: ["ADMIN", "MANAGER", "EMPLOYEE"] }
            },
            select: { userId: true, name: true, role: true }
        });

        if (users.length === 0) {
            logger.info("[AutoMarkAbsent] No users found to check");
            return;
        }

        // Get existing attendance records for today
        const existingAttendance = await prisma.attendance.findMany({
            where: { date: today },
            select: { userId: true }
        });

        const checkedInUserIds = new Set(existingAttendance.map(a => a.userId));
        
        // Find users who haven't checked in
        const absentUsers = users.filter(u => !checkedInUserIds.has(u.userId));

        if (absentUsers.length === 0) {
            logger.info("[AutoMarkAbsent] All users have checked in today");
            return;
        }

        // Create ABSENT records for users who didn't check in
        const absentRecords = absentUsers.map(user => ({
            userId: user.userId,
            date: today,
            status: "ABSENT",
            checkIn: null,
            checkOut: null,
            checkInLatitude: null,
            checkInLongitude: null,
            checkOutLatitude: null,
            checkOutLongitude: null,
            breakMinutes: 0,
        }));

        await prisma.attendance.createMany({
            data: absentRecords,
            skipDuplicates: true // In case of race condition
        });

        logger.info(
            `[AutoMarkAbsent] Marked ${absentUsers.length} user(s) as ABSENT: ${absentUsers.map(u => u.name).join(", ")}`
        );
    } catch (error) {
        logger.error({ err: error }, "[AutoMarkAbsent] Failed to mark absent users");
        throw error;
    }
}

module.exports = autoMarkAbsent;
