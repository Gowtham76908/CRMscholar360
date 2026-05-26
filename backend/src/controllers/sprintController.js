const prisma = require("../utils/prisma");

const taskInclude = {
    assignedTo: { select: { id: true, name: true, email: true } },
    lead: { select: { id: true, name: true } },
    files: true
};

// ─── Sprints CRUD ─────────────────────────────────────────────────────────────

const getSprints = async (req, res, next) => {
    try {
        const sprints = await prisma.sprint.findMany({
            include: { tasks: { include: taskInclude } },
            orderBy: { createdAt: "desc" }
        });
        res.json(sprints);
    } catch (error) {
        return next(error);
    }
};

const getActiveSprint = async (req, res, next) => {
    try {
        const sprint = await prisma.sprint.findFirst({
            where: { status: "ACTIVE" },
            include: { tasks: { include: taskInclude, orderBy: { orderIndex: "asc" } } }
        });
        res.json(sprint || null);
    } catch (error) {
        return next(error);
    }
};

const getBacklog = async (req, res, next) => {
    try {
        const tasks = await prisma.task.findMany({
            where: { sprintId: null },
            include: taskInclude,
            orderBy: [{ priority: "asc" }, { dueDate: "asc" }]
        });
        res.json(tasks);
    } catch (error) {
        return next(error);
    }
};

const createSprint = async (req, res, next) => {
    try {
        const { name, goal, startDate, endDate } = req.body;
        if (!name || !startDate || !endDate) {
            return res.status(400).json({ message: "name, startDate, and endDate are required" });
        }
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "endDate must be after startDate" });
        }
        const sprint = await prisma.sprint.create({
            data: { name, goal: goal || null, startDate: new Date(startDate), endDate: new Date(endDate) }
        });
        res.status(201).json({ message: "Sprint created", sprint });
    } catch (error) {
        return next(error);
    }
};

const updateSprint = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, goal, startDate, endDate } = req.body;
        const sprint = await prisma.sprint.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(goal !== undefined && { goal }),
                ...(startDate && { startDate: new Date(startDate) }),
                ...(endDate && { endDate: new Date(endDate) })
            }
        });
        res.json({ message: "Sprint updated", sprint });
    } catch (error) {
        return next(error);
    }
};

const deleteSprint = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.task.updateMany({
            where: { sprintId: id },
            data: { sprintId: null, kanbanStatus: "BACKLOG" }
        });
        await prisma.sprint.delete({ where: { id } });
        res.json({ message: "Sprint deleted" });
    } catch (error) {
        return next(error);
    }
};

// ─── Sprint Lifecycle ─────────────────────────────────────────────────────────

const startSprint = async (req, res, next) => {
    try {
        const { id } = req.params;
        const activeCount = await prisma.sprint.count({ where: { status: "ACTIVE" } });
        if (activeCount > 0) {
            return res.status(400).json({ message: "Another sprint is already active. Complete it first." });
        }
        const sprint = await prisma.sprint.findUnique({ where: { id } });
        if (!sprint) return res.status(404).json({ message: "Sprint not found" });
        if (sprint.status !== "PLANNING") {
            return res.status(400).json({ message: "Only PLANNING sprints can be started" });
        }

        // Move all BACKLOG tasks in this sprint to TODO
        await prisma.task.updateMany({
            where: { sprintId: id, kanbanStatus: "BACKLOG" },
            data: { kanbanStatus: "TODO" }
        });

        const updated = await prisma.sprint.update({
            where: { id },
            data: { status: "ACTIVE" },
            include: { tasks: { include: taskInclude } }
        });
        res.json({ message: "Sprint started", sprint: updated });
    } catch (error) {
        return next(error);
    }
};

const completeSprint = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { moveUnfinished = true } = req.body;

        if (moveUnfinished) {
            await prisma.task.updateMany({
                where: { sprintId: id, kanbanStatus: { not: "DONE" } },
                data: { sprintId: null, kanbanStatus: "BACKLOG" }
            });
        }

        const sprint = await prisma.sprint.update({
            where: { id },
            data: { status: "COMPLETED" }
        });
        res.json({ message: "Sprint completed", sprint });
    } catch (error) {
        return next(error);
    }
};

// ─── Sprint Tasks ─────────────────────────────────────────────────────────────

