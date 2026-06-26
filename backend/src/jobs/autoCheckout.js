const prisma = require("../utils/prisma");
const { nowIST, todayIST } = require("../utils/istTime");
const logger = require("../utils/logger");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Auto-checkout job. Fires at the admin-configured run time (CompanySettings).
 *
 * Finds today's records with a checkIn but no checkOut and stamps checkOut at
 * markTime (IST "HH:MM", default 20:00 / 8 PM). Only processes employees who
 * actually checked in.
 *
 * @param {string} markTime  IST wall-clock "HH:MM" to record as the checkout time.
 */
const autoCheckout = async (markTime = "20:00") => {
    try {
        logger.debug("[AUTO-CHECKOUT] Job started");

        // IST calendar day, matched as a UTC range — consistent with how check-in
        // stores the date (midnight UTC of the IST day) and timezone-independent.
        const start = todayIST();
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);

        // Build the checkout instant from the IST wall-clock markTime for today.
        const [hh, mm] = String(markTime).split(":").map(Number);
        const ist = nowIST();
        const checkoutTime = new Date(
            Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hh || 20, mm || 0) - IST_OFFSET_MS
        );

        const attendanceRecords = await prisma.attendance.findMany({
            where: {
                date: { gte: start, lt: end },
                checkIn: { not: null },
                checkOut: null
            }
        });

        if (attendanceRecords.length === 0) {
            logger.debug("[AUTO-CHECKOUT] No records to process");
            return;
        }

        await Promise.all(attendanceRecords.map(record =>
            prisma.attendance.update({
                where: { id: record.id },
                data: { checkOut: checkoutTime }
            })
        ));

        logger.info(`[AUTO-CHECKOUT] Checked out ${attendanceRecords.length} employee(s) at ${markTime} IST`);
    } catch (error) {
        logger.error({ err: error }, "[AUTO-CHECKOUT] Error");
        throw error;
    }
};

module.exports = autoCheckout;
