// Single source of truth for the human-readable lead source label.
// A lead's `source` is a fixed enum, but some sources (e.g. Google Sheets) allow a
// per-lead override via `sourceLabel` (the sheet's custom name) — always prefer that
// over the generic enum label when present.

export const SOURCE_LABEL = {
    FACEBOOK: "Facebook",
    INSTAGRAM: "Instagram",
    GMAIL: "Gmail",
    WEBSITE: "Website",
    PHONE_CALL: "Phone Call",
    LINKEDIN: "LinkedIn",
    SHEETS: "Google Sheet",
};

export function getSourceLabel(lead) {
    if (!lead) return "";
    return lead.sourceLabel || SOURCE_LABEL[lead.source] || lead.source;
}