const addTasksToSprint = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { taskIds } = req.body;
        if (!taskIds || !taskIds.length) {
            return res.status(400).json({ message: "taskIds array is required" });
        }
        const sprint = await prisma.sprint.findUnique({ where: { id } });
        if (!sprint) return res.status(404).json({ message: "Sprint not found" });

        await prisma.task.updateMany({
            where: { id: { in: taskIds } },
            data: {
                sprintId: id,
                kanbanStatus: sprint.status === "ACTIVE" ? "TODO" : "BACKLOG"
            }
        });
        res.json({ message: `${taskIds.length} task(s) added to sprint` });
    } catch (error) {
        return next(error);
    }
};

const removeTaskFromSprint = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        await prisma.task.update({
            where: { id: taskId },
            data: { sprintId: null, kanbanStatus: "BACKLOG" }
        });
        res.json({ message: "Task moved to backlog" });
    } catch (error) {
        return next(error);
    }
};

// ─── Analytics ────────────────────────────────────────────────────────────────

const getSprintAnalytics = async (req, res, next) => {
    try {
        const { id } = req.params;
        const sprint = await prisma.sprint.findUnique({
            where: { id },
            include: { tasks: { include: { assignedTo: { select: { id: true, name: true } } } } }
        });
        if (!sprint) return res.status(404).json({ message: "Sprint not found" });

        const tasks = sprint.tasks;
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.kanbanStatus === "DONE").length;
        const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const completedPoints = tasks.filter(t => t.kanbanStatus === "DONE")
            .reduce((s, t) => s + (t.storyPoints || 0), 0);

        // Status distribution
        const byStatus = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"]
            .reduce((acc, s) => ({ ...acc, [s]: tasks.filter(t => t.kanbanStatus === s).length }), {});

        // Priority distribution
        const byPriority = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
            .reduce((acc, p) => ({ ...acc, [p]: tasks.filter(t => t.priority === p).length }), {});

        // Per-member stats
        const memberMap = {};
        tasks.forEach(t => {
            const m = t.assignedTo;
            if (!m) return;
            if (!memberMap[m.id]) memberMap[m.id] = { id: m.id, name: m.name, total: 0, done: 0, inProgress: 0, blocked: 0, points: 0 };
            memberMap[m.id].total++;
            if (t.kanbanStatus === "DONE") memberMap[m.id].done++;
            if (t.kanbanStatus === "IN_PROGRESS") memberMap[m.id].inProgress++;
            if (t.kanbanStatus === "BLOCKED") memberMap[m.id].blocked++;
            memberMap[m.id].points += (t.storyPoints || 0);
        });

        // Burndown (ideal vs actual remaining)
        const start = new Date(sprint.startDate);
        const end = new Date(sprint.endDate);
        const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
        const burndown = Array.from({ length: totalDays + 1 }, (_, day) => {
            const dayDate = new Date(start);
            dayDate.setDate(start.getDate() + day);
            const remaining = tasks.filter(t => {
                if (t.kanbanStatus === "DONE" && t.completedAt) return new Date(t.completedAt) > dayDate;
                return t.kanbanStatus !== "DONE";
            }).length;
            return {
                label: dayDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
                remaining,
                ideal: Math.round(totalTasks * (1 - day / totalDays))
            };
        });

        res.json({
            sprint: { id: sprint.id, name: sprint.name, status: sprint.status, startDate: sprint.startDate, endDate: sprint.endDate, goal: sprint.goal },
            summary: { totalTasks, doneTasks, totalPoints, completedPoints, completion: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0 },
            byStatus,
            byPriority,
            members: Object.values(memberMap),
            burndown
        });
    } catch (error) {
        return next(error);
    }
};

const getTeamVelocity = async (req, res, next) => {
    try {
        const sprints = await prisma.sprint.findMany({
            where: { status: { in: ["ACTIVE", "COMPLETED"] } },
            include: { tasks: { select: { kanbanStatus: true, storyPoints: true } } },
            orderBy: { startDate: "asc" },
            take: 8
        });
        const velocity = sprints.map(s => ({
            name: s.name,
            committed: s.tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0),
            completed: s.tasks.filter(t => t.kanbanStatus === "DONE").reduce((sum, t) => sum + (t.storyPoints || 0), 0)
        }));
        res.json(velocity);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getSprints, getActiveSprint, getBacklog,
    createSprint, updateSprint, deleteSprint,
    startSprint, completeSprint,
    addTasksToSprint, removeTaskFromSprint,
    getSprintAnalytics, getTeamVelocity
};
