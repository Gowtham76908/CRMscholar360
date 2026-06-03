const router         = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const rateLimiter    = require("../assistant/rateLimiter");
const { chatHandler, isAssistantEnabled } = require("../assistant/assistantController");

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

module.exports = router;
