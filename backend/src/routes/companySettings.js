const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getSettings, updateSettings } = require("../controllers/companySettingsController");

router.use(authMiddleware);
router.get("/", getSettings);
router.patch("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateSettings);

module.exports = router;
