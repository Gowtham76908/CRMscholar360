const prisma = require("../utils/prisma");

/**
 * Per-department commission.
 *
 * A commission is earned when a LeadDepartment (one department's service on a
 * customer) reaches its commission stage (COMMISSION_INVOICING). It is awarded to
 * that service's assigned consultant — NOT a single global lead owner — so the
 * same customer can generate a commission in SALES, again in FOREX, etc.
 *
 * Idempotent on (leadId, department): re-entering the commission stage, retries,
 * or double-clicks never create a second commission for the same service.
 */

const DEFAULT_COMMISSION = 500.0;

// Per-department payout. Falls back to DEFAULT_COMMISSION when not listed.
const COMMISSION_AMOUNTS = {
    SALES: 500.0,
    LOAN: 500.0,
    ACCOMMODATION_TICKETS: 500.0,
    FOREX: 500.0,
    MISCELLANEOUS: 500.0,
};

function commissionAmount(department) {
    return COMMISSION_AMOUNTS[department] ?? DEFAULT_COMMISSION;
}

/**
 * Award the commission for a department-service that has reached its commission
 * stage. Recipient is the service's consultant; if the service is unassigned there
 * is no one to pay, so it is skipped (and can be back-filled if assigned later and
 * the stage is re-applied). Safe to call repeatedly — unique (leadId, department).
 *
 * @param {{ id, leadId, department, assignedEmployeeId }} leadDept
 * @returns {Promise<{ skipped?: string } | object>}
 */
async function awardServiceCommission(leadDept) {
    if (!leadDept) return { skipped: "no_service" };
    const userId = leadDept.assignedEmployeeId;
    if (!userId) return { skipped: "unassigned" };

    const amount = commissionAmount(leadDept.department);

    try {
        // upsert keyed on the (leadId, department) unique — concurrent calls collapse
        // to a single row instead of throwing on the unique constraint.
        const commission = await prisma.commission.upsert({
            where: { leadId_department: { leadId: leadDept.leadId, department: leadDept.department } },
            create: { userId, leadId: leadDept.leadId, department: leadDept.department, amount },
            update: {}, // already awarded — leave the original recipient/amount intact
        });
        return commission;
    } catch (error) {
        console.error("[Commission] Failed to award service commission:", error);
        return { skipped: "error" };
    }
}

module.exports = { awardServiceCommission, commissionAmount, DEFAULT_COMMISSION };
