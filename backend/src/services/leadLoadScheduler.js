const cron = require("node-cron");
const prisma = require("../utils/prisma");
const { calculatePerformanceScore } = require("./leadDistributionEngine");

/**
 * Recalculates per-employee metrics every hour (repair / drift-correction).
 * currentLeadLoad is kept real-time by the engine; this job is the safety net.
 *
 * NOTE: currentLeadLoad is a CONCURRENT-OPEN counter (despite the legacy
 * "maxDailyLeads" field name). See leadDistributionEngine.js header for
 * the full semantics.
 *
 * Fields updated:
 *   currentLeadLoad      — open leads (NEW | CONTACTED | FOLLOW_UP)
 *   responseSpeed        — avg hours assignedAt → firstResponseAt (capped 24 h)
 *   leadEffectiveness    — conversion rate among closed leads
 *   responseQuality      — fraction of leads responded to within 2 h
 *   followupDiscipline   — fraction of leads with ≥1 follow-up activity
 *   attendanceReliability — fraction of working days present (approx via attendance)
 *   performanceScore     — derived: 30%LE + 25%RQ + 25%FD + 20%AR
 */
async function leadLoadRecalculationJob() {
    const employees = await prisma.user.findMany({
        where: { role: "EMPLOYEE", isActive: true },
        select: { id: true },
    });

    for (const { id } of employees) {
        // ── gather raw data in one transaction ──────────────────────────────
        const [
            openLeads,
            closedLeads,
            convertedLeads,
            respondedLeads,
            followedUpLeads,
            attendanceRows,
        ] = await prisma.$transaction([
            // Active lead count
            prisma.lead.count({
                where: { assignedToId: id, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP"] } },
            }),
            // Total closed (terminal) leads — denominator for effectiveness
            prisma.lead.count({
                where: { assignedToId: id, status: { in: ["CONVERTED", "LOST"] } },
            }),
            // Converted
            prisma.lead.count({
                where: { assignedToId: id, status: "CONVERTED" },
            }),
            // Leads with a measured first-response time
            prisma.lead.findMany({
                where: {
                    assignedToId:    id,
                    firstResponseAt: { not: null },
                    assignedAt:      { not: null },
                },
                select: { assignedAt: true, firstResponseAt: true },
            }),
            // Leads that have at least one follow-up activity after initial contact
            prisma.lead.findMany({
                where: { assignedToId: id },
                select: {
                    id: true,
                    activities: {
                        where: { action: { in: ["FOLLOW_UP_ADDED", "CALL_LOGGED", "NOTE_ADDED", "EMAIL_SENT"] } },
                        select: { id: true },
                        take: 1,
                    },
                },
            }),
            // Last 30 days of attendance records
            prisma.attendance.findMany({
                where: {
                    userId:    id,
                    checkIn:   { gte: new Date(Date.now() - 30 * 24 * 3_600_000) },
                },
                select: { id: true },
            }),
        ]);

        // ── responseSpeed ────────────────────────────────────────────────────
        let responseSpeed = 1.0;
        if (respondedLeads.length > 0) {
            const total = respondedLeads.reduce((sum, l) => {
                const h = (new Date(l.firstResponseAt) - new Date(l.assignedAt)) / 3_600_000;
                return sum + Math.min(h, 24);
            }, 0);
            responseSpeed = total / respondedLeads.length;
        }

        // ── leadEffectiveness: conversion rate among closed leads (0-1) ──────
        const leadEffectiveness = closedLeads > 0
            ? Math.min(convertedLeads / closedLeads, 1)
            : 0.5;

        // ── responseQuality: fraction responded within 2 h ──────────────────
        const respondedWithin2h = respondedLeads.filter(l => {
            const h = (new Date(l.firstResponseAt) - new Date(l.assignedAt)) / 3_600_000;
            return h <= 2;
        }).length;
        const responseQuality = respondedLeads.length > 0
            ? respondedWithin2h / respondedLeads.length
            : 0.5;

        // ── followupDiscipline: fraction of leads with ≥1 follow-up ─────────
        const totalLeads = followedUpLeads.length;
        const withFollowUp = followedUpLeads.filter(l => l.activities.length > 0).length;
        const followupDiscipline = totalLeads > 0
            ? withFollowUp / totalLeads
            : 0.5;

        // ── attendanceReliability: attendance days / ~22 working days ────────
        const EXPECTED_WORKING_DAYS = 22;
        const attendanceReliability = Math.min(
            attendanceRows.length / EXPECTED_WORKING_DAYS,
            1
        );

        // ── derive performanceScore ──────────────────────────────────────────
        const performanceScore = calculatePerformanceScore({
            leadEffectiveness,
            responseQuality,
            followupDiscipline,
            attendanceReliability,
        });

        await prisma.employeeProfile.upsert({
            where:  { employeeId: id },
            update: {
                currentLeadLoad:      openLeads,
                responseSpeed,
                leadEffectiveness,
                responseQuality,
                followupDiscipline,
                attendanceReliability,
                performanceScore,
            },
            create: {
                employeeId:           id,
                currentLeadLoad:      openLeads,
                responseSpeed,
                leadEffectiveness,
                responseQuality,
                followupDiscipline,
                attendanceReliability,
                performanceScore,
            },
        });
    }

    console.log(`[Scheduler] Lead load recalculated for ${employees.length} employees`);
}

function startScheduler() {
    leadLoadRecalculationJob().catch(err =>
        console.error("[Scheduler] Initial recalculation failed:", err.message)
    );

    cron.schedule("0 * * * *", () => {
        leadLoadRecalculationJob().catch(err =>
            console.error("[Scheduler] Hourly recalculation failed:", err.message)
        );
    });

    console.log("[Scheduler] Lead load scheduler started (runs every hour)");
}

module.exports = { startScheduler, leadLoadRecalculationJob };
