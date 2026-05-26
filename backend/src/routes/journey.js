const router = require("express").Router({ mergeParams: true });
const auth = require("../middleware/authMiddleware");
const { getJourney } = require("../controllers/journeyController");

router.use(auth);
router.get("/", getJourney);

module.exports = router;
