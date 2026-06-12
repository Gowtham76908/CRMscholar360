const express = require("express");
const router = express.Router();
const chat = require("../controllers/chatController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// LiveKit video token
router.get("/token", chat.createToken);

// Channel management
router.get("/channels",         chat.getChannels);
router.post("/group",           chat.createGroupChannel);
router.post("/dm",              chat.startDirectChat);
router.get("/channels/:id/messages", chat.getChannelMessages);

// Member management
router.post("/channels/:id/members",        chat.addMember);
router.delete("/channels/:id/members/:uid", chat.removeMember);

// User search
router.get("/users", chat.getUsersForChat);

// Admin: seed demo data
router.post("/seed", roleMiddleware(["SUPER_ADMIN"]), chat.seedDemoData);

module.exports = router;
