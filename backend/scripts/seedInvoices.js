require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const INVOICE_TYPES   = ["PROFORMA", "TAX_INVOICE"];
const TAX_RATES       = [0, 5, 12, 18, 28];
const INVOICE_TITLES  = [
    "Website Redesign – Advance",    "Website Redesign – Milestone",   "Website Redesign – Final",
    "SEO Retainer – Month 1",        "SEO Retainer – Month 2",         "PPC Campaign Setup",
    "Mobile App – Phase 1",          "Mobile App – Phase 2",           "Mobile App – Final",
    "CRM Implementation",            "Cloud Migration – Setup",         "Cloud Migration – Final",
    "UI/UX Audit",                   "Social Media Management",        "Content Marketing Package",
    "Email Campaign Setup",          "Brand Identity Kit",             "Video Production",
    "Annual Maintenance Contract",   "Support Package",                "Data Analytics Dashboard",
    "API Integration",               "E-commerce Platform",            "Lead Gen Campaign",
    "Consulting Retainer",           "SaaS Subscription",              "Training Program",
    "Security Audit",                "Performance Optimization",       "BI Reporting Suite",
];

// Weighted status distribution: realistic for a healthy pipeline
// ~25% PAID, ~20% PARTIALLY_PAID, ~25% SENT, ~20% DRAFT, ~10% CANCELLED
const STATUS_WEIGHTS = [
    { status: "PAID",           weight: 25 },
    { status: "PARTIALLY_PAID", weight: 20 },
    { status: "SENT",           weight: 25 },
    { status: "DRAFT",          weight: 20 },
    { status: "CANCELLED",      weight: 10 },
];

function pickStatus() {
    const total = STATUS_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of STATUS_WEIGHTS) {
        r -= w.weight;
        if (r <= 0) return w.status;
    }
    return "DRAFT";
}

function computeTotals(items) {
    let subtotal = 0, totalTax = 0;
    const processed = items.map(item => {
        const taxable = parseFloat((item.price * item.quantity).toFixed(2));
        const tax     = parseFloat((taxable * item.taxRate / 100).toFixed(2));
        subtotal += taxable;
        totalTax += tax;
        return { ...item, taxableValue: taxable, amount: parseFloat((taxable + tax).toFixed(2)) };
    });
    subtotal  = parseFloat(subtotal.toFixed(2));
    totalTax  = parseFloat(totalTax.toFixed(2));
    const cgst  = parseFloat((totalTax / 2).toFixed(2));
    const sgst  = parseFloat((totalTax / 2).toFixed(2));
    const total = parseFloat((subtotal + totalTax).toFixed(2));
    return { processed, subtotal, cgst, sgst, igst: 0, total };
}

// ─── Counter helper (same logic as invoiceController) ────────────────────────

