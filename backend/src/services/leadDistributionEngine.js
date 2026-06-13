/**
 * Lead Distribution Engine
 *
 * Distributes leads to employees by simple ROUND-ROBIN over an eligibility
 * filter. No "best employee" scoring — every employee in the pool gets work
 * in turn. The cursor is each employee's lastAssignedAt timestamp: whoever
 * was assigned the longest ago (or never) is next.
 *
 * Example: 10 employees, all idle.
 *   - 5 leads arrive  → emp 1..5 receive them (their lastAssignedAt is set)
 *   - 5 more arrive   → emp 6..10 receive them (they still have null lastAssignedAt)
 *   - 5 more arrive   → emp 1..5 receive them again (oldest in queue)
 *
 * Eligibility (hard gates):
 *   isActive === true                (user is active)
 *   isAcceptingLeads === true        (employee toggle says they want leads)
 *   availabilityStatus !== ON_LEAVE   (not on approved leave)
 *
 * OFFLINE is NOT a hard exclusion — an off-desk employee is still working.
 * They take their turn in the rotation just like ONLINE employees.
 *
 * NO LOAD CAP — the engine does not refuse to route based on how many open
 * leads an employee already has. Distribution is pure round-robin: if you
 * are eligible, you take your turn. If an employee falls behind, their queue
 * grows visibly via the currentLeadLoad metric and admins address it as a
 * people problem (toggle isAcceptingLeads, set ON_LEAVE, or have a chat).
 *
 * METRICS — currentLeadLoad / maxDailyLeads:
 *   These are tracked for visibility only, not enforced as a routing gate.
 *   currentLeadLoad reflects open-status leads (NEW | CONTACTED | FOLLOW_UP):
 *     - increments on assignment (+1)
 *     - decrements when the lead transitions to a terminal status (-1)
 *     - is reconciled hourly from actual open-lead count (drift correction)
 *   maxDailyLeads is informational — admins can compare currentLeadLoad
 *   against it to see who is over their target workload.
 *
 * All assignments run inside a serializable Prisma transaction that locks
 * the target EmployeeProfile row, preventing duplicate assignments under
 * concurrent intake. On lock-time eligibility failure (employee flipped to
 * ON_LEAVE or stopped accepting leads between the snapshot and the lock),
 * the engine retries with the next candidate in the queue (up to 3 attempts).
 *
 * Single-lead and batch paths both use a flat employee pool across all teams.
 */

const prisma = require("../utils/prisma");
const { randomUUID: uuidv4 } = require("crypto");

// ── helpers ──────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Derives performanceScore from four sub-score components (all 0–1).
 * Formula: 30% leadEffectiveness + 25% responseQuality +
 *          25% followupDiscipline + 20% attendanceReliability
 */
function calculatePerformanceScore(profile) {
    const le = clamp(profile.leadEffectiveness    ?? 0.5, 0, 1);
    const rq = clamp(profile.responseQuality      ?? 0.5, 0, 1);
    const fd = clamp(profile.followupDiscipline   ?? 0.5, 0, 1);
    const ar = clamp(profile.attendanceReliability ?? 0.5, 0, 1);
    return le * 0.30 + rq * 0.25 + fd * 0.25 + ar * 0.20;
}

/**
 * Adjust an employee's open-lead counter (metric).
 *   delta = +1 (lead newly assigned and in an open status)
 *   delta = -1 (lead transitioned to CONVERTED | LOST | MERGED)
 * Clamped to 0 on the floor so concurrent decrements can't drive it negative.
 * No upper clamp — the counter reflects reality, even when it exceeds
 * maxDailyLeads (which is informational only). The hourly recalc job
 * reconciles any drift against the actual open-lead count.
 */
async function adjustLeadLoad(employeeId, delta) {
    if (!employeeId) return;
    await prisma.$executeRawUnsafe(
        `UPDATE "EmployeeProfile"
         SET "currentLeadLoad" = GREATEST(0, "currentLeadLoad" + $1),
             "updatedAt" = NOW()
         WHERE "employeeId" = $2`,
        delta, employeeId
    );
}


