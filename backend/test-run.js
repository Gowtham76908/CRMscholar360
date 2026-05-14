require("dotenv").config();
const prisma = require("./src/utils/prisma");
const { getSuggestionsForLead } = require("./src/services/followUpSuggestionService");

async function main() {
    // Get a few leads to test
    const leads = await prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true, createdAt: true, updatedAt: true }
    });

    if (leads.length === 0) {
        console.log("No leads found in DB.");
        return;
    }

    console.log(`\nFound ${leads.length} leads. Testing suggestions...\n`);

    for (const lead of leads) {
        console.log(`──────────────────────────────────────`);
        console.log(`Lead: ${lead.name} (${lead.status})`);
        console.log(`ID: ${lead.id}`);
        console.log(`Created: ${lead.createdAt.toLocaleDateString()}`);

        const suggestions = await getSuggestionsForLead(lead.id);

        if (suggestions.length === 0) {
            console.log(`Suggestions: none`);
        } else {
            console.log(`Suggestions (${suggestions.length}):`);
            for (const s of suggestions) {
                console.log(`  [${s.priority}] ${s.headline}`);
                console.log(`         ${s.detail}`);
                if (s.reason) console.log(`         Why: ${s.reason}`);
            }
        }
    }

    // Test automation log — check recent automations fired
    console.log(`\n──────────────────────────────────────`);
    console.log(`Recent Automation Logs:`);
    const logs = await prisma.automationLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { rule: { select: { name: true } } }
    });

    if (logs.length === 0) {
        console.log("No automation logs found. Create/update a lead to trigger rules.");
    } else {
        for (const log of logs) {
            console.log(`  [${log.status}] Rule: "${log.rule?.name}" | Lead: ${log.leadId} | ${log.createdAt.toLocaleString()}`);
            if (log.errorMessage) console.log(`         Error: ${log.errorMessage}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
