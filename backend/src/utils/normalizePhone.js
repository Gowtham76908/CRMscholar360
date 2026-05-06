/**
 * Strip all non-digits and return the last 10 digits.
 * Handles formats: +91 98765 43210, 091-9876543210, 9876543210, etc.
 * Returns null if result is not exactly 10 digits (unparseable or ambiguous).
 */
const normalizePhone = (phone) => {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    const last10 = digits.slice(-10);
    if (last10.length !== 10) return null;
    return last10;
};

module.exports = normalizePhone;
