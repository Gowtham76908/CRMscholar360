const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

// Public route (might need API Key validation in real world, skipping for MVP)
router.post("/leads", webhookController.handleLeadWebhook);

module.exports = router;
