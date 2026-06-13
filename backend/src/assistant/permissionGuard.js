const logger = require("../utils/logger");

// Tool allowlist per role. Tools NOT listed here are forbidden — they will
// never appear in the LLM's tool list and are rejected if somehow invoked.
//
// When adding a new tool:
//   1. Decide which roles can use it.
//   2. Add its name under each allowed role below.
//   3. Tools missing from a role's list are silently invisible to that role.
const ROLE_TOOLS = {
    EMPLOYEE: [
        "search_leads",
        "count_leads_by_status",
        "list_my_tasks",
        "get_pipeline_summary",
        "get_top_leads_by_revenue",
    ],
    ADMIN: [
        "search_leads",
        "count_leads_by_status",
        "list_my_tasks",
        "get_pipeline_summary",
        "get_revenue_stats",
        "get_top_leads_by_revenue",
    ],
    SUPER_ADMIN: [
        "search_leads",
        "count_leads_by_status",
        "list_my_tasks",
        "get_pipeline_summary",
        "get_revenue_stats",
        "get_top_leads_by_revenue",
    ],
};

const getAllowedToolNames = (role) => ROLE_TOOLS[role] ?? [];

const isToolAllowed = (role, toolName) => (ROLE_TOOLS[role] ?? []).includes(toolName);

const auditLog = ({ requestId, userId, role, tool, allowed, args }) => {
    if (allowed) {
        logger.info({ requestId, userId, role, tool }, "Assistant tool allowed");
    } else {
        logger.warn({ requestId, userId, role, tool, args }, "Assistant tool BLOCKED by permission guard");
    }
};

module.exports = { getAllowedToolNames, isToolAllowed, auditLog };
