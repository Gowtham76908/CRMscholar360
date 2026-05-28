const { getPipelineDeals, getRevenueStats } = require("../../services/dealService");

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

module.exports = { get_pipeline_summary, get_revenue_stats };
