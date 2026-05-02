const express = require("express");
const router = express.Router();
const { salestrailWebhook, getCalls, getStats } = require("../controllers/salestrailController");
const authMiddleware = require("../middleware/authMiddleware");

// No auth middleware — Salestrail calls this with Basic Auth in header
router.post("/webhook", salestrailWebhook);

// Protected endpoints for the CRM frontend
router.get("/calls", authMiddleware, getCalls);
router.get("/stats", authMiddleware, getStats);

module.exports = router;
