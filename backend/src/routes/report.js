const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware(["SUPER_ADMIN", "ADMIN"]));

router.get("/leads-by-source", reportController.getLeadsBySource);
router.get("/leads-by-employee", reportController.getLeadsByEmployee);
router.get("/conversion-rate", reportController.getConversionRate);
router.get("/monthly-growth", reportController.getMonthlyGrowth);

module.exports = router;
