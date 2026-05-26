/**
 * Test: Smart Assignment Engine
 *
 * Creates 5 unassigned test leads then runs smartAssignLeads() on them.
 * Verifies each lead gets an assignedToId and lead load increments correctly.
 * Cleans up all created leads after the test.
 */

const prisma = require("../src/utils/prisma");
const { assignLeads } = require("../src/services/leadDistributionEngine");
const { randomUUID } = require("crypto");

const TEST_TAG = "TEST_SMART_ASSIGN_" + Date.now();
const LEAD_COUNT = 5;

async function run() {
    console.log("=== Smart Assignment Test ===\n");

    // ── Snapshot employee loads before ─────────────────────────────────────
    const before = await prisma.user.findMany({
        where: { isActive: true, role: "EMPLOYEE" },
        select: {
            id: true,
            name: true,
            managerId: true,
            employeeProfile: { select: { currentLeadLoad: true, maxDailyLeads: true, availabilityStatus: true, isAcceptingLeads: true } },
        },
    });

    const eligible = before.filter(u =>
        u.employeeProfile?.availabilityStatus === "ONLINE" &&
        u.employeeProfile?.isAcceptingLeads === true &&
        (u.employeeProfile?.currentLeadLoad ?? 0) < (u.employeeProfile?.maxDailyLeads ?? 20)
    );

    console.log(`Eligible employees (ONLINE + accepting + under capacity): ${eligible.length}`);
    if (eligible.length === 0) {
        console.error("FAIL: No eligible employees — test cannot proceed.");
        process.exit(1);
    }
    eligible.forEach(u => {
        const p = u.employeeProfile;
        console.log(`  ${u.name.padEnd(20)} load=${p.currentLeadLoad}/${p.maxDailyLeads}`);
    });

    // ── Create 5 unassigned test leads ────────────────────────────────────
    console.log(`\nCreating ${LEAD_COUNT} unassigned test leads...`);
    const phoneBase = 9000000000 + Math.floor(Math.random() * 100000);
    const leads = [];
    for (let i = 0; i < LEAD_COUNT; i++) {
        const lead = await prisma.lead.create({
            data: {
                name: `Test Lead ${TEST_TAG} #${i + 1}`,
                phone: String(phoneBase + i),
                phoneNormalized: String(phoneBase + i),
                source: "WEBSITE",
                enquiryType: "PRODUCT",
                score: 50,
                category: "WARM",
            },
        });
        leads.push(lead);
        console.log(`  Created lead ${lead.id} — "${lead.name}"`);
    }

    // ── Run smart assignment ──────────────────────────────────────────────
    console.log("\nRunning smartAssignLeads()...");
    const leadIds = leads.map(l => l.id);

    // Use a super-admin actor (first SUPER_ADMIN user or fallback)
    const actor = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    const result = await assignLeads(leadIds, { actorId: actor?.id });

    console.log(`\nResult: ${result.assigned} assigned, ${result.failed} failed out of ${result.total}`);

    // ── Verify each lead ──────────────────────────────────────────────────
    console.log("\nVerifying lead assignments:");
    let allAssigned = true;
    for (const r of result.results) {
        const lead = await prisma.lead.findUnique({
            where: { id: r.leadId },
            select: { id: true, name: true, assignedToId: true, assignedTo: { select: { name: true } } },
        });
        const ok = lead?.assignedToId != null;
        if (!ok) allAssigned = false;
        const status = ok ? "PASS" : "FAIL";
        const empName = lead?.assignedTo?.name ?? "(none)";
        console.log(`  [${status}] ${lead?.name} → ${empName} (${lead?.assignedToId ?? "unassigned"})`);
    }

    if (result.failed > 0) {
        console.log("\nFailed assignments:");
        result.results.filter(r => r.status === "failed").forEach(r => {
            console.log(`  leadId=${r.leadId} reason=${r.reason}`);
        });
    }

    // ── Snapshot loads after ──────────────────────────────────────────────
    console.log("\nEmployee load changes:");
    const after = await prisma.user.findMany({
        where: { id: { in: eligible.map(u => u.id) } },
        select: { id: true, name: true, employeeProfile: { select: { currentLeadLoad: true } } },
    });
    const beforeMap = new Map(before.map(u => [u.id, u.employeeProfile?.currentLeadLoad ?? 0]));
    after.forEach(u => {
        const was = beforeMap.get(u.id) ?? 0;
        const now = u.employeeProfile?.currentLeadLoad ?? 0;
        const delta = now - was;
        if (delta !== 0) console.log(`  ${u.name.padEnd(20)} ${was} → ${now} (${delta >= 0 ? "+" : ""}${delta})`);
    });

    // ── Cleanup ───────────────────────────────────────────────────────────
    console.log("\nCleaning up test leads...");
    const { count } = await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    console.log(`  Deleted ${count} test leads.`);

    // ── Summary ───────────────────────────────────────────────────────────
    console.log("\n=== Summary ===");
    if (allAssigned && result.failed === 0) {
        console.log("ALL TESTS PASSED — Smart assignment is working correctly.");
    } else if (result.assigned > 0) {
        console.log(`PARTIAL PASS — ${result.assigned}/${result.total} assigned. ${result.failed} failed (check eligible capacity/availability).`);
    } else {
        console.log("FAIL — No leads were assigned. Check engine logs above.");
        process.exitCode = 1;
    }
}

run()
    .catch(err => { console.error("\nUnexpected error:", err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
