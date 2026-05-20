const { z } = require("zod");

const getLeadsSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST", "ALL"]).optional(),
    assignedTo: z.string().uuid().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "score", "name", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    isSearchLead: z.any().optional().transform(v => v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
    score_min: z.coerce.number().int().min(0).max(100).optional(),
    mine: z.any().optional().transform(v => v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
})
.refine((data) => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: "startDate must be less than or equal to endDate",
    path: ["endDate"],
})
.transform((data) => {
    // If status is ALL, treat it as no status filter
    if (data.status === "ALL") {
        data.status = undefined;
    }
    return data;
});

module.exports = {
    getLeadsSchema
};
