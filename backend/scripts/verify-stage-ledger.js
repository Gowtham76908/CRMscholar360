/**
 * Phase 1 verification for the LeadDepartmentStageEvent ledger.
 *
 * Exercises every acceptance criterion against the real DB and cleans up after
 * itself. Run from backend/:  node scripts/verify-stage-ledger.js
 *
 *   1. Creating a lead            → 1 SALES entry event (null → ENQUIRY)
 *   2. Allocating departments     → 1 entry event per NEW department only
 *   3. Re-allocating same dept    → no duplicate entry event
 *   4. Moving a stage             → 1 transition event (from → to)
 *   5. No-op stage set            → no event
 *   6. ★ ROLLBACK: event insert fails → stage update rolls back, no event
 */
const prisma = require("../src/utils/prisma");
const leadService = require("../src/services/leadService");
const leadDeptService = require("../src/services/leadDepartmentService");

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const eventsFor = (leadDepartmentId) =>
    prisma.leadDepartmentStageEvent.findMany({ where: { leadDepartmentId }, orderBy: { createdAt: "asc" } });

async function main() {
    const user = (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } }))
        || (await prisma.user.findFirst());
    if (!user) throw new Error("No user in DB to act as actor");
    const actor = { userId: user.id, role: "SUPER_ADMIN" };
    const tag = `LEDGER_TEST_${Date.now()}`;

    let leadId;
    try {
        // 1. Create lead → SALES entry event
        const lead = await leadService.createLead(
            { name: tag, email: `${tag}@test.local`, phone: "0000000000", source: "WEBSITE" },
            { createdByUserId: user.id }
        );
        leadId = lead.id;
        const sales = await prisma.leadDepartment.findUnique({
            where: { leadId_department: { leadId, department: "SALES" } },
        });
        let salesEvents = await eventsFor(sales.id);
        console.log("\n[1] Lead creation");
        check("exactly 1 SALES event", salesEvents.length === 1);
        check("event is null → ENQUIRY", salesEvents[0]?.fromStage === null && salesEvents[0]?.toStage === "ENQUIRY");
        check("changedByUserId = creator", salesEvents[0]?.changedByUserId === user.id);

        // 2. Allocate to LOAN + FOREX → 1 entry event each
        await leadDeptService.allocateDepartments({ leadId, departments: ["LOAN", "FOREX"], actor });
        const loan = await prisma.leadDepartment.findUnique({ where: { leadId_department: { leadId, department: "LOAN" } } });
        const forex = await prisma.leadDepartment.findUnique({ where: { leadId_department: { leadId, department: "FOREX" } } });
        console.log("\n[2] Allocation to new departments");
        check("LOAN has 1 entry event (null → ENQUIRY)", (await eventsFor(loan.id)).length === 1);
        check("FOREX has 1 entry event (null → ENQUIRY)", (await eventsFor(forex.id)).length === 1);

        // 3. Re-allocate LOAN (already exists) → no new event
        await leadDeptService.allocateDepartments({ leadId, departments: ["LOAN"], actor });
        console.log("\n[3] Re-allocation of existing department");
        check("LOAN still has only 1 entry event (skipDuplicates)", (await eventsFor(loan.id)).length === 1);

        // 4. Move a stage → 1 transition event
        await leadDeptService.updateStage({ leadDepartmentId: loan.id, stage: "LOAN_DOCUMENTATION", actor });
        const loanEvents = await eventsFor(loan.id);
        console.log("\n[4] Stage transition");
        check("LOAN now has 2 events", loanEvents.length === 2);
        check("transition is ENQUIRY → LOAN_DOCUMENTATION",
            loanEvents[1]?.fromStage === "ENQUIRY" && loanEvents[1]?.toStage === "LOAN_DOCUMENTATION");

        // 5. No-op stage set → no event
        await leadDeptService.updateStage({ leadDepartmentId: loan.id, stage: "LOAN_DOCUMENTATION", actor });
        console.log("\n[5] No-op stage set");
        check("LOAN still has 2 events (no-op emits nothing)", (await eventsFor(loan.id)).length === 2);

        // 6. ★ ROLLBACK: a bad actor FK makes the event insert fail inside the txn.
        //    The stage update in the same transaction must roll back.
        console.log("\n[6] ★ ROLLBACK on event-insert failure");
        const badActor = { userId: "00000000-0000-0000-0000-000000000000", role: "SUPER_ADMIN" };
        const before = await prisma.leadDepartment.findUnique({ where: { id: forex.id } });
        let threw = false;
        try {
            await leadDeptService.updateStage({ leadDepartmentId: forex.id, stage: "ON_PROGRESS", actor: badActor });
        } catch (e) { threw = true; }
        const after = await prisma.leadDepartment.findUnique({ where: { id: forex.id } });
        check("update threw (FK violation on changedByUserId)", threw);
        check("FOREX stage rolled back / unchanged", after.stage === before.stage);
        check("no orphan event written for FOREX", (await eventsFor(forex.id)).length === 1);
    } finally {
        // Cleanup: events cascade-delete with the lead.
        if (leadId) await prisma.lead.delete({ where: { id: leadId } }).catch(() => {});
    }

    console.log(`\n${fail === 0 ? "ALL PASSED" : "FAILURES"} — ${pass} passed, ${fail} failed`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
