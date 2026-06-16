/**
 * Tests for automationEngine (department-stage based).
 *
 * Tests:
 *  - condition matching (source / assignedTo / department / stage)
 *  - department event matching: STAGE_CHANGED department + stage gating
 *  - checkConstraints (mocked prisma — constraint logic)
 *  - depth limit + recursion guard
 *  - executeAction guard cases (skips when required fields missing)
 *  - department actions: CHANGE_STAGE / ASSIGN_CONSULTANT
 */

const mockTx = {
    lead: { update: jest.fn(), findUnique: jest.fn() },
    leadDepartment: { update: jest.fn(), findUnique: jest.fn() },
    task: { create: jest.fn() },
    reminder: { create: jest.fn() },
    notification: { create: jest.fn() },
    whatsAppMessage: { create: jest.fn() },
    activity: { create: jest.fn() },
    automationLog: { create: jest.fn() },
};

jest.mock("../utils/prisma", () => ({
    $transaction: jest.fn(async (fn) => fn(mockTx)),
    automationRule: { findMany: jest.fn() },
    automationLog: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
    },
    lead: { update: jest.fn(), findUnique: jest.fn() },
    leadDepartment: { update: jest.fn(), findUnique: jest.fn() },
    task: { create: jest.fn() },
    reminder: { create: jest.fn() },
    notification: { create: jest.fn() },
    whatsAppMessage: { create: jest.fn() },
    activity: { create: jest.fn() },
}));

jest.mock("../utils/activityLogger", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../services/whatsappService", () => ({
    sendTemplateMessage: jest.fn().mockResolvedValue({ status: "SENT", watiMessageId: "w1", raw: {} }),
}));
jest.mock("../services/emailService", () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/normalizePhone", () => jest.fn((p) => p || null));

const prisma = require("../utils/prisma");
const { runRulesForLead, runRulesForDepartmentEvent } = require("../services/automationEngine");

// "did the rule fire?" = automationLog.create called inside the transaction
function expectRuleFired(times = 1) {
    expect(mockTx.automationLog.create).toHaveBeenCalledTimes(times);
}
function expectRuleNotFired() {
    expect(mockTx.automationLog.create).not.toHaveBeenCalled();
    expect(prisma.automationLog.create).not.toHaveBeenCalled();
}

beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
    mockTx.automationLog.create.mockResolvedValue({});
    mockTx.lead.findUnique.mockResolvedValue(null);
    mockTx.leadDepartment.findUnique.mockResolvedValue(null);
    mockTx.leadDepartment.update.mockResolvedValue({});
    mockTx.task.create.mockResolvedValue({});
    mockTx.reminder.create.mockResolvedValue({});
    mockTx.notification.create.mockResolvedValue({});
    mockTx.whatsAppMessage.create.mockResolvedValue({});
    mockTx.activity.create.mockResolvedValue({});
    prisma.automationRule.findMany.mockResolvedValue([]);
    prisma.automationLog.findFirst.mockResolvedValue(null);
    prisma.automationLog.count.mockResolvedValue(0);
    prisma.automationLog.create.mockResolvedValue({});
    prisma.lead.findUnique.mockResolvedValue(null);
    prisma.leadDepartment.findUnique.mockResolvedValue(null);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRule(overrides = {}) {
    return {
        id: "rule-1",
        triggerType: "STAGE_CHANGED",
        isActive: true,
        triggerConfig: {},
        conditions: [],
        actions: [],
        ...overrides,
    };
}

function makeLead(overrides = {}) {
    return {
        id: "lead-1",
        name: "Test Lead",
        source: "FACEBOOK",
        phone: "+919876543210",
        email: "test@example.com",
        enquiryType: "PRODUCT",
        ...overrides,
    };
}

function makeLeadDept(overrides = {}) {
    return {
        id: "ld-1",
        leadId: "lead-1",
        department: "SALES",
        stage: "PROSPECT",
        assignedEmployeeId: "emp-1",
        ...overrides,
    };
}

/** Drive a STAGE_CHANGED department event with the given lead + leadDept. */
async function fireStageChanged(leadDept = makeLeadDept(), lead = makeLead(), ctx = null) {
    prisma.lead.findUnique.mockResolvedValue(lead);
    return runRulesForDepartmentEvent("STAGE_CHANGED", leadDept, ctx);
}

// ── condition matching (lead-level event) ─────────────────────────────────────

describe("condition matching (runRulesForLead)", () => {
    test("matching 'equals' on source fires", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerType: "LEAD_CREATED", conditions: [{ field: "source", operator: "equals", value: "FACEBOOK" }] }),
        ]);
        await runRulesForLead("LEAD_CREATED", makeLead({ source: "FACEBOOK" }));
        expectRuleFired(1);
    });

    test("non-matching 'equals' on source does NOT fire", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerType: "LEAD_CREATED", conditions: [{ field: "source", operator: "equals", value: "INSTAGRAM" }] }),
        ]);
        await runRulesForLead("LEAD_CREATED", makeLead({ source: "FACEBOOK" }));
        expectRuleNotFired();
    });

    test("'is_empty' on assignedTo passes when lead owner is null", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerType: "LEAD_CREATED", conditions: [{ field: "assignedTo", operator: "is_empty" }] }),
        ]);
        await runRulesForLead("LEAD_CREATED", makeLead());
        expectRuleFired(1);
    });

    test("unknown operator → rule does not fire", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerType: "LEAD_CREATED", conditions: [{ field: "source", operator: "regex_match", value: ".*" }] }),
        ]);
        await runRulesForLead("LEAD_CREATED", makeLead());
        expectRuleNotFired();
    });
});

