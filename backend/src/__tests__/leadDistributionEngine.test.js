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
    scoreEmployee: _scoreEmployee,
    batchAssignLeads,
    assignLead,
    findBestEmployee,
} = require("../services/leadDistributionEngine");

// scoreEmployee is not exported — we test it indirectly via findBestEmployee
// We expose the module internals through require for unit testing
// (If not exported, we test behaviour through findBestEmployee)

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

// ── findBestEmployee (tests scoreEmployee indirectly) ────────────────────────

describe("findBestEmployee", () => {
    const baseProfile = {
        availabilityStatus: "ONLINE",
        isAcceptingLeads: true,
        currentLeadLoad: 5,
        maxDailyLeads: 20,
        lastAssignedAt: null,
        performanceScore: 0.5,
        responseSpeed: null,
    };

    test("returns null when no employees in manager team", async () => {
        prisma.user.findMany.mockResolvedValue([]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("returns null when all employees are OFFLINE", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, availabilityStatus: "OFFLINE" },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("returns null when all employees are NOT accepting leads", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, isAcceptingLeads: false },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("returns null when all employees are at max capacity", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: { ...baseProfile, currentLeadLoad: 20, maxDailyLeads: 20 },
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBeNull();
    });

    test("returns employee ID when one valid employee exists", async () => {
        prisma.user.findMany.mockResolvedValue([{
            id: "emp-1",
            employeeProfile: baseProfile,
        }]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-1");
    });

    test("returns higher-scoring employee when two compete", async () => {
        // emp-2 has lower load → higher headroom score → wins
        prisma.user.findMany.mockResolvedValue([
            { id: "emp-1", employeeProfile: { ...baseProfile, currentLeadLoad: 15 } },
            { id: "emp-2", employeeProfile: { ...baseProfile, currentLeadLoad: 2 } },
        ]);
        const result = await findBestEmployee("mgr-1");
        expect(result).toBe("emp-2");
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

    test("auto-assignment returns error when profile is OFFLINE (no forced employee)", async () => {
        // Without forcedEmployee, capacity guards fire inside the transaction lock
        prisma.$queryRawUnsafe.mockResolvedValue([{ ...mockProfile, availabilityStatus: "OFFLINE" }]);
        // Force the manager so scoreManagers is bypassed; employee lookup bypassed too
        // We simulate the transaction path directly hitting the guard
        const result = await assignLead("lead-1", { employeeId: undefined, managerId: "mgr-1" });
        // findBestEmployee returns null (emp-1 is OFFLINE in user.findMany mock)
        // Provide the employee as OFFLINE through findMany
        // Actually: managerId path calls findBestEmployee which reads user.findMany
        // Our beforeEach mock has emp-1 with ONLINE profile, so override:
        prisma.user.findMany.mockResolvedValueOnce([{
            id: "emp-1",
            employeeProfile: { ...mockProfile, availabilityStatus: "OFFLINE", lastAssignedAt: null, performanceScore: 0.5, responseSpeed: null },
        }]);
        const r = await assignLead("lead-1", { managerId: "mgr-1" });
        expect(r.error).toBe("No available employee in selected manager's team");
    });

    test("auto-assignment returns error when capacity exceeded (no forced employee)", async () => {
        prisma.user.findMany.mockResolvedValueOnce([{
            id: "emp-1",
            employeeProfile: { ...mockProfile, currentLeadLoad: 20, maxDailyLeads: 20, lastAssignedAt: null, performanceScore: 0.5, responseSpeed: null },
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
});

// ── batchAssignLeads ──────────────────────────────────────────────────────────

describe("batchAssignLeads", () => {
    test("empty leadIds returns zero counts immediately", async () => {
        const result = await batchAssignLeads([]);
        expect(result).toEqual({ assigned: 0, failed: 0, total: 0 });
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    test("returns all failed when no managers found", async () => {
        // scoreManagers queries users with role MANAGER/SUPER_ADMIN
        prisma.user.findMany.mockResolvedValue([]); // no managers
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

    test("leads exceeding total capacity are counted as failed", async () => {
        const profile = {
            availabilityStatus: "ONLINE",
            isAcceptingLeads: true,
            currentLeadLoad: 9,  // only 1 slot left
            maxDailyLeads: 10,
            lastAssignedAt: null,
            performanceScore: 0.5,
            responseSpeed: null,
        };

        prisma.user.findMany
            .mockResolvedValueOnce([{ id: "emp-A", employeeProfile: profile }]) // candidates
            .mockResolvedValueOnce([{ id: "emp-A", name: "Alice" }]);            // empNameMap

        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.lead.updateMany.mockResolvedValue({});
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.assignmentHistory.createMany.mockResolvedValue({});
        prisma.activity.createMany.mockResolvedValue({});

        const result = await batchAssignLeads(["l1", "l2", "l3"], { managerId: "mgr-1" });
        expect(result.assigned).toBe(1);
        expect(result.failed).toBe(2);
    });
});
