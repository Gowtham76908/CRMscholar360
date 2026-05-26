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

router.get("/stats",           roleMiddleware(["SUPER_ADMIN", "MANAGER"]), getStats);
router.get("/managers",        roleMiddleware(["SUPER_ADMIN", "MANAGER"]), getManagers);
router.get("/team",            roleMiddleware(["SUPER_ADMIN", "MANAGER"]), getOrgTeam);
router.get("/team/:id",        roleMiddleware(["SUPER_ADMIN", "MANAGER"]), requireHierarchyAccess(), getEmployeeProfile);
router.patch("/team/:id/manager", roleMiddleware(["SUPER_ADMIN"]), setManager);

module.exports = router;