// ── department event matching (STAGE_CHANGED) ─────────────────────────────────

describe("STAGE_CHANGED — department + stage gating", () => {
    test("fires when triggerConfig department + stage match the service", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", stage: "PROSPECT" } }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "PROSPECT" }));
        expectRuleFired(1);
    });

    test("does NOT fire when department differs", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "LOAN", stage: "PROSPECT" } }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "PROSPECT" }));
        expectRuleNotFired();
    });

    test("does NOT fire when stage differs", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", stage: "FOLLOW_UP" } }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "PROSPECT" }));
        expectRuleNotFired();
    });

    test("department-only rule (no stage) fires on any stage in that department", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES" } }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "FOLLOW_UP" }));
        expectRuleFired(1);
    });

    test("condition on stage/department evaluates against the service", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({
                triggerConfig: { department: "SALES" },
                conditions: [{ field: "stage", operator: "equals", value: "PROSPECT" }],
            }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "PROSPECT" }));
        expectRuleFired(1);
    });
});

// ── checkConstraints ──────────────────────────────────────────────────────────

describe("constraint: COOLDOWN", () => {
    test("blocks when a recent SUCCESS log exists", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", constraints: [{ type: "COOLDOWN", hours: 24 }] } }),
        ]);
        prisma.automationLog.findFirst.mockResolvedValue({ id: "log-1" });
        await fireStageChanged();
        expectRuleNotFired();
    });

    test("allows when no recent SUCCESS log exists", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", constraints: [{ type: "COOLDOWN", hours: 24 }] } }),
        ]);
        prisma.automationLog.findFirst.mockResolvedValue(null);
        await fireStageChanged();
        expectRuleFired(1);
    });
});

describe("constraint: MAX_EXECUTIONS_PER_DAY", () => {
    test("blocks when count meets max", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", constraints: [{ type: "MAX_EXECUTIONS_PER_DAY", max: 2 }] } }),
        ]);
        prisma.automationLog.count.mockResolvedValue(2);
        await fireStageChanged();
        expectRuleNotFired();
    });
});

describe("constraint: PREVENT_RECURSIVE_TRIGGERS", () => {
    test("blocks when rule id already in ruleChain", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ id: "rule-A", triggerConfig: { department: "SALES", constraints: [{ type: "PREVENT_RECURSIVE_TRIGGERS" }] } }),
        ]);
        await fireStageChanged(makeLeadDept(), makeLead(), { chainId: "c", triggerDepth: 1, ruleChain: ["rule-A"] });
        expectRuleNotFired();
    });

    test("allows when rule id not in ruleChain", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ id: "rule-B", triggerConfig: { department: "SALES", constraints: [{ type: "PREVENT_RECURSIVE_TRIGGERS" }] } }),
        ]);
        await fireStageChanged(makeLeadDept(), makeLead(), { chainId: "c", triggerDepth: 1, ruleChain: ["rule-A"] });
        expectRuleFired(1);
    });
});

describe("constraint: PREVENT_DUPLICATES", () => {
    test("blocks if any prior SUCCESS log exists", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", constraints: [{ type: "PREVENT_DUPLICATES" }] } }),
        ]);
        prisma.automationLog.findFirst.mockResolvedValue({ id: "old-log" });
        await fireStageChanged();
        expectRuleNotFired();
    });
});

// ── Depth limit ───────────────────────────────────────────────────────────────

describe("depth limit", () => {
    test("aborts silently when triggerDepth > MAX_TRIGGER_DEPTH (3)", async () => {
        await fireStageChanged(makeLeadDept(), makeLead(), { chainId: "c1", triggerDepth: 4, ruleChain: [] });
        expect(prisma.automationRule.findMany).not.toHaveBeenCalled();
        expectRuleNotFired();
    });

    test("executes normally at depth = MAX_TRIGGER_DEPTH (3)", async () => {
        prisma.automationRule.findMany.mockResolvedValue([makeRule({ triggerConfig: { department: "SALES" } })]);
        await fireStageChanged(makeLeadDept(), makeLead(), { chainId: "c1", triggerDepth: 3, ruleChain: [] });
        expectRuleFired(1);
    });
});

// ── executeAction guard cases ─────────────────────────────────────────────────

