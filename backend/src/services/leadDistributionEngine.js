/**
 * Lead Distribution Engine
 *
 * Scores managers and employees to fairly distribute leads.
 * All assignments run inside a serializable Prisma transaction that
 * locks the target EmployeeProfile row, preventing duplicate ownership
 * under concurrent bulk imports.
 *
 * Manager priority (per lead):
 *   40% team workload ratio (lower = better)
 *   30% active available employee count (more = better)
 *   20% time since most-recent team assignment (longer = better)
 *   10% average team performance score (higher = better)
 *
 * Employee priority:
 *   35% workload headroom  (1 – load/max)
 *   25% availability       (ONLINE + accepting = 1.0, else 0)
 *   20% assignment cooldown (time since lastAssignedAt, capped at 8 h)
 *   10% performance score
 *   10% response speed     (lower hours = better, capped at 24 h)
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
 * Immediately adjust an employee's currentLeadLoad counter.
 * delta = +1 (new active lead) or -1 (lead closed/converted/lost).
 * Clamps to [0, maxDailyLeads] so it never goes negative.
 */
async function adjustLeadLoad(employeeId, delta) {
    if (!employeeId) return;
    await prisma.$executeRawUnsafe(
        `UPDATE "EmployeeProfile"
         SET "currentLeadLoad" = GREATEST(0, LEAST("maxDailyLeads", "currentLeadLoad" + $1)),
             "updatedAt" = NOW()
         WHERE "employeeId" = $2`,
        delta, employeeId
    );
}

function hoursAgo(date) {
    if (!date) return Infinity;
    return (Date.now() - new Date(date).getTime()) / 3_600_000;
}

/** 0-1 score: more time elapsed = higher score, capped at `maxHours`. */
function cooldownScore(date, maxHours) {
    if (!date) return 1.0;
    return clamp(hoursAgo(date) / maxHours, 0, 1);
}

// ── ensure profile exists ─────────────────────────────────────────────────────

async function ensureProfile(employeeId, tx = prisma) {
    const existing = await tx.employeeProfile.findUnique({ where: { employeeId } });
    if (existing) return existing;
    return tx.employeeProfile.create({
        data: { id: uuidv4(), employeeId },
    });
}

// ── manager scoring ───────────────────────────────────────────────────────────

async function scoreManagers() {
    const managers = await prisma.user.findMany({
        where: { role: { in: ["MANAGER", "SUPER_ADMIN"] }, isActive: true },
        select: { id: true },
    });

    const scored = await Promise.all(managers.map(async (m) => {
        const employees = await prisma.user.findMany({
            where: { managerId: m.id, isActive: true, role: "EMPLOYEE" },
            select: {
                id: true,
                employeeProfile: {
                    select: {
                        availabilityStatus: true,
                        isAcceptingLeads: true,
                        currentLeadLoad: true,
                        maxDailyLeads: true,
                        lastAssignedAt: true,
                        performanceScore: true,
                    },
                },
            },
        });

        const active = employees.filter(e =>
            e.employeeProfile?.availabilityStatus === "ONLINE" &&
            e.employeeProfile?.isAcceptingLeads === true &&
            (e.employeeProfile?.currentLeadLoad ?? 0) < (e.employeeProfile?.maxDailyLeads ?? 20)
        );

        if (active.length === 0) return null; // manager ineligible

        // 40% team workload — avg load ratio across all employees (lower = better)
        const totalMax   = employees.reduce((s, e) => s + (e.employeeProfile?.maxDailyLeads ?? 20), 0);
        const totalLoad  = employees.reduce((s, e) => s + (e.employeeProfile?.currentLeadLoad ?? 0), 0);
        const teamRatio  = totalMax > 0 ? totalLoad / totalMax : 0;
        const workloadS  = 1 - teamRatio; // invert: lower load → higher score

        // 30% active employee headroom (more available employees = better)
        const activeS = clamp(active.length / 10, 0, 1); // normalise against 10

        // 20% recency — time since the most-recently-assigned employee in team
        const latestAssigned = employees
            .map(e => e.employeeProfile?.lastAssignedAt)
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0];
        const recencyS = cooldownScore(latestAssigned, 4); // 4 h cap

        // 10% avg team performance
        const perfScores = employees
            .map(e => e.employeeProfile?.performanceScore ?? 0.5)
            .filter(Boolean);
        const avgPerf = perfScores.length > 0
            ? perfScores.reduce((a, b) => a + b, 0) / perfScores.length
            : 0.5;

        const score = workloadS * 0.4 + activeS * 0.3 + recencyS * 0.2 + avgPerf * 0.1;

        return { managerId: m.id, score, activeCount: active.length };
    }));

    return scored.filter(Boolean).sort((a, b) => b.score - a.score);
}

// ── employee scoring ──────────────────────────────────────────────────────────

