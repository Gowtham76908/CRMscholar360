const prisma = require("../utils/prisma");
const { ApiError } = require("../utils/apiError");
const { istDateKey } = require("../utils/istTime");

// Helper to filter by date range
function dateRange(period, from, to) {
    if (period === "custom" && from && to) {
        return { gte: new Date(from), lte: new Date(to + "T23:59:59Z") };
    }
    const start = new Date();
    switch (period) {
        case "today":
            start.setHours(0, 0, 0, 0);
            return { gte: start };
        case "yesterday": {
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            return { gte: start, lte: end };
        }
        case "7d":
            start.setDate(start.getDate() - 7);
            return { gte: start };
        case "month":
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            return { gte: start };
        default: // 30d
            start.setDate(start.getDate() - 30);
            return { gte: start };
    }
}

// Assert SUPER_ADMIN access
const assertSuperAdmin = (req) => {
    if (req.user?.role !== "SUPER_ADMIN") {
        throw new ApiError(403, "Access denied. Super Admin only.");
    }
};

const getExpenses = async (req, res, next) => {
    try {
        assertSuperAdmin(req);
        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const expenses = await prisma.expense.findMany({
            where: { date: dr },
            orderBy: { date: "desc" },
            include: { createdBy: { select: { id: true, name: true } } },
        });

        res.json(expenses);
    } catch (err) {
        next(err);
    }
};

const createExpense = async (req, res, next) => {
    try {
        assertSuperAdmin(req);
        const { title, amount, category, date, description } = req.body;
        if (!title || !amount || !category) {
            throw new ApiError(400, "Title, amount, and category are required.");
        }

        const expense = await prisma.expense.create({
            data: {
                title,
                amount: parseFloat(amount),
                category,
                date: date ? new Date(date) : new Date(),
                description,
                createdById: req.user.userId,
            },
            include: { createdBy: { select: { id: true, name: true } } },
        });

        res.status(201).json(expense);
    } catch (err) {
        next(err);
    }
};

const deleteExpense = async (req, res, next) => {
    try {
        assertSuperAdmin(req);
        const { id } = req.params;

        const expense = await prisma.expense.findUnique({ where: { id } });
        if (!expense) throw new ApiError(404, "Expense not found.");

        await prisma.expense.delete({ where: { id } });
        res.json({ message: "Expense deleted successfully" });
    } catch (err) {
        next(err);
    }
};

const getTrackerSummary = async (req, res, next) => {
    try {
        assertSuperAdmin(req);
        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        // Fetch income (Credit Payments)
        const payments = await prisma.paymentEntry.findMany({
            where: { type: "CREDIT", paymentDate: dr },
            select: {
                id: true,
                amount: true,
                paymentDate: true,
                description: true,
                invoice: {
                    select: {
                        invoiceNumber: true,
                        clientName: true,
                    }
                }
            }
        });

        // Fetch manual expenses
        const expenses = await prisma.expense.findMany({
            where: { date: dr },
            select: {
                id: true,
                title: true,
                amount: true,
                category: true,
                date: true,
                description: true,
            }
        });

        const totalIncome = payments.reduce((s, p) => s + p.amount, 0);
        const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
        const netProfit = totalIncome - totalExpense;

        // Build chronological list of transactions (combining payments and expenses)
        const transactions = [
            ...payments.map(p => ({
                id: p.id,
                type: "INCOME",
                title: p.invoice ? `Invoice ${p.invoice.invoiceNumber} (${p.invoice.clientName})` : "General Income",
                amount: p.amount,
                category: "Invoice Payment",
                date: p.paymentDate,
                description: p.description || "",
            })),
            ...expenses.map(e => ({
                id: e.id,
                type: "EXPENSE",
                title: e.title,
                amount: e.amount,
                category: e.category,
                date: e.date,
                description: e.description || "",
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Group by day for trends
        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = istDateKey(d);
            dayMap[key] = { date: key, income: 0, expense: 0 };
        }
        for (const p of payments) {
            const key = istDateKey(p.paymentDate);
            if (dayMap[key]) dayMap[key].income += p.amount;
        }
        for (const e of expenses) {
            const key = istDateKey(e.date);
            if (dayMap[key]) dayMap[key].expense += e.amount;
        }

        const trend = Object.values(dayMap);

        res.json({
            totalIncome: parseFloat(totalIncome.toFixed(2)),
            totalExpense: parseFloat(totalExpense.toFixed(2)),
            netProfit: parseFloat(netProfit.toFixed(2)),
            transactions,
            trend,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getExpenses,
    createExpense,
    deleteExpense,
    getTrackerSummary,
};
