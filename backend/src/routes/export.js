const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");
const leadController = require("../controllers/leadController"); // Reuse existing lead export
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/leads", leadController.exportLeads);
router.get("/tasks", exportController.exportTasks);
router.get("/team-performance", exportController.exportTeamPerformance);

module.exports = router;
