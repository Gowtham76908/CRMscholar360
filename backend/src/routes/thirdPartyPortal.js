const express = require("express");
const router = express.Router();
const thirdPartyPortalController = require("../controllers/thirdPartyPortalController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect all routes with authMiddleware
router.use(authMiddleware);

router.get("/", thirdPartyPortalController.listPortals);
router.post("/", thirdPartyPortalController.createPortal);

module.exports = router;
