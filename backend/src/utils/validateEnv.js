const logger = require("./logger");

// Vars the app cannot run correctly without. Missing any of these is fatal —
// we exit immediately rather than failing later with an opaque runtime 500.
const REQUIRED = [
    { key: "DATABASE_URL", why: "Prisma cannot connect to the database" },
    { key: "JWT_SECRET",   why: "authentication tokens cannot be signed or verified" },
];

// Vars that gate optional features. Missing them isn't fatal, but the feature
// silently no-ops (e.g. password-reset emails never arrive), so we warn loudly.
const RECOMMENDED = [
    { keys: ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"], feature: "Video calls (LiveKit)" },
    { keys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],  feature: "Outbound email (password reset, invoices, reminders)" },
    { keys: ["FRONTEND_URL"], feature: "Password-reset links & CORS origin" },
    // ENCRYPTION_KEY is what encrypts stored Google OAuth tokens and integration configs.
    { keys: ["ENCRYPTION_KEY"], feature: "Token encryption (Google Calendar / WhatsApp)" },
    // Bunny.net storage — without it uploads fall back to ephemeral local disk.
    { keys: ["BUNNY_STORAGE_ZONE", "BUNNY_STORAGE_ACCESS_KEY", "BUNNY_PULL_ZONE_HOST"], feature: "Persistent file storage (Bunny.net)" },
];

const validateEnv = () => {
    const missingRequired = REQUIRED.filter(({ key }) => !process.env[key]);

    if (missingRequired.length > 0) {
        for (const { key, why } of missingRequired) {
            logger.error(`[env] Missing required ${key} — ${why}.`);
        }
        logger.error("[env] Refusing to start with an invalid configuration. Set the variables above and restart.");
        process.exit(1);
    }

    for (const { keys, feature } of RECOMMENDED) {
        const missing = keys.filter((k) => !process.env[k]);
        if (missing.length > 0) {
            logger.warn(`[env] ${feature} disabled — missing ${missing.join(", ")}.`);
        }
    }

    // ENCRYPTION_KEY, if present, must be a 32-byte hex string or every encrypt()
    // call will throw. Catch the malformed-but-set case here rather than at runtime.
    const encKey = process.env.ENCRYPTION_KEY;
    if (encKey && !/^[0-9a-fA-F]{64}$/.test(encKey)) {
        logger.warn("[env] ENCRYPTION_KEY is set but is not a 64-char hex string — token encryption (Google Calendar) will fail until fixed.");
    }

    logger.info("[env] Configuration validated.");
};

module.exports = validateEnv;
