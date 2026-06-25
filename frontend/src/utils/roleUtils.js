/**
 * Utility functions for handling user roles
 */

export const ROLE_LABELS = {
  SUPER_ADMIN: "Director",
  ADMIN: "Manager",
  TEAM_LEADER: "Team Leader",
  EMPLOYEE: "Consultant"
};

export const ROLE_COLORS = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
  TEAM_LEADER: "bg-green-100 text-green-700 border-green-200",
  EMPLOYEE: "bg-gray-100 text-gray-700 border-gray-200"
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export function getRoleColor(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.EMPLOYEE;
}

export function isSuperAdmin(role) {
  return role === "SUPER_ADMIN";
}

export function isManager(role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function isTeamLeader(role) {
  return role === "TEAM_LEADER";
}

export function isManagerOrTeamLeader(role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEAM_LEADER";
}

export function canManageTeam(role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEAM_LEADER";
}

export function canAccessAdminPanel(role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}
