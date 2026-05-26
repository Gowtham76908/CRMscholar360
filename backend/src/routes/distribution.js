const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const role    = require("../middleware/roleMiddleware");
const ctrl    = require("../controllers/distributionController");

router.use(auth);

const MANAGERS = ["SUPER_ADMIN", "MANAGER"];

// Unassigned pool
router.get("/unassigned",             role(MANAGERS),    ctrl.getUnassignedLeads);
router.get("/available-employees",    role(MANAGERS),    ctrl.getAvailableEmployees);
router.get("/stats",                  role(MANAGERS),    ctrl.getDistributionStats);

// Assignment actions
router.post("/assign",                role(MANAGERS),    ctrl.manualAssign);
router.post("/bulk-assign",           role(MANAGERS),    ctrl.bulkAutoAssign);
router.post("/claim/:leadId",         role(MANAGERS),    ctrl.claimLead);

// Employee profile
router.get("/profile/:employeeId",    auth,              ctrl.getProfile);
router.patch("/profile/:employeeId",  auth,              ctrl.updateProfile);

// Admin-only ops
router.post("/recalculate",           role(["SUPER_ADMIN"]), ctrl.triggerRecalculation);

module.exports = router;