// ── ensure profile exists ─────────────────────────────────────────────────────

async function ensureProfile(employeeId, tx = prisma) {
    const existing = await tx.employeeProfile.findUnique({ where: { employeeId } });
    if (existing) return existing;
    return tx.employeeProfile.create({
        data: { id: uuidv4(), employeeId },
    });
}

// ── eligibility ───────────────────────────────────────────────────────────────

/**
 * True if this employee profile is currently eligible to receive a lead.
 * No ranking — just a yes/no gate. Ordering happens in collectCandidates().
 */
function isEligible(profile) {
    if (!profile) return false;
    if (!profile.isAcceptingLeads) return false;
    if (profile.availabilityStatus === "ON_LEAVE") return false;
    return true;
}

/**
 * Returns every eligible employee in round-robin order:
 *   1. Employees who were never assigned a lead (lastAssignedAt = null) come first.
 *   2. Then by lastAssignedAt ascending (oldest first).
 *   3. Tiebreaker: employee id ascending (deterministic).
 *
 * Optionally restricted to one manager's team (used by MANAGER role).
 */
async function collectCandidates({ forcedManager } = {}) {
    const where = { isActive: true, role: "EMPLOYEE" };
    if (forcedManager) where.managerId = forcedManager;

    const employees = await prisma.user.findMany({
        where,
        select: {
            id: true,
            managerId: true,
            employeeProfile: {
                select: {
                    availabilityStatus: true,
                    isAcceptingLeads: true,
                    currentLeadLoad: true,
                    maxDailyLeads: true,
                    lastAssignedAt: true,
                },
            },
        },
    });

    const candidates = [];
    for (const emp of employees) {
        const profile = emp.employeeProfile;
        if (!isEligible(profile)) continue;
        candidates.push({
            id:             emp.id,
            managerId:      emp.managerId,
            lastAssignedAt: profile.lastAssignedAt,
        });
    }

    // Round-robin queue order: never-assigned first, then oldest first.
    candidates.sort((a, b) => {
        const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
        const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.id < b.id ? -1 : 1; // deterministic tiebreaker
    });
    return candidates;
}

async function findBestEmployee(managerId) {
    const candidates = await collectCandidates({ forcedManager: managerId });
    return candidates[0]?.id ?? null;
}

// ── core assignment ───────────────────────────────────────────────────────────

/**
 * Internal: the actual transactional write for a single (lead, employee) pair.
 * Returns { lead, employeeId, managerId } on success, { error } on a known
 * recoverable failure (EMPLOYEE_UNAVAILABLE | LEAD_NOT_FOUND).
 * Other errors propagate.
 */
