const { getPipelineDeals, getRevenueStats, getTopLeadsByRevenue } = require("../../services/dealService");

const get_pipeline_summary = {
    name:        "get_pipeline_summary",
    description: "Deal pipeline grouped by stage (NEW, NEGOTIATION, WON, LOST). Returns count and total amount per stage, plus KPIs (active value, won revenue, lost revenue, avg deal size, total deals, win rate %). RBAC: EMPLOYEE sees own deals, MANAGER sees team, SUPER_ADMIN sees all. Currency is INR.",
    parameters:  { type: "object", properties: {}, required: [] },
    execute: async (_args, { userId, role }) => {
        const { columns, kpi } = await getPipelineDeals(userId, role);
        const byStage = {};
        for (const stage of ["NEW", "NEGOTIATION", "WON", "LOST"]) {
            const deals = columns[stage] || [];
            byStage[stage] = {
                count:       deals.length,
                totalAmount: deals.reduce((s, d) => s + (d.amount || 0), 0),
            };
        }
        return { byStage, kpi };
    },
};

const get_revenue_stats = {
    name:        "get_revenue_stats",
    description: "Organization-wide revenue numbers in INR: realizedRevenue (collected via payments), pendingAmount (non-paid invoice totals), outstandingPayments (invoice balance still owed). Org-wide totals — does not honor per-user RBAC.",
    parameters:  { type: "object", properties: {}, required: [] },
    execute: async (_args, _ctx) => getRevenueStats(),
};

const get_top_leads_by_revenue = {
    name:        "get_top_leads_by_revenue",
    description: "Top leads ranked by total deal amount in a given stage. Use this for questions like 'top customers by revenue', 'biggest accounts', 'which leads brought the most money', 'top deals in negotiation'. Defaults to WON (realised revenue). Returns lead id (use for entity links), name, status, contact, summed amount, and deal count. RBAC: EMPLOYEE = own deals, MANAGER = team, SUPER_ADMIN = all. Amounts in INR.",
    parameters:  {
        type: "object",
        properties: {
            stage: {
                type:        "string",
                enum:        ["WON", "NEW", "NEGOTIATION", "LOST"],
                description: "Deal stage to aggregate. WON = realised revenue, NEW/NEGOTIATION = pipeline value, LOST = lost opportunities. Default WON.",
            },
            limit: {
                type:        "integer",
                minimum:     1,
                maximum:     20,
                description: "How many top leads to return (default 5).",
            },
        },
        required: [],
    },
    execute: async ({ stage, limit }, { userId, role }) =>
        getTopLeadsByRevenue(userId, role, { stage: stage ?? "WON", limit: limit ?? 5 }),
};

module.exports = { get_pipeline_summary, get_revenue_stats, get_top_leads_by_revenue };
