const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { searchLinkedInLeads, importLinkedInLeads } = require("../controllers/linkedinLeadsController");

router.use(authMiddleware);

// Search LinkedIn profiles / company pages via Serper
router.post("/", searchLinkedInLeads);

// Import selected LinkedIn leads (managers + super admin)
router.post("/import", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), importLinkedInLeads);

module.exports = router;
