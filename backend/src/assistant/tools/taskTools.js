const { getTasks } = require("../../services/taskService");

const list_my_tasks = {
    name:        "list_my_tasks",
    description: "List tasks visible to the current user. EMPLOYEE sees own tasks; MANAGER sees team tasks; SUPER_ADMIN sees all. Optionally filter by PENDING, COMPLETED, or OVERDUE.",
    parameters: {
        type: "object",
        properties: {
            filter: { type: "string",  description: "Optional task filter.", enum: ["PENDING", "COMPLETED", "OVERDUE"] },
            limit:  { type: "integer", description: "Max tasks to return (1-20).", minimum: 1, maximum: 20 },
        },
        required: [],
    },
    execute: async (args, { userId, role }) => {
        const limit  = Math.min(Math.max(parseInt(args.limit, 10) || 10, 1), 20);
        const result = await getTasks({
            userId, role,
            page: 1, limit,
            filter: args.filter,
        });
        const tasks = result.data.map(t => ({
            id:         t.id,
            title:      t.title,
            status:     t.status,
            priority:   t.priority,
            dueDate:    t.dueDate,
            assignedTo: t.assignedTo?.name ?? null,
            lead:       t.lead ? { id: t.lead.id, name: t.lead.name } : null,
        }));
        return {
            count: tasks.length,
            total: result.pagination?.total ?? tasks.length,
            stats: result.stats,
            tasks,
        };
    },
};

module.exports = { list_my_tasks };
