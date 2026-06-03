/**
 * Tests for the assistant settings TTL cache.
 * Strategy: mock prisma.companySettings.findFirst so we control DB responses,
 * and verify the cache reads once per TTL window and invalidates on call.
 */

jest.mock("../utils/prisma", () => ({
    companySettings: { findFirst: jest.fn() },
}));

// Re-require both modules after resetModules so they share the same mocked prisma.
const loadFresh = () => {
    jest.resetModules();
    jest.doMock("../utils/prisma", () => ({
        companySettings: { findFirst: jest.fn() },
    }));
    const prisma = require("../utils/prisma");
    const cache  = require("../assistant/settingsCache");
    return { prisma, cache };
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe("assistant settingsCache", () => {
    test("first read hits the DB and returns DB values", async () => {
        const { prisma, cache } = loadFresh();
        prisma.companySettings.findFirst.mockResolvedValue({
            assistantEnabled:         false,
            assistantRateLimitPerMin: 100,
            assistantMaxHistoryTurns: 10,
        });

        const out = await cache.getAssistantSettings();

        expect(prisma.companySettings.findFirst).toHaveBeenCalledTimes(1);
        expect(out).toEqual({ enabled: false, rateLimit: 100, maxHistoryTurns: 10 });
    });

    test("second read within TTL does not hit the DB", async () => {
        const { prisma, cache } = loadFresh();
        prisma.companySettings.findFirst.mockResolvedValue({
            assistantEnabled:         true,
            assistantRateLimitPerMin: 30,
            assistantMaxHistoryTurns: 6,
        });

        await cache.getAssistantSettings();
        await cache.getAssistantSettings();
        await cache.getAssistantSettings();

        expect(prisma.companySettings.findFirst).toHaveBeenCalledTimes(1);
    });

    test("invalidate forces the next read to hit the DB", async () => {
        const { prisma, cache } = loadFresh();
        prisma.companySettings.findFirst.mockResolvedValue({
            assistantEnabled:         true,
            assistantRateLimitPerMin: 30,
            assistantMaxHistoryTurns: 6,
        });

        await cache.getAssistantSettings();
        cache.invalidateAssistantSettings();
        await cache.getAssistantSettings();

        expect(prisma.companySettings.findFirst).toHaveBeenCalledTimes(2);
    });

    test("falls back to env defaults if the DB query throws", async () => {
        const { prisma, cache } = loadFresh();
        prisma.companySettings.findFirst.mockRejectedValue(new Error("DB down"));

        const out = await cache.getAssistantSettings();

        expect(out.enabled).toBe(true);
        expect(out.rateLimit).toBeGreaterThan(0);
        expect(out.maxHistoryTurns).toBeGreaterThanOrEqual(0);
    });
});
