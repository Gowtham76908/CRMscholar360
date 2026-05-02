const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Get all integrations
router.get("/", integrationController.getIntegrations);

// Toggle integration (Admin only)
router.patch("/:id/toggle", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), integrationController.toggleIntegration);

module.exports = router;
