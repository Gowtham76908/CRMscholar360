const prisma = require("../utils/prisma");
const logger = require("../utils/logger");

/**
 * Auto-checkout job: Runs at 10:00 PM daily
 * 
 * Logic:
 * - Finds all attendance records for today with checkIn but no checkOut
 * - Sets checkOut to 8:00 PM (office end time)
 * - Only processes records where employee checked in
 */
const autoCheckout = async () => {
    try {
        logger.debug("[AUTO-CHECKOUT] Job started");

        // Get today's date in UTC
        const today = new Date();
        const todayDateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

        // Create checkout time at 8:00 PM today
        const checkoutTime = new Date();
        checkoutTime.setHours(20, 0, 0, 0); // 8:00 PM

        // Find all attendance records for today with checkIn but no checkOut
        const attendanceRecords = await prisma.attendance.findMany({
            where: {
                date: todayDateOnly,
                checkIn: { not: null },
                checkOut: null
            }
        });

        if (attendanceRecords.length === 0) {
            logger.debug("[AUTO-CHECKOUT] No records to process");
            return;
        }

        // Update each record with auto-checkout time
        const updatePromises = attendanceRecords.map(record =>
            prisma.attendance.update({
                where: { id: record.id },
                data: { checkOut: checkoutTime }
            })
        );

        await Promise.all(updatePromises);

        logger.info(`[AUTO-CHECKOUT] Checked out ${attendanceRecords.length} employees at 8:00 PM`);
    } catch (error) {
        logger.error({ err: error }, "[AUTO-CHECKOUT] Error");
    }
};

module.exports = autoCheckout;
