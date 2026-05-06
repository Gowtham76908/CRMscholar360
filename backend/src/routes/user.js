const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { registerUserSchema, updateProfileSchema, changePasswordSchema, updatePreferencesSchema } = require("../middleware/schemas");

// All routes require authentication
router.use(authMiddleware);

// Only admins can create new users
router.post("/register", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(registerUserSchema), userController.registerUser);
router.get("/", userController.getAllUsers);
router.patch("/profile", validate(updateProfileSchema), userController.updateProfile);
router.patch("/password", validate(changePasswordSchema), userController.changePassword);
router.patch("/preferences", validate(updatePreferencesSchema), userController.updatePreferences);

module.exports = router;
