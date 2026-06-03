const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Routes require authentication
router.use(authMiddleware);

// Managers may manage their own team (scoped inside teamController); hard-delete
// and Manager-role assignment stay SUPER_ADMIN-only (enforced in the controller).
router.use(roleMiddleware(["SUPER_ADMIN", "MANAGER"]));

// Get all users
router.get("/", teamController.getTeam);

// Create new user
router.post("/", teamController.createUser);

// Toggle user access
router.patch("/:id/toggle", teamController.toggleUserAccess);

// Update user details
router.patch("/:id", teamController.updateUser);

// Soft delete (deactivate) user
router.delete("/:id", teamController.deleteUser);

module.exports = router;
