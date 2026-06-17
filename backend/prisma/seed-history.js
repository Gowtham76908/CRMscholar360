/**
 * Historical stage-event seed for analytics development.
 *
 * Populates LeadDepartmentStageEvent (the historical ledger) with realistic,
 * backdated workflow progressions so the Phase 2 reports/charts/timeline can be
 * validated against meaningful data BEFORE real production usage exists.
 *
 * What it generates (default 500 leads, ~90 days of history):
 *   - A Lead + SALES service for every lead, walking ENQUIRY → FOLLOW_UP → … with
 *     realistic gaps between transitions; a minority branch to ARCHIVE (lost).
 *   - ~35% of leads also get an extra department service (LOAN/FOREX/…), entering
 *     ENQUIRY a little after Sales and progressing on their own timeline.
 *   - One LeadDepartmentStageEvent per transition (fromStage=null = entry).
 *
 * Safe + re-runnable: every lead it creates is tagged with an `@seed.history`
 * email; each run first deletes the previous batch (cascades to services/events),
 * leaving the main seed's data untouched. Requires the main seed's users to exist.
 *
 * Usage (from backend/):
 *   node prisma/seed-history.js [leadCount] [historyDays]
 *   node prisma/seed-history.js 500 90
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
const { getStages, WON_STAGES, LOST_STAGES } = require("../src/config/departmentWorkflows");
const prisma = new PrismaClient();

const LEAD_COUNT   = parseInt(process.argv[2], 10) || 500;
const HISTORY_DAYS = parseInt(process.argv[3], 10) || 90;
const SEED_DOMAIN  = "seed.history";

const pick   = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;
const DAY    = 86_400_000;
const NOW    = Date.now();
const daysAgo = (n) => new Date(NOW - n * DAY);

const SOURCES   = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];
const ENQUIRIES = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];
const FIRST = ["Aarav","Vivaan","Aditya","Diya","Ananya","Ishaan","Kavya","Rohan","Meera","Arjun",
    "Saanvi","Reyansh","Anika","Vihaan","Myra","Kabir","Aadhya","Dhruv","Pari","Krish",
    "Sara","Ayaan","Riya","Advik","Navya","Yuvan","Ira","Shaurya","Aisha","Vivek"];
const LAST = ["Sharma","Verma","Nair","Iyer","Reddy","Patel","Gupta","Menon","Pillai","Das",
    "Kumar","Rao","Babu","Singh","Bose","Desai","Choudhary","Kapoor","Nambiar","Suresh"];

// Insert in chunks to stay well under Postgres parameter limits.
async function createManyChunked(model, rows, size = 500) {
    let n = 0;
    for (let i = 0; i < rows.length; i += size) {
        const res = await model.createMany({ data: rows.slice(i, i + size), skipDuplicates: true });
        n += res.count;
    }
    return n;
}

/**
 * Build one department journey: an ordered list of stage transitions with realistic
 * backdated timestamps, plus the resulting final LeadDepartment state.
 *
 * @returns { stage, createdAt, updatedAt, events:[{fromStage,toStage,at}] }
 */
function buildJourney(department, startDate) {
    const stages = getStages(department);
    if (!stages.length) return null;

    const lost = LOST_STAGES[department] || [];
    const won  = WON_STAGES[department] || [];

    // How far along the workflow this service got. Weighted toward earlier stages
    // (most enquiries don't convert), but allow a healthy tail of completions.
    const maxIdx = stages.length - 1;
    let depth = Math.min(maxIdx, Math.floor(Math.pow(Math.random(), 1.7) * (maxIdx + 1)));

    // Build the linear path of stages this service moved THROUGH (excluding
    // terminal won/lost stages, which we may append explicitly below).
    const linear = stages.filter((s) => !won.includes(s) && !lost.includes(s));
    const path = linear.slice(0, Math.max(1, Math.min(depth + 1, linear.length)));

    // A minority of services reach an outcome: mostly won, some lost.
    if (depth >= 2) {
        if (lost.length && chance(0.15)) path.push(pick(lost));
        else if (won.length && chance(0.45)) path.push(won[won.length - 1]);
    }

    // Walk the path, spacing transitions a few days apart, never past "now".
    const events = [];
    let cursor = startDate.getTime();
    let prev = null;
    for (const stage of path) {
        if (prev !== null) cursor = Math.min(NOW, cursor + rand(1, 12) * DAY);
        events.push({ fromStage: prev, toStage: stage, at: new Date(cursor) });
        prev = stage;
    }

    return {
        stage: path[path.length - 1],
        createdAt: events[0].at,
        updatedAt: events[events.length - 1].at,
        events,
    };
}

