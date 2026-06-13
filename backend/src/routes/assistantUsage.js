const router         = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getUsage }   = require("../controllers/assistantUsageController");

router.use(authMiddleware);
router.get("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), getUsage);

module.exports = router;
