const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/leadDepartmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Per-assignment actions on a lead's department service (by LeadDepartment id).
// Lead-scoped allocation/listing lives on the leads router (GET/POST /leads/:id/departments).
router.use(authMiddleware);

// Static/collection routes first so they aren't shadowed by the :id param routes.
router.get("/workflows", ctrl.getWorkflows);
router.get("/queue", ctrl.getQueue);
router.get("/board", ctrl.getBoardQueue);
router.get("/dashboard", ctrl.getDashboard);
router.get("/workload", ctrl.getWorkload);
router.get("/memberships/me", ctrl.getMyDepartments);

// Membership management — listing is open (needed for assignment dropdowns),
// mutations are Director-only.
router.get("/members", ctrl.getMembers);
router.post("/members", roleMiddleware(["SUPER_ADMIN"]), ctrl.addMember);
router.delete("/members", roleMiddleware(["SUPER_ADMIN"]), ctrl.removeMember);

// Per-assignment lifecycle (fine-grained authorization is enforced in the service).
router.patch("/:leadDepartmentId/assign", ctrl.assignConsultant);
router.patch("/:leadDepartmentId/stage", ctrl.updateStage);
router.delete("/:leadDepartmentId", ctrl.remove);

module.exports = router;