function scoreEmployee(profile) {
    const available =
        profile.availabilityStatus === "ONLINE" && profile.isAcceptingLeads;
    if (!available) return -1;

    const load      = profile.currentLeadLoad ?? 0;
    const maxLoad   = profile.maxDailyLeads   ?? 20;
    if (load >= maxLoad) return -1;

    const headroom  = 1 - clamp(load / maxLoad, 0, 1);           // 35%
    const avail     = 1.0;                                         // 25% (already checked)
    const cooldown  = cooldownScore(profile.lastAssignedAt, 8);   // 20%
    const perf      = clamp(profile.performanceScore ?? 0.5, 0, 1); // 10%
    const speed     = profile.responseSpeed != null
        ? 1 - clamp(profile.responseSpeed / 24, 0, 1)             // 10%
        : 0.5;

    return headroom * 0.35 + avail * 0.25 + cooldown * 0.20 + perf * 0.10 + speed * 0.10;
}

async function findBestEmployee(managerId) {
    const employees = await prisma.user.findMany({
        where: { managerId, isActive: true, role: "EMPLOYEE" },
        select: {
            id: true,
            employeeProfile: true,
        },
    });

    let best = null;
    let bestScore = -Infinity;

    for (const emp of employees) {
        const profile = emp.employeeProfile;
        if (!profile) continue;
        const s = scoreEmployee(profile);
        if (s >= 0 && s > bestScore) { bestScore = s; best = emp.id; }
    }

    return best; // null if nobody is available
}

// ── core assignment ───────────────────────────────────────────────────────────

/**
 * Assign a single lead.
 * Runs inside a serializable transaction + SELECT FOR UPDATE on the profile row
 * to prevent simultaneous duplicate assignments.
 *
 * @param {string}  leadId
 * @param {object}  opts
 * @param {string}  [opts.employeeId]  - force-assign to this employee (manual)
 * @param {string}  [opts.managerId]   - restrict search to this manager's team
 * @param {string}  [opts.actorId]     - user performing the action (for history)
 * @param {string}  [opts.reason]      - AUTO_ASSIGNMENT | MANUAL_REASSIGNMENT | CLAIMED
 * @returns {{ lead, employeeId, managerId } | { error }}
 */
