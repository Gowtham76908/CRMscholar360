const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getDigest } = require("../controllers/aiController");

router.use(authMiddleware);

// POST /api/ai/digest — rate-limited, cached per user
router.post("/digest", getDigest);

module.exports = router;