async function _doAssign(leadId, targetEmployeeId, opts) {
    const { actorId, reason = "AUTO_ASSIGNMENT", forced = false } = opts;

    try {
        return await prisma.$transaction(async (tx) => {
            // Lock the target profile row to serialise concurrent assignments to the
            // same employee.
            const profiles = await tx.$queryRawUnsafe(
                `SELECT * FROM "EmployeeProfile" WHERE "employeeId" = $1 FOR UPDATE`,
                targetEmployeeId
            );
            let profile = profiles[0];

            if (!profile) {
                await tx.$executeRawUnsafe(
                    `INSERT INTO "EmployeeProfile" ("id","employeeId","updatedAt")
                     VALUES ($1,$2,NOW())
                     ON CONFLICT ("employeeId") DO NOTHING`,
                    uuidv4(), targetEmployeeId
                );
                const p2 = await tx.$queryRawUnsafe(
                    `SELECT * FROM "EmployeeProfile" WHERE "employeeId" = $1 FOR UPDATE`,
                    targetEmployeeId
                );
                profile = p2[0];
            }

            // Lock-time eligibility re-check. Manual force-assign skips this so an
            // admin can override (e.g. assign to an on-leave employee).
            if (!forced) {
                if (profile.availabilityStatus === "ON_LEAVE" || !profile.isAcceptingLeads) {
                    throw new Error("EMPLOYEE_UNAVAILABLE");
                }
            }

            const lead = await tx.lead.findUnique({ where: { id: leadId } });
            if (!lead) throw new Error("LEAD_NOT_FOUND");

            const previousEmployeeId = lead.assignedToId || null;
            const now = new Date();

            const updated = await tx.lead.update({
                where: { id: leadId },
                data:  { assignedToId: targetEmployeeId, assignedAt: now },
                include: { assignedTo: { select: { id: true, name: true, email: true } } },
            });

            await tx.$executeRawUnsafe(
                `UPDATE "EmployeeProfile"
                 SET "currentLeadLoad" = GREATEST(0, "currentLeadLoad" + 1),
                     "lastAssignedAt"  = $1,
                     "updatedAt"       = $1
                 WHERE "employeeId" = $2`,
                now, targetEmployeeId
            );

            if (previousEmployeeId && previousEmployeeId !== targetEmployeeId) {
                await tx.$executeRawUnsafe(
                    `UPDATE "EmployeeProfile"
                     SET "currentLeadLoad" = GREATEST(0, "currentLeadLoad" - 1),
                         "updatedAt" = $1
                     WHERE "employeeId" = $2`,
                    now, previousEmployeeId
                );
            }

            await tx.assignmentHistory.create({
                data: { leadId, employeeId: targetEmployeeId, previousEmployeeId, reason },
            });

            const employee = await tx.user.findUnique({
                where: { id: targetEmployeeId },
                select: { name: true, managerId: true },
            });
            await tx.activity.create({
                data: {
                    leadId,
                    // null for system-initiated assigns (no human actor)
                    userId: actorId || null,
                    action: previousEmployeeId ? "LEAD_REASSIGNED" : "LEAD_ASSIGNED",
                    metadata: {
                        newEmployeeId:   targetEmployeeId,
                        newEmployeeName: employee?.name,
                        previousEmployeeId,
                        reason,
                    },
                },
            });

            return { lead: updated, employeeId: targetEmployeeId, managerId: employee?.managerId };
        }, {
            isolationLevel: "Serializable",
            timeout: 10_000,
        });
    } catch (err) {
        if (["EMPLOYEE_UNAVAILABLE", "LEAD_NOT_FOUND"].includes(err.message)) {
            return { error: err.message };
        }
        throw err;
    }
}

/**
 * Assign a single lead.
 *
 * If `employeeId` is provided, force-assigns to that user (bypasses eligibility).
 * Otherwise picks the next employee in round-robin order. If the lock-time
 * eligibility check fails (another concurrent assign grabbed the slot), retries
 * with the next candidate, up to 3 attempts total.
 *
 * @param {string}  leadId
 * @param {object}  opts
 * @param {string}  [opts.employeeId]  - force-assign to this employee (manual)
 * @param {string}  [opts.managerId]   - restrict round-robin to this manager's team
 * @param {string}  [opts.actorId]     - user performing the action (null for system)
 * @param {string}  [opts.reason]      - AUTO_ASSIGNMENT | MANUAL_REASSIGNMENT | CLAIMED
 * @returns {{ lead, employeeId, managerId } | { error }}
 */
async function assignLead(leadId, opts = {}) {
    const { employeeId: forcedEmployee, managerId: forcedManager } = opts;

    if (forcedEmployee) {
        return _doAssign(leadId, forcedEmployee, { ...opts, forced: true });
    }

    const candidates = await collectCandidates({ forcedManager });
    if (candidates.length === 0) {
        return {
            error: forcedManager
                ? "No available employee in selected manager's team"
                : "No available employee",
        };
    }

    const MAX_ATTEMPTS = Math.min(3, candidates.length);
    let lastError = null;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const result = await _doAssign(leadId, candidates[i].id, opts);
        if (!result.error) return result;
        // LEAD_NOT_FOUND is terminal — retrying won't help.
        if (result.error === "LEAD_NOT_FOUND") return result;
        // EMPLOYEE_UNAVAILABLE → status changed between snapshot and lock,
        // try the next candidate in the queue.
        lastError = result.error;
    }
    return { error: lastError || "No available employee after retries" };
}

