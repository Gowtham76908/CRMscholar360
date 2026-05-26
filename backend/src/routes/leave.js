const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { applyLeaveSchema, approveRejectLeaveSchema } = require("../middleware/schemas");

router.use(authMiddleware);

// Employee routes
router.post("/apply", validate(applyLeaveSchema), leaveController.applyLeave);
router.get("/my", leaveController.getMyLeaves);
router.get("/stats", leaveController.getLeaveStats);

// Admin routes
router.get("/pending", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), leaveController.getPendingLeaves);
router.get("/all", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), leaveController.getAllLeaves);
router.post("/approve/:id", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(approveRejectLeaveSchema), leaveController.approveLeave);
router.post("/reject/:id", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(approveRejectLeaveSchema), leaveController.rejectLeave);

module.exports = router;
