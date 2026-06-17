const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const { isValidDepartment, getStageLabel } = require("../config/departmentWorkflows");
const { isMemberOfDepartment, getUserDepartments } = require("./leadDepartmentService");

/**
 * Historical analytics — derived from the LeadDepartmentStageEvent ledger, i.e.
 * "what happened over time", as opposed to departmentAnalyticsService which counts
 * the current LeadDepartment.stage snapshot ("what exists right now"). Both are
 * kept; this module never touches current-state counts.
 *
 * Every query is scoped to the actor exactly like the snapshot analytics:
 *   Director (SUPER_ADMIN) — any department, any consultant
 *   Manager  (ADMIN)       — only the departments they belong to
 *   Consultant (EMPLOYEE)  — only their own activity (changedByUserId = self)
 */

// ── Date helpers (UTC, consistent with departmentAnalyticsService) ─────────────

const DAY = 86_400_000;
const startOfDayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Parse a YYYY-MM-DD string into a UTC Date at the start/end of that day. */
function parseDate(str, endOfDay = false) {
    if (!str) return null;
    return new Date(str + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"));
}

/** Resolve a {from, to} range, defaulting to the last 30 days. */
function resolveRange(from, to) {
    const toDate = parseDate(to, true) || new Date();
    const fromDate = parseDate(from) || new Date(toDate.getTime() - 30 * DAY);
    return { fromDate, toDate };
}

// ── Actor scoping ──────────────────────────────────────────────────────────────

/**
 * Build the Prisma `where` for the stage-event ledger, scoped to the actor. Used by
 * every aggregate query so scoping lives in exactly one place. Throws 400/403 on
 * invalid department / lack of access.
 */
async function buildEventScope({ actor, department, changedByUserId, fromDate, toDate }) {
    if (department && !isValidDepartment(department)) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid department: ${department}`);
    }

    const where = { createdAt: { gte: fromDate, lte: toDate } };

    if (actor.role === "EMPLOYEE") {
        // A consultant only ever sees their own work.
        where.changedByUserId = actor.userId;
        if (department) where.department = department;
    } else if (actor.role === "ADMIN") {
        const managed = await getUserDepartments(actor.userId);
        if (department) {
            if (!(await isMemberOfDepartment(actor.userId, department))) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not manage this department");
            }
            where.department = department;
        } else {
            // No explicit department → restrict to the manager's departments.
            where.department = { in: managed.length ? managed : ["__none__"] };
        }
        if (changedByUserId) where.changedByUserId = changedByUserId;
    } else if (actor.role === "SUPER_ADMIN") {
        if (department) where.department = department;
        if (changedByUserId) where.changedByUserId = changedByUserId;
    } else {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
    }

    return where;
}

// ── Time-series bucketing (UTC) ────────────────────────────────────────────────

/** The UTC start of the bucket a date falls in, for the given granularity. */
function bucketStart(date, granularity) {
    const d = startOfDayUTC(date);
    if (granularity === "day") return d;
    if (granularity === "week") {
        // ISO week: Monday start (matches Postgres date_trunc('week')).
        const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
        return new Date(d.getTime() - dow * DAY);
    }
    if (granularity === "month") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    if (granularity === "year") return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d;
}

/** Advance a bucket start to the next bucket. */
function nextBucket(date, granularity) {
    if (granularity === "week") return new Date(date.getTime() + 7 * DAY);
    if (granularity === "month") return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    if (granularity === "year") return new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
    return new Date(date.getTime() + DAY); // day
}

/**
 * Stage activity over time → [{ bucket: "YYYY-MM-DD", count }], zero-filled across
 * the whole range so charts have no gaps. `toStage` narrows to a single metric
 * (e.g. ENQUIRY = "enquiries received", APPROVED = "approvals").
 */
async function getStageTimeSeries({ department, toStage, granularity = "day", from, to, actor }) {
    const { fromDate, toDate } = resolveRange(from, to);
    const where = await buildEventScope({ actor, department, fromDate, toDate });
    if (toStage) where.toStage = toStage;

    const rows = await prisma.leadDepartmentStageEvent.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    // Tally into buckets.
    const counts = new Map();
    for (const r of rows) {
        const key = bucketStart(r.createdAt, granularity).toISOString().slice(0, 10);
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    // Zero-fill the full range so the series is continuous.
    const series = [];
    let cursor = bucketStart(fromDate, granularity);
    const end = bucketStart(toDate, granularity);
    while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        series.push({ bucket: key, count: counts.get(key) || 0 });
        cursor = nextBucket(cursor, granularity);
    }

    return { granularity, from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10), total: rows.length, series };
}

/**
 * Department throughput: how many services MOVED INTO each stage during the range
 * (group by toStage). This is the historical counterpart to the snapshot funnel.
 */
async function getDepartmentThroughput({ department, from, to, actor }) {
    if (!department) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "department is required");
    }
    const { fromDate, toDate } = resolveRange(from, to);
    const where = await buildEventScope({ actor, department, fromDate, toDate });

    const grouped = await prisma.leadDepartmentStageEvent.groupBy({
        by: ["toStage"],
        where,
        _count: { _all: true },
    });

    const byStage = grouped
        .map((g) => ({ stage: g.toStage, label: getStageLabel(g.toStage), count: g._count._all }))
        .sort((a, b) => b.count - a.count);

    const total = byStage.reduce((s, r) => s + r.count, 0);
    return { department, from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10), total, byStage };
}

/**
 * Employee activity: a consultant's stage moves in the range, grouped by toStage.
 * "What work was performed by this consultant." A consultant may only query self.
 */
async function getEmployeeStageActivity({ changedByUserId, department, from, to, actor }) {
    if (!changedByUserId) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "employee id is required");
    }
    if (actor.role === "EMPLOYEE" && changedByUserId !== actor.userId) {
        throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You can only view your own activity");
    }
    const { fromDate, toDate } = resolveRange(from, to);
    const where = await buildEventScope({ actor, department, changedByUserId, fromDate, toDate });

    const grouped = await prisma.leadDepartmentStageEvent.groupBy({
        by: ["toStage"],
        where,
        _count: { _all: true },
    });

    const byStage = grouped
        .map((g) => ({ stage: g.toStage, label: getStageLabel(g.toStage), count: g._count._all }))
        .sort((a, b) => b.count - a.count);

    const total = byStage.reduce((s, r) => s + r.count, 0);
    return { changedByUserId, from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10), total, byStage };
}

/**
 * The full chronological progression of ONE service — the data behind
 * Lead Details → Journey → Activity Timeline. Visibility mirrors the queue:
 * consultants see only their own assignments; managers their departments.
 */
async function getServiceTimeline(leadDepartmentId, actor) {
    const svc = await prisma.leadDepartment.findUnique({
        where: { id: leadDepartmentId },
        select: { id: true, leadId: true, department: true, assignedEmployeeId: true },
    });
    if (!svc) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Department service not found");

    if (actor.role === "EMPLOYEE") {
        if (svc.assignedEmployeeId !== actor.userId) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot view this service");
        }
    } else if (actor.role === "ADMIN") {
        const ok = svc.assignedEmployeeId === actor.userId || (await isMemberOfDepartment(actor.userId, svc.department));
        if (!ok) throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot view this service");
    }

    const events = await prisma.leadDepartmentStageEvent.findMany({
        where: { leadDepartmentId },
        orderBy: { createdAt: "asc" },
        include: { changedByUser: { select: { id: true, name: true } } },
    });

    return {
        leadDepartmentId: svc.id,
        leadId: svc.leadId,
        department: svc.department,
        events: events.map((e) => ({
            id: e.id,
            fromStage: e.fromStage,
            fromLabel: e.fromStage ? getStageLabel(e.fromStage) : null,
            toStage: e.toStage,
            toLabel: getStageLabel(e.toStage),
            at: e.createdAt,
            by: e.changedByUser ? { id: e.changedByUser.id, name: e.changedByUser.name } : null,
        })),
    };
}

module.exports = {
    getStageTimeSeries,
    getDepartmentThroughput,
    getEmployeeStageActivity,
    getServiceTimeline,
};
