const router         = require("express").Router();
const multer         = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimiter    = require("../assistant/rateLimiter");
const { chatHandler, transcribeHandler, isAssistantEnabled } = require("../assistant/assistantController");

// Audio stays in memory (small clips) and is streamed straight to Whisper.
const uploadAudio = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 15 * 1024 * 1024 }, // 15MB — plenty for short voice clips
});

router.get("/health", async (req, res) => {
    const enabled = await isAssistantEnabled();
    res.json({
        status:   enabled ? "ok" : "disabled",
        enabled,
        provider: process.env.LLM_PROVIDER || "openai",
        model:    process.env.OPENAI_MODEL  || "gpt-4o-mini",
    });
});

router.post("/chat", authMiddleware, rateLimiter.limit, chatHandler);

router.post("/transcribe", authMiddleware, rateLimiter.limit, (req, res, next) => {
    uploadAudio.single("audio")(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                error: { type: "UPLOAD_ERROR", message: err.message || "Failed to read audio." },
            });
        }
        next();
    });
}, transcribeHandler);

module.exports = router;
