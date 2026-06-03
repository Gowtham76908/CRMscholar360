/**
 * Tests for invoiceController
 *
 * Pure helpers (computeInvoiceTotals, getPaymentSummary) are tested directly.
 * Controller functions are tested with mock req/res objects and a mocked prisma.
 */

jest.mock("../utils/prisma", () => ({
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
    },
    invoiceItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    paymentEntry: {
        create: jest.fn(),
        delete: jest.fn(),
    },
    deal: { findUnique: jest.fn() },
    companySettings: { findFirst: jest.fn() },
}));

jest.mock("../services/emailService", () => ({
    sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/activityLogger", () => jest.fn().mockResolvedValue(undefined));

const prisma = require("../utils/prisma");
const {
    computeInvoiceTotals,
    createInvoice,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    addPayment,
    deletePayment,
} = require("../controllers/invoiceController");

// ── Test helpers ──────────────────────────────────────────────────────────────

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function makeReq(overrides = {}) {
    return {
        user: { userId: "user-1", role: "SUPER_ADMIN" },
        params: {},
        query: {},
        body: {},
        ...overrides,
    };
}

// Mimics the global error handler in app.js so controllers that throw ApiError
// can be exercised in isolation. Flattens code+message to top-level so the
// test assertions can use `expect.objectContaining({ message })`.
function makeNext(res) {
    return (err) => {
        if (!err) return;
        const status = err.status || 500;
        res.status(status).json({ code: err.code, message: err.message });
    };
}

// Convenience wrapper: invokes a controller with auto-wired next.
const invoke = (controller, req, res) => controller(req, res, makeNext(res));

beforeEach(() => jest.clearAllMocks());

// ── computeInvoiceTotals ──────────────────────────────────────────────────────

describe("computeInvoiceTotals", () => {
    test("single item, no tax", () => {
        const result = computeInvoiceTotals([{ description: "Widget", price: 100, quantity: 2, taxRate: 0 }]);
        expect(result.subtotal).toBe(200);
        expect(result.cgst).toBe(0);
        expect(result.sgst).toBe(0);
        expect(result.total).toBe(200);
        expect(result.processedItems).toHaveLength(1);
    });

    test("single item with 18% GST: tax = 18, CGST = SGST = 9, total = 118", () => {
        const result = computeInvoiceTotals([{ description: "Service", price: 100, quantity: 1, taxRate: 18 }]);
        expect(result.subtotal).toBe(100);
        expect(result.cgst).toBe(9);
        expect(result.sgst).toBe(9);
        expect(result.total).toBe(118);
    });

    test("IGST is always 0 (intrastate only model)", () => {
        const result = computeInvoiceTotals([{ price: 500, quantity: 1, taxRate: 12 }]);
        expect(result.igst).toBe(0);
    });

    test("multiple items accumulate correctly", () => {
        const result = computeInvoiceTotals([
            { price: 100, quantity: 1, taxRate: 0 },
            { price: 200, quantity: 2, taxRate: 10 },
        ]);
        // subtotal = 100 + 400 = 500; tax = 0 + 40 = 40; total = 540
        expect(result.subtotal).toBe(500);
        expect(result.total).toBe(540);
    });

    test("floating point amounts are rounded to 2 decimal places", () => {
        const result = computeInvoiceTotals([{ price: 99.99, quantity: 3, taxRate: 18 }]);
        // taxableValue = 299.97, tax = 53.99 (rounded), total = 353.96
        expect(result.subtotal).toBe(parseFloat((99.99 * 3).toFixed(2)));
        expect(Number.isInteger(result.total * 100)).toBe(true); // max 2 decimal places
    });

    test("missing quantity defaults to 1", () => {
        const result = computeInvoiceTotals([{ price: 50, taxRate: 0 }]);
        expect(result.subtotal).toBe(50);
    });

    test("missing price defaults to 0", () => {
        const result = computeInvoiceTotals([{ quantity: 5, taxRate: 0 }]);
        expect(result.subtotal).toBe(0);
        expect(result.total).toBe(0);
    });

    test("empty items array returns all zeros", () => {
        const result = computeInvoiceTotals([]);
        expect(result.subtotal).toBe(0);
        expect(result.total).toBe(0);
        expect(result.processedItems).toHaveLength(0);
    });
});

// ── createInvoice — input validation ─────────────────────────────────────────

describe("createInvoice — validation", () => {
    test("returns 400 when clientName is missing", async () => {
        const req = makeReq({ body: { items: [{ price: 100, quantity: 1, taxRate: 0 }] } });
        const res = mockRes();
        await invoke(createInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Client name is required" }));
    });

    test("returns 400 when items array is empty", async () => {
        const req = makeReq({ body: { clientName: "Acme Corp", items: [] } });
        const res = mockRes();
        await invoke(createInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "At least one item is required" }));
    });

    test("returns 400 when items is not provided", async () => {
        const req = makeReq({ body: { clientName: "Acme Corp" } });
        const res = mockRes();
        await invoke(createInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("creates invoice and returns 201 on valid input", async () => {
        const mockInvoice = {
            id: "inv-1", invoiceNumber: "HXZ-1", total: 118,
            items: [], payments: [], createdBy: { id: "user-1", name: "Admin" },
            dealId: null,
        };
        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.companySettings.findFirst.mockResolvedValue({ shortName: "HXZ" });
        prisma.$queryRaw = jest.fn().mockResolvedValue([{ currentValue: 1 }]);
        prisma.invoice.create.mockResolvedValue(mockInvoice);

        const req = makeReq({
            body: {
                clientName: "Acme Corp",
                items: [{ description: "Service", price: 100, quantity: 1, taxRate: 18 }],
            },
        });
        const res = mockRes();
        await invoke(createInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(mockInvoice);
    });
});

// ── getInvoice ────────────────────────────────────────────────────────────────

describe("getInvoice", () => {
    test("returns 404 when invoice not found or soft-deleted", async () => {
        prisma.invoice.findFirst.mockResolvedValue(null);
        const req = makeReq({ params: { id: "inv-missing" } });
        const res = mockRes();
        await invoke(getInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns invoice with totalPaid and balance attached", async () => {
        prisma.invoice.findFirst.mockResolvedValue({
            id: "inv-1", total: 500, payments: [
                { type: "CREDIT", amount: 200 },
                { type: "CREDIT", amount: 100 },
            ],
        });
        const req = makeReq({ params: { id: "inv-1" } });
        const res = mockRes();
        await invoke(getInvoice, req, res);
        const data = res.json.mock.calls[0][0];
        expect(data.totalPaid).toBe(300);
        expect(data.balance).toBe(200);
    });
});

// ── updateInvoice — guards ─────────────────────────────────────────────────────

describe("updateInvoice — guards", () => {
    test("returns 404 when invoice does not exist", async () => {
        prisma.invoice.findUnique.mockResolvedValue(null);
        const req = makeReq({ params: { id: "inv-gone" }, body: {} });
        const res = mockRes();
        await invoke(updateInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 400 when trying to edit a PAID invoice", async () => {
        prisma.invoice.findUnique.mockResolvedValue({ id: "inv-1", status: "PAID" });
        const req = makeReq({ params: { id: "inv-1" }, body: { clientName: "New Name" } });
        const res = mockRes();
        await invoke(updateInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Cannot edit a paid invoice" }));
    });
});

// ── deleteInvoice ─────────────────────────────────────────────────────────────

describe("deleteInvoice", () => {
    test("returns 404 when invoice not found", async () => {
        prisma.invoice.findUnique.mockResolvedValue(null);
        const req = makeReq({ params: { id: "inv-none" } });
        const res = mockRes();
        await invoke(deleteInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 409 when trying to delete a PAID invoice", async () => {
        prisma.invoice.findUnique.mockResolvedValue({ id: "inv-1", status: "PAID" });
        const req = makeReq({ params: { id: "inv-1" } });
        const res = mockRes();
        await invoke(deleteInvoice, req, res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Paid invoices") }));
    });

    test("soft-deletes unpaid invoice (sets deletedAt)", async () => {
        prisma.invoice.findUnique.mockResolvedValue({ id: "inv-1", status: "SENT" });
        prisma.invoice.update.mockResolvedValue({});
        const req = makeReq({ params: { id: "inv-1" } });
        const res = mockRes();
        await invoke(deleteInvoice, req, res);
        expect(prisma.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("deleted") }));
    });
});

// ── addPayment ────────────────────────────────────────────────────────────────

describe("addPayment", () => {
    test("returns 400 when amount is missing", async () => {
        const req = makeReq({ params: { id: "inv-1" }, body: {} });
        const res = mockRes();
        await invoke(addPayment, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 when amount is zero", async () => {
        const req = makeReq({ params: { id: "inv-1" }, body: { amount: 0 } });
        const res = mockRes();
        await invoke(addPayment, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 when amount is negative", async () => {
        const req = makeReq({ params: { id: "inv-1" }, body: { amount: -50 } });
        const res = mockRes();
        await invoke(addPayment, req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 404 when invoice not found", async () => {
        prisma.invoice.findUnique.mockResolvedValue(null);
        const req = makeReq({ params: { id: "inv-none" }, body: { amount: 100 } });
        const res = mockRes();
        await invoke(addPayment, req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("marks invoice PAID when totalPaid >= total", async () => {
        const mockInvoice = { id: "inv-1", total: 500, payments: [{ type: "CREDIT", amount: 400 }], dealId: null };
        prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
        prisma.paymentEntry.create.mockResolvedValue({ id: "pay-1", type: "CREDIT", amount: 100 });
        prisma.invoice.update.mockResolvedValue({});

        const req = makeReq({ params: { id: "inv-1" }, body: { amount: 100, type: "CREDIT" } });
        const res = mockRes();
        await invoke(addPayment, req, res);

        expect(prisma.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) })
        );
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.status).toBe("PAID");
        expect(responseData.totalPaid).toBe(500);
        expect(responseData.balance).toBe(0);
    });

    test("marks invoice PARTIALLY_PAID when 0 < totalPaid < total", async () => {
        const mockInvoice = { id: "inv-1", total: 500, payments: [], dealId: null };
        prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
        prisma.paymentEntry.create.mockResolvedValue({ id: "pay-1", type: "CREDIT", amount: 200 });
        prisma.invoice.update.mockResolvedValue({});

        const req = makeReq({ params: { id: "inv-1" }, body: { amount: 200, type: "CREDIT" } });
        const res = mockRes();
        await invoke(addPayment, req, res);

        expect(prisma.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "PARTIALLY_PAID" }) })
        );
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.status).toBe("PARTIALLY_PAID");
        expect(responseData.balance).toBe(300);
    });

    test("status remains unchanged when DEBIT is recorded (no credit sum change toward 0)", async () => {
        // A DEBIT alone: totalPaid (credit only) = 0, balance = total
        const mockInvoice = { id: "inv-1", total: 500, payments: [], status: "SENT", dealId: null };
        prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
        prisma.paymentEntry.create.mockResolvedValue({ id: "pay-1", type: "DEBIT", amount: 50 });
        prisma.invoice.update.mockResolvedValue({});

        const req = makeReq({ params: { id: "inv-1" }, body: { amount: 50, type: "DEBIT" } });
        const res = mockRes();
        await invoke(addPayment, req, res);

        // totalPaid (credits only) = 0, which is NOT >= 500 and NOT > 0
        const updateCall = prisma.invoice.update.mock.calls[0][0];
        expect(updateCall.data.status).toBe("SENT"); // unchanged
    });
});

// ── deletePayment — status recalculation ──────────────────────────────────────

describe("deletePayment — status recalculation", () => {
    test("recalculates to PAID if remaining payments still cover total", async () => {
        prisma.paymentEntry.delete.mockResolvedValue({});
        prisma.invoice.findUnique.mockResolvedValue({
            id: "inv-1",
            total: 300,
            status: "PAID",
            payments: [{ type: "CREDIT", amount: 300 }], // one large payment remains
        });
        prisma.invoice.update.mockResolvedValue({});

        const req = makeReq({ params: { id: "inv-1", paymentId: "pay-old" } });
        const res = mockRes();
        await invoke(deletePayment, req, res);

        expect(prisma.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) })
        );
    });

    test("recalculates to SENT when all payments removed", async () => {
        prisma.paymentEntry.delete.mockResolvedValue({});
        prisma.invoice.findUnique.mockResolvedValue({
            id: "inv-1", total: 300, status: "PAID", payments: [],
        });
        prisma.invoice.update.mockResolvedValue({});

        const req = makeReq({ params: { id: "inv-1", paymentId: "pay-last" } });
        const res = mockRes();
        await invoke(deletePayment, req, res);

        expect(prisma.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) })
        );
    });
});
