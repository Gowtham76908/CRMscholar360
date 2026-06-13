const prisma = require("../utils/prisma");
const { getTeamMemberIds } = require("../services/organizationService");
const { ApiError } = require("../utils/apiError");
const { istDateKey } = require("../utils/istTime");

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

async function resolveTeamIds(userId, role) {
    if (role === "SUPER_ADMIN") {
        const rows = await prisma.user.findMany({
            where: { role: "EMPLOYEE", isActive: true },
            select: { id: true },
        });
        return rows.map(r => r.id);
    }
    return getTeamMemberIds(userId);
}

// ── GET /api/team-performance/kpis ───────────────────────────────────────────
const getKPIs = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) {
            return res.json({ assignedLeads: 0, convertedLeads: 0, callsMade: 0, pendingFollowUps: 0, talkTime: 0, responseRate: 0 });
        }

        const dr = dateRange(period, from, to);

        const [assigned, converted, pendingFollowUps, callRows, responded] =
            await prisma.$transaction([
                prisma.lead.count({ where: { assignedToId: { in: teamIds }, assignedAt: dr } }),
                prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: "CONVERTED", updatedAt: dr } }),
                prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: "FOLLOW_UP" } }),
                prisma.salestrailCall.findMany({
                    where: { startedAt: dr },
                    select: { duration: true, agentEmail: true },
                }),
                prisma.lead.count({
                    where: { assignedToId: { in: teamIds }, firstResponseAt: { not: null }, assignedAt: dr },
                }),
            ]);

        // Scope calls to team members (match by email)
        const teamEmails = await prisma.user.findMany({
            where: { id: { in: teamIds } },
            select: { email: true },
        }).then(rows => new Set(rows.map(r => r.email)));

        const teamCalls = callRows.filter(c => c.agentEmail && teamEmails.has(c.agentEmail));
        const talkTime  = teamCalls.reduce((s, c) => s + (c.duration || 0), 0);

        res.json({
            assignedLeads:   assigned,
            convertedLeads:  converted,
            callsMade:       teamCalls.length,
            pendingFollowUps,
            talkTime,
            responseRate: assigned > 0 ? Math.round((responded / assigned) * 100) : 0,
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/lead-chart ─────────────────────────────────────
const getLeadChart = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to, mode = "daily" } = req.query;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) return res.json([]);

        const dr = dateRange(period, from, to);
        const leads = await prisma.lead.findMany({
            where: { assignedToId: { in: teamIds }, assignedAt: dr },
            select: { status: true, assignedAt: true },
        });

        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap   = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = istDateKey(d);
            dayMap[key] = { date: key, assigned: 0, contacted: 0, converted: 0, lost: 0 };
        }

        for (const l of leads) {
            const key = l.assignedAt ? istDateKey(l.assignedAt) : null;
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

// ── GET /api/team-performance/employees ──────────────────────────────────────
const getEmployeeTable = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) return res.json([]);

        const dr = dateRange(period, from, to);

        const idList = teamIds.map(id => `'${id}'`).join(",");
        const [employees, leadStats, callRows] = await Promise.all([
            prisma.user.findMany({
                where: { id: { in: teamIds } },
                select: {
                    id: true, name: true, email: true, profilePhoto: true,
                    onlineStatus: true, lastSeen: true,
                    employeeProfile: {
                        select: {
                            availabilityStatus: true,
                            currentLeadLoad: true, maxDailyLeads: true,
                            performanceScore: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
            prisma.$queryRawUnsafe(`
                SELECT
                    "assignedToId",
                    COUNT(*)                                                        AS assigned,
                    COUNT(*) FILTER (WHERE status = 'CONVERTED' AND "updatedAt" >= $1 AND "updatedAt" <= $2) AS converted,
                    COUNT(*) FILTER (WHERE status = 'FOLLOW_UP')                   AS follow_up
                FROM "Lead"
                WHERE "assignedToId" IN (${idList})
                  AND "assignedAt" >= $1
                  AND "assignedAt" <= $2
                GROUP BY "assignedToId"
            `, dr.gte, dr.lte),
            prisma.salestrailCall.findMany({
                where: { startedAt: dr },
                select: { agentEmail: true, duration: true },
            }),
        ]);

        const assignedMap  = Object.fromEntries(leadStats.map(r => [r.assignedToId, Number(r.assigned)]));
        const convertedMap = Object.fromEntries(leadStats.map(r => [r.assignedToId, Number(r.converted)]));
        const followUpMap  = Object.fromEntries(leadStats.map(r => [r.assignedToId, Number(r.follow_up)]));

        const emailToId  = Object.fromEntries(employees.map(e => [e.email, e.id]));
        const callsById  = {};
        const talkById   = {};
        for (const c of callRows) {
            const eid = emailToId[c.agentEmail];
            if (!eid) continue;
            callsById[eid] = (callsById[eid] || 0) + 1;
            talkById[eid]  = (talkById[eid]  || 0) + (c.duration || 0);
        }

        res.json(employees.map(e => ({
            id:                  e.id,
            name:                e.name,
            email:               e.email,
            profilePhoto:        e.profilePhoto,
            onlineStatus:        e.onlineStatus,
            lastSeen:            e.lastSeen,
            availabilityStatus:  e.employeeProfile?.availabilityStatus || "OFFLINE",
            currentLeadLoad:     e.employeeProfile?.currentLeadLoad    || 0,
            maxDailyLeads:       e.employeeProfile?.maxDailyLeads      || 20,
            performanceScore:    e.employeeProfile?.performanceScore    ?? 0.5,
            assignedLeads:       assignedMap[e.id]  || 0,
            convertedLeads:      convertedMap[e.id] || 0,
            pendingFollowUps:    followUpMap[e.id]  || 0,
            callsMade:           callsById[e.id]    || 0,
            talkTime:            talkById[e.id]     || 0,
        })));
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/team-emails ────────────────────────────────────
// Returns emails of team members (used by frontend to scope SalestrailSection)
const getTeamEmails = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const teamIds  = await resolveTeamIds(userId, role);
        const rows     = await prisma.user.findMany({
            where: { id: { in: teamIds } },
            select: { email: true },
        });
        res.json(rows.map(r => r.email));
    } catch (err) {
        return next(err);
    }
};

// ── Rule-based insights engine ────────────────────────────────────────────────
function buildInsights(employees, teamStats) {
    const insights = [];

    for (const e of employees) {
        const pct  = e.maxDailyLeads > 0 ? e.currentLeadLoad / e.maxDailyLeads : 0;
        const perf = Math.round((e.performanceScore ?? 0.5) * 100);

        if (pct >= 0.9)  insights.push({ type: "danger",   text: `${e.name}'s workload is near capacity (${Math.round(pct * 100)}%)` });
        else if (pct >= 0.75) insights.push({ type: "warning", text: `${e.name}'s workload is getting high (${Math.round(pct * 100)}%)` });

        if (perf >= 80)  insights.push({ type: "positive", text: `${e.name} has a high performance score (${perf}%)` });
        if (perf < 30)   insights.push({ type: "warning",  text: `${e.name} needs attention — low performance score (${perf}%)` });

        if ((e.pendingFollowUps || 0) > 10)
            insights.push({ type: "warning", text: `${e.name} has ${e.pendingFollowUps} pending follow-ups` });
    }

    if (teamStats.avgResponseTimeHours > 24)
        insights.push({ type: "danger",  text: `Average lead response time exceeds 24 hours (${teamStats.avgResponseTimeHours.toFixed(1)}h)` });

    if (teamStats.avgFollowupDiscipline < 0.4)
        insights.push({ type: "warning", text: "Follow-up completion is low across the team" });

    if (teamStats.conversionRateWeek > teamStats.conversionRatePrevWeek && teamStats.conversionRateWeek > 0)
        insights.push({ type: "positive", text: `Team conversion rate improved this week (${teamStats.conversionRateWeek}% vs ${teamStats.conversionRatePrevWeek}% last week)` });

    if (teamStats.leadAgingCount > 10)
        insights.push({ type: "warning", text: `${teamStats.leadAgingCount} leads have had no activity in 7+ days` });

    return insights.slice(0, 8); // cap at 8 insights
}

// ── GET /api/team-performance/workforce ──────────────────────────────────────
const getWorkforce = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) {
            return res.json({ totalActiveLeads: 0, totalPendingFollowUps: 0, tasksCompleted: 0, tasksPending: 0, avgLeadResponseTimeHours: 0, avgConversionTimeDays: 0, leadAgingCount: 0, insights: [] });
        }

        const dr      = dateRange(period, from, to);
        const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
        const weekStart    = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0,0,0,0);
        const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        const prevWeekEnd   = new Date(weekStart);

        const [
            totalActiveLeads, totalPendingFollowUps,
            tasksCompleted, tasksPending,
            responseTimes, conversionTimes,
            leadAgingCount,
            weekConverted, weekAssigned,
            prevWeekConverted, prevWeekAssigned,
            employees,
        ] = await prisma.$transaction([
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP"] } } }),
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: "FOLLOW_UP" } }),
            prisma.task.count({ where: { assignedToId: { in: teamIds }, status: "COMPLETED", updatedAt: dr } }),
            prisma.task.count({ where: { assignedToId: { in: teamIds }, status: "PENDING" } }),
            prisma.lead.findMany({
                where: { assignedToId: { in: teamIds }, firstResponseAt: { not: null }, assignedAt: { not: null }, assignedAt: dr },
                select: { assignedAt: true, firstResponseAt: true },
            }),
            prisma.lead.findMany({
                where: { assignedToId: { in: teamIds }, status: "CONVERTED", assignedAt: { not: null }, updatedAt: dr },
                select: { assignedAt: true, updatedAt: true },
            }),
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: { in: ["NEW", "CONTACTED"] }, updatedAt: { lt: sevenDaysAgo } } }),
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: "CONVERTED", updatedAt: { gte: weekStart } } }),
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, assignedAt: { gte: weekStart } } }),
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, status: "CONVERTED", updatedAt: { gte: prevWeekStart, lt: prevWeekEnd } } }),
            prisma.lead.count({ where: { assignedToId: { in: teamIds }, assignedAt: { gte: prevWeekStart, lt: prevWeekEnd } } }),
            prisma.user.findMany({
                where: { id: { in: teamIds } },
                select: {
                    id: true, name: true,
                    employeeProfile: {
                        select: { currentLeadLoad: true, maxDailyLeads: true, performanceScore: true, followupDiscipline: true },
                    },
                },
            }),
        ]);

        // Metrics calculations
        let avgLeadResponseTimeHours = 0;
        if (responseTimes.length > 0) {
            const total = responseTimes.reduce((s, l) => s + (new Date(l.firstResponseAt) - new Date(l.assignedAt)) / 3_600_000, 0);
            avgLeadResponseTimeHours = parseFloat((total / responseTimes.length).toFixed(1));
        }

        let avgConversionTimeDays = 0;
        if (conversionTimes.length > 0) {
            const total = conversionTimes.reduce((s, l) => s + (new Date(l.updatedAt) - new Date(l.assignedAt)) / 86_400_000, 0);
            avgConversionTimeDays = parseFloat((total / conversionTimes.length).toFixed(1));
        }

        const conversionRateWeek     = weekAssigned > 0 ? Math.round((weekConverted / weekAssigned) * 100) : 0;
        const conversionRatePrevWeek = prevWeekAssigned > 0 ? Math.round((prevWeekConverted / prevWeekAssigned) * 100) : 0;
        const avgFollowupDiscipline  = employees.length > 0
            ? employees.reduce((s, e) => s + (e.employeeProfile?.followupDiscipline ?? 0.5), 0) / employees.length
            : 0.5;

        // Enrich employee list with pending follow-ups for insights
        const followUpGroups = await prisma.lead.groupBy({
            by: ["assignedToId"],
            where: { assignedToId: { in: teamIds }, status: "FOLLOW_UP" },
            _count: { id: true },
        });
        const fuMap = Object.fromEntries(followUpGroups.map(r => [r.assignedToId, r._count.id]));
        const enrichedEmployees = employees.map(e => ({
            ...e,
            pendingFollowUps: fuMap[e.id] || 0,
        }));

        const insights = buildInsights(enrichedEmployees, {
            avgResponseTimeHours: avgLeadResponseTimeHours,
            avgFollowupDiscipline,
            conversionRateWeek,
            conversionRatePrevWeek,
            leadAgingCount,
        });

        res.json({
            totalActiveLeads, totalPendingFollowUps,
            tasksCompleted, tasksPending,
            avgLeadResponseTimeHours, avgConversionTimeDays,
            leadAgingCount,
            insights,
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/workload ───────────────────────────────────────
const getWorkload = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) return res.json([]);

        const employees = await prisma.user.findMany({
            where: { id: { in: teamIds } },
            select: {
                id: true, name: true, profilePhoto: true,
                employeeProfile: {
                    select: { currentLeadLoad: true, maxDailyLeads: true, availabilityStatus: true },
                },
            },
            orderBy: { name: "asc" },
        });

        res.json(employees.map(e => {
            const load = e.employeeProfile?.currentLeadLoad ?? 0;
            const max  = e.employeeProfile?.maxDailyLeads   ?? 20;
            const pct  = max > 0 ? Math.round((load / max) * 100) : 0;
            return {
                id: e.id, name: e.name, profilePhoto: e.profilePhoto,
                currentLeadLoad: load, maxDailyLeads: max, pct,
                status: e.employeeProfile?.availabilityStatus || "OFFLINE",
                tier: pct >= 90 ? "danger" : pct >= 75 ? "warning" : "normal",
            };
        }));
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/workflow-board ─────────────────────────────────
const getWorkflowBoard = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) return res.json({});

        const STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"];
        const PER_COL  = 8;

        const [leads, counts] = await prisma.$transaction([
            prisma.lead.findMany({
                where: { assignedToId: { in: teamIds }, status: { in: STATUSES } },
                select: {
                    id: true, name: true, status: true, score: true,
                    createdAt: true, updatedAt: true,
                    assignedTo: { select: { id: true, name: true } },
                    activities: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { action: true, createdAt: true },
                    },
                },
                orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
            }),
            prisma.lead.groupBy({
                by: ["status"],
                where: { assignedToId: { in: teamIds }, status: { in: STATUSES } },
                _count: { id: true },
            }),
        ]);

        const now = Date.now();
        const formatted = leads.map(l => ({
            id:           l.id,
            name:         l.name,
            status:       l.status,
            score:        l.score,
            ownerName:    l.assignedTo?.name || "Unassigned",
            ownerId:      l.assignedTo?.id,
            daysInStage:  Math.floor((now - new Date(l.updatedAt)) / 86_400_000),
            lastActivity: l.activities[0]?.createdAt || l.updatedAt,
            lastAction:   l.activities[0]?.action,
        }));

        const countMap = Object.fromEntries(counts.map(c => [c.status, c._count.id]));

        const board = {};
        for (const s of STATUSES) {
            const col = formatted.filter(l => l.status === s);
            board[s] = {
                leads: col.slice(0, PER_COL),
                total: countMap[s] || 0,
            };
        }

        res.json(board);
    } catch (err) {
        return next(err);
    }
};

