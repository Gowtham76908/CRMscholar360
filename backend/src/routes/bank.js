const express = require("express");
const router = express.Router();
const bankController = require("../controllers/bankController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect all routes with authMiddleware
router.use(authMiddleware);

router.get("/", bankController.listBanks);
router.post("/", bankController.createBank);

module.exports = router;
