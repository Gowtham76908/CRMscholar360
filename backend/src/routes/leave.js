const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Employee routes
router.post("/apply", leaveController.applyLeave);
router.get("/my", leaveController.getMyLeaves);
router.get("/stats", leaveController.getLeaveStats);

// Admin routes
router.get("/pending", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.getPendingLeaves);
router.get("/all", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.getAllLeaves);
router.post("/approve/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.approveLeave);
router.post("/reject/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.rejectLeave);

module.exports = router;
