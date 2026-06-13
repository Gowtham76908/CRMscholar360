const prisma   = require("../utils/prisma");
const engine   = require("../services/leadDistributionEngine");
const { getTeamMemberIds } = require("../services/organizationService");
const { leadLoadRecalculationJob } = require("../services/leadLoadScheduler");
const { ApiError } = require("../utils/apiError");

// ── Unassigned lead pool ──────────────────────────────────────────────────────

/**
 * GET /distribution/unassigned
 * SUPER_ADMIN: all unassigned leads
 * MANAGER:     unassigned leads (no ownership filter — manager can claim any)
 */
const getUnassignedLeads = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const page   = Math.max(1, parseInt(req.query.page  || "1", 10));
        const limit  = Math.min(100, parseInt(req.query.limit || "25", 10));
        const skip   = (page - 1) * limit;
        const search = req.query.search?.trim();
        const source = req.query.source;

        const where = {
            assignedToId: null,
            ...(source && { source }),
            ...(search  && {
                OR: [
                    { name:  { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search, mode: "insensitive" } },
                ],
            }),
        };

        const [leads, total] = await prisma.$transaction([
            prisma.lead.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id:          true,
                    name:        true,
                    email:       true,
                    phone:       true,
                    source:      true,
                    status:      true,
                    score:       true,
                    createdAt:   true,
                    enquiryType: true,
                },
            }),
            prisma.lead.count({ where }),
        ]);

        res.json({
            leads,
            pagination: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (err) {
        return next(err);
    }
};

// ── Employee availability list (for assignment dropdowns) ─────────────────────

/**
 * GET /distribution/available-employees
 * Returns employees who are ONLINE + accepting leads + under capacity.
 * MANAGER sees only own team. SUPER_ADMIN sees all.
 */
const getAvailableEmployees = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        let userWhere = {
            isActive: true,
            employeeProfile: {
                availabilityStatus: "ONLINE",
                isAcceptingLeads:   true,
            },
        };

        if (role === "ADMIN") {
            userWhere.managerId = userId;
        }

        const employees = await prisma.user.findMany({
            where: userWhere,
            select: {
                id:      true,
                name:    true,
                email:   true,
                department: true,
                jobTitle:   true,
                employeeProfile: {
                    select: {
                        availabilityStatus: true,
                        isAcceptingLeads:   true,
                        currentLeadLoad:    true,
                        maxDailyLeads:      true,
                        performanceScore:   true,
                        lastAssignedAt:     true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        // No load-cap filter: the engine no longer treats maxDailyLeads as a
        // routing gate. currentLeadLoad is returned in the payload so admins
        // can spot heavy queues visually.
        res.json(employees);
    } catch (err) {
        return next(err);
    }
};

// ── Manual assign ─────────────────────────────────────────────────────────────

/**
 * POST /distribution/assign
 * Body: { leadId, employeeId }
 * MANAGER: can only assign to own team employees.
 * SUPER_ADMIN: can assign to anyone.
 */
const manualAssign = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { leadId, employeeId } = req.body;

        if (!leadId || !employeeId) {
            return res.status(400).json({ message: "leadId and employeeId are required" });
        }

        if (role === "ADMIN") {
            const teamIds = await getTeamMemberIds(userId);
            if (!teamIds.includes(employeeId)) {
                return res.status(403).json({ message: "You can only assign to your own team members" });
            }
        }

        const result = await engine.assignLead(leadId, {
            employeeId,
            actorId: userId,
            reason:  "MANUAL_REASSIGNMENT",
        });

        if (result.error) return res.status(400).json({ message: result.error });
        res.json({ message: "Lead assigned", lead: result.lead });
    } catch (err) {
        return next(err);
    }
};

// ── Bulk auto-assign ──────────────────────────────────────────────────────────

/**
 * POST /distribution/bulk-assign
 * Body: { leadIds?: string[], all?: boolean }
 * Runs auto-distribution over the unassigned pool (or a specific set).
 * MANAGER: restricts scoring to own team.
 */
const bulkAutoAssign = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        let { leadIds, all } = req.body;

        if (all) {
            const rows = await prisma.lead.findMany({
                where: { assignedToId: null },
                select: { id: true },
                take: 500, // safety cap per request
            });
            leadIds = rows.map(r => r.id);
        }

        if (!leadIds?.length) {
            return res.status(400).json({ message: "leadIds is required or use all:true" });
        }

        const opts = role === "ADMIN" ? { managerId: userId, actorId: userId } : { actorId: userId };
        const summary = await engine.assignLeads(leadIds, opts);

        res.json(summary);
    } catch (err) {
        return next(err);
    }
};

// ── Claim ─────────────────────────────────────────────────────────────────────

