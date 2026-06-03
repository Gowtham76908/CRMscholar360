const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const c = require("../controllers/sprintController");
const validate = require("../middleware/validate");
const { createSprintSchema, updateSprintSchema, addTasksToSprintSchema } = require("../middleware/schemas");

router.use(authMiddleware);

const adminOnly = roleMiddleware(["SUPER_ADMIN", "MANAGER"]);

// ── Read (all roles) ──────────────────────────────────────────────────────────
router.get("/", c.getSprints);
router.get("/active", c.getActiveSprint);
router.get("/backlog", c.getBacklog);
router.get("/:id/analytics", c.getSprintAnalytics);
router.get("/velocity", c.getTeamVelocity);

// ── Write (admin only) ────────────────────────────────────────────────────────
router.post("/", adminOnly, validate(createSprintSchema), c.createSprint);
router.put("/:id", adminOnly, validate(updateSprintSchema), c.updateSprint);
router.delete("/:id", adminOnly, c.deleteSprint);
router.post("/:id/start", adminOnly, c.startSprint);
router.post("/:id/complete", adminOnly, c.completeSprint);
router.post("/:id/tasks", adminOnly, validate(addTasksToSprintSchema), c.addTasksToSprint);
router.delete("/:id/tasks/:taskId", adminOnly, c.removeTaskFromSprint);

module.exports = router;
