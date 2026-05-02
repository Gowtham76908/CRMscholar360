const express = require("express");
const router = express.Router();
const tc = require("../controllers/taskController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

const adminOnly = roleMiddleware(["SUPER_ADMIN", "ADMIN"]);

// ── Task CRUD ─────────────────────────────────────────────────────────────────
router.get("/tasks", tc.getTasks);
router.get("/tasks/:id", tc.getTaskById);
router.post("/tasks", adminOnly, tc.createTask);
router.put("/tasks/:id", adminOnly, tc.updateTask);
router.delete("/tasks/:id", adminOnly, tc.deleteTask);

// ── Status updates ────────────────────────────────────────────────────────────
router.patch("/tasks/:id/status", tc.updateTaskStatus);
router.patch("/tasks/:id/kanban", tc.updateKanbanStatus);   // drag-and-drop

// ── Comments (all authenticated users) ────────────────────────────────────────
router.get("/tasks/:id/comments", tc.getComments);
router.post("/tasks/:id/comments", tc.addComment);
router.delete("/tasks/:id/comments/:commentId", tc.deleteComment);

module.exports = router;