const VALID_STATUSES = new Set(["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"]);
const PAGE_SIZE      = 20;

const getWorkflowColumnLeads = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { status }       = req.params;
        const page             = Math.max(1, parseInt(req.query.page, 10) || 1);
        const search           = (req.query.search || "").trim();

        if (!VALID_STATUSES.has(status)) return res.status(400).json({ message: "Invalid status" });

        const teamIds = await resolveTeamIds(userId, role);
        if (!teamIds.length) return res.json({ leads: [], total: 0, page, totalPages: 0 });

        const nameFilter = search
            ? { name: { contains: search, mode: "insensitive" } }
            : {};

        const [leads, total] = await prisma.$transaction([
            prisma.lead.findMany({
                where:   { assignedToId: { in: teamIds }, status, ...nameFilter },
                select: {
                    id: true, name: true, status: true, score: true,
                    updatedAt: true,
                    assignedTo: { select: { id: true, name: true } },
                    activities: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { action: true },
                    },
                },
                orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
                skip:  (page - 1) * PAGE_SIZE,
                take:  PAGE_SIZE,
            }),
            prisma.lead.count({
                where: { assignedToId: { in: teamIds }, status, ...nameFilter },
            }),
        ]);

        const now = Date.now();
        res.json({
            leads: leads.map(l => ({
                id:          l.id,
                name:        l.name,
                status:      l.status,
                score:       l.score,
                ownerName:   l.assignedTo?.name || "Unassigned",
                ownerId:     l.assignedTo?.id,
                daysInStage: Math.floor((now - new Date(l.updatedAt)) / 86_400_000),
                lastAction:  l.activities[0]?.action,
            })),
            total,
            page,
            totalPages: Math.ceil(total / PAGE_SIZE),
        });
    } catch (err) {
        return next(err);
    }
};

