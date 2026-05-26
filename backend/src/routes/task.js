const express = require("express");
const router = express.Router();
const tc = require("../controllers/taskController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, updateKanbanStatusSchema, addCommentSchema } = require("../middleware/schemas");

router.use(authMiddleware);

const adminOnly = roleMiddleware(["SUPER_ADMIN", "MANAGER"]);

// ── Task CRUD ─────────────────────────────────────────────────────────────────
router.get("/tasks", tc.getTasks);
router.get("/tasks/:id", tc.getTaskById);
router.post("/tasks", adminOnly, validate(createTaskSchema), tc.createTask);
router.put("/tasks/:id", adminOnly, validate(updateTaskSchema), tc.updateTask);
router.delete("/tasks/:id", adminOnly, tc.deleteTask);

// ── Status updates ────────────────────────────────────────────────────────────
router.patch("/tasks/:id/status", validate(updateTaskStatusSchema), tc.updateTaskStatus);
router.patch("/tasks/:id/kanban", validate(updateKanbanStatusSchema), tc.updateKanbanStatus);

// ── Comments (all authenticated users) ────────────────────────────────────────
router.get("/tasks/:id/comments", tc.getComments);
router.post("/tasks/:id/comments", validate(addCommentSchema), tc.addComment);
router.delete("/tasks/:id/comments/:commentId", tc.deleteComment);

module.exports = router;