async function main() {
    console.log(`Historical seed → ${LEAD_COUNT} leads over ${HISTORY_DAYS} days\n`);

    // ── Resolve real users by department (the main seed must have run) ───────────
    const memberships = await prisma.userDepartment.findMany({
        include: { user: { select: { id: true, role: true, isActive: true } } },
    });
    if (!memberships.length) {
        throw new Error("No UserDepartment rows found — run the main seed (npm run build / prisma db seed) first.");
    }
    const byDept = {}; // department → [userId] of active consultants
    for (const m of memberships) {
        if (!m.user?.isActive) continue;
        (byDept[m.department] ||= []).push(m.user.id);
    }
    const consultantFor = (dept) => {
        const pool = byDept[dept] || [];
        return pool.length ? pick(pool) : null;
    };

    const EXTRA_DEPTS = ["LOAN", "FOREX", "ACCOMMODATION_TICKETS", "MISCELLANEOUS"]
        .filter((d) => (byDept[d] || []).length > 0 && getStages(d).length > 0);

    // ── Reset previous history-seed batch (cascades to services + events) ────────
    const del = await prisma.lead.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
    if (del.count) console.log(`Cleared ${del.count} previously seeded history leads\n`);

    // ── Build everything in memory with explicit UUIDs (no per-row round-trips) ──
    const leadRows = [];
    const serviceRows = [];
    const eventRows = [];
    const toStageTally = {}; // for the summary

    for (let i = 0; i < LEAD_COUNT; i++) {
        const leadId = randomUUID();
        const name = `${pick(FIRST)} ${pick(LAST)}`;
        const createdDaysAgo = rand(1, HISTORY_DAYS);
        const leadCreatedAt = daysAgo(createdDaysAgo);

        leadRows.push({
            id: leadId,
            name,
            email: `lead${i}.${randomUUID().slice(0, 6)}@${SEED_DOMAIN}`,
            phone: `+91${rand(7000000000, 9999999999)}`,
            source: pick(SOURCES),
            enquiryType: pick(ENQUIRIES),
            score: rand(20, 95),
            createdAt: leadCreatedAt,
            customFields: { seedHistory: true },
        });

        // Plan SALES + maybe one extra department service.
        const plans = [{ department: "SALES", start: leadCreatedAt }];
        if (EXTRA_DEPTS.length && chance(0.35)) {
            // Extra dept enquiry begins a little after the sales enquiry.
            const offset = Math.min(createdDaysAgo - 1, rand(0, 10));
            plans.push({ department: pick(EXTRA_DEPTS), start: daysAgo(createdDaysAgo - offset) });
        }

        for (const plan of plans) {
            const journey = buildJourney(plan.department, plan.start);
            if (!journey) continue;
            const serviceId = randomUUID();
            const consultantId = chance(0.8) ? consultantFor(plan.department) : null;

            serviceRows.push({
                id: serviceId,
                leadId,
                department: plan.department,
                stage: journey.stage,
                assignedEmployeeId: consultantId,
                assignedAt: consultantId ? journey.createdAt : null,
                createdAt: journey.createdAt,
                updatedAt: journey.updatedAt,
            });

            for (const ev of journey.events) {
                // ~15% of entries are system/programmatic intake (null actor);
                // the rest are attributed to the handling consultant.
                const changedByUserId =
                    ev.fromStage === null && chance(0.15) ? null : (consultantId || consultantFor(plan.department));
                eventRows.push({
                    leadDepartmentId: serviceId,
                    department: plan.department,
                    fromStage: ev.fromStage,
                    toStage: ev.toStage,
                    changedByUserId,
                    createdAt: ev.at,
                });
                toStageTally[ev.toStage] = (toStageTally[ev.toStage] || 0) + 1;
            }
        }
    }

    // ── Bulk insert: leads → services → events (FK order) ────────────────────────
    console.log("Inserting...");
    const nLeads = await createManyChunked(prisma.lead, leadRows);
    console.log(`  ✓ ${nLeads} leads`);
    const nServices = await createManyChunked(prisma.leadDepartment, serviceRows);
    console.log(`  ✓ ${nServices} department services`);
    const nEvents = await createManyChunked(prisma.leadDepartmentStageEvent, eventRows);
    console.log(`  ✓ ${nEvents} stage events`);

    // ── Summary (what the historical reports will now show) ──────────────────────
    const since = daysAgo(30);
    const last30 = eventRows.filter((e) => e.createdAt >= since);
    const tally30 = {};
    for (const e of last30) tally30[e.toStage] = (tally30[e.toStage] || 0) + 1;

    console.log("\n════════════════════════════════════════");
    console.log("  Historical seed complete");
    console.log("════════════════════════════════════════");
    console.log("Moves into each stage (last 30 days):");
    Object.entries(tally30).sort((a, b) => b[1] - a[1]).forEach(([s, c]) =>
        console.log(`  ${s.padEnd(24)} ${c}`));
    console.log(`\nEnquiries received (all-time): ${toStageTally.ENQUIRY || 0}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
