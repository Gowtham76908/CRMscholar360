const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Migrating existing leads to assign sequential leadIds...");

    // 1. Get or create counter for LEAD
    let counterVal = 10000;
    const existingCounter = await prisma.invoiceCounter.findUnique({
        where: { prefix: "LEAD" }
    });

    if (existingCounter) {
        counterVal = existingCounter.currentValue;
        console.log(`Found existing LEAD counter value: ${counterVal}`);
    } else {
        console.log(`No existing LEAD counter. Starting from ${counterVal}`);
    }

    // 2. Fetch all leads where leadId is null, ordered by createdAt
    const leads = await prisma.lead.findMany({
        where: { leadId: null },
        orderBy: { createdAt: "asc" }
    });

    console.log(`Found ${leads.length} leads without a leadId.`);

    if (leads.length === 0) {
        console.log("No leads need migration.");
        if (!existingCounter) {
            await prisma.invoiceCounter.create({
                data: { prefix: "LEAD", currentValue: 10000 }
            });
            console.log("Initialized LEAD counter at 10000.");
        }
        return;
    }

    // 3. Assign IDs sequentially
    let current = counterVal;
    for (const lead of leads) {
        current += 1;
        const newLeadId = `L-${String(current).padStart(5, '0')}`;
        
        await prisma.lead.update({
            where: { id: lead.id },
            data: { leadId: newLeadId }
        });
        console.log(`Assigned ${newLeadId} to Lead: ${lead.name}`);
    }

    // 4. Update or create the counter
    await prisma.invoiceCounter.upsert({
        where: { prefix: "LEAD" },
        update: { currentValue: current },
        create: { prefix: "LEAD", currentValue: current }
    });
    console.log(`Updated LEAD counter in database to: ${current}`);

    console.log("✓ Migration completed successfully!");
}

main()
    .catch((error) => {
        console.error("Migration failed:", error);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
