const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { listTemplates, sendMessage, getMessages, watiWebhook } = require("../controllers/whatsappController");

// No auth — WATI POSTs here directly
router.post("/webhook", watiWebhook);

// Protected
router.use(authMiddleware);
router.get("/templates", listTemplates);
router.post("/send", sendMessage);
router.get("/:leadId/messages", getMessages);

module.exports = router;
