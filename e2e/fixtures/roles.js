// @ts-check
/**
 * Role catalogue for the E2E suite.
 *
 * Credentials come from the seeded demo data (password `Demo@1234`), except
 * TEAM_LEADER which uses a dedicated, clearly-named E2E account so we never
 * touch a real user's record.
 */
export const API_URL = process.env.E2E_API_URL || "http://localhost:5001/api";

export const ROLES = {
  SUPER_ADMIN: {
    key: "SUPER_ADMIN",
    email: "admin@scholar360.com",
    password: "Demo@1234",
    isManager: true,
  },
  ADMIN: {
    key: "ADMIN",
    email: "arun.manager@scholar360.com",
    password: "Demo@1234",
    isManager: true,
  },
  TEAM_LEADER: {
    key: "TEAM_LEADER",
    email: "e2e.teamleader@scholar360.com",
    password: "Demo@1234",
    isManager: true,
  },
  EMPLOYEE: {
    key: "EMPLOYEE",
    email: "priya.singh@scholar360.com",
    password: "Demo@1234",
    isManager: false,
  },
};

export const ROLE_KEYS = Object.keys(ROLES);
