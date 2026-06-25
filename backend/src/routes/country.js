const express = require("express");
const router = express.Router();
const countryController = require("../controllers/countryController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect all routes with authMiddleware
router.use(authMiddleware);

router.get("/", countryController.listCountries);
router.post("/", countryController.createCountry);
router.post("/:countryId/universities", countryController.createUniversity);

module.exports = router;
