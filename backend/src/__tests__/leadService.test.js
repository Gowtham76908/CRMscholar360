/**
 * Tests for leadService.getLeads
 *
 * Strategy: mock prisma.$transaction so we never hit a real DB.
 * We assert on the WHERE clause and pagination args passed to Prisma,
 * and verify the returned meta shape.
 */

jest.mock("../utils/prisma", () => ({
    $transaction: jest.fn(),
    lead: { count: jest.fn(), findMany: jest.fn() },
}));

// leadService destructures these from leadDepartmentService at module load.
// getUserDepartments drives ADMIN visibility scope; the others are unused here.
jest.mock("../services/leadDepartmentService", () => ({
    getUserDepartments: jest.fn(),
    createSalesAssignment: jest.fn(),
    isMemberOfDepartment: jest.fn(),
}));

const prisma = require("../utils/prisma");
const { getUserDepartments } = require("../services/leadDepartmentService");
const { getLeads } = require("../services/leadService");

// Helpers
const makeLeads = (n) => Array.from({ length: n }, (_, i) => ({ id: `lead-${i}` }));

function captureTransaction() {
    // prisma.$transaction receives [countQuery, findManyQuery] in a tuple.
    // We intercept the callback form AND the tuple form.
    prisma.$transaction.mockImplementation(async (queries) => {
        if (typeof queries === "function") {
            return queries({ lead: prisma.lead });
        }
        // Tuple form: [count promise, findMany promise]
        return Promise.all(queries);
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    captureTransaction();
    // Default stubs — individual tests override as needed
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    getUserDepartments.mockResolvedValue([]);
});

// ── Role-based visibility ─────────────────────────────────────────────────────

describe("getLeads — role visibility", () => {
    test("EMPLOYEE: restricts to services they are assigned (leadDepartments.some.assignedEmployeeId)", async () => {
        await getLeads({ userId: "emp-1", role: "EMPLOYEE" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.leadDepartments).toMatchObject({ some: { assignedEmployeeId: "emp-1" } });
    });

    test("SUPER_ADMIN: no leadDepartments scope on where clause (sees all)", async () => {
        await getLeads({ userId: "admin-1", role: "SUPER_ADMIN" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.leadDepartments).toBeUndefined();
    });

    test("ADMIN with managed departments: scope = OR of managed depts + own assignments", async () => {
        getUserDepartments.mockResolvedValue(["LOAN", "FOREX"]);
        await getLeads({ userId: "mgr-1", role: "ADMIN" });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.OR).toHaveLength(2);
        expect(scope.OR[0]).toMatchObject({ department: { in: ["LOAN", "FOREX"] } });
        expect(scope.OR[1]).toMatchObject({ assignedEmployeeId: "mgr-1" });
    });

    test("ADMIN with no department membership: only own assignments", async () => {
        getUserDepartments.mockResolvedValue([]);
        await getLeads({ userId: "mgr-1", role: "ADMIN" });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.assignedEmployeeId).toBe("mgr-1");
        expect(scope.OR).toBeUndefined();
    });

    test("filters.mine overrides SUPER_ADMIN to own assignments", async () => {
        await getLeads({ userId: "admin-1", role: "SUPER_ADMIN", filters: { mine: true } });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.assignedEmployeeId).toBe("admin-1");
    });

    test("always excludes merged leads via mergedIntoId", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.mergedIntoId).toBeNull();
    });
});

// ── Department / stage filter ──────────────────────────────────────────────────

describe("getLeads — department & stage filter", () => {
    test("SUPER_ADMIN department filter pins leadDepartments.some.department", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { department: "LOAN" } });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.department).toBe("LOAN");
    });

    test("ADMIN department filter for a managed dept is honored", async () => {
        getUserDepartments.mockResolvedValue(["LOAN"]);
        await getLeads({ userId: "mgr-1", role: "ADMIN", filters: { department: "LOAN" } });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.department).toBe("LOAN");
    });

    test("ADMIN department filter for an unmanaged dept is ignored (no leak)", async () => {
        getUserDepartments.mockResolvedValue(["LOAN"]);
        await getLeads({ userId: "mgr-1", role: "ADMIN", filters: { department: "FOREX" } });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.department).toBeUndefined();
    });

    test("stage filter narrows the same service row", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { stage: "APPROVED" } });

        const scope = prisma.lead.count.mock.calls[0][0].where.leadDepartments.some;
        expect(scope.stage).toBe("APPROVED");
    });
});

