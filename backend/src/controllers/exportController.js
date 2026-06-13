const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("../services/organizationService");
const { csvField } = require("../utils/csv");

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
            include: {
                leads: { select: { status: true } },
                tasks: { select: { status: true } }
            }
        });

        const fields = ["Employee", "Total Leads", "Converted", "Conversion Rate", "Pending Tasks"];
        const csv = [
            fields.map(csvField).join(","),
            ...users.map(user => {
                const totalLeads = user.leads.length;
                const converted = user.leads.filter(l => l.status === "CONVERTED").length;
                const rate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) + "%" : "0%";

                return [
                    user.name,
                    totalLeads,
                    converted,
                    rate,
                    user.tasks.filter(t => t.status === "PENDING").length
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
