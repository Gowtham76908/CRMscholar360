const prisma = require("./prisma");

// Returns the start of the current Indian financial year (April 1).
// Comp off is tracked per FY so queries don't scan all-time history.
const currentFYStart = () => {
    const now = new Date();
    const year = now.getUTCMonth() >= 3   // April = month 3 (0-indexed)
        ? now.getUTCFullYear()
        : now.getUTCFullYear() - 1;
    return new Date(Date.UTC(year, 3, 1)); // April 1 00:00 UTC
};

/**
 * Calculates a single user's Comp Off balance for the current financial year.
 * Earned: Every Sunday where the user was PRESENT (within the FY).
 * Used:   Every APPROVED COMP_OFF leave (within the FY).
 */
const calculateCompOffBalance = async (userId) => {
    try {
        const since = currentFYStart();
        const now   = new Date();

        // Sunday PRESENT count within the FY — DB filters DOW so no in-memory scan
        const earnedRows = await prisma.$queryRaw`
            SELECT COUNT(*)::int AS earned
            FROM "Attendance"
            WHERE "userId" = ${userId}
              AND status   = 'PRESENT'
              AND date     >= ${since}
              AND EXTRACT(DOW FROM date) = 0
        `;
        const earned = earnedRows[0]?.earned ?? 0;

        // Leaves overlapping the FY — fetch date bounds so we can cap to the FY window
        const leaves = await prisma.leave.findMany({
            where: {
                userId,
                leaveType: "COMP_OFF",
                status:    "APPROVED",
                fromDate:  { lte: now },
                toDate:    { gte: since },
            },
            select: { fromDate: true, toDate: true, totalDays: true },
        });

        // Only deduct the portion of each leave that falls inside the FY
        const MS_PER_DAY = 86_400_000;
        const used = leaves.reduce((sum, l) => {
            const overlapStart = l.fromDate > since ? l.fromDate : since;
            const overlapEnd   = l.toDate   < now   ? l.toDate   : now;
            const overlapMs    = Math.max(0, overlapEnd - overlapStart);
            const overlapDays  = overlapMs > 0 ? Math.floor(overlapMs / MS_PER_DAY) + 1 : 0;
            return sum + overlapDays;
        }, 0);

        return Math.max(0, earned - used);
    } catch (err) {
        console.error("Error calculating comp off balance:", err);
        return 0;
    }
};

/**
 * Bulk version for N employees — exactly 2 queries regardless of count.
 * Scoped to the current financial year so it never scans all-time history.
 * Returns a Map<userId, balance>.
 */
const calculateCompOffBalanceBulk = async (userIds) => {
    if (!userIds.length) return new Map();

    const since = currentFYStart();

    // Sunday PRESENT count per user within the FY — uses (userId, date) index
    const earnedRows = await prisma.$queryRaw`
        SELECT "userId", COUNT(*)::int AS earned
        FROM "Attendance"
        WHERE "userId" = ANY(${userIds})
          AND status   = 'PRESENT'
          AND date     >= ${since}
          AND EXTRACT(DOW FROM date) = 0
        GROUP BY "userId"
    `;

    // COMP_OFF days used per user — cap each leave to the FY window with LEAST/GREATEST
    const now = new Date();
    const usedRows = await prisma.$queryRaw`
        SELECT "userId",
               SUM(
                   GREATEST(0,
                       EXTRACT(DAY FROM (
                           LEAST("toDate", ${now}::date) - GREATEST("fromDate", ${since}::date)
                       ))::int + 1
                   )
               )::int AS used
        FROM "Leave"
        WHERE "userId" = ANY(${userIds})
          AND "leaveType" = 'COMP_OFF'
          AND "status"    = 'APPROVED'
          AND "fromDate" <= ${now}
          AND "toDate"   >= ${since}
        GROUP BY "userId"
    `;

    const earnedMap = new Map(earnedRows.map(r => [r.userId, r.earned]));
    const usedMap   = new Map(usedRows.map(r => [r.userId, r.used ?? 0]));

    return new Map(userIds.map(id => [
        id,
        Math.max(0, (earnedMap.get(id) ?? 0) - (usedMap.get(id) ?? 0)),
    ]));
};

module.exports = {
    calculateCompOffBalance,
    calculateCompOffBalanceBulk,
    currentFYStart,
};