// ── Revenue Intelligence helpers ──────────────────────────────────────────────

function fmtCr(n) {
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
    if (n >= 100_000)    return `${(n / 100_000).toFixed(1)} L`;
    return n.toLocaleString("en-IN");
}

function buildRevenueInsights({ pipelineValue, wonRevenue, realizedRevenue, outstandingRevenue, winRate, totalDeals, wonCount }) {
    const insights = [];
    if (totalDeals > 0 && winRate >= 50)
        insights.push({ type: "positive", text: `Win rate is strong at ${winRate}% — ${wonCount} of ${totalDeals} deals closed` });
    else if (totalDeals > 0 && winRate < 20)
        insights.push({ type: "warning",  text: `Win rate is low at ${winRate}% — consider reviewing deal qualification criteria` });
    if (realizedRevenue > 0)
        insights.push({ type: "positive", text: `₹${fmtCr(realizedRevenue)} collected from invoices` });
    if (outstandingRevenue > realizedRevenue * 0.5 && outstandingRevenue > 0)
        insights.push({ type: "warning",  text: `Outstanding revenue (₹${fmtCr(outstandingRevenue)}) exceeds 50% of collected — follow up on invoices` });
    if (wonRevenue > 0)
        insights.push({ type: "positive", text: `₹${fmtCr(wonRevenue)} in won deals for the period` });
    if (pipelineValue > wonRevenue * 3 && pipelineValue > 0)
        insights.push({ type: "positive", text: `Active pipeline (₹${fmtCr(pipelineValue)}) is well above won revenue` });
    return insights.slice(0, 6);
}

