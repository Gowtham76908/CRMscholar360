/**
 * DCRM Complete Seed
 *
 * Structure:
 *   1 SUPER_ADMIN
 *   2 MANAGERs  (each reports to super admin)
 *   20 EMPLOYEEs (10 per manager, managerId wired)
 *   EmployeeProfile for every employee + manager
 *   100 Leads distributed evenly across 20 employees (5 each)
 *   Deals  → linked to leads (CONVERTED=WON, FOLLOW_UP=NEGOTIATION, CONTACTED=NEW, LOST=LOST)
 *   Invoices → linked to deals
 *   PaymentEntries → linked to invoices (WON deals get partial/full payment)
 *   CallLogs → 2-4 calls per lead
 *   EmailLogs → 1-3 emails per lead
 *   Tasks → 1-3 tasks per employee linked to their leads
 *   Activities → status-change trail for every lead
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

// ─── Utilities ────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);
const hoursAgo = (n) => new Date(Date.now() - n * 3600_000);

// ─── Master Data ──────────────────────────────────────────────────────────────

const SOURCES   = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];
const ENQUIRIES = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];

// 30 NEW · 20 CONTACTED · 20 FOLLOW_UP · 20 CONVERTED · 10 LOST  (per 100 leads)
const STATUSES = [
    ...Array(30).fill("NEW"),
    ...Array(20).fill("CONTACTED"),
    ...Array(20).fill("FOLLOW_UP"),
    ...Array(20).fill("CONVERTED"),
    ...Array(10).fill("LOST"),
];

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
    await prisma.lead.deleteMany();
    await prisma.employeeProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.leave.deleteMany();
    await prisma.leaveApproval.deleteMany();
    await prisma.userStatusLog.deleteMany();
    await prisma.user.deleteMany();
    console.log("  ✓ All tables cleared\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    // Idempotency guard: only populate an EMPTY database. This lets the seed run
    // safely on every deploy (e.g. from the Render build command) — on a fresh DB
    // it creates the demo data + admin login, and on a DB that already has users
    // it skips entirely so real/production data is never wiped.
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
        console.log(`Seed skipped — database already has ${existingUsers} user(s); leaving data untouched.`);
        return;
    }

    await clearAll();

    const password = await bcrypt.hash("Demo@1234", 10);

    // ── 1. Super Admin ─────────────────────────────────────────────────────────
    console.log("Creating users...");

    const superAdmin = await prisma.user.create({
        data: {
            email: "admin@dcrm.com",
            name: "Super Admin",
            password,
            role: "SUPER_ADMIN",
            department: "Management",
            jobTitle: "CEO",
            isActive: true,
        },
    });
    console.log(`  ✓ ${superAdmin.name} (SUPER_ADMIN)`);

    // ── 2. Managers ────────────────────────────────────────────────────────────
    const managersData = [
        { email: "arun.manager@dcrm.com",  name: "Arun Pillai",  jobTitle: "Sales Manager",      department: "Sales" },
        { email: "meena.manager@dcrm.com", name: "Meena Sharma", jobTitle: "Business Dev Manager", department: "Sales" },
    ];

    const managers = [];
    for (const m of managersData) {
        const mgr = await prisma.user.create({
            data: { ...m, password, role: "MANAGER", isActive: true, managerId: superAdmin.id },
        });
        await prisma.employeeProfile.create({
            data: {
                employeeId: mgr.id,
                maxDailyLeads: 30,
                currentLeadLoad: 0,
                performanceScore: 0.85,
                leadEffectiveness: 0.85,
                responseQuality: 0.88,
                followupDiscipline: 0.82,
                attendanceReliability: 0.90,
            },
        });
        managers.push(mgr);
        console.log(`  ✓ ${mgr.name} (MANAGER)`);
    }

    // ── 3. Employees (10 per manager) ──────────────────────────────────────────
    const employeesData = [
        // Team Arun (indices 0-9)
        { email: "rahul.verma@dcrm.com",   name: "Rahul Verma",    jobTitle: "Sales Executive",      department: "Sales" },
        { email: "priya.singh@dcrm.com",   name: "Priya Singh",    jobTitle: "Sales Executive",      department: "Sales" },
        { email: "karthik.raj@dcrm.com",   name: "Karthik Raj",    jobTitle: "Senior Sales Rep",     department: "Sales" },
        { email: "sneha.iyer@dcrm.com",    name: "Sneha Iyer",     jobTitle: "Account Executive",    department: "Sales" },
        { email: "vikram.nair@dcrm.com",   name: "Vikram Nair",    jobTitle: "Sales Executive",      department: "Sales" },
        { email: "pooja.menon@dcrm.com",   name: "Pooja Menon",    jobTitle: "Business Dev Rep",     department: "Sales" },
        { email: "suresh.kumar@dcrm.com",  name: "Suresh Kumar",   jobTitle: "Sales Executive",      department: "Sales" },
        { email: "ananya.das@dcrm.com",    name: "Ananya Das",     jobTitle: "Account Manager",      department: "Sales" },
        { email: "deepak.reddy@dcrm.com",  name: "Deepak Reddy",   jobTitle: "Sales Executive",      department: "Sales" },
        { email: "lavanya.pillai@dcrm.com",name: "Lavanya Pillai", jobTitle: "Senior Sales Rep",     department: "Sales" },
        // Team Meena (indices 10-19)
        { email: "arjun.nair@dcrm.com",    name: "Arjun Nair",     jobTitle: "Sales Executive",      department: "Sales" },
        { email: "divya.nambiar@dcrm.com", name: "Divya Nambiar",  jobTitle: "Business Dev Rep",     department: "Sales" },
        { email: "rohit.gupta@dcrm.com",   name: "Rohit Gupta",    jobTitle: "Sales Executive",      department: "Sales" },
        { email: "kavitha.suresh@dcrm.com",name: "Kavitha Suresh", jobTitle: "Account Executive",    department: "Sales" },
        { email: "rajesh.babu@dcrm.com",   name: "Rajesh Babu",    jobTitle: "Sales Executive",      department: "Sales" },
        { email: "nisha.patel@dcrm.com",   name: "Nisha Patel",    jobTitle: "Senior Sales Rep",     department: "Sales" },
        { email: "sanjay.kumar@dcrm.com",  name: "Sanjay Kumar",   jobTitle: "Sales Executive",      department: "Sales" },
        { email: "usha.reddy@dcrm.com",    name: "Usha Reddy",     jobTitle: "Account Manager",      department: "Sales" },
        { email: "madhan.kumar@dcrm.com",  name: "Madhan Kumar",   jobTitle: "Sales Executive",      department: "Sales" },
        { email: "preethi.rao@dcrm.com",   name: "Preethi Rao",    jobTitle: "Senior Sales Rep",     department: "Sales" },
    ];

    const employees = [];
    for (let i = 0; i < employeesData.length; i++) {
        const ed = employeesData[i];
        const managerId = i < 10 ? managers[0].id : managers[1].id;
        const emp = await prisma.user.create({
            data: { ...ed, password, role: "EMPLOYEE", isActive: true, managerId },
        });
        const perfScore = 0.4 + Math.random() * 0.55;
        await prisma.employeeProfile.create({
            data: {
                employeeId: emp.id,
                maxDailyLeads: 20,
                currentLeadLoad: rand(2, 8),
                lastAssignedAt: daysAgo(rand(0, 3)),
                performanceScore: parseFloat(perfScore.toFixed(2)),
                leadEffectiveness: parseFloat((perfScore + (Math.random() * 0.1 - 0.05)).toFixed(2)),
                responseQuality: parseFloat((perfScore + (Math.random() * 0.1 - 0.05)).toFixed(2)),
                followupDiscipline: parseFloat((perfScore + (Math.random() * 0.1 - 0.05)).toFixed(2)),
                attendanceReliability: parseFloat((0.7 + Math.random() * 0.28).toFixed(2)),
            },
        });
        employees.push(emp);
    }
    console.log(`  ✓ 20 employees created (10 under each manager)`);

    // ── 4. Leads — 100 total, 5 per employee ──────────────────────────────────
    console.log("\nCreating leads...");

    // Shuffle statuses so distribution is spread across employees
    const shuffledStatuses = [...STATUSES].sort(() => Math.random() - 0.5);

    const leads = [];
    for (let i = 0; i < 100; i++) {
        const employee = employees[i % 20]; // 5 leads per employee
        const status   = shuffledStatuses[i];
        const name     = LEAD_NAMES[i] || `Lead ${i + 1}`;
        const emailKey = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").slice(0, 20);
        const createdDaysAgo = rand(5, 120);

        const lead = await prisma.lead.create({
            data: {
                name,
                email:       `${emailKey}@${pick(EMAIL_DOMAINS)}`,
                phone:       `+91${rand(7000000000, 9999999999)}`,
                source:      pick(SOURCES),
                enquiryType: pick(ENQUIRIES),
                status,
                score:       rand(20, 95),
                assignedTo:  { connect: { id: employee.id } },
                assignedAt:  daysAgo(createdDaysAgo - 1),
                createdAt:   daysAgo(createdDaysAgo),
                firstResponseAt: status !== "NEW" ? daysAgo(createdDaysAgo - rand(0, 2)) : null,
            },
        });
        leads.push({ lead, employee, status, createdDaysAgo });

        // Activity: lead created
        await prisma.activity.create({
            data: {
                leadId: lead.id,
                userId: employee.id,
                action: "LEAD_CREATED",
                metadata: { source: lead.source },
                createdAt: daysAgo(createdDaysAgo),
            },
        });

        // Activity: status changes
        if (status !== "NEW") {
            await prisma.activity.create({
                data: {
                    leadId: lead.id,
                    userId: employee.id,
                    action: "STATUS_CHANGED",
                    metadata: { from: "NEW", to: status },
                    createdAt: daysAgo(createdDaysAgo - rand(1, 3)),
                },
            });
        }
    }
    console.log(`  ✓ 100 leads created and distributed`);

    // ── 5. Deals, Invoices, Payments ──────────────────────────────────────────
    console.log("\nCreating deals, invoices, payments...");

    // Seed invoice counter
    await prisma.invoiceCounter.create({ data: { prefix: "INV", currentValue: 0 } });

    let invCounter = 1;
    let dealCount  = 0;

    const dealAmounts = [55000, 75000, 95000, 120000, 150000, 185000, 220000, 280000, 350000, 420000, 480000, 560000];

    for (const { lead, employee, status, createdDaysAgo } of leads) {
        if (status === "NEW") continue; // No deals for brand-new leads

        const amount    = pick(dealAmounts);
        const closedDaysAgo = status === "CONVERTED" || status === "LOST" ? rand(1, createdDaysAgo - 2) : null;

        const dealStage = {
            CONTACTED:  "NEW",
            FOLLOW_UP:  "NEGOTIATION",
            CONVERTED:  "WON",
            LOST:       "LOST",
        }[status];

        const deal = await prisma.deal.create({
            data: {
                leadId:             lead.id,
                title:              `${lead.name} — ${pick(ENQUIRIES)} Deal`,
                amount,
                stage:              dealStage,
                currency:           "INR",
                createdById:        employee.id,
                assignedEmployeeId: employee.id,
                closedAt:           closedDaysAgo ? daysAgo(closedDaysAgo) : null,
                createdAt:          daysAgo(createdDaysAgo - 1),
            },
        });
        dealCount++;

        // Only create invoices for WON and NEGOTIATION deals
        if (dealStage === "WON" || dealStage === "NEGOTIATION") {
            const subtotal    = amount;
            const gst         = parseFloat((subtotal * 0.09).toFixed(2));
            const total       = parseFloat((subtotal + gst * 2).toFixed(2));
            const invNumber   = `INV-${String(invCounter++).padStart(4, "0")}`;
            const invStatus   = dealStage === "WON"
                ? pick(["PAID", "PAID", "PARTIALLY_PAID"])
                : pick(["DRAFT", "SENT"]);

            const invoice = await prisma.invoice.create({
                data: {
                    invoiceNumber: invNumber,
                    invoiceType:   "TAX_INVOICE",
                    clientName:    lead.name,
                    clientEmail:   lead.email,
                    clientPhone:   lead.phone,
                    subtotal,
                    cgst:          gst,
                    sgst:          gst,
                    total,
                    status:        invStatus,
                    dueDate:       daysAgo(closedDaysAgo ? closedDaysAgo - 30 : -30),
                    dealId:        deal.id,
                    createdById:   employee.id,
                    createdAt:     daysAgo(createdDaysAgo - 2),
                    items: {
                        create: [{
                            description:  `${pick(ENQUIRIES)} Service / Product`,
                            price:         subtotal,
                            quantity:      1,
                            taxRate:       18,
                            taxableValue:  subtotal,
                            amount:        total,
                        }],
                    },
                },
            });

            // PaymentEntries for paid/partial invoices
            if (invStatus === "PAID") {
                await prisma.paymentEntry.create({
                    data: {
                        invoiceId:   invoice.id,
                        amount:      total,
                        type:        "CREDIT",
                        description: "Full payment received",
                        paymentDate: daysAgo(closedDaysAgo ? closedDaysAgo - rand(5, 15) : rand(1, 10)),
                    },
                });
            } else if (invStatus === "PARTIALLY_PAID") {
                const partial = parseFloat((total * pick([0.3, 0.4, 0.5, 0.6])).toFixed(2));
                await prisma.paymentEntry.create({
                    data: {
                        invoiceId:   invoice.id,
                        amount:      partial,
                        type:        "CREDIT",
                        description: "Partial payment received",
                        paymentDate: daysAgo(closedDaysAgo ? closedDaysAgo - rand(2, 10) : rand(1, 5)),
                    },
                });
            }
        }
    }
    console.log(`  ✓ ${dealCount} deals created with invoices and payments`);

    // ── 6. Call Logs (2-4 per lead) ───────────────────────────────────────────
    console.log("\nCreating call logs...");
    let callCount = 0;
    for (const { lead, employee, status, createdDaysAgo } of leads) {
        const numCalls = status === "NEW" ? 1 : rand(2, 4);
        for (let c = 0; c < numCalls; c++) {
            const callDaysAgo = rand(0, createdDaysAgo);
            await prisma.callLog.create({
                data: {
                    leadId:    lead.id,
                    userId:    employee.id,
                    duration:  rand(30, 600),
                    callType:  pick(["OUTBOUND", "OUTBOUND", "INBOUND"]),
                    callStatus: pick(CALL_STATUSES),
                    callDate:  daysAgo(callDaysAgo),
                    createdAt: daysAgo(callDaysAgo),
                    summary:   pick([
                        "Discussed product requirements",
                        "Client requested demo",
                        "Followed up on proposal",
                        "Price negotiation call",
                        "Onboarding discussion",
                        "Technical requirements call",
                        null,
                    ]),
                    sentiment: pick(["POSITIVE", "NEUTRAL", "NEGATIVE", null]),
                },
            });
            callCount++;
        }
    }
    console.log(`  ✓ ${callCount} call logs created`);

    // ── 7. Email Logs (1-3 per lead) ──────────────────────────────────────────
    console.log("\nCreating email logs...");
    let emailCount = 0;
    for (const { lead, employee, status, createdDaysAgo } of leads) {
        if (status === "NEW" && Math.random() < 0.4) continue; // 40% of NEW leads have no email yet
        const numEmails = rand(1, 3);
        for (let e = 0; e < numEmails; e++) {
            const sentDaysAgo = rand(0, createdDaysAgo);
            await prisma.emailLog.create({
                data: {
                    leadId:   lead.id,
                    sentById: employee.id,
                    subject:  pick(EMAIL_SUBJECTS),
                    body:     `Dear ${lead.name},\n\nThank you for your interest. ${pick([
                        "We'd love to schedule a demo for you.",
                        "Please find the attached proposal.",
                        "Following up on our previous discussion.",
                        "We have a special offer available this month.",
                        "Our team is ready to assist you.",
                    ])}\n\nBest regards,\n${employee.name}`,
                    toEmail:  lead.email || `lead_${lead.id.slice(0, 8)}@example.com`,
                    openedAt: Math.random() > 0.4 ? daysAgo(sentDaysAgo - rand(0, 2)) : null,
                    createdAt: daysAgo(sentDaysAgo),
                },
            });
            emailCount++;
        }
    }
    console.log(`  ✓ ${emailCount} email logs created`);

    // ── 8. Tasks (1-3 per employee, linked to their leads) ────────────────────
    console.log("\nCreating tasks...");
    let taskCount = 0;
    const TASK_TITLES = [
        "Send product brochure", "Schedule demo call", "Follow up on proposal",
        "Prepare custom quote", "Send contract draft", "Check payment status",
        "Update lead information", "Escalate to senior", "Send thank you email",
        "Arrange site visit", "Share case studies", "Confirm meeting",
    ];

    for (const employee of employees) {
        const myLeads = leads.filter(l => l.employee.id === employee.id);
        const numTasks = rand(2, 4);
        for (let t = 0; t < numTasks; t++) {
            const targetLead = myLeads[t % myLeads.length];
            const dueDaysFromNow = rand(-3, 14); // some overdue, some upcoming
            await prisma.task.create({
                data: {
                    title:        pick(TASK_TITLES),
                    leadId:       targetLead.lead.id,
                    assignedToId: employee.id,
                    dueDate:      new Date(Date.now() + dueDaysFromNow * 86400_000),
                    status:       dueDaysFromNow < -1 ? pick(["PENDING", "PENDING", "COMPLETED"]) : "PENDING",
                    priority:     pick(["HIGH", "MEDIUM", "MEDIUM", "LOW"]),
                    kanbanStatus: pick(["TODO", "TODO", "IN_PROGRESS", "DONE"]),
                },
            });
            taskCount++;
        }
    }
    console.log(`  ✓ ${taskCount} tasks created`);

    // ── 9. Notes on leads ─────────────────────────────────────────────────────
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
    for (const { lead, status } of leads) {
        if (status === "NEW") continue;
        if (Math.random() < 0.6) {
            await prisma.note.create({
                data: {
                    leadId:    lead.id,
                    content:   pick(NOTE_TEXTS),
                    createdAt: daysAgo(rand(0, 10)),
                },
            });
            noteCount++;
        }
    }
    console.log(`  ✓ ${noteCount} notes created`);

    // ── 10. Attendance (last 30 days for all users) ────────────────────────────
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

            // attendance date must be unique per user per date — use start of day
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
    console.log("  SUPER_ADMIN  admin@dcrm.com");
    console.log("  MANAGER      arun.manager@dcrm.com");
    console.log("  MANAGER      meena.manager@dcrm.com");
    console.log("  EMPLOYEE     rahul.verma@dcrm.com  (Team Arun)");
    console.log("  EMPLOYEE     arjun.nair@dcrm.com   (Team Meena)");
    console.log("─────────────────────────────────────────");
    console.log(`  Users: 23  |  Leads: 100  |  Deals: ${dealCount}`);
    console.log(`  Calls: ${callCount}  |  Emails: ${emailCount}  |  Tasks: ${taskCount}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
