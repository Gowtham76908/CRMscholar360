const { getTeamMemberIds } = require("./organizationService");

async function canAccessUser(requesterId, requesterRole, targetUserId) {
    if (requesterRole === "SUPER_ADMIN") return true;
    if (requesterId === targetUserId) return true;

    if (requesterRole === "MANAGER") {
        const teamIds = await getTeamMemberIds(requesterId);
        return teamIds.includes(targetUserId);
    }

    return false;
}

async function canAccessLead(requesterId, requesterRole, lead) {
    if (requesterRole === "SUPER_ADMIN") return true;

    if (requesterRole === "EMPLOYEE") {
        return lead.assignedToId === requesterId;
    }

    if (requesterRole === "MANAGER") {
        if (!lead.assignedToId) return true;
        const teamIds = await getTeamMemberIds(requesterId);
        return teamIds.includes(lead.assignedToId);
    }

    return false;
}

async function canReassignLeadTo(requesterId, requesterRole, targetEmployeeId) {
    if (requesterRole === "EMPLOYEE") return false;
    if (requesterRole === "SUPER_ADMIN") return true;

    if (requesterRole === "MANAGER") {
        const teamIds = await getTeamMemberIds(requesterId);
        return teamIds.includes(targetEmployeeId);
    }

    return false;
}

module.exports = { canAccessUser, canAccessLead, canReassignLeadTo };
