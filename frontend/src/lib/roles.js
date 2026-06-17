// Presentation labels for the user role enum. The backend still stores the
// canonical enum values (SUPER_ADMIN / ADMIN / EMPLOYEE); this file maps them to
// the names the org actually uses so every screen renders the role consistently:
//   SUPER_ADMIN → Director, ADMIN → Manager, EMPLOYEE → Consultant.

export const ROLE_LABELS = {
    SUPER_ADMIN: "Director",
    ADMIN: "Manager",
    EMPLOYEE: "Consultant",
};

// Human label for a role code, falling back to a humanized version of the raw
// value (so unknown/future roles still render readably rather than blank).
export const roleLabel = (role) =>
    ROLE_LABELS[role] ||
    (role
        ? String(role).toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "—");
