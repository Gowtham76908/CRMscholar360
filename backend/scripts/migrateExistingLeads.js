const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Renumber every lead into the `sch-YY-XXXX` format:
//   - leads are ordered oldest-first and given a global, continuous sequence
//     starting at 0001 (matches leadService.createLead: seq = counter - 9999),
//   - YY is the last two digits of each lead's own creation year,
//   - the LEAD counter is then set so newly created leads continue the sequence.
//
// leadId is a display code only — all relations use the lead's uuid `id`, so
// renumbering is safe for foreign keys.
async function main() {
    const leads = await prisma.lead.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, createdAt: true },
    });
    console.log(`Renumbering ${leads.length} leads…`);

    if (leads.length === 0) {
        await prisma.invoiceCounter.upsert({
            where: { prefix: "LEAD" },
            update: { currentValue: 9999 },
            create: { prefix: "LEAD", currentValue: 9999 },
        });
        console.log("No leads. LEAD counter set to 9999 (next lead → 0001).");
        return;
    }

    // Phase 1 — clear all leadIds so reassignment can't hit the unique constraint
    // when a target code currently belongs to a not-yet-processed lead.
    await prisma.lead.updateMany({ data: { leadId: null } });

    // Phase 2 — assign sequential codes.
    let seq = 0;
    for (const lead of leads) {
        seq += 1;
        const year = new Date(lead.createdAt).getFullYear().toString().slice(-2);
        const leadId = `sch-${year}-${String(seq).padStart(4, "0")}`;
        await prisma.lead.update({ where: { id: lead.id }, data: { leadId } });
        console.log(`${leadId}  ←  ${lead.name}`);
    }

    // Counter so the next createLead() (nextVal - 9999) yields seq + 1.
    const counterVal = 9999 + seq;
    await prisma.invoiceCounter.upsert({
        where: { prefix: "LEAD" },
        update: { currentValue: counterVal },
        create: { prefix: "LEAD", currentValue: counterVal },
    });
    console.log(`✓ Done. LEAD counter set to ${counterVal} (next lead → ${String(seq + 1).padStart(4, "0")}).`);
}

main()
    .catch((error) => {
        console.error("Migration failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
