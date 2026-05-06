// Canonical public user shape returned by every auth/user endpoint.
// Any field added to the User model that should be public goes here — one place to update.
// Fields that must never appear: password, phoneNormalized, workspaceId, departmentId, isActive.
//
// Role note: onlineStatus/breakStartedAt are intentionally included — the frontend uses them
// for presence UI visible to the authenticated user themselves. If per-role visibility is
// needed later, add: toSafeUser(user, { includePresence: role !== 'GUEST' }).
const toSafeUser = (user) => Object.freeze({
    id:             user.id,
    name:           user.name,
    email:          user.email,
    role:           user.role,
    phone:          user.phone          ?? null,
    department:     user.department     ?? null,
    jobTitle:       user.jobTitle       ?? null,
    profilePhoto:   user.profilePhoto   ?? null,
    onlineStatus:   user.onlineStatus   ?? "OFFLINE",
    breakStartedAt: user.breakStartedAt ?? null,
    preferences:    user.preferences    ?? null,
    createdAt:      user.createdAt      ?? null,
});

// The exact set of keys this function guarantees — used by contract tests.
const SAFE_USER_KEYS = Object.freeze([
    "id", "name", "email", "role", "phone", "department",
    "jobTitle", "profilePhoto", "onlineStatus", "breakStartedAt",
    "preferences", "createdAt",
]);

module.exports = { toSafeUser, SAFE_USER_KEYS };
