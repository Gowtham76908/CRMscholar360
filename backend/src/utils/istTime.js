const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30, no DST

/**
 * Returns a Date object representing the current moment shifted to IST.
 * Use .getUTCHours(), .getUTCDay(), etc. to read IST wall-clock values.
 */
const nowIST = () => new Date(Date.now() + IST_OFFSET_MS);

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

module.exports = { nowIST, todayIST };
