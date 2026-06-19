const prisma = require("../utils/prisma");
const { createNotification } = require("../services/notificationService");
const { getTasks: getTasksPaginated, getTasksForCalendar } = require("../services/taskService");
const { getTasksSchema, getCalendarSchema } = require("../validations/task.validation");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const logActivity = require("../utils/activityLogger");
const { canAccessLead } = require("../services/permissionService");

const taskInclude = {
    lead: { select: { id: true, name: true, phone: true, email: true } },
    assignedTo: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    sprint: { select: { id: true, name: true, status: true } },
    files: true,
    comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" }
    }
};

// ─── Create Task ──────────────────────────────────────────────────────────────

const createTask = async (req, res, next) => {
    try {
        let {
            title, description, leadId, assignedTo, dueDate, files,
            priority = "MEDIUM", type = "TASK", storyPoints,
            estimatedHours, labels = [], sprintId, kanbanStatus
        } = req.body;

        if (!title || !title.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Task title is required");
        }
        if (!dueDate || isNaN(new Date(dueDate).getTime())) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "A valid due date is required");
        }

        if (!leadId || leadId === "") leadId = null;
        if (!sprintId || sprintId === "") sprintId = null;

        if (leadId) {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
        }
        if (assignedTo) {
            const user = await prisma.user.findUnique({ where: { id: assignedTo } });
            if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Assigned user not found");
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
                createdById: req.user.userId,
                dueDate: new Date(dueDate),
                status: "PENDING",
                kanbanStatus: resolvedKanbanStatus,
                priority,
                type,
                storyPoints: storyPoints ? parseInt(storyPoints, 10) : null,
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

        logActivity({
            leadId:   newTask.leadId ?? null,
            userId:   req.user.userId,
            action:   "TASK_CREATED",
            metadata: { taskId: newTask.id, title, priority, type, assignedTo: assignedTo ?? null, dueDate }
        }).catch(console.error);

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

        return next(error);
    }
};

// ─── Get Tasks (paginated) ────────────────────────────────────────────────────

const getTasks = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        const validation = getTasksSchema.safeParse(req.query);
        if (!validation.success) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid query parameters");
        }

        const { page, limit, filter, leadId } = validation.data;

        if (leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                select: { id: true }
            });
            if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
            if (!(await canAccessLead(userId, role, lead))) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
            }
        }

        const result = await getTasksPaginated({ userId, role, page, limit, filter, leadId });
        res.json(result);
    } catch (error) {
        return next(error);
    }
};

// ─── Get Tasks for Calendar (date range, no pagination) ───────────────────────

const getCalendarTasks = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        const validation = getCalendarSchema.safeParse(req.query);
        if (!validation.success) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "from and to dates are required");
        }

        const { from, to } = validation.data;
        const tasks = await getTasksForCalendar({ userId, role, from, to });
        res.json(tasks);
    } catch (error) {
        return next(error);
    }
};

// ─── Get Task By ID ───────────────────────────────────────────────────────────

const getTaskById = async (req, res, next) => {
    try {
        const task = await prisma.task.findUnique({
            where: { id: req.params.id },
            include: taskInclude
        });
        if (!task) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Task not found");
        res.json(task);
    } catch (error) {
        return next(error);
    }
};

// ─── Update Task (full) ───────────────────────────────────────────────────────

const updateTask = async (req, res, next) => {
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
                ...(storyPoints !== undefined && { storyPoints: storyPoints ? parseInt(storyPoints, 10) : null }),
                ...(estimatedHours !== undefined && { estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null }),
                ...(actualHours !== undefined && { actualHours: actualHours ? parseFloat(actualHours) : null }),
                ...(labels !== undefined && { labels }),
                ...(sprintId !== undefined && { sprintId: sprintId || null }),
                ...(leadId !== undefined && { leadId: leadId || null })
            },
            include: taskInclude
        });
        res.json({ message: "Task updated", task });

        const changes = Object.fromEntries(
            Object.entries({ title, description, assignedTo, dueDate, priority, type, storyPoints, estimatedHours, actualHours, labels, sprintId, leadId })
                .filter(([, v]) => v !== undefined)
        );
        logActivity({
            leadId:   task.leadId ?? null,
            userId:   req.user.userId,
            action:   "TASK_UPDATED",
            metadata: { taskId: id, taskTitle: task.title, changes }
        }).catch(console.error);
    } catch (error) {
        return next(error);
    }
};

// ─── Update Status (legacy + kanban) ─────────────────────────────────────────

const updateTaskStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["PENDING", "COMPLETED"].includes(status)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid status");
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

        if (status === "COMPLETED") {
            logActivity({
                leadId:   updatedTask.leadId ?? null,
                userId:   req.user.userId,
                action:   "TASK_COMPLETED",
                metadata: { taskId: id, title: updatedTask.title }
            }).catch(console.error);
        }

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
        return next(error);
    }
};

// ─── Update Kanban Status (drag & drop) ──────────────────────────────────────

const updateKanbanStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { kanbanStatus, orderIndex } = req.body;

        const validStatuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
        if (!validStatuses.includes(kanbanStatus)) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid kanban status");
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

        if (kanbanStatus === "DONE") {
            logActivity({
                leadId:   task.leadId ?? null,
                userId:   req.user.userId,
                action:   "TASK_COMPLETED",
                metadata: { taskId: id, title: task.title }
            }).catch(console.error);
        }
    } catch (error) {
        return next(error);
    }
};

// ─── Delete Task ──────────────────────────────────────────────────────────────

const deleteTask = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const task = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!task) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Task not found");

        // Employees can only delete tasks assigned to them
        if (role === "EMPLOYEE" && task.assignedToId !== userId) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You can only delete tasks assigned to you");
        }

        await prisma.task.delete({ where: { id: req.params.id } });
        res.json({ message: "Task deleted" });

        logActivity({
            leadId:   task.leadId ?? null,
            userId,
            action:   "TASK_DELETED",
            metadata: { taskId: task.id, title: task.title, priority: task.priority, deletedBy: role }
        }).catch(console.error);
    } catch (error) {
        return next(error);
    }
};

// ─── Comments ─────────────────────────────────────────────────────────────────

const addComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        const { content } = req.body;

        if (!content?.trim()) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Comment cannot be empty");

        const comment = await prisma.taskComment.create({
            data: { taskId: id, userId, content: content.trim() },
            include: { user: { select: { id: true, name: true } } }
        });
        res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
        return next(error);
    }
};

const getComments = async (req, res, next) => {
    try {
        const comments = await prisma.taskComment.findMany({
            where: { taskId: req.params.id },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" }
        });
        res.json(comments);
    } catch (error) {
        return next(error);
    }
};

const deleteComment = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const { userId, role } = req.user;

        const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
        if (!comment) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Comment not found");
        if (comment.userId !== userId && role !== "SUPER_ADMIN") {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Not authorized to delete this comment");
        }

        await prisma.taskComment.delete({ where: { id: commentId } });
        res.json({ message: "Comment deleted" });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    createTask, getTasks, getCalendarTasks, getTaskById,
    updateTask, updateTaskStatus, updateKanbanStatus,
    deleteTask, addComment, getComments, deleteComment
};
