const express = require("express");
const router = express.Router();
const noteController = require("../controllers/noteController");
const authMiddleware = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Create Note
router.post("/leads/:leadId/notes", noteController.createNote);

// Get Notes
router.get("/leads/:leadId/notes", noteController.getNotes);

module.exports = router;
