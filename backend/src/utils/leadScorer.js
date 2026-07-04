/**
 * Lead category thresholds — kept in lockstep with the frontend
 * (`getCategoryFromScore` in Leads.jsx and the badge in LeadDetail.jsx).
 * Score is always on a 0–100 scale across the whole app.
 */
const categoryFromScore = (score) => {
    if (score >= 81) return "PREMIUM";
    if (score >= 61) return "HOT";
    if (score >= 31) return "WARM";
    return "COLD";
};

// Source quality (max 15) — channel signal only, not intent.
const SOURCE_SCORE = {
    WEBSITE:    15,
    PHONE_CALL: 15,
    LINKEDIN:   12,
    INSTAGRAM:  10,
    FACEBOOK:    8,
    GMAIL:       8,
};

/**
 * Calculate a lead's creation-time score on a 0–100 scale.
 * This reflects only what we know at intake (source + contact info);
 * call sentiment later refines it via leadScoringService.
 * @param {Object} lead - { source, phone, email }
 * @returns {Object} { score, category }
 */
const calculateLeadScore = (lead) => {
    let score = SOURCE_SCORE[lead.source] ?? 10;

    if (lead.phone) score += 3;
    if (lead.email) score += 2;

    score = Math.max(0, Math.min(100, score));

    return { score, category: categoryFromScore(score) };
};

module.exports = calculateLeadScore;
module.exports.calculateLeadScore = calculateLeadScore;
module.exports.categoryFromScore = categoryFromScore;
module.exports.SOURCE_SCORE = SOURCE_SCORE;
