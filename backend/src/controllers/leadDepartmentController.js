const leadDepartmentService = require("../services/leadDepartmentService");
const departmentAnalyticsService = require("../services/departmentAnalyticsService");
const departmentHistoryService = require("../services/departmentHistoryService");
const {
    DEPARTMENT_WORKFLOWS,
    STAGE_LABELS,
    DEPARTMENTS,
    getStageLabel,
} = require("../config/departmentWorkflows");

const GRANULARITIES = ["day", "week", "month", "year"];

/**
 * HTTP layer for the multi-department lead model. All authorization lives in
 * leadDepartmentService; controllers just unpack req, build the `actor`, and map
 * service results to responses. `actor` is always { userId, role }.
 */
const actorOf = (req) => ({ userId: req.user.userId, role: req.user.role });

// ── Workflow config (frontend reads this to render stages) ─────────────────────

// GET /api/lead-departments/workflows
const getWorkflows = (_req, res) => {
    // Shape the config for the client: ordered stages with display labels per dept.
    const departments = DEPARTMENTS.map((department) => ({
        department,
        stages: (DEPARTMENT_WORKFLOWS[department] || []).map((code) => ({
            code,
            label: getStageLabel(code),
        })),
        hasWorkflow: (DEPARTMENT_WORKFLOWS[department] || []).length > 0,
    }));
    res.json({ departments, stageLabels: STAGE_LABELS });
};

// ── Lead-scoped: a lead's department services ──────────────────────────────────

// GET /api/leads/:id/departments
const listForLead = async (req, res, next) => {
    try {
        const assignments = await leadDepartmentService.getDepartmentAssignments({
            leadId: req.params.id,
            actor: actorOf(req),
        });
        res.json(assignments);
    } catch (err) {
        return next(err);
    }
};

// POST /api/leads/:id/departments   body: { departments: ["LOAN", ...] }
const allocate = async (req, res, next) => {
    try {
        const assignments = await leadDepartmentService.allocateDepartments({
            leadId: req.params.id,
            departments: req.body.departments,
            actor: actorOf(req),
        });
        res.status(201).json(assignments);
    } catch (err) {
        return next(err);
    }
};

// ── Per-assignment actions (by LeadDepartment id) ──────────────────────────────

