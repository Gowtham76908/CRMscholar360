const prisma = require("../utils/prisma");
const { sendInvoiceEmail } = require("../services/emailService");

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

const generateInvoiceNumber = async (type) => {
    const settings = await prisma.companySettings.findFirst();
    const base = settings?.shortName || "HXZ";
    const prefix = type === "PROFORMA" ? `${base}-PRO` : base;
    const latest = await prisma.invoice.findFirst({
        where: { invoiceType: type, invoiceNumber: { startsWith: prefix } },
        orderBy: { createdAt: "desc" },
    });
    if (!latest) return `${prefix}-1`;
    const lastNum = parseInt(latest.invoiceNumber.split("-").pop()) || 0;
    return `${prefix}-${lastNum + 1}`;
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

const createInvoice = async (req, res) => {
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
        } = req.body;

        if (!clientName) return res.status(400).json({ message: "Client name is required" });
        if (!items.length) return res.status(400).json({ message: "At least one item is required" });

        const { processedItems, subtotal, cgst, sgst, igst, total } = computeInvoiceTotals(items);
        const invoiceNumber = await generateInvoiceNumber(invoiceType);

        const invoice = await prisma.invoice.create({
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
                items: { create: processedItems },
            },
            include: { items: true, payments: true, createdBy: { select: { id: true, name: true } } },
        });

        res.status(201).json(invoice);
    } catch (error) {
        res.status(500).json({ message: "Error creating invoice", error: error.message });
    }
};

const getInvoices = async (req, res) => {
    try {
        const { status, type } = req.query;
        const where = {};
        if (status) where.status = status;
        if (type) where.invoiceType = type;

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                items: true,
                payments: { orderBy: { paymentDate: "desc" } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        // Attach balance info to each invoice
        const enriched = invoices.map((inv) => {
            const { totalPaid } = getPaymentSummary(inv.payments);
            return { ...inv, totalPaid: parseFloat(totalPaid.toFixed(2)), balance: parseFloat((inv.total - totalPaid).toFixed(2)) };
        });

        res.json(enriched);
    } catch (error) {
        res.status(500).json({ message: "Error fetching invoices", error: error.message });
    }
};

const getInvoice = async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: req.params.id },
            include: {
                items: true,
                payments: { orderBy: { paymentDate: "desc" } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const { totalPaid } = getPaymentSummary(invoice.payments);
        res.json({ ...invoice, totalPaid: parseFloat(totalPaid.toFixed(2)), balance: parseFloat((invoice.total - totalPaid).toFixed(2)) });
    } catch (error) {
        res.status(500).json({ message: "Error fetching invoice", error: error.message });
    }
};

const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            clientName, clientEmail, clientPhone, clientAddress, clientGstin,
            items, dueDate, notes, status, invoiceType,
        } = req.body;

        const existing = await prisma.invoice.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Invoice not found" });
        if (existing.status === "PAID") return res.status(400).json({ message: "Cannot edit a paid invoice" });

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

        res.json(invoice);
    } catch (error) {
        res.status(500).json({ message: "Error updating invoice", error: error.message });
    }
};

const deleteInvoice = async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        await prisma.invoice.delete({ where: { id: req.params.id } });
        res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting invoice", error: error.message });
    }
};

const sendEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { recipientEmail } = req.body;

        if (!recipientEmail) return res.status(400).json({ message: "Recipient email is required" });

        const [invoice, company] = await Promise.all([
            prisma.invoice.findUnique({ where: { id }, include: { items: true } }),
            prisma.companySettings.findFirst(),
        ]);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

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
        res.status(500).json({ message: "Error sending invoice email", error: error.message });
    }
};

const addPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, type = "CREDIT", description, paymentDate } = req.body;

        if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: "Valid amount is required" });

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

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

        res.status(201).json({ payment, totalPaid: parseFloat(totalPaid.toFixed(2)), balance: parseFloat((invoice.total - totalPaid).toFixed(2)), status: newStatus });
    } catch (error) {
        res.status(500).json({ message: "Error recording payment", error: error.message });
    }
};

const deletePayment = async (req, res) => {
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
        res.status(500).json({ message: "Error deleting payment", error: error.message });
    }
};

const getBalanceSheet = async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            where: { status: { not: "CANCELLED" } },
            include: { payments: true },
            orderBy: { createdAt: "desc" },
        });

        let totalInvoiced = 0;
        let totalReceived = 0;
        let totalOutstanding = 0;

        const ledger = invoices.map((inv) => {
            const { totalPaid } = getPaymentSummary(inv.payments);
            const balance = inv.total - totalPaid;
            totalInvoiced += inv.total;
            totalReceived += totalPaid;
            totalOutstanding += balance;
            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                invoiceType: inv.invoiceType,
                clientName: inv.clientName,
                date: inv.createdAt,
                dueDate: inv.dueDate,
                total: inv.total,
                totalPaid: parseFloat(totalPaid.toFixed(2)),
                balance: parseFloat(balance.toFixed(2)),
                status: inv.status,
                payments: inv.payments,
            };
        });

        res.json({
            summary: {
                totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
                totalReceived: parseFloat(totalReceived.toFixed(2)),
                totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
                invoiceCount: invoices.length,
                paidCount: invoices.filter((i) => i.status === "PAID").length,
                partialCount: invoices.filter((i) => i.status === "PARTIALLY_PAID").length,
                overdueCount: invoices.filter((i) => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== "PAID").length,
            },
            ledger,
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching balance sheet", error: error.message });
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
};
