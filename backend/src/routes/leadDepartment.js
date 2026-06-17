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

// Historical analytics (LeadDepartmentStageEvent ledger) — "what happened over time".
router.get("/reports/timeseries", ctrl.getHistoryTimeSeries);
router.get("/reports/throughput", ctrl.getHistoryThroughput);
router.get("/reports/employee-activity", ctrl.getHistoryEmployeeActivity);

router.get("/memberships/me", ctrl.getMyDepartments);

// Membership management — listing is open (needed for assignment dropdowns),
// mutations are Director-only.
router.get("/members", ctrl.getMembers);
router.post("/members", roleMiddleware(["SUPER_ADMIN"]), ctrl.addMember);
router.delete("/members", roleMiddleware(["SUPER_ADMIN"]), ctrl.removeMember);

// Manager-approved reassignment requests (static routes before :id params).
router.get("/reassign-requests", ctrl.getReassignmentRequests);
router.patch("/reassign-requests/:requestId", ctrl.decideReassignment);

// Per-assignment lifecycle (fine-grained authorization is enforced in the service).
router.patch("/bulk-assign", ctrl.assignConsultantBulk);
router.get("/:leadDepartmentId/timeline", ctrl.getServiceTimeline);
router.patch("/:leadDepartmentId/assign", ctrl.assignConsultant);
router.patch("/:leadDepartmentId/claim", ctrl.claimService);
router.post("/:leadDepartmentId/reassign-request", ctrl.requestReassignment);
router.patch("/:leadDepartmentId/stage", ctrl.updateStage);
router.delete("/:leadDepartmentId", ctrl.remove);

module.exports = router;
