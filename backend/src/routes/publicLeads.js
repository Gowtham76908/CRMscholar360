const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { capturePublicLead, getFormConfig } = require("../controllers/publicLeadsController");

// Wide-open CORS — this endpoint is called from customer websites
router.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// Per-IP cap on public submissions — unauthenticated endpoints with DB writes
// are easy spam vectors. Genuine embed forms rarely fire more than a few per hour.
const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many submissions. Please try again later." },
});

// GET /api/public/leads/config?key=WORKSPACE_API_KEY  — returns form field config
router.get("/config", getFormConfig);

// POST /api/public/leads?key=WORKSPACE_API_KEY  — submit a lead from a website form
router.post("/", submitLimiter, capturePublicLead);

module.exports = router;
