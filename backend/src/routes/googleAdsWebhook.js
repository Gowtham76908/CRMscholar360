const express = require("express");
const router = express.Router();
const { receiveGoogleAdsLead, verifyGoogleAdsWebhook } = require("../controllers/googleAdsWebhookController");

// Google Ads Lead Form Extension webhook — public, no auth
// GET: Google pings this to verify the URL is live (returns 200 with google_key echoed)
router.get("/webhook", verifyGoogleAdsWebhook);
// POST: Google sends lead data here
router.post("/webhook", receiveGoogleAdsLead);

module.exports = router;
