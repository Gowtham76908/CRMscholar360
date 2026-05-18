const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { listTemplates, sendMessage, getMessages, watiWebhook } = require("../controllers/whatsappController");
const {
    createCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    listCampaigns,
    getCampaign,
    listAutoReplies,
    createAutoReply,
    updateAutoReply,
    deleteAutoReply,
} = require("../controllers/whatsappCampaignController");

const WATI_WEBHOOK_TOKEN = process.env.WATI_WEBHOOK_TOKEN;

// No auth — WATI POSTs here directly, but validate webhook token if configured
router.post("/webhook", (req, res, next) => {
    if (WATI_WEBHOOK_TOKEN) {
        const token = req.headers["x-wati-token"] || req.query.token;
        if (token !== WATI_WEBHOOK_TOKEN) {
            return res.status(401).json({ error: "Unauthorized webhook request" });
        }
    }
    next();
}, watiWebhook);

// Protected
router.use(authMiddleware);

// Single message (any authenticated user)
router.get("/templates", listTemplates);
router.post("/send", sendMessage);
router.get("/:leadId/messages", getMessages);

// Campaigns — write operations restricted to ADMIN+
router.get("/campaigns", listCampaigns);
router.post("/campaigns", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), createCampaign);
router.get("/campaigns/:id", getCampaign);
router.post("/campaigns/:id/start", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), startCampaign);
router.post("/campaigns/:id/pause", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), pauseCampaign);
router.post("/campaigns/:id/resume", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), resumeCampaign);

// Auto-replies — write operations restricted to ADMIN+
router.get("/auto-replies", listAutoReplies);
router.post("/auto-replies", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), createAutoReply);
router.patch("/auto-replies/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateAutoReply);
router.delete("/auto-replies/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deleteAutoReply);

module.exports = router;
