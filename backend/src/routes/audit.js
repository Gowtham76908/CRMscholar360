const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Only Admins can view audit logs
router.get("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), auditController.getAuditLogs);

module.exports = router;