async function assignLead(leadId, opts = {}) {
    const {
        employeeId: forcedEmployee,
        managerId:  forcedManager,
        actorId,
        reason = "AUTO_ASSIGNMENT",
    } = opts;

    try {
        // ── 1. Pick target employee outside the transaction (scoring reads, not writes)
        let targetEmployeeId = forcedEmployee;

        if (!targetEmployeeId) {
            let mgr = forcedManager;

            if (!mgr) {
                const ranked = await scoreManagers();
                if (ranked.length === 0) return { error: "No eligible manager found" };
                mgr = ranked[0].managerId;
            }

            targetEmployeeId = await findBestEmployee(mgr);
            if (!targetEmployeeId) return { error: "No available employee in selected manager's team" };
        }

        // ── 2. Assign inside a serializable transaction with row-level lock
        const result = await prisma.$transaction(async (tx) => {
            // Lock profile row — prevents concurrent assignments to the same employee
            const profiles = await tx.$queryRawUnsafe(
                `SELECT * FROM "EmployeeProfile" WHERE "employeeId" = $1 FOR UPDATE`,
                targetEmployeeId
            );

            let profile = profiles[0];

            // If no profile yet, create one and re-lock
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

            // Guard: capacity check inside lock
            if (!forcedEmployee) {
                if (profile.availabilityStatus !== "ONLINE" || !profile.isAcceptingLeads) {
                    throw new Error("EMPLOYEE_UNAVAILABLE");
                }
                if (profile.currentLeadLoad >= profile.maxDailyLeads) {
                    throw new Error("CAPACITY_EXCEEDED");
                }
            }

            const lead = await tx.lead.findUnique({ where: { id: leadId } });
            if (!lead) throw new Error("LEAD_NOT_FOUND");

            const previousEmployeeId = lead.assignedToId || null;
            const now = new Date();

            // Update lead
            const updated = await tx.lead.update({
                where: { id: leadId },
                data:  { assignedToId: targetEmployeeId, assignedAt: now },
                include: { assignedTo: { select: { id: true, name: true, email: true } } },
            });

            // Increment new employee's load, decrement previous (if reassignment)
            await tx.$executeRawUnsafe(
                `UPDATE "EmployeeProfile"
                 SET "currentLeadLoad" = GREATEST(0, LEAST("maxDailyLeads", "currentLeadLoad" + 1)),
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

            // Assignment history
            await tx.assignmentHistory.create({
                data: {
                    leadId,
                    employeeId:         targetEmployeeId,
                    previousEmployeeId,
                    reason,
                },
            });

            // Timeline event
            const employee = await tx.user.findUnique({
                where: { id: targetEmployeeId },
                select: { name: true, managerId: true },
            });
            await tx.activity.create({
                data: {
                    leadId,
                    userId: actorId || targetEmployeeId,
                    action: previousEmployeeId ? "LEAD_REASSIGNED" : "LEAD_ASSIGNED",
                    metadata: {
                        newEmployeeId:      targetEmployeeId,
                        newEmployeeName:    employee?.name,
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

        return result;
    } catch (err) {
        if (["EMPLOYEE_UNAVAILABLE", "CAPACITY_EXCEEDED", "LEAD_NOT_FOUND"].includes(err.message)) {
            return { error: err.message };
        }
        throw err;
    }
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
 *   1. Scores all managers + employees ONCE.
 *   2. Distributes leads across eligible employees in memory (round-robin,
 *      score-ordered, capacity-bounded).
 *   3. Writes everything in two passes:
 *        - One transaction: updateMany per employee + EmployeeProfile counters.
 *        - Chunked createMany outside the transaction: AssignmentHistory + Activity.
 *
 * This reduces N serializable transactions → ~(2E + 2) queries for E employees,
 * making it safe for imports of 10 000+ leads.
 *
 * @param {string[]} leadIds
 * @param {{ managerId?: string, actorId?: string }} opts
 * @returns {{ assigned: number, failed: number, total: number }}
 */
async function batchAssignLeads(leadIds, opts = {}) {
    if (!leadIds || leadIds.length === 0) return { assigned: 0, failed: 0, total: 0 };

    const { managerId: forcedManager, actorId } = opts;

    // ── 1. Determine manager pool ─────────────────────────────────────────
    let managerIds;
    if (forcedManager) {
        managerIds = [forcedManager];
    } else {
        const ranked = await scoreManagers();
        managerIds = ranked.map(r => r.managerId);
    }

    if (managerIds.length === 0) {
        return { assigned: 0, failed: leadIds.length, total: leadIds.length };
    }

    // ── 2. Collect eligible employees across all managers ─────────────────
    const seenEmpIds = new Set();
    const candidates = [];

    for (const mgId of managerIds) {
        const employees = await prisma.user.findMany({
            where: { managerId: mgId, isActive: true, role: "EMPLOYEE" },
            select: { id: true, employeeProfile: true },
        });
        for (const emp of employees) {
            if (seenEmpIds.has(emp.id)) continue; // guard against duplicate employee rows
            seenEmpIds.add(emp.id);
            const profile = emp.employeeProfile;
            if (!profile) continue;
            const score = scoreEmployee(profile);
            if (score < 0) continue; // unavailable or at capacity
            const capacity = Math.max(0, (profile.maxDailyLeads ?? 20) - (profile.currentLeadLoad ?? 0));
            if (capacity === 0) continue;
            candidates.push({ id: emp.id, managerId: mgId, score, capacity });
        }
    }

    if (candidates.length === 0) {
        return { assigned: 0, failed: leadIds.length, total: leadIds.length };
    }

    // Best-score first so the highest-performing employees get leads first
    candidates.sort((a, b) => b.score - a.score);

    // ── 3. Distribute leads in memory (round-robin, capacity-bounded) ──────
    const assignmentMap = new Map(); // employeeId → leadId[]
    const failedLeads = [];
    let idx = 0;

    for (const leadId of leadIds) {
        let assigned = false;
        for (let attempt = 0; attempt < candidates.length; attempt++) {
            const c = candidates[(idx + attempt) % candidates.length];
            if (c.capacity > 0) {
                if (!assignmentMap.has(c.id)) assignmentMap.set(c.id, []);
                assignmentMap.get(c.id).push(leadId);
                c.capacity--;
                // Advance past this slot so the next lead goes to the next candidate
                idx = (idx + attempt + 1) % candidates.length;
                assigned = true;
                break;
            }
        }
        if (!assigned) failedLeads.push(leadId);
    }

    if (assignmentMap.size === 0) {
        return { assigned: 0, failed: leadIds.length, total: leadIds.length };
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
            // Increment employee load atomically (LEAST prevents exceeding maxDailyLeads)
            await tx.$executeRawUnsafe(
                `UPDATE "EmployeeProfile"
                 SET "currentLeadLoad" = LEAST("maxDailyLeads", "currentLeadLoad" + $1),
                     "lastAssignedAt"  = $2,
                     "updatedAt"       = $2
                 WHERE "employeeId" = $3`,
                assignmentMap.get(empId).length, now, empId
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
                userId: actorId || empId,
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
        assigned: leadIds.length - failedLeads.length,
        failed: failedLeads.length,
        total: leadIds.length,
    };
}

module.exports = {
    assignLead,
    assignLeads,
    batchAssignLeads,
    scoreManagers,
    findBestEmployee,
    ensureProfile,
    adjustLeadLoad,
    calculatePerformanceScore,
};
