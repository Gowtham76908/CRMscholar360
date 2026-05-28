const router         = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const { chatHandler, isAssistantEnabled } = require("../assistant/assistantController");

router.get("/health", (req, res) => {
    const enabled = isAssistantEnabled();
    res.json({
        status:   enabled ? "ok" : "disabled",
        enabled,
        provider: process.env.LLM_PROVIDER || "openai",
        model:    process.env.OPENAI_MODEL  || "gpt-4o-mini",
    });
});

router.post("/chat", authMiddleware, chatHandler);

module.exports = router;
