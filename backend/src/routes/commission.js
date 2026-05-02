const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/commissionController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", commissionController.getCommissions);

module.exports = router;
