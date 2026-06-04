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
    { keys: ["STREAM_API_KEY", "STREAM_SECRET_KEY"], feature: "Team chat (Stream)" },
    { keys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],  feature: "Outbound email (password reset, invoices, reminders)" },
    { keys: ["FRONTEND_URL"], feature: "Password-reset links & CORS origin" },
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

    logger.info("[env] Configuration validated.");
};

module.exports = validateEnv;