describe("executeAction — guard cases", () => {
    function ruleWithAction(type, config = {}) {
        return makeRule({ triggerConfig: { department: "SALES" }, actions: [{ type, config, order: 0 }] });
    }

    beforeEach(() => {
        mockTx.lead.findUnique.mockResolvedValue(makeLead());
        mockTx.leadDepartment.findUnique.mockResolvedValue(makeLeadDept());
    });

    test("SEND_EMAIL skips (no throw) when lead has no email", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("SEND_EMAIL", { subject: "Hi" })]);
        await fireStageChanged(makeLeadDept(), makeLead({ email: null }));
        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.status).toBe("SUCCESS");
        expect(logCall.details.results[0]).toMatchObject({ skipped: true, reason: "no_email" });
    });

    test("SEND_WHATSAPP skips when lead has no phone", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("SEND_WHATSAPP", { templateName: "welcome" })]);
        await fireStageChanged(makeLeadDept(), makeLead({ phone: null }));
        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.details.results[0]).toMatchObject({ skipped: true, reason: "no_phone" });
    });

    test("CREATE_REMINDER skips when no assignee on the service", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("CREATE_REMINDER", { message: "Follow up" })]);
        await fireStageChanged(makeLeadDept({ assignedEmployeeId: null }), makeLead());
        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.details.results[0]).toMatchObject({ skipped: true, reason: "no_assignee" });
    });

    test("CREATE_TASK assigns to the service consultant with due date now + N days", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            ruleWithAction("CREATE_TASK", { title: "Follow up call", dueDaysFromNow: 2 }),
        ]);
        const before = Date.now();
        await fireStageChanged(makeLeadDept({ assignedEmployeeId: "emp-9" }));
        expect(mockTx.task.create).toHaveBeenCalledTimes(1);
        const taskData = mockTx.task.create.mock.calls[0][0].data;
        expect(taskData.title).toBe("Follow up call");
        expect(taskData.assignedToId).toBe("emp-9");
        expect(taskData.dueDate.getTime()).toBeGreaterThanOrEqual(before + 2 * 86_400_000 - 1000);
    });

    test("action failure marks log FAILED and does not throw", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("CREATE_TASK", { title: "Task" })]);
        mockTx.task.create.mockRejectedValue(new Error("DB down"));
        prisma.$transaction.mockImplementation(async (fn) => { await fn(mockTx); });
        await expect(fireStageChanged()).resolves.not.toThrow();
        const logCall = prisma.automationLog.create.mock.calls[0][0].data;
        expect(logCall.status).toBe("FAILED");
    });
});

// ── department actions ────────────────────────────────────────────────────────

describe("department actions", () => {
    beforeEach(() => {
        mockTx.lead.findUnique.mockResolvedValue(makeLead());
        mockTx.leadDepartment.findUnique.mockResolvedValue(makeLeadDept());
    });

    test("CHANGE_STAGE updates the service stage and logs activity", async () => {
        mockTx.leadDepartment.update.mockResolvedValue(makeLeadDept({ stage: "UNIVERSITY_SHORTLISTING" }));
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES", stage: "PROSPECT" }, actions: [{ type: "CHANGE_STAGE", config: { stage: "UNIVERSITY_SHORTLISTING" }, order: 0 }] }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "PROSPECT" }));
        expect(mockTx.leadDepartment.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { stage: "UNIVERSITY_SHORTLISTING" } })
        );
        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.details.results[0]).toMatchObject({ action: "CHANGE_STAGE", stage: "UNIVERSITY_SHORTLISTING" });
    });

    test("CHANGE_STAGE skips when target stage is invalid for the department", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            makeRule({ triggerConfig: { department: "SALES" }, actions: [{ type: "CHANGE_STAGE", config: { stage: "NOT_A_STAGE" }, order: 0 }] }),
        ]);
        await fireStageChanged(makeLeadDept({ department: "SALES", stage: "PROSPECT" }));
        expect(mockTx.leadDepartment.update).not.toHaveBeenCalled();
        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.details.results[0]).toMatchObject({ action: "CHANGE_STAGE", skipped: true });
    });

    test("ASSIGN_CONSULTANT sets the service consultant", async () => {
        mockTx.leadDepartment.update.mockResolvedValue(makeLeadDept({ assignedEmployeeId: "emp-7" }));
        const rule = makeRule({ triggerConfig: { department: "SALES" }, actions: [{ type: "ASSIGN_CONSULTANT", config: { userId: "emp-7" }, order: 0 }] });
        // Only the initial STAGE_CHANGED matches; the chained ASSIGNED event (fired
        // via setImmediate) finds no rules, so it doesn't recurse past the test.
        prisma.automationRule.findMany.mockImplementation(({ where }) =>
            Promise.resolve(where.triggerType === "STAGE_CHANGED" ? [rule] : [])
        );
        await fireStageChanged();
        expect(mockTx.leadDepartment.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ assignedEmployeeId: "emp-7" }) })
        );
    });
});
