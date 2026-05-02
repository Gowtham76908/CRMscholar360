const express = require("express");
const router = express.Router();
const reminderController = require("../controllers/reminderController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/", reminderController.createReminder);
router.get("/", reminderController.getMyReminders);

module.exports = router;
