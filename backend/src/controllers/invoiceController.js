const prisma = require("../utils/prisma");
const { sendInvoiceEmail } = require("../services/emailService");
const logActivity = require("../utils/activityLogger");
const paginate = require("../utils/paginate");

// Resolve leadId from an invoice's dealId (if any), for timeline logging
async function getLeadIdFromInvoice(invoice) {
    if (!invoice.dealId) return null;
    const deal = await prisma.deal.findUnique({ where: { id: invoice.dealId }, select: { leadId: true } });
    return deal?.leadId ?? null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const computeInvoiceTotals = (items) => {
    let subtotal = 0;
    let totalTax = 0;
    const processedItems = items.map((item) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.price) || 0;
        const taxRate = parseFloat(item.taxRate) || 0;
        const taxableValue = parseFloat((price * qty).toFixed(2));
        const tax = parseFloat((taxableValue * taxRate / 100).toFixed(2));
        const amount = parseFloat((taxableValue + tax).toFixed(2));
        subtotal += taxableValue;
        totalTax += tax;
        return { description: item.description, price, quantity: qty, taxRate, taxableValue, amount };
    });
    subtotal = parseFloat(subtotal.toFixed(2));
    totalTax = parseFloat(totalTax.toFixed(2));
    // Intrastate: split total tax equally as CGST + SGST
    const cgst = parseFloat((totalTax / 2).toFixed(2));
    const sgst = parseFloat((totalTax / 2).toFixed(2));
    const total = parseFloat((subtotal + totalTax).toFixed(2));
    return { processedItems, subtotal, cgst, sgst, igst: 0, total };
};

const generateInvoiceNumber = async (type, tx) => {
    const settings = await tx.companySettings.findFirst();
    const base = settings?.shortName || "HXZ";
    const prefix = type === "PROFORMA" ? `${base}-PRO` : base;

    // Atomic increment inside a transaction so that if invoice creation later
    // fails the counter rolls back with it — guaranteeing no gaps.
    const rows = await tx.$queryRaw`
        INSERT INTO "InvoiceCounter" ("prefix", "currentValue")
        VALUES (${prefix}, 1)
        ON CONFLICT ("prefix") DO UPDATE
            SET "currentValue" = "InvoiceCounter"."currentValue" + 1
        RETURNING "currentValue"
    `;
    return `${prefix}-${rows[0].currentValue}`;
};

const getPaymentSummary = (payments) => {
    const totalPaid = payments
        .filter((p) => p.type === "CREDIT")
        .reduce((sum, p) => sum + p.amount, 0);
    const totalDebited = payments
        .filter((p) => p.type === "DEBIT")
        .reduce((sum, p) => sum + p.amount, 0);
    return { totalPaid, totalDebited };
};

// ─── Controllers ────────────────────────────────────────────────────────────

const createInvoice = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const {
            invoiceType = "PROFORMA",
            clientName,
            clientEmail,
            clientPhone,
            clientAddress,
            clientGstin,
            items = [],
            dueDate,
            notes,
            dealId,
        } = req.body;

        if (!clientName) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Client name is required");
        if (!items.length) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "At least one item is required");

        const { processedItems, subtotal, cgst, sgst, igst, total } = computeInvoiceTotals(items);

        const invoice = await prisma.$transaction(async (tx) => {
            const invoiceNumber = await generateInvoiceNumber(invoiceType, tx);
            return tx.invoice.create({
                data: {
                    invoiceNumber,
                    invoiceType,
                    clientName,
                    clientEmail,
                    clientPhone,
                    clientAddress,
                    clientGstin,
                    subtotal,
                    cgst,
                    sgst,
                    igst,
                    total,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    notes,
                    createdById: userId,
                    dealId: dealId ?? null,
                    items: { create: processedItems },
                },
                include: { items: true, payments: true, createdBy: { select: { id: true, name: true } } },
            });
        });

        if (invoice.dealId) {
            const leadId = await getLeadIdFromInvoice(invoice);
            if (leadId) {
                await logActivity({
                    leadId,
                    userId,
                    action: "INVOICE_CREATED",
                    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.total },
                });
            }
        }

        res.status(201).json(invoice);
    } catch (error) {
        return next(error);
    }
};