// ── bulk assignment ───────────────────────────────────────────────────────────

/**
 * Auto-assign an array of lead IDs.
 * Processes sequentially so the scoring reflects updated loads after each pick.
 * Returns a summary { assigned, failed, results }.
 */
async function assignLeads(leadIds, opts = {}) {
    const results = [];
    let assigned = 0;
    let failed   = 0;

    for (const leadId of leadIds) {
        const r = await assignLead(leadId, opts);
        if (r.error) {
            failed++;
            results.push({ leadId, status: "failed", reason: r.error });
        } else {
            assigned++;
            results.push({ leadId, status: "assigned", employeeId: r.employeeId });
        }
    }

    return { assigned, failed, total: leadIds.length, results };
}

// ── batch assignment (optimised for bulk imports) ─────────────────────────────

/**
 * Assign an array of lead IDs in bulk.
 *
 * Unlike assignLeads() (which opens one serializable transaction per lead),
 * this function:
 *   1. Collects the flat candidate pool ONCE (employee-first, all teams).
 *   2. Distributes leads across eligible employees in memory (round-robin,
 *      score-ordered, capacity-bounded).
 *   3. Writes everything in two passes:
 *        - One transaction: updateMany per employee + EmployeeProfile counters.
 *        - Chunked createMany outside the transaction: AssignmentHistory + Activity.
 *
 * Safe for imports of 10 000+ leads.
 *
 * @param {string[]} leadIds
 * @param {{ managerId?: string, actorId?: string }} opts
 * @returns {{ assigned: number, failed: number, total: number }}
 */
async function batchAssignLeads(leadIds, opts = {}) {
    if (!leadIds || leadIds.length === 0) return { assigned: 0, failed: 0, total: 0 };

    const { managerId: forcedManager, actorId } = opts;

    // ── 1. Collect eligible employees (already ordered round-robin: never-assigned
    //       first, then oldest lastAssignedAt). No re-sort.
    const candidates = await collectCandidates({ forcedManager });
    if (candidates.length === 0) {
        return { assigned: 0, failed: leadIds.length, total: leadIds.length };
    }

    // ── 2. Distribute leads in memory (pure round-robin, no cap) ───────────
    const assignmentMap = new Map(); // employeeId → leadId[]

    for (let i = 0; i < leadIds.length; i++) {
        const c = candidates[i % candidates.length];
        if (!assignmentMap.has(c.id)) assignmentMap.set(c.id, []);
        assignmentMap.get(c.id).push(leadIds[i]);
    }

    // ── 4. Fetch employee names for activity log (read-only, outside tx) ──
    const empIds = [...assignmentMap.keys()];
    const empUsers = await prisma.user.findMany({
        where: { id: { in: empIds } },
        select: { id: true, name: true },
    });
    const empNameMap = new Map(empUsers.map(u => [u.id, u.name]));

    // ── 5. Atomic write: lead assignments + profile counters ──────────────
    const now = new Date();
    const CHUNK = 500; // max IN-clause size per updateMany

    await prisma.$transaction(async (tx) => {
        for (const [empId, ids] of assignmentMap) {
            // Update leads in chunks to keep IN clauses bounded
            for (let i = 0; i < ids.length; i += CHUNK) {
                await tx.lead.updateMany({
                    where: { id: { in: ids.slice(i, i + CHUNK) } },
                    data: { assignedToId: empId, assignedAt: now },
                });
            }
            // Increment employee load metric — no cap, the counter reflects reality.
            await tx.$executeRawUnsafe(
                `UPDATE "EmployeeProfile"
                 SET "currentLeadLoad" = GREATEST(0, "currentLeadLoad" + $1),
                     "lastAssignedAt"  = $2,
                     "updatedAt"       = $2
                 WHERE "employeeId" = $3`,
                ids.length, now, empId
            );
        }
    }, { timeout: 60_000 });

    // ── 6. Non-transactional logging (history + activity) ─────────────────
    // These are append-only audit rows; a partial failure here is acceptable
    // and does not corrupt the core lead data written above.
    const historyRows = [];
    const activityRows = [];
    for (const [empId, ids] of assignmentMap) {
        for (const leadId of ids) {
            historyRows.push({ leadId, employeeId: empId, previousEmployeeId: null, reason: "AUTO_ASSIGNMENT" });
            activityRows.push({
                leadId,
                // null for system-initiated assigns (no human actor)
                userId: actorId || null,
                action: "LEAD_ASSIGNED",
                metadata: { newEmployeeId: empId, newEmployeeName: empNameMap.get(empId), reason: "AUTO_ASSIGNMENT" },
            });
        }
    }

    for (let i = 0; i < historyRows.length; i += CHUNK) {
        await prisma.assignmentHistory.createMany({ data: historyRows.slice(i, i + CHUNK) });
    }
    for (let i = 0; i < activityRows.length; i += CHUNK) {
        await prisma.activity.createMany({ data: activityRows.slice(i, i + CHUNK) });
    }

    return {
        assigned: leadIds.length,
        failed: 0,
        total: leadIds.length,
    };
}

