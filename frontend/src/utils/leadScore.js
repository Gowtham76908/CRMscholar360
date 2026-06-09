// Single source of truth for lead temperature on the frontend.
// Mirrors the backend thresholds in backend/src/utils/leadScorer.js — keep them in
// lockstep. Score is always 0–100. All screens must use these helpers rather than
// hand-rolling their own breakpoints, so a lead reads the same temperature everywhere.

export const getCategoryFromScore = (score = 0) => {
    if (score >= 81) return "PREMIUM";
    if (score >= 61) return "HOT";
    if (score >= 31) return "WARM";
    return "COLD";
};

const STYLE = {
    PREMIUM: { label: "Premium", text: "text-purple-700", bg: "bg-purple-100", bar: "bg-purple-500" },
    HOT:     { label: "Hot",     text: "text-red-700",    bg: "bg-red-100",    bar: "bg-red-500"    },
    WARM:    { label: "Warm",    text: "text-amber-700",  bg: "bg-amber-100",  bar: "bg-amber-500"  },
    COLD:    { label: "Cold",    text: "text-blue-700",   bg: "bg-blue-100",   bar: "bg-blue-500"   },
};

export const getScoreStyle = (score = 0) => STYLE[getCategoryFromScore(score)];

export const getScoreLabel = (score = 0) => STYLE[getCategoryFromScore(score)].label;

// Convenience for a colored score chip: "text-… bg-…"
export const scoreChipClass = (score = 0) => {
    const s = getScoreStyle(score);
    return `${s.text} ${s.bg}`;
};
