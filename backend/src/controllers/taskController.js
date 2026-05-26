const prisma = require("../utils/prisma");
const { createNotification } = require("../services/notificationService");
const { getTasks: getTasksPaginated } = require("../services/taskService");
const { getTasksSchema } = require("../validations/task.validation");

const taskInclude = {
    lead: { select: { id: true, name: true, phone: true, email: true } },
    assignedTo: { select: { id: true, name: true, email: true } },
    sprint: { select: { id: true, name: true, status: true } },
    files: true,
    comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" }
    }
};

// ─── Create Task ──────────────────────────────────────────────────────────────

const createTask = async (req, res) => {
    try {
        let {
            title, description, leadId, assignedTo, dueDate, files,
            priority = "MEDIUM", type = "TASK", storyPoints,
            estimatedHours, labels = [], sprintId, kanbanStatus
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: "Task title is required" });
        }
        if (!dueDate || isNaN(new Date(dueDate).getTime())) {
            return res.status(400).json({ message: "A valid due date is required" });
        }

        if (!leadId || leadId === "") leadId = null;
        if (!sprintId || sprintId === "") sprintId = null;

        if (leadId) {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) return res.status(404).json({ message: "Lead not found" });
        }
        if (assignedTo) {
            const user = await prisma.user.findUnique({ where: { id: assignedTo } });
            if (!user) return res.status(404).json({ message: "Assigned user not found" });
        }

        // If sprintId provided, determine kanbanStatus based on sprint state
        let resolvedKanbanStatus = kanbanStatus || "BACKLOG";
        if (sprintId) {
            const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
            resolvedKanbanStatus = sprint?.status === "ACTIVE" ? "TODO" : "BACKLOG";
        } else if (!kanbanStatus) {
            resolvedKanbanStatus = "BACKLOG";
        }

        const newTask = await prisma.task.create({
            data: {
                title,
                description: description || null,
                leadId,
                assignedToId: assignedTo || null,
                dueDate: new Date(dueDate),
                status: "PENDING",
                kanbanStatus: resolvedKanbanStatus,
                priority,
                type,
                storyPoints: storyPoints ? parseInt(storyPoints) : null,
                estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
                labels: Array.isArray(labels) ? labels : [],
                sprintId,
                files: {
                    create: (files || []).map(f => ({
                        fileName: f.fileName, fileUrl: f.fileUrl,
                        fileSize: f.fileSize, mimeType: f.mimeType
                    }))
                }
            },
            include: taskInclude
        });

        res.status(201).json({ message: "Task created successfully", task: newTask });

        // Notify the assignee if one was set
        if (assignedTo) {
            const due = new Date(dueDate).toLocaleString("en-IN", {
                dateStyle: "medium", timeZone: "Asia/Kolkata"
            });
            createNotification({
                userId:  assignedTo,
                title:   "📋 New Task Assigned",
                message: `You have been assigned a new task: "${title}". Due date: ${due}.`,
                type:    "TASK_ASSIGNED",
                link:    `/tasks/${newTask.id}`
            }).catch(err => console.error("[Notification] TASK_ASSIGNED failed:", err));
        }
    } catch (error) {
        console.error("CREATE_TASK_ERROR:", error);
        res.status(500).json({ message: "Error creating task", error: error.message });
    }
};

// ─── Get Tasks (paginated) ────────────────────────────────────────────────────

const getTasks = async (req, res) => {
    try {
        const { userId, role } = req.user;

        const validation = getTasksSchema.safeParse(req.query);
        if (!validation.success) {
            return res.status(400).json({ message: "Invalid query parameters", errors: validation.error.errors });
        }

        const { page, limit, filter, leadId } = validation.data;

        if (leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                select: { assignedToId: true }
            });
            if (!lead) return res.status(404).json({ message: "Lead not found" });
            if (role === "EMPLOYEE" && lead.assignedToId !== userId) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        const result = await getTasksPaginated({ userId, role, page, limit, filter, leadId });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching tasks", error: error.message });
    }
};

// ─── Get Task By ID ───────────────────────────────────────────────────────────

const getTaskById = async (req, res) => {
    try {
        const task = await prisma.task.findUnique({
            where: { id: req.params.id },
            include: taskInclude
        });
        if (!task) return res.status(404).json({ message: "Task not found" });
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Error fetching task", error: error.message });
    }
};

// ─── Update Task (full) ───────────────────────────────────────────────────────