// ── Score filter ──────────────────────────────────────────────────────────────

describe("getLeads — score filter", () => {
    test("score_min adds gte constraint", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { score_min: 70 } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        expect(where.score).toMatchObject({ gte: 70 });
    });
});

// ── Date range filter ─────────────────────────────────────────────────────────

describe("getLeads — date range filter", () => {
    test("startDate sets createdAt.gte", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { startDate: "2024-01-01" } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        expect(where.createdAt.gte).toEqual(new Date("2024-01-01"));
    });

    test("endDate at midnight UTC is bumped to 23:59:59.999 UTC (inclusive day)", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { endDate: "2024-01-31T00:00:00.000Z" } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        const lte = where.createdAt.lte;
        expect(lte.getUTCHours()).toBe(23);
        expect(lte.getUTCMinutes()).toBe(59);
        expect(lte.getUTCSeconds()).toBe(59);
    });

    test("endDate with non-zero time is NOT bumped", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { endDate: "2024-01-31T12:30:00.000Z" } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        const lte = where.createdAt.lte;
        expect(lte.getUTCHours()).toBe(12);
    });
});

// ── Search filter ─────────────────────────────────────────────────────────────

describe("getLeads — search", () => {
    test("search without existing OR: adds where.OR with name/phone/email", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", search: "Alice" });

        const where = prisma.lead.count.mock.calls[0][0].where;
        expect(where.OR).toHaveLength(3);
        expect(where.OR[0]).toMatchObject({ name: { contains: "Alice", mode: "insensitive" } });
    });

    test("manager scope lives in leadDepartments, so search sets where.OR directly", async () => {
        getUserDepartments.mockResolvedValue(["LOAN"]);
        await getLeads({ userId: "mgr-1", role: "ADMIN", search: "Bob" });

        const where = prisma.lead.count.mock.calls[0][0].where;
        // Manager scope is on leadDepartments.some.OR — it does not collide with the
        // top-level search OR, so no AND wrapping is needed.
        expect(where.OR).toHaveLength(3);
        expect(where.AND).toBeUndefined();
        expect(where.leadDepartments.some.OR).toHaveLength(2);
    });
});

// ── Sort validation ───────────────────────────────────────────────────────────

describe("getLeads — sort", () => {
    test("valid sortBy is passed through", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", sortBy: "score", sortOrder: "asc" });

        const orderBy = prisma.lead.findMany.mock.calls[0][0].orderBy;
        expect(orderBy).toEqual({ score: "asc" });
    });

    test("invalid sortBy falls back to createdAt", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", sortBy: "DROP TABLE", sortOrder: "desc" });

        const orderBy = prisma.lead.findMany.mock.calls[0][0].orderBy;
        expect(orderBy).toEqual({ createdAt: "desc" });
    });

    test("invalid sortOrder falls back to desc", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", sortOrder: "inject" });

        const orderBy = prisma.lead.findMany.mock.calls[0][0].orderBy;
        expect(orderBy).toEqual({ createdAt: "desc" });
    });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe("getLeads — pagination", () => {
    test("skip = (page-1) * limit", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", page: 3, limit: 10 });

        const { skip, take } = prisma.lead.findMany.mock.calls[0][0];
        expect(skip).toBe(20);
        expect(take).toBe(10);
    });

    test("totalPages is Math.ceil(total/limit)", async () => {
        prisma.lead.count.mockResolvedValue(25);
        const result = await getLeads({ userId: "u", role: "SUPER_ADMIN", page: 1, limit: 10 });

        expect(result.totalPages).toBe(3);
        expect(result.total).toBe(25);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
    });

    test("returns data array from findMany", async () => {
        const leads = makeLeads(3);
        prisma.lead.findMany.mockResolvedValue(leads);
        prisma.lead.count.mockResolvedValue(3);

        const result = await getLeads({ userId: "u", role: "SUPER_ADMIN" });
        expect(result.data).toHaveLength(3);
    });
});
