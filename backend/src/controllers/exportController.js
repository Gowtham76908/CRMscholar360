const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("../services/organizationService");
const { csvField } = require("../utils/csv");
const { isWonStage } = require("../config/departmentWorkflows");

const exportTasks = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        // Scope by requester so an employee can't export everyone's tasks.
        const where = {};
        if (role === "EMPLOYEE") {
            where.assignedToId = userId;
        } else if (role === "ADMIN") {
            const teamIds = await getTeamMemberIds(userId);
            if (teamIds.length > 0) where.assignedToId = { in: [...teamIds, userId] };
        }
        // SUPER_ADMIN (and unseeded manager) → all tasks

        const tasks = await prisma.task.findMany({
            where,
            include: {
                lead: { select: { name: true } },
                assignedTo: { select: { name: true } }
            }
        });

        const fields = ["Title", "Status", "Priority", "Due Date", "Lead", "Assigned To"];
        const csv = [
            fields.map(csvField).join(","),
            ...tasks.map(task => [
                task.title,
                task.status,
                task.priority,
                task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "",
                task.lead?.name || "N/A",
                task.assignedTo?.name || "Unassigned"
            ].map(csvField).join(","))
        ].join("\r\n");

        res.header("Content-Type", "text/csv; charset=utf-8");
        res.attachment("tasks.csv");
        res.send(csv);
    } catch (error) {
        return next(error);
    }
};

const exportTeamPerformance = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        // A manager only exports their own team; super admin exports all employees.
        const where = { role: "EMPLOYEE" };
        if (role === "ADMIN") {
            const teamIds = await getTeamMemberIds(userId);
            where.id = { in: teamIds };
        }

        const users = await prisma.user.findMany({
            where,
            include: { tasks: { select: { status: true } } },
        });

        // A user's "leads" are their department services; converted = won stage.
        const services = await prisma.leadDepartment.findMany({
            where: { assignedEmployeeId: { in: users.map(u => u.id) } },
            select: { assignedEmployeeId: true, department: true, stage: true },
        });
        const tally = new Map();
        for (const s of services) {
            const t = tally.get(s.assignedEmployeeId) || { total: 0, won: 0 };
            t.total += 1;
            if (isWonStage(s.department, s.stage)) t.won += 1;
            tally.set(s.assignedEmployeeId, t);
        }

        const fields = ["Employee", "Total Leads", "Converted", "Conversion Rate", "Pending Tasks"];
        const csv = [
            fields.map(csvField).join(","),
            ...users.map(user => {
                const t = tally.get(user.id) || { total: 0, won: 0 };
                const rate = t.total > 0 ? ((t.won / t.total) * 100).toFixed(1) + "%" : "0%";

                return [
                    user.name,
                    t.total,
                    t.won,
                    rate,
                    user.tasks.filter(tk => tk.status === "PENDING").length
                ].map(csvField).join(",");
            })
        ].join("\r\n");

        res.header("Content-Type", "text/csv; charset=utf-8");
        res.attachment("team_performance.csv");
        res.send(csv);
    } catch (error) {
        return next(error);
    }
};

module.exports = { exportTasks, exportTeamPerformance };
