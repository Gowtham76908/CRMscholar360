const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("../services/organizationService");
const { ApiError } = require("../utils/apiError");

// ── Date range helper ─────────────────────────────────────────────────────────
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

async function assertAccess(req, employeeId) {
    const { userId, role } = req.user;
    if (role === "SUPER_ADMIN") return true;
    if (role === "MANAGER") {
        const teamIds = await getTeamMemberIds(userId);
        return teamIds.includes(employeeId);
    }
    return false;
}

// ── GET /api/employee-report/:id/profile ─────────────────────────────────────
const getProfile = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const user = await prisma.user.findUnique({
            where: { id: employeeId },
            select: {
                id: true, name: true, email: true, profilePhoto: true,
                role: true, department: true, jobTitle: true,
                onlineStatus: true, lastSeen: true, createdAt: true,
                manager: { select: { id: true, name: true } },
                employeeProfile: true,
            },
        });
        if (!user) return res.status(404).json({ message: "Employee not found" });

        const since = new Date();
        since.setDate(since.getDate() - 30);
        const attendanceDays = await prisma.attendance.count({
            where: { userId: employeeId, checkIn: { gte: since } },
        });

        res.json({ ...user, attendanceDays });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/kpis ────────────────────────────────────────
const getKPIs = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const emp = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { email: true },
        });

        const [
            assigned, contacted, converted, lost,
            pendingFollowUps,
            emailsSent, whatsappSent, whatsappReplies,
            tasksAssigned, tasksCompleted,
            responded, totalAssigned,
            callRows,
        ] = await prisma.$transaction([
            prisma.lead.count({ where: { assignedToId: employeeId, assignedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "CONTACTED", updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "CONVERTED", updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "LOST",      updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "FOLLOW_UP" } }),
            prisma.emailLog.count({ where: { sentById: employeeId, createdAt: dr } }),
            prisma.whatsAppMessage.count({ where: { userId: employeeId, direction: "OUTBOUND", sentAt: dr } }),
            prisma.whatsAppMessage.count({ where: { userId: employeeId, direction: "INBOUND",  sentAt: dr } }),
            prisma.task.count({ where: { assignedToId: employeeId, updatedAt: dr } }),
            prisma.task.count({ where: { assignedToId: employeeId, status: "COMPLETED", updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, firstResponseAt: { not: null }, assignedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, assignedAt: dr } }),
            prisma.salestrailCall.findMany({
                where: { agentEmail: emp?.email, startedAt: dr },
                select: { direction: true, status: true, duration: true },
            }),
        ]);

        const callsMade     = callRows.length;
        const answeredCalls = callRows.filter(c => c.status === "answered").length;
        const missedCalls   = callRows.filter(c => ["missed", "no_answer", "busy"].includes(c.status)).length;
        const incomingCalls = callRows.filter(c => c.direction === "incoming").length;
        const outgoingCalls = callRows.filter(c => c.direction === "outgoing").length;
        const talkTime      = callRows.reduce((s, c) => s + (c.duration || 0), 0);
        const avgDuration   = callsMade ? Math.round(talkTime / callsMade) : 0;

        res.json({
            assignedLeads:    assigned,
            contactedLeads:   contacted,
            convertedLeads:   converted,
            lostLeads:        lost,
            pendingFollowUps,
            callsMade, answeredCalls, missedCalls, incomingCalls, outgoingCalls,
            avgDuration, talkTime,
            emailsSent, whatsappSent, whatsappReplies,
            tasksAssigned, tasksCompleted,
            responseRate:    totalAssigned > 0 ? Math.round((responded    / totalAssigned) * 100) : 0,
            conversionRate:  assigned      > 0 ? Math.round((converted   / assigned)       * 100) : 0,
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/lead-chart ──────────────────────────────────
const getLeadChart = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "30d", from, to, mode = "daily" } = req.query;
        const dr = dateRange(period, from, to);

        const leads = await prisma.lead.findMany({
            where: { assignedToId: employeeId, assignedAt: dr },
            select: { status: true, assignedAt: true },
        });

        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap   = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            dayMap[key] = { date: key, assigned: 0, contacted: 0, converted: 0, lost: 0 };
        }

        for (const l of leads) {
            const key = l.assignedAt ? new Date(l.assignedAt).toISOString().split("T")[0] : null;
            if (!key || !dayMap[key]) continue;
            dayMap[key].assigned++;
            if (l.status === "CONTACTED") dayMap[key].contacted++;
            if (l.status === "CONVERTED") dayMap[key].converted++;
            if (l.status === "LOST")      dayMap[key].lost++;
        }

        const daily = Object.values(dayMap);
        if (mode !== "weekly") return res.json(daily);

        const weeks = [];
        for (let i = 0; i < daily.length; i += 7) {
            const chunk = daily.slice(i, i + 7);
            weeks.push({
                date:      chunk[0].date,
                assigned:  chunk.reduce((a, d) => a + d.assigned,  0),
                contacted: chunk.reduce((a, d) => a + d.contacted, 0),
                converted: chunk.reduce((a, d) => a + d.converted, 0),
                lost:      chunk.reduce((a, d) => a + d.lost,      0),
            });
        }
        res.json(weeks);
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/tasks ───────────────────────────────────────
const getTaskAnalytics = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const [total, completed, pending] = await prisma.$transaction([
            prisma.task.count({ where: { assignedToId: employeeId, createdAt:  dr } }),
            prisma.task.count({ where: { assignedToId: employeeId, status: "COMPLETED", updatedAt: dr } }),
            prisma.task.count({ where: { assignedToId: employeeId, status: "PENDING" } }),
        ]);

        res.json({
            total, completed, pending,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/activities ──────────────────────────────────
const getActivities = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "7d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const activities = await prisma.activity.findMany({
            where: { userId: employeeId, createdAt: dr },
            orderBy: { createdAt: "desc" },
            take: 60,
            include: { lead: { select: { id: true, name: true } } },
        });

        res.json(activities);
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/communication ───────────────────────────────
const getCommunicationStats = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const [emailsSent, whatsappSent, whatsappReplied] = await prisma.$transaction([
            prisma.emailLog.count({ where: { sentById: employeeId, createdAt: dr } }),
            prisma.whatsAppMessage.count({ where: { userId: employeeId, direction: "OUTBOUND", sentAt: dr } }),
            prisma.whatsAppMessage.count({ where: { userId: employeeId, direction: "INBOUND",  sentAt: dr } }),
        ]);

        res.json({
            emailsSent, whatsappSent, whatsappReplied,
            responseRate: whatsappSent > 0 ? Math.round((whatsappReplied / whatsappSent) * 100) : 0,
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/notes ───────────────────────────────────────
const getNotes = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const notes = await prisma.managerNote.findMany({
            where: { subjectId: employeeId },
            orderBy: { createdAt: "desc" },
            include: { author: { select: { id: true, name: true, profilePhoto: true } } },
        });
        res.json(notes);
    } catch (err) {
        return next(err);
    }
};

