const { handleChat } = require("./assistantService");
const { ApiError }   = require("../utils/apiError");

const STATUS_FOR = {
    TIMEOUT:       504,
    RATE_LIMITED:  429,
    PROVIDER_DOWN: 503,
};

// Operational kill-switch — flip ASSISTANT_ENABLED=false in env to stop accepting
// chat requests without redeploying code. Defaults to enabled when unset.
const isAssistantEnabled = () => {
    const v = (process.env.ASSISTANT_ENABLED ?? "true").toLowerCase().trim();
    return v !== "false" && v !== "0" && v !== "off" && v !== "no";
};

const chatHandler = async (req, res, next) => {
    if (!isAssistantEnabled()) {
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
