const prisma = require("../utils/prisma");
const logger = require("../utils/logger");

const TTL_MS = 30_000;

const FALLBACK = {
    enabled:         (process.env.ASSISTANT_ENABLED ?? "true").toLowerCase().trim() !== "false",
    rateLimit:       Math.max(1, parseInt(process.env.ASSISTANT_RATE_LIMIT, 10) || 30),
    maxHistoryTurns: Math.max(0, parseInt(process.env.ASSISTANT_MAX_HISTORY_TURNS, 10) || 6),
};

let cached    = null;
let expiresAt = 0;

const getAssistantSettings = async () => {
    if (cached && Date.now() < expiresAt) return cached;
    try {
        const row = await prisma.companySettings.findFirst({
            select: {
                assistantEnabled:         true,
                assistantRateLimitPerMin: true,
                assistantMaxHistoryTurns: true,
            },
        });
        cached = {
            enabled:         row?.assistantEnabled         ?? FALLBACK.enabled,
            rateLimit:       row?.assistantRateLimitPerMin ?? FALLBACK.rateLimit,
            maxHistoryTurns: row?.assistantMaxHistoryTurns ?? FALLBACK.maxHistoryTurns,
        };
    } catch (err) {
        logger.warn({ err: err.message }, "Assistant settings DB read failed; using env fallback");
        cached = { ...FALLBACK };
    }
    expiresAt = Date.now() + TTL_MS;
    return cached;
};

const invalidateAssistantSettings = () => {
    cached    = null;
    expiresAt = 0;
};

module.exports = { getAssistantSettings, invalidateAssistantSettings };