// ── unassigned-backlog alert ──────────────────────────────────────────────────
//
// Replaces the cron-poll approach: when an immediate auto-assign fails (no
// eligible employee), we push an in-app notification to admins. Throttled by an
// in-memory cooldown so a burst of 50 failed assigns produces one alert, not 50.

const UNASSIGNED_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
let _lastUnassignedAlertAt = 0;

async function notifyAdminsOfUnassignedBacklog() {
    const now = Date.now();
    if (now - _lastUnassignedAlertAt < UNASSIGNED_ALERT_COOLDOWN_MS) return;
    _lastUnassignedAlertAt = now;

    const unassignedCount = await prisma.lead.count({ where: { assignedToId: null } });
    if (unassignedCount === 0) return;

    const admins = await prisma.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
        select: { id: true },
    });
    if (admins.length === 0) return;

    const title = "Leads need manual assignment";
    const message = `${unassignedCount} lead${unassignedCount === 1 ? "" : "s"} could not be auto-assigned — no employee was eligible. Please allocate them.`;

    await Promise.all(admins.map(a =>
        prisma.notification.create({
            data: {
                userId:  a.id,
                title,
                message,
                type:    "UNASSIGNED_LEAD_BACKLOG",
                link:    "/unassigned-leads",
            },
        }).catch(err => console.error("[Unassigned alert] notify failed:", err.message || err))
    ));
}

/**
 * Convenience wrapper used by intake paths: attempts auto-assignment and, on
 * failure, fires a throttled admin notification. Always resolves with the
 * assignLead result so callers can log / inspect.
 */
async function assignLeadOrAlert(leadId, opts = {}) {
    const result = await assignLead(leadId, opts);
    if (result?.error) {
        // Fire-and-forget — never block the caller.
        notifyAdminsOfUnassignedBacklog().catch(err =>
            console.error("[Unassigned alert] cooldown handler failed:", err.message || err)
        );
    }
    return result;
}

module.exports = {
    assignLead,
    assignLeadOrAlert,
    assignLeads,
    batchAssignLeads,
    findBestEmployee,
    isEligible,
    ensureProfile,
    adjustLeadLoad,
    calculatePerformanceScore,
    notifyAdminsOfUnassignedBacklog,
};
