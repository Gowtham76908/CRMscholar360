const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("./organizationService");

async function canAccessUser(requesterId, requesterRole, targetUserId) {
    if (requesterRole === "SUPER_ADMIN") return true;
    if (requesterId === targetUserId) return true;

    if (requesterRole === "ADMIN") {
        const teamIds = await getTeamMemberIds(requesterId);
        return teamIds.includes(targetUserId);
    }

    return false;
}

/**
 * Can the requester see this lead?
 *
 * Multi-department model (preferred): a lead is visible to whoever is assigned to,
 * or manages, ANY of its department services.
 *   - Director (SUPER_ADMIN) — every lead
 *   - Consultant (EMPLOYEE)  — leads where they are the assignedEmployee on some
 *                              LeadDepartment
 *   - Manager (ADMIN)        — leads with a LeadDepartment in a department they are
 *                              a member of, plus anything assigned directly to them
 *
 * Always scoped through LeadDepartment / UserDepartment — the lead's `id` is
 * required. A lead object without an id is treated as inaccessible to non-Directors.
 */
async function canAccessLead(requesterId, requesterRole, lead) {
    if (requesterRole === "SUPER_ADMIN") return true;
    if (!lead || !lead.id) return false;

    if (requesterRole === "EMPLOYEE") {
        const row = await prisma.leadDepartment.findFirst({
            where: { leadId: lead.id, assignedEmployeeId: requesterId },
            select: { id: true },
        });
        return Boolean(row);
    }
    if (requesterRole === "ADMIN") {
        const memberships = await prisma.userDepartment.findMany({
            where: { userId: requesterId },
            select: { department: true },
        });
        const managed = memberships.map(m => m.department);
        const row = await prisma.leadDepartment.findFirst({
            where: {
                leadId: lead.id,
                OR: [
                    ...(managed.length ? [{ department: { in: managed } }] : []),
                    { assignedEmployeeId: requesterId },
                ],
            },
            select: { id: true },
        });
        return Boolean(row);
    }
    return false;
}

module.exports = { canAccessUser, canAccessLead };
