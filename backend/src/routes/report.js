const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware(["SUPER_ADMIN", "ADMIN"]));

router.get("/leads-by-source", reportController.getLeadsBySource);
router.get("/monthly-growth", reportController.getMonthlyGrowth);
// /leads-by-employee, /conversion-rate, /leads-by-status retired — global status
// funnels are replaced by per-department analytics (/lead-departments/dashboard)
// and team performance (/team-performance).

module.exports = router;
