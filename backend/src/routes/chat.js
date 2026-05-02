const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Get Token (Auth)
router.post("/token", chatController.createToken);

// Create Group (Admin Only)
router.post("/group", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), chatController.createGroupChannel);

// Start Direct Chat (Syncs users)
router.post("/start", chatController.startDirectChat);

// Get Users for Chat Search
router.get("/users", chatController.getUsersForChat);

// Sync User to Stream (before adding to channel)
router.post("/sync-user", chatController.syncUserToStream);

// Sync ALL users to Stream (run once after deployment)
router.post("/sync-all-users", roleMiddleware(["SUPER_ADMIN"]), chatController.syncAllUsers);

module.exports = router;
