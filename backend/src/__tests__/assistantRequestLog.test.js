/**
 * Tests that handleChat writes one AssistantRequestLog row per request, with
 * the right status and primaryTool. We mock everything below assistantService:
 *  - the LLM provider (so we control toolCalls / errors / usage)
 *  - prisma (so we capture log writes without touching a DB)
 *  - contextManager + permissionGuard + toolRegistry (so handleChat doesn't
 *    drift off into unrelated codepaths)
 */

jest.mock("../utils/prisma", () => ({
    assistantRequestLog: { create: jest.fn().mockResolvedValue({}) },
    user:                { findUnique: jest.fn().mockResolvedValue({ name: "Test User" }) },
}));

jest.mock("../assistant/providers", () => ({
    getProvider: jest.fn(),
}));

jest.mock("../assistant/contextManager", () => ({
    getSession: jest.fn().mockResolvedValue([]),
    addTurn:    jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../assistant/permissionGuard", () => ({
    getAllowedToolNames: jest.fn().mockReturnValue([]),
    isToolAllowed:       jest.fn().mockReturnValue(true),
    auditLog:            jest.fn(),
}));

jest.mock("../assistant/toolRegistry", () => ({
    getToolDefinitions: jest.fn().mockReturnValue([]),
    executeTool:        jest.fn(),
}));

jest.mock("../assistant/prompts/system", () => ({
    buildSystemPrompt: jest.fn().mockReturnValue("system"),
}));

const prisma                 = require("../utils/prisma");
const { getProvider }        = require("../assistant/providers");
const { handleChat }         = require("../assistant/assistantService");

const flushPromises = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
    jest.clearAllMocks();
});

describe("assistantService — request log writes", () => {
    test("writes one SUCCESS row when the LLM answers without tool calls", async () => {
        getProvider.mockReturnValue({
            chat: jest.fn().mockResolvedValue({
                reply:     "hello",
                toolCalls: [],
                usage:     { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }),
            normalizeError: jest.fn(),
        });

        const result = await handleChat({
            userId: "u-1", role: "EMPLOYEE", message: "hi", inputMode: "chat",
        });

        // Log writes are fire-and-forget; let the microtask queue drain.
        await flushPromises();

        expect(result.reply).toBe("hello");
        expect(prisma.assistantRequestLog.create).toHaveBeenCalledTimes(1);
        const data = prisma.assistantRequestLog.create.mock.calls[0][0].data;
        expect(data.userId).toBe("u-1");
        expect(data.status).toBe("SUCCESS");
        expect(data.totalTokens).toBe(15);
        expect(data.primaryTool).toBeNull();
        expect(data.inputMode).toBe("chat");
        expect(typeof data.latencyMs).toBe("number");
    });

    test("captures the FIRST tool name as primaryTool", async () => {
        // First LLM call returns a tool request; second call returns a plain reply.
        const chat = jest.fn()
            .mockResolvedValueOnce({
                reply:     "",
                toolCalls: [{ id: "t1", name: "leads.search", arguments: {} }],
                usage:     { totalTokens: 20 },
            })
            .mockResolvedValueOnce({
                reply:     "done",
                toolCalls: [],
                usage:     { totalTokens: 5 },
            });
        getProvider.mockReturnValue({ chat, normalizeError: jest.fn() });
        const { executeTool } = require("../assistant/toolRegistry");
        executeTool.mockResolvedValue({ ok: true });

        await handleChat({ userId: "u-2", role: "EMPLOYEE", message: "find lead X" });
        await flushPromises();

        const data = prisma.assistantRequestLog.create.mock.calls[0][0].data;
        expect(data.status).toBe("SUCCESS");
        expect(data.primaryTool).toBe("leads.search");
        expect(data.totalTokens).toBe(25);
    });

    test("writes a single ERROR row when the provider blows up", async () => {
        const providerErr = new Error("boom");
        getProvider.mockReturnValue({
            chat: jest.fn().mockRejectedValue(providerErr),
            normalizeError: jest.fn().mockReturnValue({ type: "TIMEOUT", message: "timeout" }),
        });

        await expect(
            handleChat({ userId: "u-3", role: "EMPLOYEE", message: "hi" }),
        ).rejects.toThrow("timeout");

        await flushPromises();

        expect(prisma.assistantRequestLog.create).toHaveBeenCalledTimes(1);
        const data = prisma.assistantRequestLog.create.mock.calls[0][0].data;
        expect(data.status).toBe("ERROR");
        expect(data.userId).toBe("u-3");
    });

    test("voice inputMode is preserved into the log row", async () => {
        getProvider.mockReturnValue({
            chat: jest.fn().mockResolvedValue({
                reply: "ok", toolCalls: [], usage: { totalTokens: 1 },
            }),
            normalizeError: jest.fn(),
        });

        await handleChat({ userId: "u-4", role: "EMPLOYEE", message: "hi", inputMode: "voice" });
        await flushPromises();

        expect(prisma.assistantRequestLog.create.mock.calls[0][0].data.inputMode).toBe("voice");
    });
});
