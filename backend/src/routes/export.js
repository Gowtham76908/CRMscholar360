const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");
const leadController = require("../controllers/leadController"); // Reuse existing lead export
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Leads & tasks: scoped per-requester inside the controller (EMPLOYEE→own, ADMIN→team).
router.get("/leads", leadController.exportLeads);
router.get("/tasks", exportController.exportTasks);
// Team performance is an org/team report — managers and super admins only.
router.get("/team-performance", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), exportController.exportTeamPerformance);

module.exports = router;
