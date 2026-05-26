const prisma = require("../utils/prisma");

// Get all integrations
const getIntegrations = async (req, res, next) => {
    try {
        let integrations = await prisma.integration.findMany();

        // If no integrations exist, seed them (for initial setup)
        if (integrations.length === 0) {
            const defaults = [
                { platform: "Facebook Leads", isConnected: false },
                { platform: "Instagram Leads", isConnected: false },
                { platform: "Gmail", isConnected: false },
                { platform: "Website Contact Form", isConnected: false },
                { platform: "Phone Call Logs", isConnected: false },
            ];

            await prisma.integration.createMany({ data: defaults });
            integrations = await prisma.integration.findMany();
        }

        res.json(integrations);
    } catch (error) {
        return next(error);
    }
};

// Toggle Integration Status
const toggleIntegration = async (req, res, next) => {
    try {
        const { id } = req.params;

        const integration = await prisma.integration.findUnique({ where: { id } });
        if (!integration) {
            return res.status(404).json({ message: "Integration not found" });
        }

        const updated = await prisma.integration.update({
            where: { id },
            data: {
                isConnected: !integration.isConnected,
                lastSynced: !integration.isConnected ? new Date() : integration.lastSynced
            }
        });

        res.json(updated);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getIntegrations,
    toggleIntegration
};