// ── GET /api/team-performance/revenue-kpis ───────────────────────────────────
const getRevenueKPIs = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);

        if (!teamIds.length) {
            return res.json({ pipelineValue: 0, wonRevenue: 0, realizedRevenue: 0, pendingRevenue: 0, collectedRevenue: 0, outstandingRevenue: 0, avgDealSize: 0, winRate: 0, insights: [] });
        }

        const dr = dateRange(period, from, to);

        const [periodDeals, activeDeals, wonDeals, invoices] = await Promise.all([
            prisma.deal.findMany({
                where: { createdById: { in: teamIds }, deletedAt: null, createdAt: dr },
                select: { amount: true, stage: true },
            }),
            prisma.deal.findMany({
                where: { createdById: { in: teamIds }, deletedAt: null, stage: { in: ["NEW", "NEGOTIATION"] } },
                select: { amount: true },
            }),
            prisma.deal.findMany({
                where: { createdById: { in: teamIds }, deletedAt: null, stage: "WON", closedAt: dr },
                select: { amount: true },
            }),
            prisma.invoice.findMany({
                where: { status: { not: "CANCELLED" }, deal: { createdById: { in: teamIds } } },
                select: { total: true, status: true, payments: { select: { amount: true, type: true } } },
            }),
        ]);

        let realizedRevenue = 0, pendingRevenue = 0, outstandingRevenue = 0;
        for (const inv of invoices) {
            const paid = inv.payments.filter(p => p.type === "CREDIT").reduce((s, p) => s + p.amount, 0);
            realizedRevenue += paid;
            if (inv.status !== "PAID") {
                pendingRevenue += inv.total;
                outstandingRevenue += inv.total - paid;
            }
        }

        const pipelineValue  = activeDeals.reduce((s, d) => s + d.amount, 0);
        const wonRevenue     = wonDeals.reduce((s, d) => s + d.amount, 0);
        const totalDeals     = periodDeals.length;
        const wonCount       = periodDeals.filter(d => d.stage === "WON").length;
        const totalAmt       = periodDeals.reduce((s, d) => s + d.amount, 0);
        const avgDealSize    = totalDeals > 0 ? Math.round(totalAmt / totalDeals) : 0;
        const winRate        = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0;

        const insights = buildRevenueInsights({ pipelineValue, wonRevenue, realizedRevenue, outstandingRevenue, winRate, totalDeals, wonCount });

        res.json({
            pipelineValue:     parseFloat(pipelineValue.toFixed(2)),
            wonRevenue:        parseFloat(wonRevenue.toFixed(2)),
            realizedRevenue:   parseFloat(realizedRevenue.toFixed(2)),
            pendingRevenue:    parseFloat(pendingRevenue.toFixed(2)),
            collectedRevenue:  parseFloat(realizedRevenue.toFixed(2)),
            outstandingRevenue: parseFloat(outstandingRevenue.toFixed(2)),
            avgDealSize,
            winRate,
            totalDeals,
            insights,
        });
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/revenue-trend ──────────────────────────────────
const getRevenueTrend = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to, mode = "daily" } = req.query;
        const teamIds = await resolveTeamIds(userId, role);
        if (!teamIds.length) return res.json([]);

        const dr = dateRange(period, from, to);

        const [payments, invoices] = await Promise.all([
            prisma.paymentEntry.findMany({
                where: { type: "CREDIT", paymentDate: dr, invoice: { deal: { createdById: { in: teamIds } } } },
                select: { amount: true, paymentDate: true },
            }),
            prisma.invoice.findMany({
                where: { createdAt: dr, deal: { createdById: { in: teamIds } } },
                select: { total: true, createdAt: true },
            }),
        ]);

        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap   = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = istDateKey(d);
            dayMap[key] = { date: key, collected: 0, invoiced: 0 };
        }
        for (const p of payments) {
            const key = istDateKey(p.paymentDate);
            if (dayMap[key]) dayMap[key].collected += p.amount;
        }
        for (const inv of invoices) {
            const key = istDateKey(inv.createdAt);
            if (dayMap[key]) dayMap[key].invoiced += inv.total;
        }

        const daily = Object.values(dayMap).map(d => ({
            date: d.date,
            collected: parseFloat(d.collected.toFixed(2)),
            invoiced:  parseFloat(d.invoiced.toFixed(2)),
        }));

        if (mode === "weekly") {
            const weeks = [];
            for (let i = 0; i < daily.length; i += 7) {
                const c = daily.slice(i, i + 7);
                weeks.push({ date: c[0].date, collected: parseFloat(c.reduce((s, d) => s + d.collected, 0).toFixed(2)), invoiced: parseFloat(c.reduce((s, d) => s + d.invoiced, 0).toFixed(2)) });
            }
            return res.json(weeks);
        }
        if (mode === "monthly") {
            const mmap = {};
            for (const d of daily) {
                const key = d.date.slice(0, 7);
                if (!mmap[key]) mmap[key] = { date: key, collected: 0, invoiced: 0 };
                mmap[key].collected += d.collected;
                mmap[key].invoiced  += d.invoiced;
            }
            return res.json(Object.values(mmap).map(m => ({ date: m.date, collected: parseFloat(m.collected.toFixed(2)), invoiced: parseFloat(m.invoiced.toFixed(2)) })));
        }
        res.json(daily);
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/revenue-by-employee ────────────────────────────
const getRevenueByEmployee = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);
        if (!teamIds.length) return res.json([]);
        const dr = dateRange(period, from, to);

        const [employees, wonDeals, payments] = await Promise.all([
            prisma.user.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
            prisma.deal.findMany({
                where: { createdById: { in: teamIds }, stage: "WON", closedAt: dr, deletedAt: null },
                select: { amount: true, createdById: true },
            }),
            prisma.paymentEntry.findMany({
                where: { type: "CREDIT", paymentDate: dr, invoice: { deal: { createdById: { in: teamIds } } } },
                select: { amount: true, invoice: { select: { deal: { select: { createdById: true } } } } },
            }),
        ]);

        const wonByEmp  = {};
        const collByEmp = {};
        for (const d of wonDeals)  wonByEmp[d.createdById]  = (wonByEmp[d.createdById]  || 0) + d.amount;
        for (const p of payments) {
            const eid = p.invoice?.deal?.createdById;
            if (eid) collByEmp[eid] = (collByEmp[eid] || 0) + p.amount;
        }

        res.json(employees.map(e => ({
            id:          e.id,
            name:        e.name,
            wonRevenue:  parseFloat((wonByEmp[e.id]  || 0).toFixed(2)),
            collected:   parseFloat((collByEmp[e.id] || 0).toFixed(2)),
        })).sort((a, b) => b.wonRevenue - a.wonRevenue));
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/revenue-by-source ──────────────────────────────
const getRevenueBySource = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);
        if (!teamIds.length) return res.json([]);
        const dr = dateRange(period, from, to);

        const deals = await prisma.deal.findMany({
            where: { createdById: { in: teamIds }, stage: "WON", closedAt: dr, deletedAt: null },
            select: { amount: true, lead: { select: { source: true } } },
        });

        const bySource = {};
        for (const d of deals) {
            const src = d.lead?.source || "UNKNOWN";
            bySource[src] = (bySource[src] || 0) + d.amount;
        }
        res.json(Object.entries(bySource).map(([source, amount]) => ({ source, amount: parseFloat(amount.toFixed(2)) })).sort((a, b) => b.amount - a.amount));
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/revenue-by-manager ─────────────────────────────
const getRevenueByManager = async (req, res, next) => {
    try {
        const { role } = req.user;
        if (role !== "SUPER_ADMIN") return res.status(403).json({ message: "SUPER_ADMIN only" });
        const { period = "30d", from, to } = req.query;
        const dr = dateRange(period, from, to);

        const managers = await prisma.user.findMany({
            where: { role: "ADMIN", isActive: true },
            select: { id: true, name: true },
        });

        const deals = await prisma.deal.findMany({
            where: { deletedAt: null, stage: "WON", closedAt: dr, lead: { assignedTo: { managerId: { in: managers.map(m => m.id) } } } },
            select: { amount: true, lead: { select: { assignedTo: { select: { managerId: true } } } } },
        });

        const byMgr = {};
        for (const d of deals) {
            const mid = d.lead?.assignedTo?.managerId;
            if (mid) byMgr[mid] = (byMgr[mid] || 0) + d.amount;
        }

        res.json(managers.map(m => ({ id: m.id, name: m.name, wonRevenue: parseFloat((byMgr[m.id] || 0).toFixed(2)) })).sort((a, b) => b.wonRevenue - a.wonRevenue));
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/invoice-collection-trend ───────────────────────
const getInvoiceCollectionTrend = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to, mode = "daily" } = req.query;
        const teamIds = await resolveTeamIds(userId, role);
        if (!teamIds.length) return res.json([]);
        const dr = dateRange(period, from, to);

        const invoices = await prisma.invoice.findMany({
            where: { status: { not: "CANCELLED" }, deal: { createdById: { in: teamIds } }, createdAt: dr },
            select: { total: true, status: true, createdAt: true, payments: { select: { amount: true, type: true } } },
        });

        const dayCount = Math.max(Math.ceil((Date.now() - new Date(dr.gte)) / 86_400_000), 1);
        const dayMap   = {};
        for (let i = dayCount; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = istDateKey(d);
            dayMap[key] = { date: key, paid: 0, partial: 0, outstanding: 0 };
        }
        for (const inv of invoices) {
            const key = istDateKey(inv.createdAt);
            if (!dayMap[key]) continue;
            const collected = inv.payments.filter(p => p.type === "CREDIT").reduce((s, p) => s + p.amount, 0);
            const remaining = inv.total - collected;
            if (inv.status === "PAID")          dayMap[key].paid        += inv.total;
            else if (inv.status === "PARTIALLY_PAID") dayMap[key].partial += collected;
            if (remaining > 0)                  dayMap[key].outstanding += remaining;
        }

        const daily = Object.values(dayMap).map(d => ({
            date: d.date,
            paid:        parseFloat(d.paid.toFixed(2)),
            partial:     parseFloat(d.partial.toFixed(2)),
            outstanding: parseFloat(d.outstanding.toFixed(2)),
        }));

        if (mode === "weekly") {
            const weeks = [];
            for (let i = 0; i < daily.length; i += 7) {
                const c = daily.slice(i, i + 7);
                weeks.push({ date: c[0].date, paid: parseFloat(c.reduce((s, d) => s + d.paid, 0).toFixed(2)), partial: parseFloat(c.reduce((s, d) => s + d.partial, 0).toFixed(2)), outstanding: parseFloat(c.reduce((s, d) => s + d.outstanding, 0).toFixed(2)) });
            }
            return res.json(weeks);
        }
        res.json(daily);
    } catch (err) {
        return next(err);
    }
};

