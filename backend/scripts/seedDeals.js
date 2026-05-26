require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const STAGES = ["NEW", "NEGOTIATION", "WON", "LOST"];
const CURRENCIES = ["INR", "INR", "INR", "USD"]; // weighted toward INR

const DEAL_TEMPLATES = [
    "Website Development", "SEO Package", "Marketing Campaign", "Mobile App",
    "CRM Setup", "ERP Implementation", "Cloud Migration", "UI/UX Redesign",
    "Social Media Management", "Content Strategy", "Email Marketing",
    "PPC Campaign", "Brand Identity", "Product Photography", "Video Production",
    "Annual Maintenance Contract", "Support Package", "Training Program",
    "Data Analytics Dashboard", "API Integration", "E-commerce Platform",
    "Lead Generation Campaign", "PR & Outreach", "Event Management",
    "White Label Solution", "LMS Platform", "SaaS Subscription", "Consulting Retainer",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.round(Math.random() * (max - min) + min); }

async function main() {
    const leads = await prisma.lead.findMany({ select: { id: true }, take: 1000 });
    if (leads.length === 0) { console.log("No leads found — run seedManagers.js first"); return; }

    const users = await prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) { console.log("No users found"); return; }

    // Clear existing seeded deals to avoid duplicates on re-run
    await prisma.deal.deleteMany({});
    console.log("Cleared existing deals");

    const TARGET = 200;
    const deals = [];

    for (let i = 0; i < TARGET; i++) {
        const stage = pick(STAGES);
        const currency = pick(CURRENCIES);
        const amount = currency === "INR"
            ? rand(5000, 500000)
            : rand(500, 50000);

        const createdDaysAgo = rand(1, 180);
        const createdAt = new Date(Date.now() - createdDaysAgo * 86_400_000);
        const updatedAt = new Date(createdAt.getTime() + rand(0, createdDaysAgo) * 86_400_000);
        const closedAt = ["WON", "LOST"].includes(stage) ? updatedAt : null;

        deals.push({
            leadId: pick(leads).id,
            createdById: pick(users).id,
            title: pick(DEAL_TEMPLATES),
            amount,
            stage,
            currency,
            closedAt,
            createdAt,
            updatedAt,
        });
    }

    // Insert in batches to avoid statement limits
    const BATCH = 50;
    let created = 0;
    for (let i = 0; i < deals.length; i += BATCH) {
        const batch = deals.slice(i, i + BATCH);
        await prisma.$transaction(
            batch.map(d => prisma.deal.create({ data: d }))
        );
        created += batch.length;
        console.log(`  Created ${created}/${TARGET} deals`);
    }

    // Print stage breakdown
    const counts = await prisma.deal.groupBy({ by: ["stage"], _count: { id: true } });
    console.log("\nDeal stage breakdown:");
    counts.forEach(c => console.log(`  ${c.stage}: ${c._count.id}`));

    const totals = await prisma.deal.aggregate({ _sum: { amount: true }, _count: { id: true } });
    console.log(`\nTotal deals: ${totals._count.id}`);
    console.log(`Total pipeline value: ${totals._sum.amount?.toLocaleString("en-IN")}`);
    console.log("\nDone ✓");
}

main().catch(console.error).finally(() => prisma.$disconnect());
