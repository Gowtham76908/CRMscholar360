require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Data pools ──────────────────────────────────────────────────────────────

const FIRST_NAMES = ["Aarav","Aditi","Amit","Anjali","Arjun","Aryan","Deepak","Divya","Gaurav","Ishaan",
    "Karan","Kavya","Manish","Meera","Mohit","Nisha","Pooja","Priya","Rahul","Rajesh",
    "Ravi","Rohit","Sakshi","Sanjay","Sanket","Sneha","Suresh","Tanvi","Varun","Vikram",
    "Arun","Bhavna","Chirag","Disha","Esha","Fatima","Harish","Heena","Isha","Jai",
    "Kartik","Lata","Madhur","Neha","Omkar","Pallavi","Qasim","Rekha","Shweta","Tushar",
    "Uday","Vidya","Wasim","Yash","Zara","Ajay","Bindu","Chetan","Deepa","Ekta"];

const LAST_NAMES = ["Sharma","Verma","Patel","Kumar","Singh","Gupta","Mehta","Joshi","Rao","Nair",
    "Pillai","Reddy","Shah","Malhotra","Kapoor","Chauhan","Mishra","Tiwari","Pandey","Agarwal",
    "Bhat","Chaudhary","Desai","Ghosh","Iyer","Jain","Kaur","Luthra","Mohan","Naik",
    "Oberoi","Prasad","Qureshi","Rastogi","Saxena","Trivedi","Upadhyay","Varma","Walia","Yadav"];

const COMPANIES = ["Infosys","TCS","Wipro","HCL","Tech Mahindra","Cognizant","Hexaware","Mphasis",
    "Mindtree","NIIT Technologies","L&T Infotech","Persistent Systems","Cyient","Mastech","Rackspace",
    "Accenture India","IBM India","Capgemini India","Oracle India","SAP India",
    "Reliance Industries","Tata Steel","Bajaj Auto","Mahindra","Asian Paints",
    "HDFC Bank","ICICI Bank","Axis Bank","Kotak Mahindra","SBI Cards",
    "Flipkart","Zomato","Swiggy","Paytm","PhonePe","Ola","Nykaa","Meesho","Razorpay","Zepto",
    "StartupXYZ","InnovateCo","DigitalEdge","GrowthHive","Launchpad Inc",
    "CloudNine Tech","DataSolutions","AI Systems","NextGen Labs","PrimeSoft"];

const DEAL_TEMPLATES = [
    "Website Redesign","SEO Retainer","PPC Campaign","Mobile App Development","CRM Implementation",
    "ERP Rollout","Cloud Migration","UI/UX Audit","Social Media Management","Content Marketing",
    "Email Campaign","Brand Identity","Video Production","Annual AMC","Support Package",
    "Data Analytics Dashboard","API Integration","E-commerce Platform","Lead Gen Campaign",
    "PR & Outreach","Event Management","SaaS Subscription","Consulting Retainer",
    "White Label Solution","LMS Platform","Security Audit","DevOps Setup","Performance Optimization",
    "Training Program","Digital Transformation Package","Customer Portal","HR System Integration",
    "Inventory Management","Logistics Dashboard","BI Reporting Suite","IoT Integration",
    "Chatbot Development","WhatsApp Automation","Marketing Automation","Product Photography",
];

const { getStages } = require("../src/config/departmentWorkflows");

const SOURCES   = ["WEBSITE","FACEBOOK","INSTAGRAM","GMAIL","PHONE_CALL","LINKEDIN"];
const SALES_STAGES = getStages("SALES");
const STAGES    = ["NEW","NEGOTIATION","WON","LOST"];
const CURRENCIES = ["INR","INR","INR","INR","USD","USD","EUR"];