// ── GET /api/team-performance/revenue-employees ──────────────────────────────
const getRevenueEmployeeTable = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { period = "30d", from, to } = req.query;
        const teamIds = await resolveTeamIds(userId, role);
        if (!teamIds.length) return res.json([]);
        const dr = dateRange(period, from, to);

        const [employees, periodDeals, wonDeals, payments, unpaidInvoices] = await Promise.all([
            prisma.user.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, email: true, profilePhoto: true } }),
            prisma.deal.findMany({ where: { createdById: { in: teamIds }, deletedAt: null, createdAt: dr }, select: { amount: true, stage: true, createdById: true } }),
            prisma.deal.findMany({ where: { createdById: { in: teamIds }, deletedAt: null, stage: "WON", closedAt: dr }, select: { amount: true, createdById: true } }),
            prisma.paymentEntry.findMany({
                where: { type: "CREDIT", paymentDate: dr, invoice: { deal: { createdById: { in: teamIds } } } },
                select: { amount: true, invoice: { select: { deal: { select: { createdById: true } } } } },
            }),
            prisma.invoice.findMany({
                where: { deal: { createdById: { in: teamIds } }, status: { notIn: ["PAID", "CANCELLED"] } },
                select: { total: true, deal: { select: { createdById: true } }, payments: { select: { amount: true, type: true } } },
            }),
        ]);

        const wonByEmp  = {}, wonCntByEmp = {}, collByEmp = {}, outByEmp = {}, dealsByEmp = {};
        for (const d of wonDeals) {
            wonByEmp[d.createdById]    = (wonByEmp[d.createdById]    || 0) + d.amount;
            wonCntByEmp[d.createdById] = (wonCntByEmp[d.createdById] || 0) + 1;
        }
        for (const d of periodDeals) {
            if (!dealsByEmp[d.createdById]) dealsByEmp[d.createdById] = [];
            dealsByEmp[d.createdById].push(d);
        }
        for (const p of payments) {
            const eid = p.invoice?.deal?.createdById;
            if (eid) collByEmp[eid] = (collByEmp[eid] || 0) + p.amount;
        }
        for (const inv of unpaidInvoices) {
            const eid = inv.deal?.createdById;
            if (!eid) continue;
            const paid = inv.payments.filter(p => p.type === "CREDIT").reduce((s, p) => s + p.amount, 0);
            outByEmp[eid] = (outByEmp[eid] || 0) + (inv.total - paid);
        }

        const totalRevenue = employees.reduce((s, e) => s + (wonByEmp[e.id] || 0), 0);

        res.json(employees.map(e => {
            const empDeals  = dealsByEmp[e.id] || [];
            const wonCount  = wonCntByEmp[e.id] || 0;
            const totalAmt  = empDeals.reduce((s, d) => s + d.amount, 0);
            const winRate   = empDeals.length > 0 ? Math.round((wonCount / empDeals.length) * 100) : 0;
            const avgDeal   = empDeals.length > 0 ? Math.round(totalAmt / empDeals.length) : 0;
            const revenue   = wonByEmp[e.id] || 0;
            const contrib   = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
            return {
                id: e.id, name: e.name, email: e.email, profilePhoto: e.profilePhoto,
                dealsWon:          wonCount,
                revenueGenerated:  parseFloat(revenue.toFixed(2)),
                collectedRevenue:  parseFloat((collByEmp[e.id] || 0).toFixed(2)),
                avgDealSize:       avgDeal,
                winRate,
                outstandingAmount: parseFloat((outByEmp[e.id] || 0).toFixed(2)),
                contribution:      contrib,
            };
        }).sort((a, b) => b.revenueGenerated - a.revenueGenerated));
    } catch (err) {
        return next(err);
    }
};

module.exports = { getKPIs, getLeadChart, getEmployeeTable, getTeamEmails, getWorkforce, getWorkload, getWorkflowBoard, getWorkflowColumnLeads, getRevenueKPIs, getRevenueTrend, getRevenueByEmployee, getRevenueBySource, getRevenueByManager, getInvoiceCollectionTrend, getRevenueEmployeeTable };
