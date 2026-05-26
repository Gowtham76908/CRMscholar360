const dealService = require("../services/dealService");
const logActivity = require("../utils/activityLogger");
const prisma = require("../utils/prisma");
const { computeInvoiceTotals, generateInvoiceNumber } = require("../controllers/invoiceController");

const getPipeline = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { search, ownerId, managerId, dateFrom, dateTo } = req.query;
        const result = await dealService.getPipelineDeals(userId, role, { search, ownerId, managerId, dateFrom, dateTo });
        res.json(result);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error loading pipeline" });
    }
};

const getMembers = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const members = await dealService.getPipelineMembers(userId, role);
        res.json(members);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error fetching members" });
    }
};

const createDeal = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { leadId, title, amount, stage, currency, notes, assignedEmployeeId } = req.body;

        if (!leadId || !title) {
            return res.status(400).json({ message: "leadId and title are required" });
        }

        const deal = await dealService.createDeal({ leadId, title, amount, stage, currency, notes, createdById: userId, assignedEmployeeId });

        await logActivity({
            leadId,
            userId,
            action: "DEAL_CREATED",
            metadata: { dealId: deal.id, title, amount: deal.amount, stage: deal.stage, currency: deal.currency },
        });

        res.status(201).json(deal);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error creating deal" });
    }
};

const listDeals = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { page, limit, stage, search, leadId, ownerId, sortBy, sortOrder } = req.query;

        const result = await dealService.listDeals(userId, role, {
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            stage,
            search,
            leadId,
            ownerId,
            sortBy,
            sortOrder,
        });

        res.json(result);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error listing deals" });
    }
};

const getDeal = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const deal = await dealService.getDealById(req.params.id, userId, role);
        res.json(deal);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error fetching deal" });
    }
};

const updateDeal = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const prevDeal = await dealService.getDealById(req.params.id, userId, role);
        const deal = await dealService.updateDeal(req.params.id, userId, role, req.body);

        const action = req.body.stage && req.body.stage !== prevDeal.stage
            ? "DEAL_STAGE_CHANGED"
            : "DEAL_UPDATED";

        await logActivity({
            leadId: deal.leadId,
            userId,
            action,
            metadata: {
                dealId: deal.id,
                title: deal.title,
                ...(action === "DEAL_STAGE_CHANGED"
                    ? { from: prevDeal.stage, to: deal.stage }
                    : { changes: req.body }),
            },
        });

        res.json(deal);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error updating deal" });
    }
};

const deleteDeal = async (req, res) => {
    try {
        const { userId, role } = req.user;
        await dealService.softDeleteDeal(req.params.id, userId, role);
        res.json({ deleted: true });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error deleting deal" });
    }
};

const createInvoiceFromDeal = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { id } = req.params;

        // RBAC: ensure caller can access this deal
        const deal = await dealService.getDealById(id, userId, role);

        // Fetch full lead details for pre-fill
        const lead = await prisma.lead.findUnique({
            where: { id: deal.leadId },
            select: { id: true, name: true, email: true, phone: true, company: true },
        });

        const {
            invoiceType = "PROFORMA",
            clientName  = lead?.name ?? deal.lead?.name ?? "",
            clientEmail = lead?.email ?? null,
            clientPhone = lead?.phone ?? null,
            clientAddress,
            clientGstin,
            items = [{ description: deal.title, price: deal.amount, quantity: 1, taxRate: 0 }],
            dueDate,
            notes,
        } = req.body;

        if (!clientName) return res.status(400).json({ message: "Client name is required" });
        if (!items.length) return res.status(400).json({ message: "At least one item is required" });

        const { computeInvoiceTotals, generateInvoiceNumber } = require("./invoiceController");
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
                    clientAddress: clientAddress ?? null,
                    clientGstin:   clientGstin ?? null,
                    subtotal,
                    cgst,
                    sgst,
                    igst,
                    total,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    notes: notes ?? null,
                    createdById: userId,
                    dealId: id,
                    items: { create: processedItems },
                },
                include: {
                    items: true,
                    payments: true,
                    createdBy: { select: { id: true, name: true } },
                },
            });
        });

        await logActivity({
            leadId: deal.leadId,
            userId,
            action: "INVOICE_CREATED",
            metadata: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.total,
                dealTitle: deal.title,
            },
        });

        res.status(201).json(invoice);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error creating invoice from deal" });
    }
};

const listDealInvoices = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const invoices = await dealService.getDealInvoices(req.params.id, userId, role);
        res.json(invoices);
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || "Error fetching deal invoices" });
    }
};

module.exports = { createDeal, listDeals, getDeal, updateDeal, deleteDeal, getPipeline, getMembers, createInvoiceFromDeal, listDealInvoices };
