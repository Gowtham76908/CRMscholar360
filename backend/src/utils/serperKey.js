const prisma = require("./prisma");
const { decrypt } = require("./encrypt");

// Resolve the Serper API key, preferring a key configured via the Integration Hub
// (Settings → Integrations, stored encrypted) and falling back to the env var.
// Returns null when neither is configured so callers can return a clean 503.
const getSerperKey = async () => {
    try {
        const intg = await prisma.integration.findUnique({ where: { platform: "linkedin_serper" } });
        if (intg?.config?.apiKey) return decrypt(intg.config.apiKey);
    } catch (_) {
        // fall through to env
    }
    return process.env.SERPER_API_KEY || null;
};

module.exports = { getSerperKey };