function pick(arr)        { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max)   { return Math.round(Math.random() * (max - min) + min); }
function randFloat(mn,mx) { return Math.round((Math.random() * (mx - mn) + mn) * 100) / 100; }
function slug(n)          { return n.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const users = await prisma.user.findMany({ select: { id: true, role: true } });
    if (users.length === 0) { console.error("No users — run seedManagers.js first"); return; }

    // ── 1. Seed 1000 leads ──────────────────────────────────────────────────

    const existingCount = await prisma.lead.count();
    let leadsToCreate = Math.max(0, 1000 - existingCount);
    console.log(`Existing leads: ${existingCount}. Will create ${leadsToCreate} new leads.`);

    if (leadsToCreate > 0) {
        const BATCH = 50;
        let created = 0;
        for (let i = 0; i < leadsToCreate; i += BATCH) {
            const batch = [];
            const count = Math.min(BATCH, leadsToCreate - i);
            for (let j = 0; j < count; j++) {
                const fn = pick(FIRST_NAMES);
                const ln = pick(LAST_NAMES);
                const name = `${fn} ${ln}`;
                const company = pick(COMPANIES);
                const daysAgo = rand(1, 365);
                const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
                batch.push({
                    name,
                    email: `${slug(fn)}.${slug(ln)}${rand(10,99)}@${slug(company)}.com`,
                    phone: `+91${rand(7000000000, 9999999999)}`,
                    company,
                    source: pick(SOURCES),
                    createdAt,
                    updatedAt: new Date(createdAt.getTime() + rand(0, daysAgo) * 86_400_000),
                    // Every lead carries a SALES department service with its own
                    // consultant + workflow stage (replaces status/assignedToId).
                    leadDepartments: {
                        create: [{
                            department: "SALES",
                            stage: pick(SALES_STAGES),
                            assignedEmployeeId: pick(users).id,
                            assignedAt: createdAt,
                        }],
                    },
                });
            }
            await prisma.$transaction(batch.map(d => prisma.lead.create({ data: d })));
            created += batch.length;
            process.stdout.write(`\r  Created ${created}/${leadsToCreate} leads`);
        }
        console.log(`\n  ✓ Leads created`);
    }

    // ── 2. Seed 500 deals ───────────────────────────────────────────────────

    const existingDeals = await prisma.deal.count();
    const dealsToCreate = Math.max(0, 500 - existingDeals);
    console.log(`Existing deals: ${existingDeals}. Will create ${dealsToCreate} new deals.`);

    if (dealsToCreate > 0) {
        const leads = await prisma.lead.findMany({ select: { id: true }, take: 2000 });
        if (leads.length === 0) { console.error("No leads found"); return; }

        const deals = [];
        for (let i = 0; i < dealsToCreate; i++) {
            const stage    = pick(STAGES);
            const currency = pick(CURRENCIES);
            const amount   = currency === "INR" ? rand(10000, 1500000) : rand(500, 75000);
            const daysAgo  = rand(1, 270);
            const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
            const updatedAt = new Date(createdAt.getTime() + rand(0, daysAgo) * 86_400_000);
            const closedAt  = ["WON","LOST"].includes(stage) ? updatedAt : null;

            deals.push({
                leadId:      pick(leads).id,
                createdById: pick(users).id,
                title:       pick(DEAL_TEMPLATES),
                amount,
                stage,
                currency,
                closedAt,
                createdAt,
                updatedAt,
            });
        }

        const BATCH = 50;
        let created = 0;
        for (let i = 0; i < deals.length; i += BATCH) {
            const batch = deals.slice(i, i + BATCH);
            await prisma.$transaction(batch.map(d => prisma.deal.create({ data: d })));
            created += batch.length;
            process.stdout.write(`\r  Created ${created}/${dealsToCreate} deals`);
        }
        console.log(`\n  ✓ Deals created`);
    }

    // ── 3. Summary ──────────────────────────────────────────────────────────

    const totalLeads = await prisma.lead.count();
    const stageCounts = await prisma.deal.groupBy({ by: ["stage"], _count: { id: true }, where: { deletedAt: null } });
    const totals      = await prisma.deal.aggregate({ _sum: { amount: true }, _count: { id: true }, where: { deletedAt: null } });

    console.log(`\nTotal leads in DB: ${totalLeads}`);
    console.log("\nDeal pipeline breakdown:");
    stageCounts.forEach(c => console.log(`  ${c.stage}: ${c._count.id}`));
    console.log(`\nTotal deals: ${totals._count.id}`);
    console.log(`Total pipeline value: ${totals._sum.amount?.toLocaleString("en-IN")}`);
    console.log("\nDone ✓");
}

main().catch(console.error).finally(() => prisma.$disconnect());
