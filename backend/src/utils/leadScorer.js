/**
 * Calculate lead score based on available data.
 * @param {Object} lead - The lead object containing source, phone, email, etc.
 * @returns {Object} { score, category }
 */
const calculateLeadScore = (lead) => {
    let score = 0;

    // Source Rules
    switch (lead.source) {
        case "WEBSITE": score += 10; break;
        case "LINKEDIN": score += 9; break;
        case "INSTAGRAM": score += 8; break;
        case "FACEBOOK": score += 7; break;
        case "PHONE_CALL": score += 5; break;
        case "GMAIL": score += 5; break;
        default: break;
    }

    // Contact Info Rules
    if (lead.phone) score += 5;
    if (lead.email) score += 5;

    // Activity Rules (Simplified for now - can be expanded to check actual activity history)
    // For example, if we had "tasksOverdue" count passed in:
    // if (lead.tasksOverdue > 0) score -= 5;

    // Determine Category
    let category = "Cold Lead";
    if (score >= 41) {
        category = "Hot Lead";
    } else if (score >= 21) {
        category = "Warm Lead";
    }

    return { score, category };
};

module.exports = calculateLeadScore;
