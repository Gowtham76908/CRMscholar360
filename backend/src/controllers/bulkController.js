const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");

const bulkUpdateLeads = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadIds, status } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Invalid lead IDs" });
        }

        const result = await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { status }
        });

        // Log batch activity
        // Ideally we generate one log per lead or a batch log. 
        // For performance, we'll just log a generic batch action or loop async.
        // Let's loop async for better audit trails.
        for (const id of leadIds) {
            await logActivity({
                leadId: id,
                userId,
                action: "LEAD_BULK_UPDATE",
                metadata: { newStatus: status }
            });
        }

        res.json({ message: `Updated ${result.count} leads successfully`, count: result.count });
    } catch (error) {
        res.status(500).json({ message: "Error bulk updating leads", error: error.message });
    }
};

const bulkAssignLeads = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadIds, assignedToId } = req.body;

        if (!leadIds || !assignedToId) {
            return res.status(400).json({ message: "Lead IDs and Assignee ID are required" });
        }

        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee) return res.status(404).json({ message: "User not found" });

        const result = await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { assignedToId }
        });

        for (const id of leadIds) {
            await logActivity({
                leadId: id,
                userId,
                action: "LEAD_BULK_ASSIGN",
                metadata: { assignedTo: assignee.name }
            });
        }

        res.json({ message: `Assigned ${result.count} leads to ${assignee.name}`, count: result.count });
    } catch (error) {
        res.status(500).json({ message: "Error bulk assigning leads", error: error.message });
    }
};

module.exports = { bulkUpdateLeads, bulkAssignLeads };
