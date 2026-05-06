const { toSafeUser, SAFE_USER_KEYS } = require("../utils/safeUser");

const fullUser = {
    id: "abc-123",
    name: "Test User",
    email: "test@example.com",
    role: "EMPLOYEE",
    phone: "+91 9876543210",
    phoneNormalized: "9876543210",   // must NOT appear in output
    department: "Sales",
    jobTitle: "Executive",
    profilePhoto: "/uploads/photo.jpg",
    onlineStatus: "ONLINE",
    breakStartedAt: null,
    preferences: { theme: "dark" },
    createdAt: new Date("2024-01-01"),
    password: "hashed_secret",       // must NOT appear in output
    workspaceId: "ws-1",             // must NOT appear in output
    departmentId: "dept-1",          // must NOT appear in output
    isActive: true,                  // must NOT appear in output
};

describe("toSafeUser", () => {
    test("returns exactly the keys defined in SAFE_USER_KEYS — no more, no less", () => {
        const result = toSafeUser(fullUser);
        expect(Object.keys(result).sort()).toEqual([...SAFE_USER_KEYS].sort());
    });

    test("strips sensitive fields", () => {
        const result = toSafeUser(fullUser);
        expect(result).not.toHaveProperty("password");
        expect(result).not.toHaveProperty("phoneNormalized");
        expect(result).not.toHaveProperty("workspaceId");
        expect(result).not.toHaveProperty("departmentId");
        expect(result).not.toHaveProperty("isActive");
    });

    test("null-coalesces nullable fields — no undefined values", () => {
        const sparse = { id: "1", name: "X", email: "x@x.com", role: "EMPLOYEE", createdAt: new Date() };
        const result = toSafeUser(sparse);
        Object.values(result).forEach(v => expect(v).not.toBeUndefined());
    });

    test("onlineStatus defaults to OFFLINE when missing", () => {
        const result = toSafeUser({ ...fullUser, onlineStatus: undefined });
        expect(result.onlineStatus).toBe("OFFLINE");
    });

    test("result is frozen — mutation throws in strict mode", () => {
        const result = toSafeUser(fullUser);
        expect(Object.isFrozen(result)).toBe(true);
    });

    test("passes through valid values unchanged", () => {
        const result = toSafeUser(fullUser);
        expect(result.id).toBe(fullUser.id);
        expect(result.profilePhoto).toBe(fullUser.profilePhoto);
        expect(result.onlineStatus).toBe("ONLINE");
    });
});
