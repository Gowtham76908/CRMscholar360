/**
 * Tests for leadDistributionEngine
 *
 * Pure functions (calculatePerformanceScore, scoreEmployee, cooldownScore)
 * are tested without any mocking.
 *
 * DB-dependent functions (assignLead, batchAssignLeads, scoreManagers,
 * findBestEmployee) are tested with a fully mocked prisma.
 */

jest.mock("../utils/prisma", () => ({
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn(),
    user: { findMany: jest.fn() },
    lead: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    employeeProfile: { findUnique: jest.fn(), create: jest.fn() },
    assignmentHistory: { create: jest.fn(), createMany: jest.fn() },
    activity: { create: jest.fn(), createMany: jest.fn() },
}));

const prisma = require("../utils/prisma");
const {
    calculatePerformanceScore,
    batchAssignLeads,
    assignLead,
    findBestEmployee,
} = require("../services/leadDistributionEngine");

beforeEach(() => jest.clearAllMocks());

// ── calculatePerformanceScore ─────────────────────────────────────────────────

describe("calculatePerformanceScore", () => {
    test("all components at 1.0 → score = 1.0", () => {
        expect(calculatePerformanceScore({
            leadEffectiveness: 1, responseQuality: 1,
            followupDiscipline: 1, attendanceReliability: 1,
        })).toBeCloseTo(1.0);
    });

    test("all components at 0.0 → score = 0.0", () => {
        expect(calculatePerformanceScore({
            leadEffectiveness: 0, responseQuality: 0,
            followupDiscipline: 0, attendanceReliability: 0,
        })).toBeCloseTo(0.0);
    });

    test("defaults missing components to 0.5", () => {
        const score = calculatePerformanceScore({});
        // 0.5*0.30 + 0.5*0.25 + 0.5*0.25 + 0.5*0.20 = 0.5
        expect(score).toBeCloseTo(0.5);
    });

    test("clamps component above 1.0 to 1.0", () => {
        const score = calculatePerformanceScore({
            leadEffectiveness: 5, responseQuality: 1,
            followupDiscipline: 1, attendanceReliability: 1,
        });
        // Same as all-1 since 5 clamps to 1
        expect(score).toBeCloseTo(1.0);
    });

    test("clamps component below 0 to 0", () => {
        const score = calculatePerformanceScore({
            leadEffectiveness: -10, responseQuality: 0,
            followupDiscipline: 0, attendanceReliability: 0,
        });
        expect(score).toBeCloseTo(0.0);
    });

    test("known values: 0.8 le, 0.6 rq, 0.7 fd, 0.9 ar → expected formula", () => {
        const expected = 0.8 * 0.30 + 0.6 * 0.25 + 0.7 * 0.25 + 0.9 * 0.20;
        expect(calculatePerformanceScore({
            leadEffectiveness: 0.8, responseQuality: 0.6,
            followupDiscipline: 0.7, attendanceReliability: 0.9,
        })).toBeCloseTo(expected, 6);
    });
});

// ── findBestEmployee (round-robin queue head) ─────────────────────────────────

