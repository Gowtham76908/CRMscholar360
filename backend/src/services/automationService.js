const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");

const runStatusAutomation = async () => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Rule 1: Auto-mark as LOST if no activity in 7 days
        // We look for leads where updated at is older than 7 days and status is OLD/NEW
        // Ideally we check Activity logs, but for MVP checking updateAt is decent proxy
        const staleLeads = await prisma.lead.findMany({
            where: {
                status: {
                    in: ["NEW", "CONTACTED", "FOLLOW_UP"]
                },
                updatedAt: {
                    lt: sevenDaysAgo
                }
            }
        });

        for (const lead of staleLeads) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: { status: "LOST" }
            });

            await logActivity({
                leadId: lead.id,
                action: "STATUS_AUTO_UPDATE",
                metadata: { reason: "No activity for 7 days", oldStatus: lead.status, newStatus: "LOST" }
            });
            console.log(`[Automation] Marked lead ${lead.id} as LOST (Inactive).`);
        }

    } catch (error) {
        console.error("Error running automation:", error);
    }
};

module.exports = { runStatusAutomation };
