const { z } = require("zod");

const getTasksSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    filter: z.enum(["ALL", "PENDING", "COMPLETED", "OVERDUE"]).default("ALL"),
    leadId: z.string().uuid().optional(),
});

module.exports = { getTasksSchema };
