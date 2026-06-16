const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const {
    isValidDepartment,
    getStages,
    getStageLabel,
    isWonStage,
    isLostStage,
    getTerminalStages,
} = require("../config/departmentWorkflows");
const { isMemberOfDepartment } = require("./leadDepartmentService");

/**
 * Per-department analytics — every metric is computed from LeadDepartment.stage,
 * NOT the legacy Lead.status. There is no global funnel: each department has its
 * own stages, conversion, aging and workload. Visibility is scoped to the actor:
 *   Director (SUPER_ADMIN) — any department
 *   Manager  (ADMIN)       — only departments they belong to
 *   Consultant (EMPLOYEE)  — only their own assignments within the department
 */

// Build the LeadDepartment `where` scope for an actor + department.
async function buildScope(department, actor) {
    if (!isValidDepartment(department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department: ${department}`);
    }
    const where = { department };
    if (actor.role === "EMPLOYEE") {
        where.assignedEmployeeId = actor.userId;
    } else if (actor.role === "ADMIN") {
        if (!(await isMemberOfDepartment(actor.userId, department))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not manage this department");
        }
    } else if (actor.role !== "SUPER_ADMIN") {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
    }
    return where;
}

/**
 * Dashboard payload for one department: the full stage funnel (in workflow order),
 * totals, today's intake, unassigned count, won/lost/active counts, conversion
 * rate, and an aging breakdown of active services.
 */
async function getDepartmentDashboard({ department, actor }) {
    const where = await buildScope(department, actor);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Aging cutoffs for active (non-terminal) services, by updatedAt.
    const now = Date.now();
    const warnCut = new Date(now - 3 * 86_400_000);
    const staleCut = new Date(now - 7 * 86_400_000);
    const terminal = getTerminalStages(department);

    const [grouped, total, newToday, unassigned, agingWarn, agingStale] = await prisma.$transaction([
        prisma.leadDepartment.groupBy({ by: ["stage"], where, _count: { _all: true } }),
        prisma.leadDepartment.count({ where }),
        prisma.leadDepartment.count({ where: { ...where, createdAt: { gte: today } } }),
        prisma.leadDepartment.count({ where: { ...where, assignedEmployeeId: null } }),
        prisma.leadDepartment.count({
            where: { ...where, stage: { notIn: terminal }, updatedAt: { lt: warnCut, gte: staleCut } },
        }),
        prisma.leadDepartment.count({
            where: { ...where, stage: { notIn: terminal }, updatedAt: { lt: staleCut } },
        }),
    ]);

    const countByStage = Object.fromEntries(grouped.map(g => [g.stage, g._count._all]));

    // Funnel in canonical workflow order, with display labels.
    const funnel = getStages(department).map(code => ({
        code,
        label: getStageLabel(code),
        count: countByStage[code] || 0,
        won: isWonStage(department, code),
        lost: isLostStage(department, code),
    }));

    let won = 0, lost = 0;
    for (const g of grouped) {
        if (isWonStage(department, g.stage)) won += g._count._all;
        else if (isLostStage(department, g.stage)) lost += g._count._all;
    }
    const active = total - won - lost;
    // Conversion = won / (decided outcomes). Falls back to won/total when nothing
    // is lost yet, so an all-active department reads 0% rather than NaN.
    const decided = won + lost;
    const conversionRate = decided > 0 ? Math.round((won / decided) * 1000) / 10 : 0;

    return {
        department,
        total,
        newToday,
        unassigned,
        won,
        lost,
        active,
        conversionRate,
        funnel,
        aging: {
            warning: agingWarn, // 3–7 days idle
            stale: agingStale,  // 7+ days idle
        },
    };
}

/**
 * Workload by consultant within a department: active service count per assignee.
 * Director/manager view; a consultant only ever sees their own row.
 */
async function getDepartmentWorkload({ department, actor }) {
    const where = await buildScope(department, actor);
    const terminal = getTerminalStages(department);

    const grouped = await prisma.leadDepartment.groupBy({
        by: ["assignedEmployeeId"],
        where: { ...where, stage: { notIn: terminal }, assignedEmployeeId: { not: null } },
        _count: { _all: true },
    });

    const ids = grouped.map(g => g.assignedEmployeeId);
    const users = ids.length
        ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
        : [];
    const nameById = Object.fromEntries(users.map(u => [u.id, u.name]));

    return grouped
        .map(g => ({ userId: g.assignedEmployeeId, name: nameById[g.assignedEmployeeId] || "—", active: g._count._all }))
        .sort((a, b) => b.active - a.active);
}

module.exports = { getDepartmentDashboard, getDepartmentWorkload };
