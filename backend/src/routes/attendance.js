const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const holidayController = require("../controllers/holidayController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Holidays — Super Admin (company-wide or any dept) and Managers (their depts)
router.get("/holidays", holidayController.listHolidays);
router.post("/holidays", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), holidayController.createHoliday);
router.delete("/holidays/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), holidayController.deleteHoliday);

// Employee routes
router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", attendanceController.checkOut);
router.get("/my", attendanceController.getMyAttendance);
router.get("/stats", attendanceController.getAttendanceStats);

// Admin routes
router.get("/all", roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), attendanceController.getAllAttendance);
router.get("/admin/monthly-report", roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), attendanceController.getAdminMonthlyReport);
router.get("/admin/employee/:employeeId", roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), attendanceController.getEmployeeMonthlyAttendance);
router.post("/admin/update-status", roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), attendanceController.updateAttendanceStatus);
router.post("/admin/mark-absent", roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), attendanceController.manualMarkAbsent);

module.exports = router;