async function generateInvoiceNumber(type, tx, settings) {
    const base   = settings?.shortName || "HXZ";
    const prefix = type === "PROFORMA" ? `${base}-PRO` : base;
    const rows   = await tx.$queryRaw`
        INSERT INTO "InvoiceCounter" ("prefix", "currentValue")
        VALUES (${prefix}, 1)
        ON CONFLICT ("prefix") DO UPDATE
            SET "currentValue" = "InvoiceCounter"."currentValue" + 1
        RETURNING "currentValue"
    `;
    return `${prefix}-${rows[0].currentValue}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const [users, deals, settings] = await Promise.all([
        prisma.user.findMany({ select: { id: true } }),
        prisma.deal.findMany({
            where:  { deletedAt: null },
            select: { id: true, leadId: true, amount: true, title: true, createdAt: true },
            take:   500,
        }),
        prisma.companySettings.findFirst(),
    ]);

    if (!users.length)  { console.error("No users — run seedManagers.js first"); return; }
    if (!deals.length)  { console.error("No deals — run seedPipeline.js first"); return; }

    const existingCount = await prisma.invoice.count({ where: { dealId: { not: null } } });
    const target        = 1000;
    const toCreate      = Math.max(0, target - existingCount);

    console.log(`Existing deal-linked invoices: ${existingCount}. Will create ${toCreate} new invoices.`);
    if (toCreate === 0) { console.log("Already at target. Done ✓"); return; }

    const BATCH = 25;
    let created = 0;

    for (let i = 0; i < toCreate; i += BATCH) {
        const batchSize = Math.min(BATCH, toCreate - i);

        for (let j = 0; j < batchSize; j++) {
            const deal      = pick(deals);
            const user      = pick(users);
            const status    = pickStatus();
            const type      = pick(INVOICE_TYPES);
            const daysAgo   = rand(1, 180);
            const createdAt = new Date(Date.now() - daysAgo * 86_400_000);

            // Build 1–3 line items summing to roughly the deal amount
            const itemCount = rand(1, 3);
            const basePrice = Math.max(1000, Math.floor(deal.amount / itemCount / 100) * 100);
            const items = Array.from({ length: itemCount }, (_, k) => ({
                description: k === 0 ? deal.title : pick(INVOICE_TITLES),
                price:       k === 0 ? basePrice : rand(2000, 50000),
                quantity:    1,
                taxRate:     pick(TAX_RATES),
            }));

            const { processed, subtotal, cgst, sgst, igst, total } = computeTotals(items);
            const dueDate = new Date(createdAt.getTime() + rand(15, 45) * 86_400_000);

            try {
                const invoice = await prisma.$transaction(async (tx) => {
                    const invoiceNumber = await generateInvoiceNumber(type, tx, settings);
                    return tx.invoice.create({
                        data: {
                            invoiceNumber,
                            invoiceType: type,
                            clientName:  deal.title,  // deal title as placeholder client name
                            subtotal,
                            cgst,
                            sgst,
                            igst,
                            total,
                            status,
                            dueDate,
                            createdById: user.id,
                            dealId:      deal.id,
                            createdAt,
                            updatedAt:   createdAt,
                            items: { create: processed },
                        },
                        select: { id: true, total: true, status: true },
                    });
                });

                // Add payments to PARTIALLY_PAID and PAID invoices
                if (status === "PAID") {
                    await prisma.paymentEntry.create({
                        data: {
                            invoiceId:   invoice.id,
                            amount:      invoice.total,
                            type:        "CREDIT",
                            description: "Full payment received",
                            paymentDate: new Date(createdAt.getTime() + rand(5, 30) * 86_400_000),
                        },
                    });
                } else if (status === "PARTIALLY_PAID") {
                    const paid = parseFloat((invoice.total * (rand(20, 75) / 100)).toFixed(2));
                    await prisma.paymentEntry.create({
                        data: {
                            invoiceId:   invoice.id,
                            amount:      paid,
                            type:        "CREDIT",
                            description: "Partial payment received",
                            paymentDate: new Date(createdAt.getTime() + rand(5, 20) * 86_400_000),
                        },
                    });
                }

                created++;
            } catch (err) {
                // Skip duplicate invoice number collisions (rare) and continue
                if (!err.message?.includes("Unique constraint")) throw err;
            }
        }

        process.stdout.write(`\r  Created ${created}/${toCreate} invoices`);
    }

    console.log(`\n  ✓ Invoices created`);

    // ── Summary ──────────────────────────────────────────────────────────────

    const [totalInvoices, statusCounts, paymentSum] = await Promise.all([
        prisma.invoice.count({ where: { dealId: { not: null } } }),
        prisma.invoice.groupBy({ by: ["status"], _count: { id: true }, where: { dealId: { not: null } } }),
        prisma.paymentEntry.aggregate({ _sum: { amount: true }, where: { type: "CREDIT" } }),
    ]);

    console.log(`\nTotal deal-linked invoices: ${totalInvoices}`);
    console.log("\nStatus breakdown:");
    statusCounts.forEach(s => console.log(`  ${s.status}: ${s._count.id}`));
    console.log(`\nTotal realized revenue: ₹${(paymentSum._sum.amount ?? 0).toLocaleString("en-IN")}`);
    console.log("\nDone ✓");
}

main().catch(console.error).finally(() => prisma.$disconnect());
