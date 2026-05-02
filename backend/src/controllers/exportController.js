const prisma = require("../utils/prisma");

const exportTasks = async (req, res) => {
    try {
        const tasks = await prisma.task.findMany({
            include: {
                lead: { select: { name: true } },
                assignedTo: { select: { name: true } }
            }
        });

        const fields = ["Title", "Status", "Priorirty", "Due Date", "Lead", "Assigned To"];
        const csv = [
            fields.join(","),
            ...tasks.map(task => [
                task.title,
                task.status,
                "Medium", // Priority placeholder
                new Date(task.dueDate).toLocaleDateString(),
                task.lead?.name || "N/A",
                task.assignedTo?.name || "Unassigned"
            ].map(field => `"${field}"`).join(","))
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment("tasks.csv");
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: "Error exporting tasks", error: error.message });
    }
};

const exportTeamPerformance = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: "EMPLOYEE" },
            include: {
                leads: { select: { status: true } },
                tasks: { select: { status: true } }
            }
        });

        const fields = ["Employee", "Total Leads", "Converted", "Conversion Rate", "Pending Tasks"];
        const csv = [
            fields.join(","),
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
                ].map(field => `"${field}"`).join(",");
            })
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment("team_performance.csv");
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: "Error exporting team performance", error: error.message });
    }
};

module.exports = { exportTasks, exportTeamPerformance };
