const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");
const verifyWebhookSignature = require("../middleware/verifyWebhookSignature");

// Verify x-hub-signature-256 before processing any inbound webhook payload.
// Invalid or missing signatures receive 403 and are logged.
router.post("/leads", verifyWebhookSignature, webhookController.handleLeadWebhook);

module.exports = router;