/**
 * POST /distribution/claim/:leadId
 * Manager assigns an unassigned lead to themselves or to a specific employee.
 * Body (optional): { employeeId }
 */
const claimLead = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { leadId } = req.params;
        const { employeeId } = req.body || {};

        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        // Only allow claiming unassigned leads via this endpoint
        if (lead.assignedToId) {
            return res.status(400).json({ message: "Lead is already assigned. Use the reassign endpoint." });
        }

        let targetEmployee = employeeId;

        if (targetEmployee && role === "ADMIN") {
            const teamIds = await getTeamMemberIds(userId);
            if (!teamIds.includes(targetEmployee)) {
                return res.status(403).json({ message: "Target employee is not in your team" });
            }
        }

        if (!targetEmployee) {
            const mgr = role === "ADMIN" ? userId : null;
            targetEmployee = mgr ? await engine.findBestEmployee(mgr) : null;
            if (!targetEmployee) return res.status(400).json({ message: "No available employee to assign" });
        }

        const result = await engine.assignLead(leadId, {
            employeeId: targetEmployee,
            actorId: userId,
            reason: "CLAIMED",
        });

        if (result.error) return res.status(400).json({ message: result.error });
        res.json({ message: "Lead claimed", lead: result.lead });
    } catch (err) {
        return next(err);
    }
};

// ── Employee profile management ───────────────────────────────────────────────

/**
 * GET /distribution/profile/:employeeId
 */
const getProfile = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { userId, role } = req.user;

        if (role === "EMPLOYEE" && userId !== employeeId) {
            return res.status(403).json({ message: "Access denied" });
        }

        const profile = await prisma.employeeProfile.findUnique({
            where: { employeeId },
            include: { employee: { select: { id: true, name: true, email: true, role: true } } },
        });

        if (!profile) return res.status(404).json({ message: "Profile not found" });
        res.json(profile);
    } catch (err) {
        return next(err);
    }
};

/**
 * PATCH /distribution/profile/:employeeId
 * Employee: can toggle isAcceptingLeads and availabilityStatus on own profile.
 * MANAGER/SUPER_ADMIN: can update maxDailyLeads and all status fields for team members.
 */
const updateProfile = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { userId, role } = req.user;

        const isSelf    = userId === employeeId;
        const isAdmin   = ["SUPER_ADMIN", "ADMIN"].includes(role);

        if (!isSelf && !isAdmin) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (role === "ADMIN" && !isSelf) {
            const teamIds = await getTeamMemberIds(userId);
            if (!teamIds.includes(employeeId)) {
                return res.status(403).json({ message: "Employee is not in your team" });
            }
        }

        const allowed = {};
        const { isAcceptingLeads, availabilityStatus, maxDailyLeads } = req.body;

        // Any user can toggle their own acceptance and availability
        if (isAcceptingLeads !== undefined) allowed.isAcceptingLeads = Boolean(isAcceptingLeads);
        if (availabilityStatus !== undefined) {
            const valid = ["ONLINE", "OFFLINE", "ON_LEAVE"];
            if (!valid.includes(availabilityStatus)) {
                return res.status(400).json({ message: `availabilityStatus must be one of: ${valid.join(", ")}` });
            }
            allowed.availabilityStatus = availabilityStatus;
        }

        // Only admins can change capacity
        if (isAdmin && maxDailyLeads !== undefined) {
            allowed.maxDailyLeads = Math.max(1, parseInt(maxDailyLeads, 10));
        }

        const profile = await prisma.employeeProfile.upsert({
            where:  { employeeId },
            update: allowed,
            create: { employeeId, ...allowed },
        });

        res.json(profile);
    } catch (err) {
        return next(err);
    }
};

/**
 * POST /distribution/recalculate
 * SUPER_ADMIN only — manually trigger the hourly recalculation job.
 */
const triggerRecalculation = async (req, res, next) => {
    try {
        await leadLoadRecalculationJob();
        res.json({ message: "Lead load recalculation complete" });
    } catch (err) {
        return next(err);
    }
};

/**
 * GET /distribution/stats
 * Returns a quick overview for the unassigned-leads dashboard.
 */
const getDistributionStats = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        const [unassigned, availableEmployees, assignedToday] = await prisma.$transaction([
            prisma.lead.count({ where: { assignedToId: null } }),
            prisma.employeeProfile.count({
                where: { availabilityStatus: "ONLINE", isAcceptingLeads: true },
            }),
            prisma.lead.count({
                where: {
                    assignedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
            }),
        ]);

        res.json({ unassigned, availableEmployees, assignedToday });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getUnassignedLeads,
    getAvailableEmployees,
    manualAssign,
    bulkAutoAssign,
    claimLead,
    getProfile,
    updateProfile,
    triggerRecalculation,
    getDistributionStats,
};
