const { z } = require("zod");
const { DEPARTMENTS } = require("../config/departmentWorkflows");

const getLeadsSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    // Board view needs every lead in one bulk fetch (columns are filtered client-side),
    // so this needs a higher ceiling than the normal 20/page list — 500 covers the
    // current seed size with headroom; raise again if the lead count grows past it.
    limit: z.coerce.number().min(1).max(500).default(20),
    assignedTo: z.string().uuid().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "score", "name"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    isSearchLead: z.any().optional().transform(v => v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
    score_min: z.coerce.number().int().min(0).max(100).optional(),
    score_max: z.coerce.number().int().min(0).max(100).optional(),
    mine: z.any().optional().transform(v => v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
    source: z.enum(["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"]).optional(),
    category: z.enum(["PREMIUM", "HOT", "WARM", "COLD"]).optional(),
    enquiryType: z.string().trim().max(50).optional(),
    sla: z.enum(["breach", "warning"]).optional(),
    // Multi-department filters: scope the list to one department's service / stage.
    department: z.enum(DEPARTMENTS).optional(),
    stage: z.string().trim().max(50).optional(),
})
.refine((data) => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: "startDate must be less than or equal to endDate",
    path: ["endDate"],
});

module.exports = {
    getLeadsSchema
};