const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, assignedTo, dueDate, priority, type,
            storyPoints, estimatedHours, actualHours, labels, sprintId, leadId
        } = req.body;

        const task = await prisma.task.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(assignedTo !== undefined && { assignedToId: assignedTo || null }),
                ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
                ...(priority !== undefined && { priority }),
                ...(type !== undefined && { type }),
                ...(storyPoints !== undefined && { storyPoints: storyPoints ? parseInt(storyPoints) : null }),
                ...(estimatedHours !== undefined && { estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null }),
                ...(actualHours !== undefined && { actualHours: actualHours ? parseFloat(actualHours) : null }),
                ...(labels !== undefined && { labels }),
                ...(sprintId !== undefined && { sprintId: sprintId || null }),
                ...(leadId !== undefined && { leadId: leadId || null })
            },
            include: taskInclude
        });
        res.json({ message: "Task updated", task });
    } catch (error) {
        res.status(500).json({ message: "Error updating task", error: error.message });
    }
};

// ─── Update Status (legacy + kanban) ─────────────────────────────────────────

const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["PENDING", "COMPLETED"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        // Only force kanban to DONE when completing — don't reset position when un-completing
        const updateData = {
            status,
            ...(status === "COMPLETED" && { kanbanStatus: "DONE" }),
            completedAt: status === "COMPLETED" ? new Date() : null
        };

        const updatedTask = await prisma.task.update({
            where: { id },
            data: updateData,
            include: { assignedTo: { select: { id: true } } }
        });

        res.json({ message: "Task status updated", task: updatedTask });

        // Notify the assignee's direct manager when a task is completed
        if (status === "COMPLETED" && updatedTask.assignedTo?.id) {
            const assigneeId = updatedTask.assignedTo.id;
            const assignee = await prisma.user.findUnique({
                where: { id: assigneeId },
                select: { managerId: true },
            });
            if (assignee?.managerId && assignee.managerId !== assigneeId) {
                createNotification({
                    userId:  assignee.managerId,
                    title:   "✅ Task Completed",
                    message: `The task "${updatedTask.title}" has been marked as completed.`,
                    type:    "TASK_COMPLETED",
                    link:    `/tasks/${id}`
                }).catch(err => console.error("[Notification] TASK_COMPLETED failed:", err));
            }
        }
    } catch (error) {
        res.status(500).json({ message: "Error updating task", error: error.message });
    }
};

// ─── Update Kanban Status (drag & drop) ──────────────────────────────────────

const updateKanbanStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { kanbanStatus, orderIndex } = req.body;

        const validStatuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
        if (!validStatuses.includes(kanbanStatus)) {
            return res.status(400).json({ message: "Invalid kanban status" });
        }

        const task = await prisma.task.update({
            where: { id },
            data: {
                kanbanStatus,
                ...(orderIndex !== undefined && { orderIndex }),
                // Sync legacy status field
                status: kanbanStatus === "DONE" ? "COMPLETED" : "PENDING",
                completedAt: kanbanStatus === "DONE" ? new Date() : null
            },
            include: taskInclude
        });
        res.json({ message: "Kanban status updated", task });
    } catch (error) {
        res.status(500).json({ message: "Error updating kanban status", error: error.message });
    }
};

// ─── Delete Task ──────────────────────────────────────────────────────────────

const deleteTask = async (req, res) => {
    try {
        await prisma.task.delete({ where: { id: req.params.id } });
        res.json({ message: "Task deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting task", error: error.message });
    }
};

// ─── Comments ─────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        const { content } = req.body;

        if (!content?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

        const comment = await prisma.taskComment.create({
            data: { taskId: id, userId, content: content.trim() },
            include: { user: { select: { id: true, name: true } } }
        });
        res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
        res.status(500).json({ message: "Error adding comment", error: error.message });
    }
};

const getComments = async (req, res) => {
    try {
        const comments = await prisma.taskComment.findMany({
            where: { taskId: req.params.id },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" }
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching comments", error: error.message });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, role } = req.user;

        const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ message: "Comment not found" });
        if (comment.userId !== userId && role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Not authorized to delete this comment" });
        }

        await prisma.taskComment.delete({ where: { id: commentId } });
        res.json({ message: "Comment deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting comment", error: error.message });
    }
};

module.exports = {
    createTask, getTasks, getTaskById,
    updateTask, updateTaskStatus, updateKanbanStatus,
    deleteTask, addComment, getComments, deleteComment
};
