const express = require("express");
const router = express.Router();
const { fasterqWebhook, getCalls, getStats } = require("../controllers/fasterqController");
const authMiddleware = require("../middleware/authMiddleware");

// No auth middleware — Fasterq calls this with Basic Auth in header
router.post("/webhook", fasterqWebhook);

// Protected endpoints for the CRM frontend
router.get("/calls", authMiddleware, getCalls);
router.get("/stats", authMiddleware, getStats);

module.exports = router;