// PATCH /api/lead-departments/:leadDepartmentId/assign   body: { consultantId }
const assignConsultant = async (req, res, next) => {
    try {
        const updated = await leadDepartmentService.assignConsultant({
            leadDepartmentId: req.params.leadDepartmentId,
            consultantId: req.body.consultantId,
            actor: actorOf(req),
        });
        res.json(updated);
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/lead-departments/bulk-assign   body: { leadDepartmentIds, consultantId }
const assignConsultantBulk = async (req, res, next) => {
    try {
        const updated = await leadDepartmentService.assignConsultantBulk({
            leadDepartmentIds: req.body.leadDepartmentIds,
            consultantId: req.body.consultantId,
            actor: actorOf(req),
        });
        res.json(updated);
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/lead-departments/:leadDepartmentId/claim
// Consultant self-claim of an unassigned enquiry-stage service (no approval).
const claimService = async (req, res, next) => {
    try {
        const updated = await leadDepartmentService.claimService({
            leadDepartmentId: req.params.leadDepartmentId,
            actor: actorOf(req),
        });
        res.json(updated);
    } catch (err) {
        return next(err);
    }
};

// POST /api/lead-departments/:leadDepartmentId/reassign-request   body: { toUserId, reason? }
// Consultant requests a (re)assignment that a department manager must approve.
const requestReassignment = async (req, res, next) => {
    try {
        const request = await leadDepartmentService.requestReassignment({
            leadDepartmentId: req.params.leadDepartmentId,
            toUserId: req.body.toUserId,
            reason: req.body.reason || null,
            actor: actorOf(req),
        });
        res.status(201).json(request);
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/lead-departments/reassign-requests/:requestId   body: { decision: "APPROVE" | "REJECT" }
const decideReassignment = async (req, res, next) => {
    try {
        const result = await leadDepartmentService.decideReassignment({
            requestId: req.params.requestId,
            decision: req.body.decision,
            actor: actorOf(req),
        });
        res.json(result);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/reassign-requests?department=SALES   (manager / Director)
const getReassignmentRequests = async (req, res, next) => {
    try {
        const requests = await leadDepartmentService.getPendingReassignmentRequests({
            department: req.query.department,
            actor: actorOf(req),
        });
        res.json(requests);
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/lead-departments/:leadDepartmentId/stage   body: { stage }
const updateStage = async (req, res, next) => {
    try {
        const updated = await leadDepartmentService.updateStage({
            leadDepartmentId: req.params.leadDepartmentId,
            stage: req.body.stage,
            actor: actorOf(req),
        });
        res.json(updated);
    } catch (err) {
        return next(err);
    }
};

// DELETE /api/lead-departments/:leadDepartmentId
const remove = async (req, res, next) => {
    try {
        const result = await leadDepartmentService.removeDepartment({
            leadDepartmentId: req.params.leadDepartmentId,
            actor: actorOf(req),
        });
        res.json(result);
    } catch (err) {
        return next(err);
    }
};

// ── Department queue (manager / consultant work list) ──────────────────────────

// GET /api/lead-departments/queue?department=SALES&stage=&assignedEmployeeId=&search=
const getQueue = async (req, res, next) => {
    try {
        const rows = await leadDepartmentService.getDepartmentQueue({
            department: req.query.department,
            actor: actorOf(req),
            filters: {
                stage: req.query.stage || undefined,
                assignedEmployeeId: req.query.assignedEmployeeId || undefined,
                search: req.query.search || undefined,
            },
        });
        res.json(rows);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/board?department=SALES&page=1&perStage=10&assignedEmployeeId=&search=
// Per-stage-paginated variant for the Leads Board view — every column gets its
// own `perStage` rows for the given page, so one busy stage can't starve the
// others the way a single flat `skip/take` over the whole department would.
// See getDepartmentBoardByStage.
const getBoardQueue = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const perStage = Math.min(50, Math.max(1, parseInt(req.query.perStage, 10) || 10));
        const result = await leadDepartmentService.getDepartmentBoardByStage({
            department: req.query.department,
            actor: actorOf(req),
            filters: {
                assignedEmployeeId: req.query.assignedEmployeeId || undefined,
                search: req.query.search || undefined,
            },
            page,
            perStage,
        });
        res.json(result);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/dashboard?department=SALES&assignedEmployeeId=&startDate=&endDate=
const getDashboard = async (req, res, next) => {
    try {
        const data = await departmentAnalyticsService.getDepartmentDashboard({
            department: req.query.department,
            assignedEmployeeId: req.query.assignedEmployeeId || undefined,
            startDate: req.query.startDate || undefined,
            endDate: req.query.endDate || undefined,
            actor: actorOf(req),
        });
        res.json(data);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/workload?department=SALES
const getWorkload = async (req, res, next) => {
    try {
        const data = await departmentAnalyticsService.getDepartmentWorkload({
            department: req.query.department,
            actor: actorOf(req),
        });
        res.json(data);
    } catch (err) {
        return next(err);
    }
};

// ── Historical analytics (LeadDepartmentStageEvent ledger) ─────────────────────

// GET /api/lead-departments/reports/timeseries?department=&toStage=&granularity=day&from=&to=
// Stage activity over time. Omit `department` for an org-wide series (scoped to the
// actor's departments for a manager). `toStage=ENQUIRY` = "enquiries received".
const getHistoryTimeSeries = async (req, res, next) => {
    try {
        const granularity = GRANULARITIES.includes(req.query.granularity) ? req.query.granularity : "day";
        const data = await departmentHistoryService.getStageTimeSeries({
            department: req.query.department || undefined,
            toStage: req.query.toStage || undefined,
            granularity,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            actor: actorOf(req),
        });
        res.json(data);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/reports/throughput?department=SALES&from=&to=
// How many services moved into each stage during the range (group by toStage).
const getHistoryThroughput = async (req, res, next) => {
    try {
        const data = await departmentHistoryService.getDepartmentThroughput({
            department: req.query.department,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            actor: actorOf(req),
        });
        res.json(data);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/reports/employee-activity?employeeId=&department=&from=&to=
// A consultant's stage moves in the range. Defaults to the caller when employeeId
// is omitted; consultants may only ever query themselves (enforced in the service).
const getHistoryEmployeeActivity = async (req, res, next) => {
    try {
        const data = await departmentHistoryService.getEmployeeStageActivity({
            changedByUserId: req.query.employeeId || req.user.userId,
            department: req.query.department || undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            actor: actorOf(req),
        });
        res.json(data);
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/:leadDepartmentId/timeline
// Full chronological progression of one service (Lead Details → Journey → Timeline).
const getServiceTimeline = async (req, res, next) => {
    try {
        const data = await departmentHistoryService.getServiceTimeline(
            req.params.leadDepartmentId,
            actorOf(req),
        );
        res.json(data);
    } catch (err) {
        return next(err);
    }
};

// ── Membership ─────────────────────────────────────────────────────────────────

// GET /api/lead-departments/memberships/me  → the caller's departments
const getMyDepartments = async (req, res, next) => {
    try {
        const departments = await leadDepartmentService.getUserDepartments(req.user.userId);
        res.json({ departments });
    } catch (err) {
        return next(err);
    }
};

// GET /api/lead-departments/members?department=SALES
const getMembers = async (req, res, next) => {
    try {
        const members = await leadDepartmentService.getDepartmentMembers(req.query.department);
        res.json(members);
    } catch (err) {
        return next(err);
    }
};

// POST /api/lead-departments/members   body: { userId, department }   (Director only)
const addMember = async (req, res, next) => {
    try {
        const membership = await leadDepartmentService.addMembership({
            userId: req.body.userId,
            department: req.body.department,
            actor: actorOf(req),
        });
        res.status(201).json(membership);
    } catch (err) {
        return next(err);
    }
};

// DELETE /api/lead-departments/members   body: { userId, department }   (Director only)
const removeMember = async (req, res, next) => {
    try {
        const result = await leadDepartmentService.removeMembership({
            userId: req.body.userId,
            department: req.body.department,
            actor: actorOf(req),
        });
        res.json(result);
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getWorkflows,
    listForLead,
    allocate,
    assignConsultant,
    assignConsultantBulk,
    claimService,
    requestReassignment,
    decideReassignment,
    getReassignmentRequests,
    updateStage,
    remove,
    getQueue,
    getBoardQueue,
    getDashboard,
    getWorkload,
    getHistoryTimeSeries,
    getHistoryThroughput,
    getHistoryEmployeeActivity,
    getServiceTimeline,
    getMyDepartments,
    getMembers,
    addMember,
    removeMember,
};
