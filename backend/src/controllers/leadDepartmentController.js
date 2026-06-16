const leadDepartmentService = require("../services/leadDepartmentService");
const departmentAnalyticsService = require("../services/departmentAnalyticsService");
const {
    DEPARTMENT_WORKFLOWS,
    STAGE_LABELS,
    DEPARTMENTS,
    getStageLabel,
} = require("../config/departmentWorkflows");

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

// ── Analytics (per-department dashboards / reports) ────────────────────────────

// GET /api/lead-departments/dashboard?department=SALES
const getDashboard = async (req, res, next) => {
    try {
        const data = await departmentAnalyticsService.getDepartmentDashboard({
            department: req.query.department,
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
    updateStage,
    remove,
    getQueue,
    getBoardQueue,
    getDashboard,
    getWorkload,
    getMyDepartments,
    getMembers,
    addMember,
    removeMember,
};
