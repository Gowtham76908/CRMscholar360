const prisma = require("../utils/prisma");
const paginate = require("../utils/paginate");
const { canAccessLead } = require("./permissionService");

const DEAL_SELECT = {
    id: true,
    title: true,
    amount: true,
    stage: true,
    currency: true,
    notes: true,
    closedAt: true,
    invoiceId: true,
    createdAt: true,
    updatedAt: true,
    leadId: true,
    createdById: true,
    assignedEmployeeId: true,
    lead: { select: { id: true, name: true, email: true, phone: true, company: true } },
    createdBy:        { select: { id: true, name: true } },
    assignedEmployee: { select: { id: true, name: true } },
    invoices: {
        select: {
            id: true,
            invoiceNumber: true,
            invoiceType: true,
            total: true,
            status: true,
            dueDate: true,
            createdAt: true,
            payments: { select: { amount: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
    },
};

function withComputed(deal) {
    const now = Date.now();
    const daysOpen = Math.floor((now - new Date(deal.createdAt).getTime()) / 86_400_000);
    const lastActivityAt = deal.updatedAt ?? deal.createdAt;
    return { ...deal, daysOpen, lastActivityAt };
}

// Build a Prisma where clause based on role
function rbacWhere(userId, role) {
    if (role === "SUPER_ADMIN") return { deletedAt: null };
    if (role === "ADMIN") {
        return {
            deletedAt: null,
            OR: [
                { createdById: userId },
                { createdBy: { managerId: userId } },
            ],
        };
    }
    // EMPLOYEE — deals they created or are assigned to
    return { deletedAt: null, OR: [{ createdById: userId }, { assignedEmployeeId: userId }] };
}

const createDeal = async ({ leadId, title, amount, stage, currency, notes, createdById, createdByRole, assignedEmployeeId }) => {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true },
    });
    if (!lead) throw Object.assign(new Error("Lead not found"), { status: 404 });

    // Block silent lead enumeration: callers can only attach deals to leads they can see.
    // createdByRole is optional so existing internal callers (no role context) still work.
    if (createdByRole && !(await canAccessLead(createdById, createdByRole, lead))) {
        throw Object.assign(new Error("Lead not found"), { status: 404 });
    }

    const deal = await prisma.deal.create({
        data: { leadId, title, amount: amount ?? 0, stage: stage ?? "NEW", currency: currency ?? "INR", notes, createdById, assignedEmployeeId: assignedEmployeeId ?? null },
        select: DEAL_SELECT,
    });
    return withComputed(deal);
};

const listDeals = async (userId, role, { page = 1, limit = 20, stage, search, leadId, ownerId, sortBy = "createdAt", sortOrder = "desc" } = {}) => {
    const base = rbacWhere(userId, role);
    const andClauses = [];

    if (stage) andClauses.push({ stage });
    if (leadId) andClauses.push({ leadId });
    if (ownerId) andClauses.push({ createdById: ownerId });
    if (search) {
        // AND with rbacWhere's OR — overwriting where.OR would lift the RBAC scope
        andClauses.push({
            OR: [
                { title: { contains: search, mode: "insensitive" } },
                { lead: { name: { contains: search, mode: "insensitive" } } },
            ],
        });
    }

    const where = andClauses.length ? { ...base, AND: andClauses } : base;

    const [raw, total] = await Promise.all([
        prisma.deal.findMany({
            where,
            select: DEAL_SELECT,
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.deal.count({ where }),
    ]);

    return paginate(raw.map(withComputed), total, page, limit);
};

const getDealById = async (id, userId, role) => {
    const deal = await prisma.deal.findFirst({
        where: { id, ...rbacWhere(userId, role) },
        select: DEAL_SELECT,
    });
    if (!deal) throw Object.assign(new Error("Deal not found"), { status: 404 });
    return withComputed(deal);
};

const updateDeal = async (id, userId, role, data) => {
    const existing = await getDealById(id, userId, role);

    const allowed = ["title", "amount", "stage", "currency", "notes", "closedAt", "invoiceId", "assignedEmployeeId"];
    const update = {};
    for (const k of allowed) {
        if (data[k] !== undefined) update[k] = data[k];
    }

    // Manage closedAt based on stage transition
    if (update.stage) {
        if (["WON", "LOST"].includes(update.stage) && !existing.closedAt) {
            update.closedAt = new Date();
        } else if (["NEW", "NEGOTIATION"].includes(update.stage) && existing.closedAt) {
            update.closedAt = null;
        }
    }

    const updated = await prisma.deal.update({ where: { id }, data: update, select: DEAL_SELECT });
    return withComputed(updated);
};

const softDeleteDeal = async (id, userId, role) => {
    await getDealById(id, userId, role); // permission check + existence check
    return prisma.deal.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } });
};

