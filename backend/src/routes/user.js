const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

// Register (Public or Admin protected? Ideally protected but keeping open for initial setup if needed, or check app logic)
// Based on typical flows, register might be public, but here userController.registerUser exists.
// Let's keep existing logic if any, but adding new protected routes.

router.post("/register", userController.registerUser);

// Protected Routes
router.use(authMiddleware);
router.get("/", userController.getAllUsers); // Get all users
router.patch("/profile", userController.updateProfile);
router.patch("/password", userController.changePassword);
router.patch("/preferences", userController.updatePreferences);

module.exports = router;
