const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { searchBusinessLeads, importSearchedLeads } = require("../controllers/searchLeadsController");

router.use(authMiddleware);

// Search businesses via Serper API
router.post("/", searchBusinessLeads);

// Import selected search results as leads (Admin/Super Admin only)
router.post("/import", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), importSearchedLeads);

module.exports = router;
