const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get("/", roleMiddleware(["SUPER_ADMIN"]), sessionController.getActiveSessions);
router.post("/logout-all", roleMiddleware(["SUPER_ADMIN"]), sessionController.logoutAllSessions);

module.exports = router;