// ── POST /api/employee-report/:id/notes ──────────────────────────────────────
const addNote = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        const { userId } = req.user;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ message: "content is required" });

        const note = await prisma.managerNote.create({
            data: { authorId: userId, subjectId: employeeId, content: content.trim() },
            include: { author: { select: { id: true, name: true, profilePhoto: true } } },
        });
        res.json(note);
    } catch (err) {
        return next(err);
    }
};

// ── DELETE /api/employee-report/notes/:noteId ────────────────────────────────
const deleteNote = async (req, res, next) => {
    try {
        const { noteId } = req.params;
        const { userId, role } = req.user;

        const note = await prisma.managerNote.findUnique({ where: { id: noteId } });
        if (!note) return res.status(404).json({ message: "Note not found" });
        if (note.authorId !== userId && role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Cannot delete another manager's note" });
        }

        await prisma.managerNote.delete({ where: { id: noteId } });
        res.json({ message: "Note deleted" });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/productivity ────────────────────────────────
const getProductivity = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const [
            tasksAssigned, tasksCompleted, tasksPending, tasksOverdue,
            assignedLeads, convertedLeads,
            responseTimes, followupLeads, allLeads,
        ] = await prisma.$transaction([
            prisma.task.count({ where: { assignedToId: employeeId, updatedAt: dr } }),
            prisma.task.count({ where: { assignedToId: employeeId, status: "COMPLETED", updatedAt: dr } }),
            prisma.task.count({ where: { assignedToId: employeeId, status: "PENDING" } }),
            prisma.task.count({ where: { assignedToId: employeeId, status: "PENDING", dueDate: { lt: new Date() } } }),
            prisma.lead.count({ where: { assignedToId: employeeId, assignedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "CONVERTED", updatedAt: dr } }),
            prisma.lead.findMany({
                where: { assignedToId: employeeId, firstResponseAt: { not: null }, assignedAt: { not: null }, assignedAt: dr },
                select: { assignedAt: true, firstResponseAt: true },
            }),
            prisma.lead.findMany({
                where: { assignedToId: employeeId, status: { in: ["FOLLOW_UP", "CONVERTED"] }, assignedAt: { not: null }, updatedAt: dr },
                select: { assignedAt: true, updatedAt: true },
            }),
            prisma.lead.findMany({
                where: { assignedToId: employeeId, assignedAt: dr },
                select: { assignedAt: true, updatedAt: true, status: true },
            }),
        ]);

        // avg response time
        let avgResponseTime = 0;
        if (responseTimes.length > 0) {
            const total = responseTimes.reduce((s, l) => s + (new Date(l.firstResponseAt) - new Date(l.assignedAt)) / 3_600_000, 0);
            avgResponseTime = parseFloat((total / responseTimes.length).toFixed(1));
        }

        // avg follow-up completion time (hours from assigned to follow-up/converted)
        let avgFollowupTime = 0;
        if (followupLeads.length > 0) {
            const total = followupLeads.reduce((s, l) => s + (new Date(l.updatedAt) - new Date(l.assignedAt)) / 3_600_000, 0);
            avgFollowupTime = parseFloat((total / followupLeads.length).toFixed(1));
        }

        // avg lead aging (days open)
        let avgLeadAging = 0;
        const openLeads = allLeads.filter(l => !["CONVERTED", "LOST"].includes(l.status));
        if (openLeads.length > 0) {
            const total = openLeads.reduce((s, l) => s + (Date.now() - new Date(l.assignedAt)) / 86_400_000, 0);
            avgLeadAging = parseFloat((total / openLeads.length).toFixed(1));
        }

        // task trend: per day in period
        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const completedTasks = await prisma.task.findMany({
            where: { assignedToId: employeeId, updatedAt: dr },
            select: { status: true, updatedAt: true, dueDate: true, createdAt: true },
        });

        const dayMap = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            dayMap[key] = { date: key, completed: 0, pending: 0, overdue: 0 };
        }
        for (const t of completedTasks) {
            const key = new Date(t.updatedAt).toISOString().split("T")[0];
            if (!dayMap[key]) continue;
            if (t.status === "COMPLETED") dayMap[key].completed++;
            else if (t.status === "PENDING") {
                dayMap[key].pending++;
                if (t.dueDate && new Date(t.dueDate) < new Date()) dayMap[key].overdue++;
            }
        }

        res.json({
            tasksAssigned, tasksCompleted, tasksPending, tasksOverdue,
            completionRate:       tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0,
            leadConversionRate:   assignedLeads  > 0 ? Math.round((convertedLeads  / assignedLeads)  * 100) : 0,
            avgResponseTime, avgFollowupTime, avgLeadAging,
            taskTrend: Object.values(dayMap),
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/funnel ──────────────────────────────────────
const getFunnel = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const [total, contacted, followUp, converted, lost] = await prisma.$transaction([
            prisma.lead.count({ where: { assignedToId: employeeId, assignedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: { in: ["CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"] }, updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: { in: ["FOLLOW_UP", "CONVERTED"] }, updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "CONVERTED", updatedAt: dr } }),
            prisma.lead.count({ where: { assignedToId: employeeId, status: "LOST",      updatedAt: dr } }),
        ]);

        res.json([
            { stage: "Assigned",   count: total,     pct: 100 },
            { stage: "Contacted",  count: contacted, pct: total > 0 ? Math.round((contacted / total) * 100) : 0 },
            { stage: "Follow-up",  count: followUp,  pct: total > 0 ? Math.round((followUp  / total) * 100) : 0 },
            { stage: "Converted",  count: converted, pct: total > 0 ? Math.round((converted / total) * 100) : 0 },
            { stage: "Lost",       count: lost,      pct: total > 0 ? Math.round((lost      / total) * 100) : 0 },
        ]);
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/employee-report/:id/revenue-kpis ────────────────────────────────
const getRevenueKPIs = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) return res.status(403).json({ message: "Access denied" });
        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const [allDeals, wonDeals, activeDeals, invoices, teamRevRow] = await Promise.all([
            prisma.deal.findMany({ where: { createdById: employeeId, deletedAt: null, createdAt: dr }, select: { amount: true, stage: true } }),
            prisma.deal.findMany({ where: { createdById: employeeId, deletedAt: null, stage: "WON", closedAt: dr }, select: { amount: true } }),
            prisma.deal.findMany({ where: { createdById: employeeId, deletedAt: null, stage: { in: ["NEW", "NEGOTIATION"] } }, select: { amount: true } }),
            prisma.invoice.findMany({ where: { deal: { createdById: employeeId }, status: { not: "CANCELLED" } }, select: { total: true, status: true, payments: { select: { amount: true, type: true } } } }),
            prisma.deal.aggregate({ where: { deletedAt: null, stage: "WON", closedAt: dr }, _sum: { amount: true } }),
        ]);

        let collectedRevenue = 0, outstandingRevenue = 0;
        for (const inv of invoices) {
            const paid = inv.payments.filter(p => p.type === "CREDIT").reduce((s, p) => s + p.amount, 0);
            collectedRevenue += paid;
            if (inv.status !== "PAID") outstandingRevenue += inv.total - paid;
        }

        const revenueGenerated = wonDeals.reduce((s, d) => s + d.amount, 0);
        const pipelineValue    = activeDeals.reduce((s, d) => s + d.amount, 0);
        const totalAmt         = allDeals.reduce((s, d) => s + d.amount, 0);
        const avgDealSize      = allDeals.length > 0 ? Math.round(totalAmt / allDeals.length) : 0;
        const teamTotal        = teamRevRow._sum.amount || 1;
        const contribution     = revenueGenerated > 0 ? Math.round((revenueGenerated / teamTotal) * 100) : 0;

        res.json({
            revenueGenerated:  parseFloat(revenueGenerated.toFixed(2)),
            wonDeals:          wonDeals.length,
            pipelineValue:     parseFloat(pipelineValue.toFixed(2)),
            avgDealSize,
            collectedRevenue:  parseFloat(collectedRevenue.toFixed(2)),
            outstandingRevenue: parseFloat(outstandingRevenue.toFixed(2)),
            contribution,
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

// ── GET /api/employee-report/:id/revenue-trend ───────────────────────────────
const getRevenueTrend = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) return res.status(403).json({ message: "Access denied" });
        const { period = "30d", from, to, mode = "daily" } = req.query;
        const dr = dateRange(period, from, to);

        const [payments, invoices] = await Promise.all([
            prisma.paymentEntry.findMany({ where: { type: "CREDIT", paymentDate: dr, invoice: { deal: { createdById: employeeId } } }, select: { amount: true, paymentDate: true } }),
            prisma.invoice.findMany({ where: { createdAt: dr, deal: { createdById: employeeId } }, select: { total: true, createdAt: true } }),
        ]);

        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap   = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            dayMap[key] = { date: key, collected: 0, invoiced: 0 };
        }
        for (const p of payments) {
            const key = new Date(p.paymentDate).toISOString().split("T")[0];
            if (dayMap[key]) dayMap[key].collected += p.amount;
        }
        for (const inv of invoices) {
            const key = new Date(inv.createdAt).toISOString().split("T")[0];
            if (dayMap[key]) dayMap[key].invoiced += inv.total;
        }

        const daily = Object.values(dayMap).map(d => ({ date: d.date, collected: parseFloat(d.collected.toFixed(2)), invoiced: parseFloat(d.invoiced.toFixed(2)) }));

        if (mode === "weekly") {
            const weeks = [];
            for (let i = 0; i < daily.length; i += 7) {
                const c = daily.slice(i, i + 7);
                weeks.push({ date: c[0].date, collected: parseFloat(c.reduce((s, d) => s + d.collected, 0).toFixed(2)), invoiced: parseFloat(c.reduce((s, d) => s + d.invoiced, 0).toFixed(2)) });
            }
            return res.json(weeks);
        }
        res.json(daily);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

// ── GET /api/employee-report/:id/invoice-collection-trend ────────────────────
const getInvoiceCollectionTrend = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        if (!await assertAccess(req, employeeId)) return res.status(403).json({ message: "Access denied" });
        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const invoices = await prisma.invoice.findMany({
            where: { deal: { createdById: employeeId }, status: { not: "CANCELLED" }, createdAt: dr },
            select: { total: true, status: true, createdAt: true, payments: { select: { amount: true, type: true } } },
        });

        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap   = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            dayMap[key] = { date: key, paid: 0, partial: 0, outstanding: 0 };
        }
        for (const inv of invoices) {
            const key = new Date(inv.createdAt).toISOString().split("T")[0];
            if (!dayMap[key]) continue;
            const collected = inv.payments.filter(p => p.type === "CREDIT").reduce((s, p) => s + p.amount, 0);
            const remaining = inv.total - collected;
            if (inv.status === "PAID")               dayMap[key].paid    += inv.total;
            else if (inv.status === "PARTIALLY_PAID") dayMap[key].partial += collected;
            if (remaining > 0)                        dayMap[key].outstanding += remaining;
        }

        res.json(Object.values(dayMap).map(d => ({ date: d.date, paid: parseFloat(d.paid.toFixed(2)), partial: parseFloat(d.partial.toFixed(2)), outstanding: parseFloat(d.outstanding.toFixed(2)) })));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

module.exports = {
    getProfile, getKPIs, getLeadChart,
    getTaskAnalytics, getActivities, getCommunicationStats,
    getNotes, addNote, deleteNote,
    getProductivity, getFunnel,
    getRevenueKPIs, getRevenueTrend, getInvoiceCollectionTrend,
};
