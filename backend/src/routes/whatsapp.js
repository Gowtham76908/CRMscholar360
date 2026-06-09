const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { createCampaignSchema, createAutoReplySchema } = require("../middleware/schemas");
const { listTemplates, sendMessage, getMessages, getInboundMessages, metaWebhook, verifyWebhookSubscription } = require("../controllers/whatsappController");
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

// Meta Cloud API webhook endpoints — no app auth (Meta posts here directly).
// The POST handler verifies the X-Hub-Signature-256 HMAC against the app secret;
// the GET handler responds to Meta's subscription verification handshake.
router.get("/webhook", verifyWebhookSubscription);
router.post("/webhook", metaWebhook);

// Protected
router.use(authMiddleware);

// Single message (any authenticated user)
router.get("/templates", listTemplates);
router.post("/send", sendMessage);
router.get("/messages", getInboundMessages);
router.get("/:leadId/messages", getMessages);

// Campaigns — write operations restricted to ADMIN+
router.get("/campaigns", listCampaigns);
router.post("/campaigns", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(createCampaignSchema), createCampaign);
router.get("/campaigns/:id", getCampaign);
router.post("/campaigns/:id/start", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), startCampaign);
router.post("/campaigns/:id/pause", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), pauseCampaign);
router.post("/campaigns/:id/resume", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), resumeCampaign);

// Auto-replies — write operations restricted to ADMIN+
router.get("/auto-replies", listAutoReplies);
router.post("/auto-replies", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(createAutoReplySchema), createAutoReply);
router.patch("/auto-replies/:id", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), updateAutoReply);
router.delete("/auto-replies/:id", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), deleteAutoReply);

module.exports = router;
