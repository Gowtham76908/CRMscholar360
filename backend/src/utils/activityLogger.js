const prisma = require("./prisma");

/**
 * Log an activity for a lead, user, or both.
 * @param {Object} params
 * @param {string} [params.leadId] - ID of the lead
 * @param {string} [params.userId] - ID of the user performing the action or user being affected
 * @param {string} params.action - Description of the action (e.g., "LEAD_CREATED", "STATUS_UPDATED")
 * @param {Object} [params.metadata] - Additional JSON data
 */
const logActivity = async ({ leadId, userId, action, metadata }) => {
    try {
        await prisma.activity.create({
            data: { leadId, userId, action, metadata }
        });
        if (leadId) {
            await prisma.lead.update({
                where: { id: leadId },
                data: { lastActivityAt: new Date() },
            }).catch(() => {}); // ignore if lead doesn't exist
        }
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};

module.exports = logActivity;
