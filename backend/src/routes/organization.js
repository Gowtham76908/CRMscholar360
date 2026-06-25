const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { requireHierarchyAccess } = require("../middleware/hierarchyMiddleware");
const {
    getOrgTeam,
    getEmployeeProfile,
    getStats,
    setManager,
    getManagers,
} = require("../controllers/organizationController");

router.use(authMiddleware);

router.get("/stats",           roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), getStats);
router.get("/managers",        roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), getManagers);
router.get("/team",            roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), getOrgTeam);
router.get("/team/:id",        roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), requireHierarchyAccess(), getEmployeeProfile);
router.patch("/team/:id/manager", roleMiddleware(["SUPER_ADMIN"]), setManager);

module.exports = router;