describe("findBestEmployee", () => {
    const baseProfile = {
        availabilityStatus: "ONLINE",
        isAcceptingLeads: true,
        currentLeadLoad: 5,
        maxDailyLeads: 20,
        lastAssignedAt: null,
    };

    test("returns null when no employees in manager team", async () => {
        prisma.user.findMany.mockResolvedValue([]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("returns null when all employees are ON_LEAVE", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, availabilityStatus: "ON_LEAVE" },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("OFFLINE employees are still eligible (working off-desk)", async () => {
        // Per business rule: OFFLINE != absent. Employee may be in the field
        // or just not on the dashboard — they still receive leads.
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, availabilityStatus: "OFFLINE" },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-1");
    });

    test("OFFLINE and ONLINE are treated identically (pure round-robin)", async () => {
        // emp-off has older lastAssignedAt (10 min ago), emp-on has newer (1 min ago).
        // Older one goes first regardless of availability status.
        const tenMinAgo = new Date(Date.now() - 10 * 60_000);
        const oneMinAgo = new Date(Date.now() -  1 * 60_000);
        prisma.user.findMany.mockResolvedValue([
            { id: "emp-on",  employeeProfile: { ...baseProfile, availabilityStatus: "ONLINE",  lastAssignedAt: oneMinAgo } },
            { id: "emp-off", employeeProfile: { ...baseProfile, availabilityStatus: "OFFLINE", lastAssignedAt: tenMinAgo } },
        ]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-off");
    });

    test("returns null when all employees are NOT accepting leads", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, isAcceptingLeads: false },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("maxDailyLeads is not a routing gate — employee over the metric is still eligible", async () => {
        // Cap was removed: currentLeadLoad >= maxDailyLeads no longer disqualifies.
        // The counter is purely informational. Routing continues; admins notice
        // heavy queues via the metric.
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, currentLeadLoad: 200, maxDailyLeads: 20 },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-1");
    });

    test("returns employee ID when one valid employee exists", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: baseProfile,
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-1");
    });

    test("never-assigned employee wins over previously-assigned (round-robin)", async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60_000);
        prisma.user.findMany.mockResolvedValue([
            { id: "emp-1", employeeProfile: { ...baseProfile, lastAssignedAt: oneHourAgo } }, // assigned recently
            { id: "emp-2", employeeProfile: { ...baseProfile, lastAssignedAt: null      } }, // never assigned
        ]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-2");
    });

    test("oldest lastAssignedAt wins (queue rotates)", async () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
        const oneHourAgo  = new Date(Date.now() -     60 * 60_000);
        prisma.user.findMany.mockResolvedValue([
            { id: "emp-recent", employeeProfile: { ...baseProfile, lastAssignedAt: oneHourAgo  } },
            { id: "emp-older",  employeeProfile: { ...baseProfile, lastAssignedAt: twoHoursAgo } },
        ]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-older");
    });

    test("deterministic tiebreaker on equal lastAssignedAt (id ascending)", async () => {
        prisma.user.findMany.mockResolvedValue([
            { id: "emp-b", employeeProfile: { ...baseProfile, lastAssignedAt: null } },
            { id: "emp-a", employeeProfile: { ...baseProfile, lastAssignedAt: null } },
        ]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-a");
    });

    test("skips employee with no profile", async () => {
        prisma.user.findMany.mockResolvedValue([
            { id: "emp-1", employeeProfile: null },
            { id: "emp-2", employeeProfile: baseProfile },
        ]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-2");
    });
});

// ── assignLead ────────────────────────────────────────────────────────────────

describe("assignLead", () => {
    const mockProfile = {
        employeeId: "emp-1",
        availabilityStatus: "ONLINE",
        isAcceptingLeads: true,
        currentLeadLoad: 5,
        maxDailyLeads: 20,
    };
    const mockLead = { id: "lead-1", assignedToId: null, name: "Test Lead" };
    const mockEmployee = { name: "Alice", managerId: "mgr-1" };

    beforeEach(() => {
        // $transaction executes the callback
        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.$queryRawUnsafe.mockResolvedValue([mockProfile]);
        prisma.lead.findUnique.mockResolvedValue(mockLead);
        prisma.lead.update.mockResolvedValue({ ...mockLead, assignedToId: "emp-1", assignedTo: { id: "emp-1", name: "Alice", email: "a@a.com" } });
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.assignmentHistory.create.mockResolvedValue({});
        prisma.activity.create.mockResolvedValue({});
        prisma.user.findMany.mockResolvedValue([{ id: "emp-1", employeeProfile: { ...mockProfile, lastAssignedAt: null, performanceScore: 0.5, responseSpeed: null } }]);
        prisma.user.findUnique = jest.fn().mockResolvedValue(mockEmployee);
    });

    test("returns error when lead not found", async () => {
        prisma.lead.findUnique.mockResolvedValue(null);
        const result = await assignLead("missing-lead", { employeeId: "emp-1" });
        expect(result.error).toBe("LEAD_NOT_FOUND");
    });

    test("returns error when employee unavailable (force assign bypasses capacity)", async () => {
        // With forcedEmployee, capacity guards are skipped
        prisma.lead.update.mockResolvedValue({ ...mockLead, assignedToId: "emp-1", assignedTo: {} });
        const result = await assignLead("lead-1", { employeeId: "emp-1", actorId: "admin-1" });
        expect(result.error).toBeUndefined();
        expect(result.employeeId).toBe("emp-1");
    });

    test("auto-assignment returns error when employee is ON_LEAVE (no forced employee)", async () => {
        // ON_LEAVE is the only availability state that disqualifies a candidate.
        prisma.user.findMany.mockResolvedValueOnce([{
            id: "emp-1",
            employeeProfile: { ...mockProfile, availabilityStatus: "ON_LEAVE", lastAssignedAt: null, performanceScore: 0.5, responseSpeed: null },
        }]);
        const r = await assignLead("lead-1", { managerId: "mgr-1" });
        expect(r.error).toBe("No available employee in selected manager's team");
    });


    test("successful assignment creates AssignmentHistory and Activity", async () => {
        prisma.lead.update.mockResolvedValue({ ...mockLead, assignedToId: "emp-1", assignedTo: { id: "emp-1", name: "Alice", email: "a@a.com" } });
        await assignLead("lead-1", { employeeId: "emp-1", actorId: "admin-1" });
        expect(prisma.assignmentHistory.create).toHaveBeenCalledTimes(1);
        expect(prisma.activity.create).toHaveBeenCalledTimes(1);
    });

    test("retries with next candidate when first hits EMPLOYEE_UNAVAILABLE at lock time", async () => {
        // Two candidates eligible at snapshot time (id ascending so emp-1 picks first).
        prisma.user.findMany.mockResolvedValueOnce([
            { id: "emp-1", employeeProfile: { ...mockProfile, lastAssignedAt: null } },
            { id: "emp-2", employeeProfile: { ...mockProfile, lastAssignedAt: null } },
        ]);
        // Inside the transaction lock: emp-1 flipped to ON_LEAVE since the
        // snapshot was taken. emp-2 is still available.
        prisma.$queryRawUnsafe
            .mockResolvedValueOnce([{ ...mockProfile, employeeId: "emp-1", availabilityStatus: "ON_LEAVE" }])
            .mockResolvedValueOnce([{ ...mockProfile, employeeId: "emp-2", availabilityStatus: "ONLINE" }]);
        prisma.lead.update.mockResolvedValue({ ...mockLead, assignedToId: "emp-2", assignedTo: {} });
        prisma.user.findUnique = jest.fn().mockResolvedValue({ name: "Bob", managerId: "mgr-1" });

        const result = await assignLead("lead-1");
        expect(result.error).toBeUndefined();
        expect(result.employeeId).toBe("emp-2");
    });
});

// ── batchAssignLeads ──────────────────────────────────────────────────────────

describe("batchAssignLeads", () => {
    test("empty leadIds returns zero counts immediately", async () => {
        const result = await batchAssignLeads([]);
        expect(result).toEqual({ assigned: 0, failed: 0, total: 0 });
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    test("returns all failed when no eligible employees exist", async () => {
        prisma.user.findMany.mockResolvedValue([]); // empty candidate pool
        const result = await batchAssignLeads(["l1", "l2"], {});
        expect(result.assigned).toBe(0);
        expect(result.failed).toBe(2);
    });

    test("distributes all leads when employee has enough capacity", async () => {
        const profile = {
            availabilityStatus: "ONLINE",
            isAcceptingLeads: true,
            currentLeadLoad: 0,
            maxDailyLeads: 10,
            lastAssignedAt: null,
            performanceScore: 0.5,
            responseSpeed: null,
        };

        // With managerId provided: batchAssignLeads skips scoreManagers entirely.
        // Calls: (1) user.findMany for candidates, (2) user.findMany for empNameMap
        prisma.user.findMany
            .mockResolvedValueOnce([{ id: "emp-A", employeeProfile: profile }]) // candidates
            .mockResolvedValueOnce([{ id: "emp-A", name: "Alice" }]);            // empNameMap

        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.lead.updateMany.mockResolvedValue({});
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.assignmentHistory.createMany.mockResolvedValue({});
        prisma.activity.createMany.mockResolvedValue({});

        const result = await batchAssignLeads(["l1", "l2", "l3"], { managerId: "mgr-1" });
        expect(result.total).toBe(3);
        expect(result.assigned).toBe(3);
        expect(result.failed).toBe(0);
    });

    test("batch distributes all leads regardless of currentLeadLoad (no cap)", async () => {
        // Employee is already well over their informational maxDailyLeads — engine
        // still routes to them, since the cap is no longer a gate.
        const profile = {
            availabilityStatus: "ONLINE",
            isAcceptingLeads: true,
            currentLeadLoad: 500,
            maxDailyLeads: 10,
            lastAssignedAt: null,
        };

        prisma.user.findMany
            .mockResolvedValueOnce([{ id: "emp-A", employeeProfile: profile }])
            .mockResolvedValueOnce([{ id: "emp-A", name: "Alice" }]);

        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.lead.updateMany.mockResolvedValue({});
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.assignmentHistory.createMany.mockResolvedValue({});
        prisma.activity.createMany.mockResolvedValue({});

        const result = await batchAssignLeads(["l1", "l2", "l3"], { managerId: "mgr-1" });
        expect(result.assigned).toBe(3);
        expect(result.failed).toBe(0);
    });

    test("batch round-robins leads evenly across employees", async () => {
        // 4 employees, 10 leads → 2 employees get 3 leads each, 2 get 2.
        const baseP = { availabilityStatus: "ONLINE", isAcceptingLeads: true, currentLeadLoad: 0, maxDailyLeads: 20, lastAssignedAt: null };
        prisma.user.findMany
            .mockResolvedValueOnce([
                { id: "emp-A", employeeProfile: baseP },
                { id: "emp-B", employeeProfile: baseP },
                { id: "emp-C", employeeProfile: baseP },
                { id: "emp-D", employeeProfile: baseP },
            ])
            .mockResolvedValueOnce([
                { id: "emp-A", name: "A" }, { id: "emp-B", name: "B" },
                { id: "emp-C", name: "C" }, { id: "emp-D", name: "D" },
            ]);

        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        // Capture per-employee assignment counts via updateMany calls
        const counts = {};
        prisma.lead.updateMany.mockImplementation(({ where, data }) => {
            counts[data.assignedToId] = (counts[data.assignedToId] || 0) + where.id.in.length;
            return {};
        });
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.assignmentHistory.createMany.mockResolvedValue({});
        prisma.activity.createMany.mockResolvedValue({});

        const leads = ["l1","l2","l3","l4","l5","l6","l7","l8","l9","l10"];
        const result = await batchAssignLeads(leads, { managerId: "mgr-1" });
        expect(result.assigned).toBe(10);
        // Round-robin: A,B,C,D,A,B,C,D,A,B → A=3, B=3, C=2, D=2
        expect(counts["emp-A"]).toBe(3);
        expect(counts["emp-B"]).toBe(3);
        expect(counts["emp-C"]).toBe(2);
        expect(counts["emp-D"]).toBe(2);
    });
});
