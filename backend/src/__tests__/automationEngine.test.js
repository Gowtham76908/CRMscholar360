/**
 * Tests for automationEngine
 *
 * Tests:
 *  - matchesCondition / matchesAllConditions (pure — no DB)
 *  - checkConstraints (mocked prisma — constraint logic)
 *  - runRulesForLead (mocked prisma — rule execution, depth limit, condition gate)
 *  - executeAction guard cases (skips when lead missing required fields)
 */

const mockTx = {
    lead: { update: jest.fn(), findUnique: jest.fn() },
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
    task: { create: jest.fn() },
    reminder: { create: jest.fn() },
    notification: { create: jest.fn() },
    whatsAppMessage: { create: jest.fn() },
    activity: { create: jest.fn() },
}));

jest.mock("../utils/activityLogger", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../services/whatsappService", () => ({
    sendTemplateMessage: jest.fn().mockResolvedValue({ status: "sent", watiMessageId: "w1", raw: {} }),
}));
jest.mock("../services/emailService", () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/normalizePhone", () => jest.fn((p) => p || null));

const prisma = require("../utils/prisma");
const { runRulesForLead } = require("../services/automationEngine");

// mockTx is declared before jest.mock so it's accessible here via module scope
// (the factory closure captures it).
// Helper: "did the rule fire?" = automationLog.create called inside the transaction
function expectRuleFired(times = 1) {
    expect(mockTx.automationLog.create).toHaveBeenCalledTimes(times);
}
function expectRuleNotFired() {
    expect(mockTx.automationLog.create).not.toHaveBeenCalled();
    expect(prisma.automationLog.create).not.toHaveBeenCalled();
}

beforeEach(() => {
    jest.clearAllMocks();
    // Restore $transaction to use fresh mockTx each test
    prisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
    mockTx.automationLog.create.mockResolvedValue({});
    mockTx.lead.findUnique.mockResolvedValue(null);
    mockTx.task.create.mockResolvedValue({});
    mockTx.reminder.create.mockResolvedValue({});
    mockTx.notification.create.mockResolvedValue({});
    mockTx.whatsAppMessage.create.mockResolvedValue({});
    mockTx.activity.create.mockResolvedValue({});
    // Default: no rules, no logs
    prisma.automationRule.findMany.mockResolvedValue([]);
    prisma.automationLog.findFirst.mockResolvedValue(null);
    prisma.automationLog.count.mockResolvedValue(0);
    prisma.automationLog.create.mockResolvedValue({});
    prisma.lead.findUnique.mockResolvedValue(null);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRule(overrides = {}) {
    return {
        id: "rule-1",
        triggerType: "STATUS_CHANGED",
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
        status: "NEW",
        source: "FACEBOOK",
        assignedToId: "emp-1",
        phone: "+919876543210",
        email: "test@example.com",
        enquiryType: "PRODUCT",
        ...overrides,
    };
}

// ── matchesCondition (tested via runRulesForLead) ─────────────────────────────

describe("condition matching", () => {
    test("rule with matching 'equals' condition fires", async () => {
        const rule = makeRule({
            conditions: [{ field: "status", operator: "equals", value: "NEW" }],
            actions: [],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead({ status: "NEW" }));

        expectRuleFired(1);
    });

    test("rule with non-matching 'equals' condition does NOT fire", async () => {
        const rule = makeRule({
            conditions: [{ field: "status", operator: "equals", value: "CONVERTED" }],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead({ status: "NEW" }));

        expectRuleNotFired();
    });

    test("'not_equals' condition passes when field differs", async () => {
        const rule = makeRule({
            conditions: [{ field: "source", operator: "not_equals", value: "INSTAGRAM" }],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead({ source: "FACEBOOK" }));

        expectRuleFired(1);
    });

    test("'is_empty' condition passes when field is null", async () => {
        const rule = makeRule({
            conditions: [{ field: "assignedTo", operator: "is_empty" }],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead({ assignedToId: null }));

        expectRuleFired(1);
    });

    test("'is_not_empty' condition fails when field is null", async () => {
        const rule = makeRule({
            conditions: [{ field: "assignedTo", operator: "is_not_empty" }],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead({ assignedToId: null }));

        expectRuleNotFired();
    });

    test("unknown operator returns false → rule does not fire", async () => {
        const rule = makeRule({
            conditions: [{ field: "status", operator: "regex_match", value: ".*" }],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead());

        expectRuleNotFired();
    });

    test("multiple conditions: ALL must pass", async () => {
        const rule = makeRule({
            conditions: [
                { field: "status", operator: "equals", value: "NEW" },
                { field: "source", operator: "equals", value: "INSTAGRAM" }, // won't match
            ],
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        await runRulesForLead("STATUS_CHANGED", makeLead({ status: "NEW", source: "FACEBOOK" }));

        expectRuleNotFired();
    });
});

// ── checkConstraints ──────────────────────────────────────────────────────────

describe("constraint: COOLDOWN", () => {
    test("blocks rule when recent SUCCESS log exists within cooldown window", async () => {
        const rule = makeRule({
            triggerConfig: { constraints: [{ type: "COOLDOWN", hours: 24 }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);
        prisma.automationLog.findFirst.mockResolvedValue({ id: "log-1" }); // recent log exists

        await runRulesForLead("STATUS_CHANGED", makeLead());

        expectRuleNotFired();
    });

    test("allows rule when no recent SUCCESS log exists", async () => {
        const rule = makeRule({
            triggerConfig: { constraints: [{ type: "COOLDOWN", hours: 24 }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);
        prisma.automationLog.findFirst.mockResolvedValue(null); // no recent log

        await runRulesForLead("STATUS_CHANGED", makeLead());

        expectRuleFired(1);
    });
});

describe("constraint: MAX_EXECUTIONS_PER_DAY", () => {
    test("blocks when daily execution count meets the max", async () => {
        const rule = makeRule({
            triggerConfig: { constraints: [{ type: "MAX_EXECUTIONS_PER_DAY", max: 2 }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);
        prisma.automationLog.count.mockResolvedValue(2); // already ran twice

        await runRulesForLead("STATUS_CHANGED", makeLead());

        expectRuleNotFired();
    });

    test("allows when daily execution count is below max", async () => {
        const rule = makeRule({
            triggerConfig: { constraints: [{ type: "MAX_EXECUTIONS_PER_DAY", max: 3 }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);
        prisma.automationLog.count.mockResolvedValue(1); // ran once

        await runRulesForLead("STATUS_CHANGED", makeLead());

        expectRuleFired(1);
    });
});

describe("constraint: PREVENT_RECURSIVE_TRIGGERS", () => {
    test("blocks when current rule ID is already in ruleChain context", async () => {
        const rule = makeRule({
            id: "rule-A",
            triggerConfig: { constraints: [{ type: "PREVENT_RECURSIVE_TRIGGERS" }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        const childCtx = { chainId: "chain-1", triggerDepth: 1, ruleChain: ["rule-A"] };
        await runRulesForLead("STATUS_CHANGED", makeLead(), childCtx);

        expectRuleNotFired();
    });

    test("allows when rule ID is NOT in ruleChain", async () => {
        const rule = makeRule({
            id: "rule-B",
            triggerConfig: { constraints: [{ type: "PREVENT_RECURSIVE_TRIGGERS" }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        const childCtx = { chainId: "chain-1", triggerDepth: 1, ruleChain: ["rule-A"] }; // rule-B not in chain
        await runRulesForLead("STATUS_CHANGED", makeLead(), childCtx);

        expectRuleFired(1);
    });
});

describe("constraint: PREVENT_DUPLICATES", () => {
    test("blocks if any prior SUCCESS log exists for this rule+lead", async () => {
        const rule = makeRule({
            triggerConfig: { constraints: [{ type: "PREVENT_DUPLICATES" }] },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);
        prisma.automationLog.findFirst.mockResolvedValue({ id: "old-log" });

        await runRulesForLead("STATUS_CHANGED", makeLead());

        expectRuleNotFired();
    });
});

// ── Depth limit ───────────────────────────────────────────────────────────────

describe("runRulesForLead — depth limit", () => {
    test("aborts silently when triggerDepth > MAX_TRIGGER_DEPTH (3)", async () => {
        const deepCtx = { chainId: "c1", triggerDepth: 4, ruleChain: [] };
        await runRulesForLead("STATUS_CHANGED", makeLead(), deepCtx);

        // Should not even query rules
        expect(prisma.automationRule.findMany).not.toHaveBeenCalled();
        expectRuleNotFired();
    });

    test("executes normally at depth = MAX_TRIGGER_DEPTH (3)", async () => {
        const rule = makeRule();
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        const ctx = { chainId: "c1", triggerDepth: 3, ruleChain: [] };
        await runRulesForLead("STATUS_CHANGED", makeLead(), ctx);

        expectRuleFired(1);
    });
});

// ── STATUS_CHANGED trigger config filter ─────────────────────────────────────

describe("runRulesForLead — STATUS_CHANGED trigger config", () => {
    test("rule with triggerConfig.status skips when newStatus doesn't match", async () => {
        const rule = makeRule({
            triggerType: "STATUS_CHANGED",
            triggerConfig: { status: "CONVERTED" }, // only fires for CONVERTED
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        const ctx = { chainId: "c", triggerDepth: 0, ruleChain: [], newStatus: "NEW" };
        await runRulesForLead("STATUS_CHANGED", makeLead(), ctx);

        expectRuleNotFired();
    });

    test("rule with triggerConfig.status fires when newStatus matches", async () => {
        const rule = makeRule({
            triggerType: "STATUS_CHANGED",
            triggerConfig: { status: "CONVERTED" },
        });
        prisma.automationRule.findMany.mockResolvedValue([rule]);

        const ctx = { chainId: "c", triggerDepth: 0, ruleChain: [], newStatus: "CONVERTED" };
        await runRulesForLead("STATUS_CHANGED", makeLead(), ctx);

        expectRuleFired(1);
    });
});

// ── executeAction guard cases ─────────────────────────────────────────────────

describe("executeAction — guard cases via runRulesForLead", () => {
    function ruleWithAction(type, config = {}) {
        return makeRule({
            actions: [{ type, config, order: 0 }],
        });
    }

    // After each action, the engine re-fetches the lead via tx.lead.findUnique.
    beforeEach(() => {
        mockTx.lead.findUnique.mockResolvedValue(makeLead());
    });

    test("SEND_EMAIL skips and does NOT throw when lead has no email", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("SEND_EMAIL", { subject: "Hi" })]);
        const lead = makeLead({ email: null });
        mockTx.lead.findUnique.mockResolvedValue(lead);

        await runRulesForLead("STATUS_CHANGED", lead);

        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.status).toBe("SUCCESS");
        expect(logCall.details.results[0]).toMatchObject({ skipped: true, reason: "no_email" });
    });

    test("SEND_WHATSAPP skips when lead has no phone", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("SEND_WHATSAPP", { templateName: "welcome" })]);
        const lead = makeLead({ phone: null });
        mockTx.lead.findUnique.mockResolvedValue(lead);

        await runRulesForLead("STATUS_CHANGED", lead);

        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.details.results[0]).toMatchObject({ skipped: true, reason: "no_phone" });
    });

    test("CREATE_REMINDER skips when lead has no assignee", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("CREATE_REMINDER", { message: "Follow up" })]);
        const lead = makeLead({ assignedToId: null });
        mockTx.lead.findUnique.mockResolvedValue(lead);

        await runRulesForLead("STATUS_CHANGED", lead);

        const logCall = mockTx.automationLog.create.mock.calls[0][0].data;
        expect(logCall.details.results[0]).toMatchObject({ skipped: true, reason: "no_assignee" });
    });

    test("CREATE_TASK creates task with due date = now + dueDaysFromNow", async () => {
        prisma.automationRule.findMany.mockResolvedValue([
            ruleWithAction("CREATE_TASK", { title: "Follow up call", dueDaysFromNow: 2, priority: "HIGH" }),
        ]);

        const before = Date.now();
        await runRulesForLead("STATUS_CHANGED", makeLead());

        expect(mockTx.task.create).toHaveBeenCalledTimes(1);
        const taskData = mockTx.task.create.mock.calls[0][0].data;
        expect(taskData.title).toBe("Follow up call");
        expect(taskData.priority).toBe("HIGH");
        expect(taskData.dueDate.getTime()).toBeGreaterThanOrEqual(before + 2 * 86_400_000 - 1000);
    });

    test("action failure marks log as FAILED but does not throw", async () => {
        prisma.automationRule.findMany.mockResolvedValue([ruleWithAction("CREATE_TASK", { title: "Task" })]);
        mockTx.task.create.mockRejectedValue(new Error("DB down"));
        // $transaction rejects → outer catch writes FAILED log via prisma (not tx)
        prisma.$transaction.mockImplementation(async (fn) => { await fn(mockTx); });

        await expect(runRulesForLead("STATUS_CHANGED", makeLead())).resolves.not.toThrow();

        const logCall = prisma.automationLog.create.mock.calls[0][0].data;
        expect(logCall.status).toBe("FAILED");
    });
});
