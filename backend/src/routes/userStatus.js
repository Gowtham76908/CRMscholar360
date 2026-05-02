const express = require("express");
const router = express.Router();
const { updateMyStatus, getAllUsersStatus, getMyTodayLogs, getLastSeen } = require("../controllers/userStatusController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.patch("/me", updateMyStatus);
router.get("/all", getAllUsersStatus);
router.get("/me/logs-today", getMyTodayLogs);
router.get("/:userId/last-seen", getLastSeen);

module.exports = router;
