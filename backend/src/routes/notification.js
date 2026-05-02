const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getMyNotifications, markAsRead, markAllAsRead } = require("../controllers/notificationController");

router.get("/", authMiddleware, getMyNotifications);
router.patch("/read-all", authMiddleware, markAllAsRead);
router.patch("/:id/read", authMiddleware, markAsRead);

module.exports = router;
