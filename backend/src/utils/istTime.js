const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30, no DST

/**
 * Returns a Date object representing the current moment shifted to IST.
 * Use .getUTCHours(), .getUTCDay(), etc. to read IST wall-clock values.
 */
const nowIST = () => new Date(Date.now() + IST_OFFSET_MS);

/**
 * Shifts any Date to IST so its UTC accessors read IST wall-clock values.
 * e.g. toIST(checkIn).getUTCHours() === the hour the user saw on their clock.
 */
const toIST = (date) => new Date(new Date(date).getTime() + IST_OFFSET_MS);

/**
 * IST calendar-date key "YYYY-MM-DD" for bucketing charts/reports by the day
 * the business actually experienced (not the UTC day).
 */
const istDateKey = (date) => toIST(date).toISOString().split("T")[0];

/**
 * Returns midnight UTC of today's date in IST.
 * This is what gets stored in the DB as the attendance date key.
 *
 * Example: 12:30 AM IST on May 5 = 7:00 PM UTC on May 4.
 * Without this fix the record would be stored under May 4 (wrong).
 * With this fix it is stored under May 5 (correct — the IST calendar date).
 */
const todayIST = () => {
    const ist = nowIST();
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
};

module.exports = { nowIST, todayIST, toIST, istDateKey };
