const express = require("express");
const router = express.Router();
const { trackOpen, trackClick } = require("../controllers/emailTrackController");

// Public routes — no auth (email clients load pixel without credentials)
router.get("/open/:id",  trackOpen);
router.get("/click/:id", trackClick);

module.exports = router;
