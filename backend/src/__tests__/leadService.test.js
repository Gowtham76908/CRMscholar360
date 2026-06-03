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

jest.mock("../services/organizationService", () => ({
    getTeamMemberIds: jest.fn(),
}));

const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("../services/organizationService");
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
    getTeamMemberIds.mockResolvedValue([]);
});

// ── Role-based visibility ─────────────────────────────────────────────────────

describe("getLeads — role visibility", () => {
    test("EMPLOYEE: restricts to own leads (assignedToId = userId)", async () => {
        await getLeads({ userId: "emp-1", role: "EMPLOYEE" });

        const [, findCall] = prisma.$transaction.mock.calls[0][0];
        // The count call receives the where clause
        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.assignedToId).toBe("emp-1");
    });

    test("SUPER_ADMIN: no assignedToId restriction on where clause", async () => {
        await getLeads({ userId: "admin-1", role: "SUPER_ADMIN" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.assignedToId).toBeUndefined();
        expect(whereArg.OR).toBeUndefined();
    });

    test("MANAGER with team members: where.OR includes team + unassigned", async () => {
        getTeamMemberIds.mockResolvedValue(["emp-1", "emp-2"]);
        await getLeads({ userId: "mgr-1", role: "MANAGER" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.OR).toHaveLength(2);
        expect(whereArg.OR[0]).toMatchObject({ assignedToId: { in: ["emp-1", "emp-2"] } });
        expect(whereArg.OR[1]).toMatchObject({ assignedToId: null });
    });

    test("MANAGER with empty team: no OR restriction (sees all)", async () => {
        getTeamMemberIds.mockResolvedValue([]);
        await getLeads({ userId: "mgr-1", role: "MANAGER" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.OR).toBeUndefined();
        expect(whereArg.assignedToId).toBeUndefined();
    });

    test("filters.mine overrides SUPER_ADMIN to own leads", async () => {
        await getLeads({ userId: "admin-1", role: "SUPER_ADMIN", filters: { mine: true } });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.assignedToId).toBe("admin-1");
    });

    test("always excludes MERGED leads", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN" });

        const whereArg = prisma.lead.count.mock.calls[0][0].where;
        expect(whereArg.status).toMatchObject({ not: "MERGED" });
    });
});

// ── Status filter ─────────────────────────────────────────────────────────────

describe("getLeads — status filter", () => {
    test("single status: exact string match", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { status: "CONTACTED" } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        expect(where.status).toBe("CONTACTED");
    });

    test("comma-separated statuses: uses { in: [...] }", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { status: "FOLLOW_UP,CONTACTED" } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        expect(where.status).toMatchObject({ in: ["FOLLOW_UP", "CONTACTED"] });
    });

    test("status filter with whitespace around comma is trimmed", async () => {
        await getLeads({ userId: "u", role: "SUPER_ADMIN", filters: { status: " NEW , HOT " } });

        const where = prisma.lead.count.mock.calls[0][0].where;
        expect(where.status).toMatchObject({ in: ["NEW", "HOT"] });
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

    test("search with existing manager OR: merges into AND to avoid overwriting scope", async () => {
        getTeamMemberIds.mockResolvedValue(["emp-1"]);
        await getLeads({ userId: "mgr-1", role: "MANAGER", search: "Bob" });

        const where = prisma.lead.count.mock.calls[0][0].where;
        // Manager scope moved to AND[0].OR; search in AND[1].OR
        expect(where.AND).toHaveLength(2);
        expect(where.OR).toBeUndefined(); // original OR removed
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
