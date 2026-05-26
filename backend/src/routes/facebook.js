const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const verifyWebhookSignature = require("../middleware/verifyWebhookSignature");
const { getStatus, connect, disconnect, listForms, syncLeads, verifyWebhook, receiveWebhookEvent } = require("../controllers/facebookController");

// ── Public webhook endpoints (no auth — called by Facebook/Meta servers) ────
// GET: subscription verification challenge
router.get("/webhook", verifyWebhook);
// POST: real-time lead events — verified via x-hub-signature-256 before processing
router.post("/webhook", verifyWebhookSignature, receiveWebhookEvent);

// ── Protected endpoints (require authenticated session) ──────────────────────
router.use(authMiddleware);

router.get("/status",       getStatus);
router.post("/connect",     roleMiddleware(["SUPER_ADMIN", "ADMIN"]), connect);
router.post("/disconnect",  roleMiddleware(["SUPER_ADMIN", "ADMIN"]), disconnect);
router.get("/forms",        roleMiddleware(["SUPER_ADMIN", "ADMIN"]), listForms);
router.post("/sync",        roleMiddleware(["SUPER_ADMIN", "ADMIN"]), syncLeads);

module.exports = router;