const getInvoices = async (req, res, next) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
        const { status, type, dealId } = req.query;

        const where = { deletedAt: null };
        if (status) where.status = status;
        if (type)   where.invoiceType = type;
        if (dealId) where.dealId = dealId;

        // items are not needed in the list view — only in detail view (getInvoice)
        const [total, invoices] = await prisma.$transaction([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                select: {
                    id: true,
                    invoiceNumber: true,
                    invoiceType: true,
                    clientName: true,
                    clientEmail: true,
                    clientPhone: true,
                    clientAddress: true,
                    clientGstin: true,
                    total: true,
                    status: true,
                    dueDate: true,
                    createdAt: true,
                    updatedAt: true,
                    dealId: true,
                    payments: {
                        select: { amount: true, type: true },
                        orderBy: { paymentDate: "desc" },
                    },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        const enriched = invoices.map((inv) => {
            const { totalPaid } = getPaymentSummary(inv.payments);
            return { ...inv, totalPaid: parseFloat(totalPaid.toFixed(2)), balance: parseFloat((inv.total - totalPaid).toFixed(2)) };
        });

        res.json(paginate(enriched, total, page, limit));
    } catch (error) {
        return next(error);
    }
};

const getInvoice = async (req, res, next) => {
    // Soft-deleted invoices are treated as not found for regular access
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: req.params.id, deletedAt: null },
            include: {
                items: true,
                payments: { orderBy: { paymentDate: "desc" } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        if (!invoice) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Invoice not found");

        const { totalPaid } = getPaymentSummary(invoice.payments);
        res.json({ ...invoice, totalPaid: parseFloat(totalPaid.toFixed(2)), balance: parseFloat((invoice.total - totalPaid).toFixed(2)) });
    } catch (error) {
        return next(error);
    }
};

const updateInvoice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            clientName, clientEmail, clientPhone, clientAddress, clientGstin,
            items, dueDate, notes, status, invoiceType,
        } = req.body;

        const existing = await prisma.invoice.findUnique({ where: { id } });
        if (!existing) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Invoice not found");
        if (existing.status === "PAID") throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Cannot edit a paid invoice");

        const updateData = { clientName, clientEmail, clientPhone, clientAddress, clientGstin, notes, status };
        if (dueDate) updateData.dueDate = new Date(dueDate);
        if (invoiceType) updateData.invoiceType = invoiceType;

        if (items && items.length > 0) {
            const { processedItems, subtotal, cgst, sgst, igst, total } = computeInvoiceTotals(items);
            updateData.subtotal = subtotal;
            updateData.cgst = cgst;
            updateData.sgst = sgst;
            updateData.igst = igst;
            updateData.total = total;
            await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
            await prisma.invoiceItem.createMany({ data: processedItems.map((i) => ({ ...i, invoiceId: id })) });
        }

        const invoice = await prisma.invoice.update({
            where: { id },
            data: updateData,
            include: { items: true, payments: true, createdBy: { select: { id: true, name: true } } },
        });

        if (invoice.dealId) {
            const leadId = await getLeadIdFromInvoice(invoice);
            if (leadId) {
                await logActivity({
                    leadId,
                    userId: req.user.userId,
                    action: "INVOICE_UPDATED",
                    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, changes: req.body },
                });
            }
        }

        res.json(invoice);
    } catch (error) {
        return next(error);
    }
};

const deleteInvoice = async (req, res, next) => {
    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id, deletedAt: null } });
        if (!invoice) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Invoice not found");
        if (invoice.status === "PAID") {
            throw new ApiError(409, ERROR_CODES.DUPLICATE_ENTRY, "Paid invoices cannot be deleted. Cancel it first.");
        }

        await prisma.invoice.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
        res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
        return next(error);
    }
};

const sendEmail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { recipientEmail } = req.body;

        if (!recipientEmail) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Recipient email is required");

        const [invoice, company] = await Promise.all([
            prisma.invoice.findUnique({ where: { id }, include: { items: true } }),
            prisma.companySettings.findFirst(),
        ]);
        if (!invoice) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Invoice not found");

        await sendInvoiceEmail({ to: recipientEmail, invoice, items: invoice.items, company });

        await prisma.invoice.update({
            where: { id },
            data: {
                emailSentAt: new Date(),
                emailSentTo: recipientEmail,
                status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
            },
        });

        res.json({ message: "Invoice sent successfully", sentTo: recipientEmail });
    } catch (error) {
        return next(error);
    }
};

const addPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { amount, type = "CREDIT", description, paymentDate } = req.body;

        if (!amount || parseFloat(amount) <= 0) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Valid amount is required");

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!invoice) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Invoice not found");

        const payment = await prisma.paymentEntry.create({
            data: {
                invoiceId: id,
                amount: parseFloat(amount),
                type,
                description,
                paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            },
        });

        // Recalculate invoice status
        const allPayments = [...invoice.payments, payment];
        const { totalPaid } = getPaymentSummary(allPayments);
        let newStatus = invoice.status;
        if (totalPaid >= invoice.total) newStatus = "PAID";
        else if (totalPaid > 0) newStatus = "PARTIALLY_PAID";

        await prisma.invoice.update({ where: { id }, data: { status: newStatus } });

        if (type === "CREDIT" && invoice.dealId) {
            const leadId = await getLeadIdFromInvoice(invoice);
            if (leadId) {
                await logActivity({
                    leadId,
                    userId: req.user.userId,
                    action: "PAYMENT_RECEIVED",
                    metadata: {
                        invoiceId: id,
                        invoiceNumber: invoice.invoiceNumber,
                        amount: parseFloat(amount),
                        totalPaid: parseFloat(totalPaid.toFixed(2)),
                        status: newStatus,
                    },
                });
            }
        }

        res.status(201).json({ payment, totalPaid: parseFloat(totalPaid.toFixed(2)), balance: parseFloat((invoice.total - totalPaid).toFixed(2)), status: newStatus });
    } catch (error) {
        return next(error);
    }
};

const deletePayment = async (req, res, next) => {
    try {
        const { id, paymentId } = req.params;
        await prisma.paymentEntry.delete({ where: { id: paymentId } });

        // Recalculate invoice status after deletion
        const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
        const { totalPaid } = getPaymentSummary(invoice.payments);
        let newStatus = "SENT";
        if (totalPaid >= invoice.total) newStatus = "PAID";
        else if (totalPaid > 0) newStatus = "PARTIALLY_PAID";
        else if (invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID") newStatus = "SENT";

        await prisma.invoice.update({ where: { id }, data: { status: newStatus } });
        res.json({ message: "Payment deleted" });
    } catch (error) {
        return next(error);
    }
};

const getBalanceSheet = async (req, res, next) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page  ?? 1));
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? 50)));
        const skip  = (page - 1) * limit;
        const where = { status: { not: "CANCELLED" }, deletedAt: null };
        const now   = new Date();

        // Aggregate summary entirely in the DB — avoids loading all invoices into JS
        const [agg, statusCounts, overdueCount, total, pageInvoices] = await Promise.all([
            prisma.$queryRaw`
                SELECT
                    COALESCE(SUM(i.total), 0)                                          AS "totalInvoiced",
                    COALESCE(SUM(p.credit), 0)                                         AS "totalReceived"
                FROM "Invoice" i
                LEFT JOIN LATERAL (
                    SELECT COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CREDIT'), 0) AS credit
                    FROM "PaymentEntry" pe WHERE pe."invoiceId" = i.id
                ) p ON true
                WHERE i.status != 'CANCELLED'
            `,
            prisma.invoice.groupBy({
                by: ["status"],
                where,
                _count: { status: true },
            }),
            prisma.invoice.count({
                where: { ...where, dueDate: { lt: now }, status: { notIn: ["PAID", "CANCELLED"] } },
            }),
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: { payments: true },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        const totalInvoiced    = parseFloat(Number(agg[0]?.totalInvoiced ?? 0).toFixed(2));
        const totalReceived    = parseFloat(Number(agg[0]?.totalReceived ?? 0).toFixed(2));
        const totalOutstanding = parseFloat((totalInvoiced - totalReceived).toFixed(2));
        const paidCount        = statusCounts.find(s => s.status === "PAID")?._count?.status ?? 0;
        const partialCount     = statusCounts.find(s => s.status === "PARTIALLY_PAID")?._count?.status ?? 0;

        const ledger = pageInvoices.map((inv) => {
            const { totalPaid } = getPaymentSummary(inv.payments);
            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                invoiceType: inv.invoiceType,
                clientName: inv.clientName,
                date: inv.createdAt,
                dueDate: inv.dueDate,
                total: inv.total,
                totalPaid: parseFloat(totalPaid.toFixed(2)),
                balance: parseFloat((inv.total - totalPaid).toFixed(2)),
                status: inv.status,
                payments: inv.payments,
            };
        });

        res.json({
            summary: { totalInvoiced, totalReceived, totalOutstanding, invoiceCount: total, paidCount, partialCount, overdueCount },
            ledger,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return next(error);
    }
};

const getInvoiceStats = async (req, res, next) => {
    try {
        const { getRevenueStats } = require("../services/dealService");
        const stats = await getRevenueStats();
        res.json(stats);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    createInvoice,
    getInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    sendEmail,
    addPayment,
    deletePayment,
    getBalanceSheet,
    getInvoiceStats,
    computeInvoiceTotals,
    generateInvoiceNumber,
};
