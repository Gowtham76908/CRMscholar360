const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const leaderboardController = require("../controllers/leaderboardController");

router.use(authMiddleware);

// Leaderboard - ALL employees and admins
router.get("/leaderboard", leaderboardController.getLeaderboard);

// Team Performance (Admin Only)
router.get("/team-performance", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), analyticsController.getTeamPerformance);

// Response Time Stats
router.get("/response-time", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), analyticsController.getResponseTimeAnalytics);

module.exports = router;