const getPipelineDeals = async (userId, role, { search, ownerId, managerId, dateFrom, dateTo } = {}) => {
    const base = rbacWhere(userId, role);

    const andClauses = [];

    if (search) {
        andClauses.push({
            OR: [
                { title: { contains: search, mode: "insensitive" } },
                { lead: { name: { contains: search, mode: "insensitive" } } },
            ],
        });
    }

    if (ownerId) andClauses.push({ createdById: ownerId });

    if (managerId && role === "SUPER_ADMIN") {
        andClauses.push({ createdBy: { managerId } });
    }

    if (dateFrom || dateTo) {
        const dateFilter = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) dateFilter.lte = new Date(dateTo);
        andClauses.push({ createdAt: dateFilter });
    }

    const where = andClauses.length ? { ...base, AND: andClauses } : base;

    const raw = await prisma.deal.findMany({
        where,
        select: DEAL_SELECT,
        orderBy: { createdAt: "desc" },
    });

    const deals = raw.map(withComputed);

    const columns = { NEW: [], NEGOTIATION: [], WON: [], LOST: [] };
    for (const d of deals) {
        if (columns[d.stage]) columns[d.stage].push(d);
    }

    const won = deals.filter(d => d.stage === "WON");
    const lost = deals.filter(d => d.stage === "LOST");
    const active = deals.filter(d => ["NEW", "NEGOTIATION"].includes(d.stage));
    const totalAmt = deals.reduce((s, d) => s + d.amount, 0);

    const kpi = {
        activeValue:  active.reduce((s, d) => s + d.amount, 0),
        wonRevenue:   won.reduce((s, d) => s + d.amount, 0),
        lostRevenue:  lost.reduce((s, d) => s + d.amount, 0),
        avgDealSize:  deals.length ? Math.round(totalAmt / deals.length) : 0,
        totalDeals:   deals.length,
        winRate:      deals.length ? Math.round((won.length / deals.length) * 100) : 0,
    };

    return { columns, kpi };
};

const getPipelineMembers = async (userId, role) => {
    if (role === "SUPER_ADMIN") {
        return prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, role: true, managerId: true },
            orderBy: { name: "asc" },
        });
    }
    if (role === "ADMIN") {
        return prisma.user.findMany({
            where: { OR: [{ id: userId }, { managerId: userId }], isActive: true },
            select: { id: true, name: true, role: true, managerId: true },
            orderBy: { name: "asc" },
        });
    }
    return prisma.user.findMany({
        where: { id: userId },
        select: { id: true, name: true, role: true, managerId: true },
    });
};

const getDealInvoices = async (id, userId, role) => {
    // RBAC: verify caller can see this deal
    await getDealById(id, userId, role);

    const invoices = await prisma.invoice.findMany({
        where: { dealId: id },
        include: {
            items: true,
            payments: { orderBy: { paymentDate: "desc" } },
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return invoices.map((inv) => {
        const totalPaid = inv.payments
            .filter(p => p.type === "CREDIT")
            .reduce((s, p) => s + p.amount, 0);
        const totalDebited = inv.payments
            .filter(p => p.type === "DEBIT")
            .reduce((s, p) => s + p.amount, 0);
        const netPaid = totalPaid - totalDebited;
        return {
            ...inv,
            totalPaid: parseFloat(totalPaid.toFixed(2)),
            balance: parseFloat((inv.total - netPaid).toFixed(2)),
        };
    });
};

const getTopLeadsByRevenue = async (userId, role, { stage = "WON", limit = 5 } = {}) => {
    const where = { ...rbacWhere(userId, role), stage };

    const grouped = await prisma.deal.groupBy({
        by:      ["leadId"],
        where,
        _sum:    { amount: true },
        _count:  { _all: true },
        orderBy: { _sum: { amount: "desc" } },
        take:    Math.max(1, Math.min(20, limit)),
    });

    const leadIds = grouped.map(g => g.leadId).filter(Boolean);
    if (leadIds.length === 0) return { stage, count: 0, leads: [] };

    const leads = await prisma.lead.findMany({
        where:  { id: { in: leadIds } },
        select: { id: true, name: true, email: true, phone: true, company: true },
    });
    const leadMap = new Map(leads.map(l => [l.id, l]));

    return {
        stage,
        count: grouped.length,
        leads: grouped.map(g => {
            const l = leadMap.get(g.leadId);
            return {
                leadId:      g.leadId,
                leadName:    l?.name    ?? "(unknown lead)",
                email:       l?.email   ?? null,
                phone:       l?.phone   ?? null,
                company:     l?.company ?? null,
                totalAmount: g._sum.amount || 0,
                dealCount:   g._count._all,
            };
        }),
    };
};

const getRevenueStats = async (scopeWhere = {}) => {
    const invoices = await prisma.invoice.findMany({
        where: { status: { not: "CANCELLED" }, ...scopeWhere },
        select: { total: true, status: true, payments: { select: { amount: true, type: true } } },
    });

    let realizedRevenue = 0;
    let pendingAmount = 0;
    let outstandingPayments = 0;

    for (const inv of invoices) {
        const paid = inv.payments
            .filter(p => p.type === "CREDIT")
            .reduce((s, p) => s + p.amount, 0);

        realizedRevenue += paid;

        if (!["PAID"].includes(inv.status)) {
            pendingAmount += inv.total;
            outstandingPayments += inv.total - paid;
        }
    }

    return {
        realizedRevenue: parseFloat(realizedRevenue.toFixed(2)),
        pendingAmount:   parseFloat(pendingAmount.toFixed(2)),
        collectedPayments: parseFloat(realizedRevenue.toFixed(2)),
        outstandingPayments: parseFloat(outstandingPayments.toFixed(2)),
    };
};

module.exports = { createDeal, listDeals, getDealById, updateDeal, softDeleteDeal, getPipelineDeals, getPipelineMembers, getDealInvoices, getRevenueStats, getTopLeadsByRevenue };
