const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Only admins can create new users
router.post("/register", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), userController.registerUser);
router.get("/", userController.getAllUsers); // Get all users
router.patch("/profile", userController.updateProfile);
router.patch("/password", userController.changePassword);
router.patch("/preferences", userController.updatePreferences);

module.exports = router;
