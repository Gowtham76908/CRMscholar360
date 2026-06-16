/**
 * DCRM Complete Seed (multi-department model) — canonical deploy seed.
 *
 * Runs from `npm run build` (prisma generate && db push && node prisma/seed.js)
 * and `prisma db seed`. Idempotent: only populates an EMPTY database.
 *
 * Structure:
 *   1 SUPER_ADMIN (Director, member of all departments)
 *   2 ADMIN managers   (Sales; Loan/Forex/Services)
 *   20 EMPLOYEE consultants distributed across departments (managerId wired)
 *   EmployeeProfile for every employee + manager
 *   100 Leads — each with a SALES LeadDepartment service; ~30% with an extra
 *       department service (LOAN/FOREX/ACCOMMODATION_TICKETS/MISCELLANEOUS)
 *   Commission per department-service that reached COMMISSION_INVOICING
 *   Deals   → derived from each lead's SALES stage
 *   Invoices/Payments → linked to deals
 *   CallLogs, EmailLogs, Tasks, Notes, Activities, Attendance
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { categoryFromScore } = require("../src/utils/leadScorer");
const { getStages, isCommissionStage } = require("../src/config/departmentWorkflows");
const prisma = new PrismaClient();

// ─── Utilities ────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);

// ─── Master Data ──────────────────────────────────────────────────────────────

const SOURCES   = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];
const ENQUIRIES = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];

// Departments a customer can additionally be serviced by (besides base SALES).
const EXTRA_DEPARTMENTS = ["LOAN", "FOREX", "ACCOMMODATION_TICKETS", "MISCELLANEOUS"];

// Weighted SALES workflow-stage distribution (per 100 leads). Drives the funnel,
// the derived deals, and which services earn commission.
const SALES_PHASES = [
    ...Array(30).fill("ENQUIRY"),
    ...Array(20).fill("FOLLOW_UP"),
    ...Array(20).fill("PROSPECT"),
    ...Array(20).fill("COMMISSION_INVOICING"),
    ...Array(10).fill("ARCHIVE"),
];

// Map a SALES stage to the matching sales Deal stage (null = no deal yet).
function dealStageForSalesStage(stage) {
    if (stage === "COMMISSION_INVOICING") return "WON";
    if (stage === "ARCHIVE") return "LOST";
    if (stage === "ENQUIRY") return null;
    return "NEGOTIATION";
}

const LEAD_NAMES = [
    "Sanjay Mehta","Anita Bose","Tech Solutions Pvt Ltd","Global Exports Ltd","Sunrise Traders",
    "Rohit Verma","Infinity Retail","Dr. Kavitha Suresh","BlueSky Analytics","Naveen Choudhary",
    "Precision Tools Co","Aishwarya Nair","Vishal Kapoor","Nandini Logistics","Rajesh Textiles",
    "Suma Healthcare","DataBridge Inc","Chetan Desai","Pooja Fashions","Horizon IT",
    "Madhu Enterprises","Shankar Exports","Elite Constructions","Tara Solutions","Vikram Groups",
    "Preethi Clinics","NextGen Media","Balaji Traders","Sunita Services","Kiran Software",
    "Arvind Agro","Deepak Manufacturing","Srilakshmi Edu","Mohan Pharma","Gayathri Textiles",
    "Ashok Cement","Rajan Electronics","Padma Hospitality","Suresh Infotech","Vimala Retail",
    "Balu Engineering","Saranya Designs","Naresh Builders","Jaya Solutions","Gopi Chemicals",
    "Lalitha Jewellers","Kannan Motors","Meena Garments","Vinoth Digital","Arun Healthcare",
    "Sudha Trading","Mani Exports","Bhaskar Tech","Revathi Foods","Senthil Logistics",
    "Viji IT Solutions","Ganesh Plastics","Kumari Constructions","Anbu Electronics","Kaveri Textiles",
    "Prasad Pharma","Hema Travels","Geetha Enterprises","Ramesh Auto","Saroja Agro",
    "Murali Cement","Devika Media","Palani Hardware","Chithra Services","Selvam Industries",
    "Prabha Exports","Nithya Fashion","Elavarasan IT","Mythili Health","Saravanan Builders",
    "Bharathi Finance","Vijaya Retail","Sakthivel Constructions","Indira Infotech","Murugan Traders",
    "Thilagam Services","Pandian Engineering","Susheela Designs","Venkatesh Groups","Radha Solutions",
    "Malathi Chemicals","Natarajan Motors","Brindha Hospitality","Sugumar Digital","Kamala Healthcare",
    "Rajagopalan Trading","Kalyani Exports","Sundaram Tech","Bhuvana Foods","Selvakumar Logistics",
    "Vidhya IT","Sivakumar Plastics","Tamilarasi Constructions","Babu Electronics","Ganga Textiles",
];

const EMAIL_DOMAINS = ["gmail.com","outlook.com","yahoo.com","company.in","business.com"];
const CALL_STATUSES = ["ANSWERED","ANSWERED","ANSWERED","NO_ANSWER","BUSY"];
const EMAIL_SUBJECTS = [
    "Inquiry about your services","Following up on our conversation","Product demo request",
    "Pricing information needed","Partnership opportunity","Solution proposal",
    "Request for quotation","Checking in on your requirements",
];

// ─── Clear existing seed data ─────────────────────────────────────────────────

async function clearAll() {
    console.log("Clearing existing data...");
    await prisma.paymentEntry.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.invoiceCounter.deleteMany();
    await prisma.deal.deleteMany();
    await prisma.emailLog.deleteMany();
    await prisma.callLog.deleteMany();
    await prisma.taskComment.deleteMany();
    await prisma.taskFile.deleteMany();
    await prisma.task.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.note.deleteMany();
    await prisma.automationLog.deleteMany();
    await prisma.assignmentHistory.deleteMany();
    await prisma.reminder.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.managerNote.deleteMany();
    await prisma.leadDepartment.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.employeeProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.leave.deleteMany();
    await prisma.leaveApproval.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.userStatusLog.deleteMany();
    await prisma.user.deleteMany();
    console.log("  ✓ All tables cleared\n");
}

// Create EmployeeProfile with realistic sub-scores.
async function createProfile(userId, { manager = false } = {}) {
    const base = manager ? 0.85 : 0.4 + Math.random() * 0.55;
    await prisma.employeeProfile.create({
        data: {
            employeeId: userId,
            maxDailyLeads: manager ? 30 : 20,
            currentLeadLoad: manager ? 0 : rand(2, 8),
            lastAssignedAt: manager ? null : daysAgo(rand(0, 3)),
            performanceScore: parseFloat(base.toFixed(2)),
            leadEffectiveness: parseFloat((base + (Math.random() * 0.1 - 0.05)).toFixed(2)),
            responseQuality: parseFloat((base + (Math.random() * 0.1 - 0.05)).toFixed(2)),
            followupDiscipline: parseFloat((base + (Math.random() * 0.1 - 0.05)).toFixed(2)),
            attendanceReliability: parseFloat((0.7 + Math.random() * 0.28).toFixed(2)),
        },
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    // Idempotency guard: only populate an EMPTY database. Safe to run on every
    // deploy — fresh DB gets demo data + admin login; a populated DB is untouched.
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
        console.log(`Seed skipped — database already has ${existingUsers} user(s); leaving data untouched.`);
        return;
    }

    await clearAll();

    const password = await bcrypt.hash("Demo@1234", 10);

    // Attach a user to one or more departments (UserDepartment M2M).
    const addDepartments = async (userId, departments) => {
        for (const department of departments) {
            await prisma.userDepartment.create({ data: { userId, department } });
        }
    };

    // ── 1. Director (member of all departments) ─────────────────────────────────
    console.log("Creating users...");
    const superAdmin = await prisma.user.create({
        data: {
            email: "admin@dcrm.com", name: "Super Admin", password,
            role: "SUPER_ADMIN", department: "Management", jobTitle: "Director", isActive: true,
        },
    });
    await addDepartments(superAdmin.id, ["SALES", "LOAN", "ACCOMMODATION_TICKETS", "FOREX", "MISCELLANEOUS"]);
    console.log(`  ✓ ${superAdmin.name} (SUPER_ADMIN / Director)`);

    // ── 2. Managers ─────────────────────────────────────────────────────────────
    const managersData = [
        { email: "arun.manager@dcrm.com",  name: "Arun Pillai",  jobTitle: "Sales Manager",          department: "Sales", departments: ["SALES"] },
        { email: "meena.manager@dcrm.com", name: "Meena Sharma", jobTitle: "Services & Loan Manager", department: "Services", departments: ["LOAN", "FOREX", "ACCOMMODATION_TICKETS", "MISCELLANEOUS"] },
    ];
    const managers = [];
    for (const m of managersData) {
        const { departments, ...data } = m;
        const mgr = await prisma.user.create({
            data: { ...data, password, role: "ADMIN", isActive: true, managerId: superAdmin.id },
        });
        await createProfile(mgr.id, { manager: true });
        await addDepartments(mgr.id, departments);
        managers.push(mgr);
        console.log(`  ✓ ${mgr.name} (ADMIN) → ${departments.join(", ")}`);
    }

    // ── 3. Employees (consultants) ──────────────────────────────────────────────
    // Department per employee index: 0-9 SALES (Team Arun); 10-19 split across the
    // services departments (Team Meena).
    const employeesData = [
        { email: "rahul.verma@dcrm.com",   name: "Rahul Verma",    jobTitle: "Sales Consultant",         dept: "SALES" },
        { email: "priya.singh@dcrm.com",   name: "Priya Singh",    jobTitle: "Sales Consultant",         dept: "SALES" },
        { email: "karthik.raj@dcrm.com",   name: "Karthik Raj",    jobTitle: "Senior Sales Consultant",  dept: "SALES" },
        { email: "sneha.iyer@dcrm.com",    name: "Sneha Iyer",     jobTitle: "Account Consultant",       dept: "SALES" },
        { email: "vikram.nair@dcrm.com",   name: "Vikram Nair",    jobTitle: "Sales Consultant",         dept: "SALES" },
        { email: "pooja.menon@dcrm.com",   name: "Pooja Menon",    jobTitle: "Business Dev Consultant",  dept: "SALES" },
        { email: "suresh.kumar@dcrm.com",  name: "Suresh Kumar",   jobTitle: "Sales Consultant",         dept: "SALES" },
        { email: "ananya.das@dcrm.com",    name: "Ananya Das",     jobTitle: "Account Consultant",       dept: "SALES" },
        { email: "deepak.reddy@dcrm.com",  name: "Deepak Reddy",   jobTitle: "Sales Consultant",         dept: "SALES" },
        { email: "lavanya.pillai@dcrm.com",name: "Lavanya Pillai", jobTitle: "Senior Sales Consultant",  dept: "SALES" },
        { email: "arjun.nair@dcrm.com",    name: "Arjun Nair",     jobTitle: "Loan Consultant",          dept: "LOAN" },
        { email: "divya.nambiar@dcrm.com", name: "Divya Nambiar",  jobTitle: "Loan Consultant",          dept: "LOAN" },
        { email: "rohit.gupta@dcrm.com",   name: "Rohit Gupta",    jobTitle: "Loan Consultant",          dept: "LOAN" },
        { email: "kavitha.suresh@dcrm.com",name: "Kavitha Suresh", jobTitle: "Loan Consultant",          dept: "LOAN" },
        { email: "rajesh.babu@dcrm.com",   name: "Rajesh Babu",    jobTitle: "Forex Consultant",         dept: "FOREX" },
        { email: "nisha.patel@dcrm.com",   name: "Nisha Patel",    jobTitle: "Forex Consultant",         dept: "FOREX" },
        { email: "sanjay.kumar@dcrm.com",  name: "Sanjay Kumar",   jobTitle: "Forex Consultant",         dept: "FOREX" },
        { email: "usha.reddy@dcrm.com",    name: "Usha Reddy",     jobTitle: "Accommodation Consultant", dept: "ACCOMMODATION_TICKETS" },
        { email: "madhan.kumar@dcrm.com",  name: "Madhan Kumar",   jobTitle: "Accommodation Consultant", dept: "ACCOMMODATION_TICKETS" },
        { email: "preethi.rao@dcrm.com",   name: "Preethi Rao",    jobTitle: "Services Consultant",      dept: "MISCELLANEOUS" },
    ];

    const employees = [];
    const byDept = {}; // DepartmentType → [employee]
    for (let i = 0; i < employeesData.length; i++) {
        const { dept, ...ed } = employeesData[i];
        const managerId = i < 10 ? managers[0].id : managers[1].id;
        const emp = await prisma.user.create({
            data: { ...ed, password, role: "EMPLOYEE", isActive: true, managerId, department: dept },
        });
        await createProfile(emp.id);
        await addDepartments(emp.id, [dept]);
        emp._dept = dept;
        employees.push(emp);
        (byDept[dept] ||= []).push(emp);
    }
    const salesTeam = byDept.SALES;
    console.log(`  ✓ 20 consultants created (10 SALES, 10 across Loan/Forex/Accommodation/Misc)`);

    // ── 4. Leads — 100 total, each with a SALES service ─────────────────────────
    console.log("\nCreating leads with department services...");
    const shuffledPhases = [...SALES_PHASES].sort(() => Math.random() - 0.5);

    const leads = []; // { lead, salesConsultant, salesStage, createdDaysAgo, services }
    for (let i = 0; i < 100; i++) {
        const salesConsultant = salesTeam[i % salesTeam.length]; // 10 leads per sales consultant
        const salesStage = shuffledPhases[i];
        const name = LEAD_NAMES[i] || `Lead ${i + 1}`;
        const emailKey = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").slice(0, 20);
        const createdDaysAgo = rand(5, 120);
        const score = rand(20, 95);

        // Base SALES service + (~30%) one extra department service.
        const services = [{ department: "SALES", stage: salesStage, assignedEmployeeId: salesConsultant.id }];
        if (Math.random() < 0.3) {
            const dept = pick(EXTRA_DEPARTMENTS);
            const pool = byDept[dept] || [];
            const consultant = pool.length ? pick(pool) : null;
            services.push({
                department: dept,
                stage: pick(getStages(dept)),
                assignedEmployeeId: consultant && Math.random() > 0.25 ? consultant.id : null,
            });
        }

        const lead = await prisma.lead.create({
            data: {
                name,
                email:       `${emailKey}@${pick(EMAIL_DOMAINS)}`,
                phone:       `+91${rand(7000000000, 9999999999)}`,
                source:      pick(SOURCES),
                enquiryType: pick(ENQUIRIES),
                score,
                category:    categoryFromScore(score),
                createdAt:   daysAgo(createdDaysAgo),
                firstResponseAt: salesStage !== "ENQUIRY" ? daysAgo(createdDaysAgo - rand(0, 2)) : null,
                lastActivityAt: daysAgo(rand(0, createdDaysAgo)),
                leadDepartments: {
                    create: services.map(s => ({
                        department: s.department,
                        stage: s.stage,
                        assignedEmployeeId: s.assignedEmployeeId,
                        assignedAt: s.assignedEmployeeId ? daysAgo(createdDaysAgo - 1) : null,
                    })),
                },
            },
        });
        leads.push({ lead, salesConsultant, salesStage, createdDaysAgo, services });

        // Activity: lead created
        await prisma.activity.create({
            data: {
                leadId: lead.id, userId: salesConsultant.id, action: "LEAD_CREATED",
                metadata: { source: lead.source }, createdAt: daysAgo(createdDaysAgo),
            },
        });
        // Activity: SALES stage advanced beyond ENQUIRY
        if (salesStage !== "ENQUIRY") {
            await prisma.activity.create({
                data: {
                    leadId: lead.id, userId: salesConsultant.id, action: "STAGE_CHANGED",
                    metadata: { department: "SALES", from: "ENQUIRY", to: salesStage },
                    createdAt: daysAgo(createdDaysAgo - rand(1, 3)),
                },
            });
        }
    }
    console.log(`  ✓ 100 leads created and distributed`);

    // ── 5. Commissions (per-department, at COMMISSION_INVOICING) ────────────────
    console.log("\nCreating commissions...");
    let commissionCount = 0;
    for (const { lead, services } of leads) {
        for (const svc of services) {
            if (!svc.assignedEmployeeId || !isCommissionStage(svc.department, svc.stage)) continue;
            await prisma.commission.create({
                data: {
                    leadId: lead.id, department: svc.department, userId: svc.assignedEmployeeId,
                    amount: rand(2000, 25000), createdAt: daysAgo(rand(1, 60)),
                },
            });
            commissionCount++;
        }
    }
    console.log(`  ✓ ${commissionCount} commissions`);

    // ── 6. Deals, Invoices, Payments (derived from SALES stage) ─────────────────
    console.log("\nCreating deals, invoices, payments...");
    await prisma.invoiceCounter.create({ data: { prefix: "INV", currentValue: 0 } });

    let invCounter = 1;
    let dealCount  = 0;
    const dealAmounts = [55000, 75000, 95000, 120000, 150000, 185000, 220000, 280000, 350000, 420000, 480000, 560000];

    for (const { lead, salesConsultant, salesStage, createdDaysAgo } of leads) {
        const dealStage = dealStageForSalesStage(salesStage);
        if (!dealStage) continue; // ENQUIRY-stage leads have no deal yet

        const amount = pick(dealAmounts);
        const closedDaysAgo = dealStage === "WON" || dealStage === "LOST" ? rand(1, createdDaysAgo - 2) : null;

        const deal = await prisma.deal.create({
            data: {
                leadId: lead.id,
                title: `${lead.name} — ${pick(ENQUIRIES)} Deal`,
                amount, stage: dealStage, currency: "INR",
                createdById: salesConsultant.id, assignedEmployeeId: salesConsultant.id,
                closedAt: closedDaysAgo ? daysAgo(closedDaysAgo) : null,
                createdAt: daysAgo(createdDaysAgo - 1),
            },
        });
        dealCount++;

        if (dealStage === "WON" || dealStage === "NEGOTIATION") {
            const subtotal  = amount;
            const gst       = parseFloat((subtotal * 0.09).toFixed(2));
            const total     = parseFloat((subtotal + gst * 2).toFixed(2));
            const invNumber = `INV-${String(invCounter++).padStart(4, "0")}`;
            const invStatus = dealStage === "WON" ? pick(["PAID", "PAID", "PARTIALLY_PAID"]) : pick(["DRAFT", "SENT"]);

            const invoice = await prisma.invoice.create({
                data: {
                    invoiceNumber: invNumber, invoiceType: "TAX_INVOICE",
                    clientName: lead.name, clientEmail: lead.email, clientPhone: lead.phone,
                    subtotal, cgst: gst, sgst: gst, total, status: invStatus,
                    dueDate: daysAgo(closedDaysAgo ? closedDaysAgo - 30 : -30),
                    dealId: deal.id, createdById: salesConsultant.id, createdAt: daysAgo(createdDaysAgo - 2),
                    items: { create: [{
                        description: `${pick(ENQUIRIES)} Service / Product`,
                        price: subtotal, quantity: 1, taxRate: 18, taxableValue: subtotal, amount: total,
                    }] },
                },
            });

            if (invStatus === "PAID") {
                await prisma.paymentEntry.create({
                    data: {
                        invoiceId: invoice.id, amount: total, type: "CREDIT",
                        description: "Full payment received",
                        paymentDate: daysAgo(closedDaysAgo ? closedDaysAgo - rand(5, 15) : rand(1, 10)),
                    },
                });
            } else if (invStatus === "PARTIALLY_PAID") {
                const partial = parseFloat((total * pick([0.3, 0.4, 0.5, 0.6])).toFixed(2));
                await prisma.paymentEntry.create({
                    data: {
                        invoiceId: invoice.id, amount: partial, type: "CREDIT",
                        description: "Partial payment received",
                        paymentDate: daysAgo(closedDaysAgo ? closedDaysAgo - rand(2, 10) : rand(1, 5)),
                    },
                });
            }
        }
    }
    console.log(`  ✓ ${dealCount} deals created with invoices and payments`);

    // ── 7. Call Logs (2-4 per lead) ───────────────────────────────────────────
    console.log("\nCreating call logs...");
    let callCount = 0;
    for (const { lead, salesConsultant, salesStage, createdDaysAgo } of leads) {
        const numCalls = salesStage === "ENQUIRY" ? 1 : rand(2, 4);
        for (let c = 0; c < numCalls; c++) {
            const callDaysAgo = rand(0, createdDaysAgo);
            await prisma.callLog.create({
                data: {
                    leadId: lead.id, userId: salesConsultant.id, duration: rand(30, 600),
                    callType: pick(["OUTBOUND", "OUTBOUND", "INBOUND"]), callStatus: pick(CALL_STATUSES),
                    callDate: daysAgo(callDaysAgo), createdAt: daysAgo(callDaysAgo),
                    summary: pick([
                        "Discussed product requirements", "Client requested demo",
                        "Followed up on proposal", "Price negotiation call",
                        "Onboarding discussion", "Technical requirements call", null,
                    ]),
                    sentiment: pick(["POSITIVE", "NEUTRAL", "NEGATIVE", null]),
                },
            });
            callCount++;
        }
    }
    console.log(`  ✓ ${callCount} call logs created`);

    // ── 8. Email Logs (1-3 per lead) ──────────────────────────────────────────
    console.log("\nCreating email logs...");
    let emailCount = 0;
    for (const { lead, salesConsultant, salesStage, createdDaysAgo } of leads) {
        if (salesStage === "ENQUIRY" && Math.random() < 0.4) continue;
        const numEmails = rand(1, 3);
        for (let e = 0; e < numEmails; e++) {
            const sentDaysAgo = rand(0, createdDaysAgo);
            await prisma.emailLog.create({
                data: {
                    leadId: lead.id, sentById: salesConsultant.id, subject: pick(EMAIL_SUBJECTS),
                    body: `Dear ${lead.name},\n\nThank you for your interest. ${pick([
                        "We'd love to schedule a demo for you.",
                        "Please find the attached proposal.",
                        "Following up on our previous discussion.",
                        "We have a special offer available this month.",
                        "Our team is ready to assist you.",
                    ])}\n\nBest regards,\n${salesConsultant.name}`,
                    toEmail: lead.email || `lead_${lead.id.slice(0, 8)}@example.com`,
                    openedAt: Math.random() > 0.4 ? daysAgo(sentDaysAgo - rand(0, 2)) : null,
                    createdAt: daysAgo(sentDaysAgo),
                },
            });
            emailCount++;
        }
    }
    console.log(`  ✓ ${emailCount} email logs created`);

    // ── 9. Tasks (linked to each consultant's leads) ──────────────────────────
    console.log("\nCreating tasks...");
    let taskCount = 0;
    const TASK_TITLES = [
        "Send product brochure", "Schedule demo call", "Follow up on proposal",
        "Prepare custom quote", "Send contract draft", "Check payment status",
        "Update service stage", "Escalate to senior", "Send thank you email",
        "Arrange site visit", "Share case studies", "Confirm meeting",
    ];
    for (const consultant of salesTeam) {
        const myLeads = leads.filter(l => l.salesConsultant.id === consultant.id);
        if (!myLeads.length) continue;
        const numTasks = rand(2, 4);
        for (let t = 0; t < numTasks; t++) {
            const targetLead = myLeads[t % myLeads.length];
            const dueDaysFromNow = rand(-3, 14);
            await prisma.task.create({
                data: {
                    title: pick(TASK_TITLES), leadId: targetLead.lead.id, assignedToId: consultant.id,
                    dueDate: new Date(Date.now() + dueDaysFromNow * 86400_000),
                    status: dueDaysFromNow < -1 ? pick(["PENDING", "PENDING", "COMPLETED"]) : "PENDING",
                    priority: pick(["HIGH", "MEDIUM", "MEDIUM", "LOW"]),
                    kanbanStatus: pick(["TODO", "TODO", "IN_PROGRESS", "DONE"]),
                },
            });
            taskCount++;
        }
    }
    console.log(`  ✓ ${taskCount} tasks created`);

    // ── 10. Notes on leads ─────────────────────────────────────────────────────
    console.log("\nCreating notes...");
    let noteCount = 0;
    const NOTE_TEXTS = [
        "Client is very interested, needs time to decide",
        "Decision maker is out of town until next week",
        "Budget approved, waiting for final sign-off",
        "Client requested a revised proposal",
        "Strong competitor also pitching — need to move fast",
        "Client prefers WhatsApp communication",
        "Referred by existing client",
        "Needs custom integration with their ERP",
    ];
    for (const { lead, salesStage } of leads) {
        if (salesStage === "ENQUIRY") continue;
        if (Math.random() < 0.6) {
            await prisma.note.create({
                data: { leadId: lead.id, content: pick(NOTE_TEXTS), createdAt: daysAgo(rand(0, 10)) },
            });
            noteCount++;
        }
    }
    console.log(`  ✓ ${noteCount} notes created`);

    // ── 11. Attendance (last 30 days for all users) ────────────────────────────
    console.log("\nCreating attendance...");
    const allUsers = [superAdmin, ...managers, ...employees];
    let attCount = 0;
    for (const user of allUsers) {
        for (let d = 30; d >= 1; d--) {
            const date = daysAgo(d);
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

            const status = Math.random() < 0.9 ? "PRESENT" : pick(["ABSENT", "HALF_DAY", "WFH"]);
            const checkIn  = status !== "ABSENT" ? new Date(date.setHours(rand(8, 10), rand(0, 59))) : null;
            const checkOut = status !== "ABSENT" && Math.random() > 0.1
                ? new Date(new Date(checkIn).setHours(rand(17, 19), rand(0, 59)))
                : null;

            const attendanceDate = new Date(daysAgo(d));
            attendanceDate.setHours(0, 0, 0, 0);
            try {
                await prisma.attendance.create({
                    data: { userId: user.id, date: attendanceDate, checkIn, checkOut, status },
                });
                attCount++;
            } catch (_) { /* skip duplicates */ }
        }
    }
    console.log(`  ✓ ${attCount} attendance records created`);

    // ── Done ──────────────────────────────────────────────────────────────────
    console.log("\n════════════════════════════════════════");
    console.log("  Seed complete!");
    console.log("════════════════════════════════════════");
    console.log("\nLogin credentials (password: Demo@1234)");
    console.log("─────────────────────────────────────────");
    console.log("  SUPER_ADMIN  admin@dcrm.com          (Director, all departments)");
    console.log("  ADMIN        arun.manager@dcrm.com   (Sales)");
    console.log("  ADMIN        meena.manager@dcrm.com  (Loan/Forex/Accommodation/Misc)");
    console.log("  EMPLOYEE     rahul.verma@dcrm.com    (Sales consultant)");
    console.log("  EMPLOYEE     arjun.nair@dcrm.com     (Loan consultant)");
    console.log("  EMPLOYEE     rajesh.babu@dcrm.com    (Forex consultant)");
    console.log("─────────────────────────────────────────");
    console.log(`  Users: 23  |  Leads: 100  |  Deals: ${dealCount}  |  Commissions: ${commissionCount}`);
    console.log(`  Calls: ${callCount}  |  Emails: ${emailCount}  |  Tasks: ${taskCount}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => {
        await prisma.$disconnect();
        try { await require("../src/utils/prisma").$disconnect(); } catch { /* noop */ }
    });
