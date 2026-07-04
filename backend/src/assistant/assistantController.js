const OpenAI = require("openai");
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

// ── Voice transcription (server-side fallback for the browser Web Speech API) ──
// Works in every browser/network since it doesn't depend on the browser's own
// speech backend. Records audio client-side → Whisper here → returns text.
let _sttClient = null;
const getSttClient = () => {
    if (!process.env.OPENAI_API_KEY) {
        const err = new Error("Voice transcription is not configured on this server.");
        err.assistantError = "PROVIDER_DOWN";
        throw err;
    }
    if (!_sttClient) _sttClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _sttClient;
};

const transcribeHandler = async (req, res, next) => {
    if (!(await isAssistantEnabled())) {
        return res.status(503).json({
            error: { type: "DISABLED", message: "The assistant is temporarily disabled." },
        });
    }

    try {
        if (!req.file?.buffer?.length) {
            return next(new ApiError(400, "VALIDATION_ERROR", "audio file is required"));
        }

        const client = getSttClient();
        const file = await OpenAI.toFile(
            req.file.buffer,
            req.file.originalname || "audio.webm",
            { type: req.file.mimetype || "audio/webm" },
        );
        const model  = process.env.OPENAI_STT_MODEL || "whisper-1";
        const result = await client.audio.transcriptions.create({ file, model });

        res.json({ text: (result.text || "").trim() });
    } catch (err) {
        if (err.assistantError) {
            return res.status(STATUS_FOR[err.assistantError] ?? 500).json({
                error: { type: err.assistantError, message: err.message },
            });
        }
        logger.warn({ err: err.message }, "Voice transcription failed");
        next(err);
    }
};

module.exports = { chatHandler, transcribeHandler, isAssistantEnabled };
