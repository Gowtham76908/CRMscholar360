const { handleChat } = require("./assistantService");
const { ApiError }   = require("../utils/apiError");
const { getAssistantSettings } = require("./settingsCache");
const prisma = require("../utils/prisma");
const logger = require("../utils/logger");

const STATUS_FOR = {
    TIMEOUT:       504,
    RATE_LIMITED:  429,
    PROVIDER_DOWN: 503,
};

// Operational kill-switch — flip via Settings UI (CompanySettings.assistantEnabled).
// Env var ASSISTANT_ENABLED still works as a fallback when the DB is unreachable.
const isAssistantEnabled = async () => {
    const { enabled } = await getAssistantSettings();
    return enabled;
};

const chatHandler = async (req, res, next) => {
    const userId    = req.user?.userId;
    const inputMode = req.body?.inputMode === "voice" ? "voice" : "chat";

    if (!(await isAssistantEnabled())) {
        if (userId) {
            prisma.assistantRequestLog.create({
                data: { userId, status: "DISABLED", inputMode },
            }).catch((err) => logger.warn({ err: err.message }, "Failed to log DISABLED"));
        }
        return res.status(503).json({
            error: { type: "DISABLED", message: "The assistant is temporarily disabled." },
        });
    }

    try {
        const { message, currentPage } = req.body ?? {};

        if (!message || typeof message !== "string" || !message.trim()) {
            return next(new ApiError(400, "VALIDATION_ERROR", "message is required"));
        }

        const result = await handleChat({
            userId:      req.user.userId,
            userName:    null,           // Phase 5: resolved inside buildSystemPrompt
            role:        req.user.role,
            message:     message.trim(),
            currentPage: currentPage ?? null,
            inputMode,
        });

        res.json({
            reply:     result.reply,
            usage:     result.usage,
            requestId: result.requestId,
        });
    } catch (err) {
        if (err.assistantError) {
            return res.status(STATUS_FOR[err.assistantError] ?? 500).json({
                error: { type: err.assistantError, message: err.message },
            });
        }
        next(err);
    }
};

module.exports = { chatHandler, isAssistantEnabled };
