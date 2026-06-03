// CSV field escaping for spreadsheet exports.
// 1. Quote the value and double any embedded quotes (RFC 4180).
// 2. Neutralize formula injection: a cell beginning with = + - @ (or a
//    leading tab/CR) is treated as a formula by Excel/Sheets. Lead names,
//    notes, etc. are user-supplied (some via public lead forms), so prefix
//    those with a single quote to force text interpretation.
const csvField = (value) => {
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
};

module.exports = { csvField };
