const express = require("express");
const router = express.Router();
const accommodationAgentController = require("../controllers/accommodationAgentController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect all routes with authMiddleware
router.use(authMiddleware);

router.get("/", accommodationAgentController.listAgents);
router.post("/", accommodationAgentController.createAgent);

module.exports = router;
