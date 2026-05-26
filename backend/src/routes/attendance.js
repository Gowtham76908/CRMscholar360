const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Employee routes
router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", attendanceController.checkOut);
router.get("/my", attendanceController.getMyAttendance);
router.get("/stats", attendanceController.getAttendanceStats);

// Admin routes
router.get("/all", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), attendanceController.getAllAttendance);
router.get("/admin/monthly-report", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), attendanceController.getAdminMonthlyReport);
router.get("/admin/employee/:employeeId", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), attendanceController.getEmployeeMonthlyAttendance);
router.post("/admin/update-status", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), attendanceController.updateAttendanceStatus);

module.exports = router;
