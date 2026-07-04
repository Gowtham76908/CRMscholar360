/**
 * scholar360 - Comprehensive System Seed Script (multi-department model)
 * Creates realistic operational data for end-to-end QA testing.
 *
 * Model notes:
 *  - There is no global Lead.status / Lead.assignedToId any more. Each lead
 *    (customer) carries one or more LeadDepartment "services", each with its own
 *    consultant (assignedEmployeeId) and workflow stage.
 *  - Department membership is via UserDepartment (M2M) against the DepartmentType
 *    enum — there is no Department model.
 *  - Commission is earned per department-service when it reaches its
 *    COMMISSION_INVOICING stage, awarded to that service's consultant.
 *
 * Run: node seed.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { getStages, isCommissionStage } = require("./src/config/departmentWorkflows");

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const hoursAgo = (n) => new Date(Date.now() - n * 3600000);
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const normalizePhone = (phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    return digits.slice(-12);
};

// ─── Master Data ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
    "Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Divya", "Karthik", "Ananya",
    "Suresh", "Meera", "Ravi", "Pooja", "Arun", "Kavya", "Nikhil", "Swathi",
    "Deepak", "Shruti", "Manoj", "Lakshmi", "Sanjay", "Nithya", "Ajay", "Bhavana",
    "Gopal", "Asha", "Venkat", "Chitra", "Bala", "Parvathi", "Ramesh", "Sujatha",
    "Harish", "Vidya", "Vinod", "Sindhu", "Muthukumar", "Saranya", "Chandru", "Uma",
    "Prasad", "Gomathi", "Senthil", "Indira", "Thirumurugan", "Revathy", "Srinivasan", "Malathi",
    "Balaji", "Jaya", "Naresh", "Kavitha", "Ganesh", "Radha", "Murugan", "Tamilselvi",
    "Krishnamurthy", "Sumathi", "Vijayakumar", "Padmavathi"
];

const LAST_NAMES = [
    "Kumar", "Sharma", "Patel", "Reddy", "Nair", "Pillai", "Iyer", "Rao",
    "Singh", "Gupta", "Verma", "Joshi", "Mehta", "Shah", "Mishra", "Pandey",
    "Krishnan", "Sundaram", "Venkataraman", "Subramaniam", "Ramasamy", "Murugesan",
    "Annamalai", "Palaniswamy", "Natarajan", "Balasubramanian", "Chandrasekaran",
    "Selvaraj", "Arumugam", "Thiagarajan"
];

const COMPANIES = [
    "TechVision Solutions", "Sunrise Enterprises", "Global Edge Systems", "Nova Digital",
    "Pinnacle Technologies", "StarBridge Consulting", "Nexus Innovations", "Velocity Corp",
    "Alpha Dynamics", "Quantum Leap Technologies", "Horizon IT Services", "BlueSky Analytics",
    "Catalyst Digital", "Meridian Software", "Apex Business Solutions", "Synergy Systems",
    "CloudNine Tech", "DataMatrix Solutions", "Fusion Technologies", "Prime Software",
    "Elevate Digital", "ClearPath Solutions", "Vertex Technologies", "Orbit Systems",
    "Clarity Consulting", "Nexgen Solutions", "Momentum Tech", "Ignite Digital",
    "Pathfinder Technologies", "Blueprint Systems", "Streamline Solutions", "CoreTech India",
    "Sterling Technologies", "Insight Analytics", "Pioneer Software", "Milestone Tech"
];

const CITIES = [
    "Chennai", "Mumbai", "Bangalore", "Hyderabad", "Delhi", "Pune", "Kolkata",
    "Ahmedabad", "Surat", "Jaipur", "Coimbatore", "Madurai", "Trichy", "Salem",
    "Tirunelveli", "Erode", "Vellore", "Cuddalore", "Thanjavur", "Kanchipuram"
];

const SOURCES = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];
const ENQUIRY_TYPES = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];

// Departments a customer can additionally be serviced by, beyond the base SALES
// service every lead starts with. APPLICATION_VISA is excluded (no workflow yet).
const EXTRA_DEPARTMENTS = ["LOAN", "FOREX", "ACCOMMODATION_TICKETS", "MISCELLANEOUS"];

// Weighted SALES stage distribution so the funnel looks realistic.
const SALES_STAGE_DIST = [
    ...Array(40).fill("ENQUIRY"),
    ...Array(30).fill("FOLLOW_UP"),
    ...Array(25).fill("PROSPECT"),
    ...Array(15).fill("UNIVERSITY_SHORTLISTING"),
    ...Array(15).fill("APPLICATION"),
    ...Array(10).fill("AWAITING_STATUS"),
    ...Array(10).fill("VISA_DOCUMENTATION"),
    ...Array(10).fill("VISA_APPROVAL"),
    ...Array(25).fill("COMMISSION_INVOICING"),
    ...Array(10).fill("ARCHIVE"),
];

const CALL_STATUSES = ["COMPLETED", "MISSED", "BUSY", "NO_ANSWER", "FAILED"];
const CALL_TONES = ["positive", "neutral", "negative", "frustrated", "interested"];
const CALL_SENTIMENTS = ["positive", "neutral", "negative"];
const CALL_CATEGORIES = ["inquiry", "follow_up", "demo_request", "complaint", "closed"];

const TASK_TITLES = [
    "Follow up with lead regarding proposal",
    "Schedule demo call",
    "Send pricing brochure",
    "Prepare custom proposal",
    "Verify client requirements",
    "Conduct product demo",
    "Send WhatsApp follow-up",
    "Update service stage after call",
    "Research client company",
    "Prepare contract documents",
    "Collect feedback after demo",
    "Coordinate with technical team",
    "Send case studies",
    "Follow up on pending payment",
    "Arrange site visit",
];

const NOTE_TEMPLATES = [
    "Client showed strong interest in the LMS module. Mentioned budget constraints around Q3.",
    "Spoke to decision maker. They are evaluating 3 vendors. We are shortlisted.",
    "Lead requested detailed pricing for enterprise plan. Send by EOD.",
    "Had a 30-min demo call. Very engaged. Asked about API integration capabilities.",
    "Client is from education sector. Looking for white-label solution.",
    "Follow-up needed. They are in approval stage internally.",
    "Lead went cold after initial contact. Try different approach.",
    "Referred by existing client Sunrise Enterprises. High priority.",
    "Client budget is 2-5 lakhs. Product fits. Move to prospect.",
    "Technical team evaluation pending. Decision expected next week.",
    "Client requested 3-month free trial. Not possible. Counter-offered 1 month.",
    "Competitor mentioned: Salesforce. Need to highlight our pricing advantage.",
    "Very interested in CRM + LMS bundle. Prepare bundled pricing.",
    "Called 3 times, no answer. Send email instead.",
    "Client wants GST invoice. Confirm with accounts team.",
];

const EMAIL_SUBJECTS = [
    "Introduction to D-CRM Solutions",
    "Proposal for Your Business Growth",
    "Follow-up: Our LMS Platform",
    "Exclusive Pricing for Q3 2024",
    "Product Demo Invitation",
    "Case Studies: Success Stories",
    "Re: Your Enquiry about White-label",
    "Special Offer - Limited Time",
    "Technical Specifications Document",
    "Follow-up: Our Previous Discussion",
];

const WA_MESSAGES = [
    "Hello! Thank you for your interest in our products. How can I assist you today?",
    "Hi, I wanted to follow up on our previous discussion. Are you still interested?",
    "Greetings! I'm sending you our latest product brochure as promised.",
    "Hello, hope you're doing well! Just checking if you received our proposal.",
    "Hi! We have an exclusive offer this month. Would you like to know more?",
    "Thank you for your time today. I'll send the detailed proposal shortly.",
    "Hello! Our team is ready to schedule a demo at your convenience.",
    "Hi, I've shared the pricing details. Please let me know if you have questions.",
];

const WA_REPLIES = [
    "Yes, please send the details.",
    "Sounds interesting. Can we schedule a call?",
    "I'll review and get back to you.",
    "Can you share more information?",
    "Not interested at this time.",
    "Please call me tomorrow morning.",
    "Send me the pricing please.",
    "We are already using another solution.",
    "Good timing! We are evaluating vendors now.",
    "Can you give us a demo this week?",
];

// ─── Users ─────────────────────────────────────────────────────────────────
// Each user declares which DepartmentType(s) they belong to (UserDepartment) and
// who their manager is (for hierarchy-based reporting/visibility).
const USER_DEFS = [
    // Director — member of every department, sees everything.
    {
        name: "System Director", email: "admin@scholar360.io", phone: "+91 9999999999",
        role: "SUPER_ADMIN", jobTitle: "Director", department: "Management",
        departments: ["SALES", "LOAN", "ACCOMMODATION_TICKETS", "FOREX", "MISCELLANEOUS"],
        managerEmail: null,
    },

    // Managers (ADMIN)
    {
        name: "Priya Sharma", email: "priya.sharma@scholar360.io", phone: "+91 9876543210",
        role: "ADMIN", jobTitle: "Sales Manager", department: "Sales",
        departments: ["SALES"], managerEmail: "admin@scholar360.io",
    },
    {
        name: "Vikram Patel", email: "vikram.patel@scholar360.io", phone: "+91 9988776655",
        role: "ADMIN", jobTitle: "Loan & Forex Manager", department: "Loan",
        departments: ["LOAN", "FOREX"], managerEmail: "admin@scholar360.io",
    },
    {
        name: "Ananya Nair", email: "ananya.nair@scholar360.io", phone: "+91 9765432109",
        role: "ADMIN", jobTitle: "Services Manager", department: "Services",
        departments: ["ACCOMMODATION_TICKETS", "MISCELLANEOUS"], managerEmail: "admin@scholar360.io",
    },

    // SALES consultants
    {
        name: "Karthik Reddy", email: "karthik.reddy@scholar360.io", phone: "+91 9876512345",
        role: "EMPLOYEE", jobTitle: "Senior Sales Consultant", department: "Sales",
        departments: ["SALES"], managerEmail: "priya.sharma@scholar360.io",
    },
    {
        name: "Rahul Krishnan", email: "rahul.krishnan@scholar360.io", phone: "+91 9654321098",
        role: "EMPLOYEE", jobTitle: "Sales Consultant", department: "Sales",
        departments: ["SALES"], managerEmail: "priya.sharma@scholar360.io",
    },
    {
        name: "Sneha Iyer", email: "sneha.iyer@scholar360.io", phone: "+91 9543210987",
        role: "EMPLOYEE", jobTitle: "Business Development Consultant", department: "Sales",
        departments: ["SALES"], managerEmail: "priya.sharma@scholar360.io",
    },
    {
        name: "Arun Venkataraman", email: "arun.venkat@scholar360.io", phone: "+91 9210987654",
        role: "EMPLOYEE", jobTitle: "Sales Consultant", department: "Sales",
        departments: ["SALES"], managerEmail: "priya.sharma@scholar360.io",
    },
    {
        name: "Bala Chandrasekaran", email: "bala.agent@scholar360.io", phone: "+91 8776543210",
        role: "EMPLOYEE", jobTitle: "Sales Consultant", department: "Sales",
        departments: ["SALES"], managerEmail: "priya.sharma@scholar360.io",
    },

    // LOAN consultants
    {
        name: "Deepak Rao", email: "deepak.rao@scholar360.io", phone: "+91 9432109876",
        role: "EMPLOYEE", jobTitle: "Loan Consultant", department: "Loan",
        departments: ["LOAN"], managerEmail: "vikram.patel@scholar360.io",
    },
    {
        name: "Kavya Annamalai", email: "kavya.agent@scholar360.io", phone: "+91 9009876543",
        role: "EMPLOYEE", jobTitle: "Loan Consultant", department: "Loan",
        departments: ["LOAN"], managerEmail: "vikram.patel@scholar360.io",
    },

    // FOREX (+ ACCOMMODATION) consultants
    {
        name: "Meera Pillai", email: "meera.pillai@scholar360.io", phone: "+91 9321098765",
        role: "EMPLOYEE", jobTitle: "Forex Consultant", department: "Forex",
        departments: ["FOREX"], managerEmail: "vikram.patel@scholar360.io",
    },
    {
        name: "Nikhil Natarajan", email: "nikhil.agent@scholar360.io", phone: "+91 8998765432",
        role: "EMPLOYEE", jobTitle: "Multi-service Consultant", department: "Forex",
        departments: ["FOREX", "ACCOMMODATION_TICKETS"], managerEmail: "vikram.patel@scholar360.io",
    },

    // ACCOMMODATION + MISCELLANEOUS consultants
    {
        name: "Suresh Murugesan", email: "suresh.agent@scholar360.io", phone: "+91 9109876543",
        role: "EMPLOYEE", jobTitle: "Accommodation Consultant", department: "Accommodation",
        departments: ["ACCOMMODATION_TICKETS"], managerEmail: "ananya.nair@scholar360.io",
    },
    {
        name: "Divya Selvaraj", email: "divya.agent@scholar360.io", phone: "+91 8887654321",
        role: "EMPLOYEE", jobTitle: "Services Consultant", department: "Misc",
        departments: ["MISCELLANEOUS"], managerEmail: "ananya.nair@scholar360.io",
    },
];

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
    console.log("🧹 Cleaning up previous seed data...");
    await prisma.whatsAppCampaignRecipient.deleteMany({});
    await prisma.whatsAppCampaign.deleteMany({});
    await prisma.whatsAppAutoReply.deleteMany({});
    await prisma.whatsAppMessage.deleteMany({});
    await prisma.emailLog.deleteMany({});
    await prisma.automationLog.deleteMany({});
    await prisma.automationAction.deleteMany({});
    await prisma.automationCondition.deleteMany({});
    await prisma.automationRule.deleteMany({});
    await prisma.reminder.deleteMany({});
    await prisma.callLog.deleteMany({});
    await prisma.taskComment.deleteMany({});
    await prisma.taskFile.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.note.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.commission.deleteMany({});
    await prisma.assignmentHistory.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.session.deleteMany({});
    // LeadDepartment cascades on lead delete, but clear explicitly to be safe.
    await prisma.leadDepartment.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.userDepartment.deleteMany({});
    await prisma.userStatusLog.deleteMany({});
    await prisma.customFieldDef.deleteMany({});
    console.log("  ✓ Cleanup done\n");
}

async function main() {
    console.log("🌱 Starting scholar360 seed (multi-department model)...\n");
    await cleanup();

    // ── Users + department memberships ─────────────────────────────────────────
    console.log("Creating users + department memberships...");
    const passwordHash = await bcrypt.hash("Password@123", 10);
    const userByEmail = new Map();

    // Ordered pass: Director first, then managers, then consultants — so every
    // managerEmail already resolves to a created user.
    for (const def of USER_DEFS) {
        const phone = def.phone.replace(/\s/g, "");
        const managerId = def.managerEmail ? userByEmail.get(def.managerEmail)?.id ?? null : null;
        const user = await prisma.user.upsert({
            where: { email: def.email },
            create: {
                name: def.name,
                email: def.email,
                phone,
                phoneNormalized: normalizePhone(phone),
                password: passwordHash,
                role: def.role,
                jobTitle: def.jobTitle,
                department: def.department,
                managerId,
                isActive: true,
                onlineStatus: randomFrom(["ONLINE", "OFFLINE", "BREAK"]),
                lastSeen: hoursAgo(randomInt(0, 48)),
            },
            update: { name: def.name, role: def.role, jobTitle: def.jobTitle, managerId, department: def.department },
        });
        userByEmail.set(def.email, user);

        // Replace memberships
        await prisma.userDepartment.deleteMany({ where: { userId: user.id } });
        for (const dept of def.departments) {
            await prisma.userDepartment.create({ data: { userId: user.id, department: dept } });
        }
    }
    const users = [...userByEmail.values()];
    const managerCount = USER_DEFS.filter(d => d.role === "ADMIN").length;
    const consultantCount = USER_DEFS.filter(d => d.role === "EMPLOYEE").length;
    console.log(`  ✓ ${users.length} users (1 Director, ${managerCount} managers, ${consultantCount} consultants)`);

    const director = userByEmail.get("admin@scholar360.io");

    // dept → consultants (EMPLOYEE members), falling back to any member.
    const deptConsultants = {};
    const deptMembers = {};
    for (const def of USER_DEFS) {
        for (const dept of def.departments) {
            (deptMembers[dept] ||= []).push(userByEmail.get(def.email));
            if (def.role === "EMPLOYEE") (deptConsultants[dept] ||= []).push(userByEmail.get(def.email));
        }
    }
    const consultantsFor = (dept) => (deptConsultants[dept]?.length ? deptConsultants[dept] : deptMembers[dept] || []);

    // ── Leads + LeadDepartment services ───────────────────────────────────────
    console.log("Creating 200 leads with department services...");
    const leads = [];
    // Per-lead context used to attribute downstream records (calls/emails/tasks)
    // to the SALES consultant rather than a removed global assignee.
    const leadCtx = new Map(); // leadId → { salesAssigneeId, services: [{department, stage, assignedEmployeeId}] }

    for (let i = 0; i < 200; i++) {
        const firstName = randomFrom(FIRST_NAMES);
        const lastName = randomFrom(LAST_NAMES);
        const name = `${firstName} ${lastName}`;
        const company = i % 3 === 0 ? randomFrom(COMPANIES) : null;
        const source = randomFrom(SOURCES);
        const enquiryType = randomFrom(ENQUIRY_TYPES);
        const createdAt = randomDate(daysAgo(180), new Date());

        // Varied data quality: each phone is unique via index suffix.
        let phone = null;
        let email = null;
        const basePhone = `9${String(700000000 + i).padStart(9, "0")}`;
        if (i % 7 === 0) {
            email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${randomFrom(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"])}`;
        } else if (i % 13 === 0) {
            // Missing both — low quality lead.
        } else {
            phone = basePhone;
            email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company ? company.toLowerCase().replace(/\s+/g, "").slice(0, 10) + ".com" : randomFrom(["gmail.com", "yahoo.com", "company.in"])}`;
        }

        const score = randomInt(10, 95);
        const category = score > 70 ? "HOT" : score > 40 ? "WARM" : "COLD";
        const whatsappOptIn = randomFrom([true, true, true, false]); // 75% opt-in

        // SALES service — every lead has one. Self-assigned to a sales consultant.
        const salesStage = SALES_STAGE_DIST[i % SALES_STAGE_DIST.length];
        const salesConsultant = randomFrom(consultantsFor("SALES"));
        const salesAssigneeId = i % 5 === 0 ? null : salesConsultant.id; // ~20% unassigned

        const services = [{
            department: "SALES",
            stage: salesStage,
            assignedEmployeeId: salesAssigneeId,
        }];

        // ~40% of leads get one extra department service, ~12% get two.
        const extras = new Set();
        if (i % 5 < 2) extras.add(randomFrom(EXTRA_DEPARTMENTS));
        if (i % 8 === 0) extras.add(randomFrom(EXTRA_DEPARTMENTS));
        for (const dept of extras) {
            const stages = getStages(dept);
            const stage = randomFrom(stages);
            const pool = consultantsFor(dept);
            const consultant = pool.length ? randomFrom(pool) : null;
            services.push({
                department: dept,
                stage,
                // Extra services are manager-assigned; leave ~25% awaiting assignment.
                assignedEmployeeId: consultant && Math.random() > 0.25 ? consultant.id : null,
            });
        }

        const firstResponseAt = salesStage !== "ENQUIRY" ? randomDate(createdAt, new Date()) : null;

        const lead = await prisma.lead.create({
            data: {
                name,
                email: email || null,
                phone: phone ? `+91${phone}` : null,
                phoneNormalized: phone ? `91${phone}` : null,
                source,
                enquiryType,
                score,
                category,
                company: company || undefined,
                whatsappOptIn,
                whatsappOptInAt: whatsappOptIn ? randomDate(daysAgo(90), new Date()) : null,
                firstResponseAt,
                lastActivityAt: randomDate(createdAt, new Date()),
                customFields: randomFrom([
                    undefined,
                    { budget_range: randomFrom(["< 1 Lakh", "1-5 Lakhs", "5-10 Lakhs", "> 10 Lakhs"]) },
                    { budget_range: randomFrom(["< 1 Lakh", "1-5 Lakhs"]), preferred_contact: randomFrom(["Phone", "WhatsApp", "Email"]) },
                    undefined,
                ]),
                createdAt,
                leadDepartments: {
                    create: services.map(s => ({
                        department: s.department,
                        stage: s.stage,
                        assignedEmployeeId: s.assignedEmployeeId,
                        assignedAt: s.assignedEmployeeId ? randomDate(createdAt, new Date()) : null,
                    })),
                },
            },
        });

        leads.push(lead);
        leadCtx.set(lead.id, { salesAssigneeId, services });
    }
    const serviceCount = [...leadCtx.values()].reduce((s, c) => s + c.services.length, 0);
    console.log(`  ✓ ${leads.length} leads, ${serviceCount} department services`);

    // For downstream records, prefer the lead's SALES consultant; fall back to a
    // random sales consultant when the lead is unassigned.
    const ownerFor = (lead) => {
        const ctx = leadCtx.get(lead.id);
        return ctx?.salesAssigneeId ? { id: ctx.salesAssigneeId } : randomFrom(consultantsFor("SALES"));
    };

    // ── Commissions (per-department, at COMMISSION_INVOICING) ──────────────────
    console.log("Creating commissions...");
    let commissionCount = 0;
    for (const lead of leads) {
        for (const svc of leadCtx.get(lead.id).services) {
            if (!svc.assignedEmployeeId) continue;
            if (!isCommissionStage(svc.department, svc.stage)) continue;
            await prisma.commission.create({
                data: {
                    leadId: lead.id,
                    department: svc.department,
                    userId: svc.assignedEmployeeId,
                    amount: randomInt(2000, 25000),
                    createdAt: randomDate(lead.createdAt, new Date()),
                },
            });
            commissionCount++;
        }
    }
    console.log(`  ✓ ${commissionCount} commissions`);

    // ── Activities / Timeline ────────────────────────────────────────────────
    console.log("Creating timeline activities...");
    let activityCount = 0;
    const activityTypes = [
        "STAGE_CHANGED", "NOTE_ADDED", "CALL_LOGGED", "EMAIL_SENT",
        "WHATSAPP_SENT", "REMINDER_SET", "CONSULTANT_ASSIGNED",
        "TASK_CREATED", "DEPARTMENT_ALLOCATED",
    ];
    for (const lead of leads) {
        const numActivities = randomInt(1, 8);
        const salesSvc = leadCtx.get(lead.id).services[0];
        for (let j = 0; j < numActivities; j++) {
            const action = j === 0 ? "LEAD_CREATED" : randomFrom(activityTypes);
            const user = ownerFor(lead);
            let metadata = null;
            if (action === "STAGE_CHANGED") {
                metadata = { department: salesSvc.department, from: "ENQUIRY", to: salesSvc.stage };
            } else if (action === "CONSULTANT_ASSIGNED") {
                metadata = { department: salesSvc.department, assignedTo: user.id };
            } else if (action === "DEPARTMENT_ALLOCATED") {
                metadata = { department: salesSvc.department };
            }
            await prisma.activity.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    user: { connect: { id: user.id } },
                    action,
                    metadata,
                    createdAt: randomDate(lead.createdAt, new Date()),
                },
            });
            activityCount++;
        }
    }
    console.log(`  ✓ ${activityCount} activities`);

    // ── Notes ────────────────────────────────────────────────────────────────
    console.log("Creating notes...");
    let noteCount = 0;
    for (const lead of leads.slice(0, 150)) {
        const count = randomInt(1, 4);
        for (let j = 0; j < count; j++) {
            await prisma.note.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    content: randomFrom(NOTE_TEMPLATES),
                    createdAt: randomDate(lead.createdAt, new Date()),
                },
            });
            noteCount++;
        }
    }
    console.log(`  ✓ ${noteCount} notes`);

    // ── Reminders ────────────────────────────────────────────────────────────
    console.log("Creating reminders...");
    let reminderCount = 0;
    for (const lead of leads.slice(0, 120)) {
        if (Math.random() > 0.4) continue;
        const user = ownerFor(lead);
        const isOverdue = Math.random() > 0.5;
        await prisma.reminder.create({
            data: {
                leadId: lead.id,
                userId: user.id,
                remindAt: isOverdue ? hoursAgo(randomInt(1, 72)) : new Date(Date.now() + randomInt(1, 48) * 3600000),
                message: randomFrom([
                    "Follow up on proposal sent",
                    "Call back after lunch",
                    "Send updated pricing",
                    "Check if demo was useful",
                    "Reminder: Contract due today",
                    "Follow up — no response in 3 days",
                ]),
                isSent: isOverdue,
            },
        });
        reminderCount++;
    }
    console.log(`  ✓ ${reminderCount} reminders`);

    // ── Call Logs ────────────────────────────────────────────────────────────
    console.log("Creating call logs...");
    let callCount = 0;
    for (const lead of leads) {
        if (Math.random() > 0.6) continue;
        const numCalls = randomInt(1, 4);
        for (let j = 0; j < numCalls; j++) {
            const callStatus = randomFrom(CALL_STATUSES);
            const user = ownerFor(lead);
            await prisma.callLog.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    userId: user.id,
                    duration: callStatus === "COMPLETED" ? randomInt(30, 1800) : 0,
                    callType: randomFrom(["OUTBOUND", "OUTBOUND", "INBOUND"]),
                    callStatus,
                    callDate: randomDate(lead.createdAt, new Date()),
                    tone: callStatus === "COMPLETED" ? randomFrom(CALL_TONES) : null,
                    sentiment: callStatus === "COMPLETED" ? randomFrom(CALL_SENTIMENTS) : null,
                    callCategory: callStatus === "COMPLETED" ? randomFrom(CALL_CATEGORIES) : null,
                    isTranscribed: callStatus === "COMPLETED" && Math.random() > 0.7,
                    summary: callStatus === "COMPLETED"
                        ? randomFrom([
                            "Client showed interest in LMS module. Requested pricing.",
                            "Decision pending. Follow up next week.",
                            "Demo scheduled for Friday. Client wants API docs.",
                            "Budget constraints. May need revised proposal.",
                            "Competitor evaluation in progress. Stay in touch.",
                          ])
                        : null,
                    createdAt: randomDate(lead.createdAt, new Date()),
                },
            });
            callCount++;
        }
    }
    console.log(`  ✓ ${callCount} call logs`);

    // ── Email Logs ───────────────────────────────────────────────────────────
    console.log("Creating email logs...");
    let emailCount = 0;
    for (const lead of leads) {
        if (!lead.email || Math.random() > 0.55) continue;
        const numEmails = randomInt(1, 4);
        for (let j = 0; j < numEmails; j++) {
            const user = ownerFor(lead);
            const wasOpened = Math.random() > 0.4;
            const wasClicked = wasOpened && Math.random() > 0.6;
            await prisma.emailLog.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    sentBy: { connect: { id: user.id } },
                    subject: randomFrom(EMAIL_SUBJECTS),
                    body: `Dear ${lead.name},\n\nThank you for your enquiry. We'd love to discuss your requirements further.\n\nBest regards,\nD-CRM Team`,
                    toEmail: lead.email,
                    openedAt: wasOpened ? randomDate(hoursAgo(72), new Date()) : null,
                    clickCount: wasClicked ? randomInt(1, 5) : 0,
                    lastClickedAt: wasClicked ? randomDate(hoursAgo(48), new Date()) : null,
                    createdAt: randomDate(lead.createdAt, new Date()),
                },
            });
            emailCount++;
        }
    }
    console.log(`  ✓ ${emailCount} email logs`);

    // ── WhatsApp Messages ────────────────────────────────────────────────────
    console.log("Creating WhatsApp messages...");
    let waCount = 0;
    for (const lead of leads) {
        if (!lead.whatsappOptIn || !lead.phone || Math.random() > 0.6) continue;
        const numMessages = randomInt(1, 5);
        for (let j = 0; j < numMessages; j++) {
            const user = ownerFor(lead);
            const isInbound = j > 0 && Math.random() > 0.6;
            const status = isInbound ? "REPLIED" : randomFrom(["SENT", "DELIVERED", "READ", "FAILED"]);
            await prisma.whatsAppMessage.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    user: { connect: { id: user.id } },
                    phone: lead.phoneNormalized || lead.phone || "919999999999",
                    direction: isInbound ? "INBOUND" : "OUTBOUND",
                    templateName: !isInbound ? "scholar360_follow_up" : null,
                    messageBody: isInbound ? randomFrom(WA_REPLIES) : randomFrom(WA_MESSAGES),
                    status,
                    replyText: isInbound ? randomFrom(WA_REPLIES) : null,
                    sentAt: randomDate(lead.createdAt, new Date()),
                    deliveredAt: status !== "SENT" && status !== "FAILED" ? randomDate(hoursAgo(72), new Date()) : null,
                    readAt: ["READ", "REPLIED"].includes(status) ? randomDate(hoursAgo(48), new Date()) : null,
                    repliedAt: status === "REPLIED" ? randomDate(hoursAgo(24), new Date()) : null,
                },
            });
            waCount++;
        }
    }
    console.log(`  ✓ ${waCount} WhatsApp messages`);

    // ── Tasks ────────────────────────────────────────────────────────────────
    console.log("Creating tasks...");
    let taskCount = 0;
    for (const lead of leads.slice(0, 100)) {
        if (Math.random() > 0.5) continue;
        const user = ownerFor(lead);
        const isOverdue = Math.random() > 0.6;
        await prisma.task.create({
            data: {
                title: randomFrom(TASK_TITLES),
                description: `Task related to lead ${lead.name}`,
                lead: { connect: { id: lead.id } },
                assignedTo: { connect: { id: user.id } },
                dueDate: isOverdue ? daysAgo(randomInt(1, 14)) : new Date(Date.now() + randomInt(1, 14) * 86400000),
                status: isOverdue ? "PENDING" : randomFrom(["PENDING", "PENDING", "COMPLETED"]),
                kanbanStatus: randomFrom(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
                priority: randomFrom(["HIGH", "MEDIUM", "MEDIUM", "LOW"]),
                type: randomFrom(["TASK", "TASK", "TASK", "BUG"]),
            },
        });
        taskCount++;
    }

    // Standalone tasks (not linked to leads)
    for (let i = 0; i < 30; i++) {
        const user = randomFrom(users);
        await prisma.task.create({
            data: {
                title: randomFrom(TASK_TITLES),
                assignedTo: { connect: { id: user.id } },
                dueDate: randomDate(daysAgo(7), new Date(Date.now() + 14 * 86400000)),
                status: randomFrom(["PENDING", "COMPLETED"]),
                kanbanStatus: randomFrom(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
                priority: randomFrom(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
                type: randomFrom(["TASK", "BUG", "STORY"]),
                storyPoints: randomInt(1, 13),
            },
        });
        taskCount++;
    }
    console.log(`  ✓ ${taskCount} tasks`);

    // ── Notifications ────────────────────────────────────────────────────────
    console.log("Creating notifications...");
    let notifCount = 0;
    const notifTemplates = [
        { title: "New Service Assigned", type: "CONSULTANT_ASSIGNED" },
        { title: "Reminder Due", type: "REMINDER" },
        { title: "Task Due Soon", type: "TASK_DUE" },
        { title: "Service Stage Updated", type: "STAGE_CHANGED" },
        { title: "New WhatsApp Reply", type: "WHATSAPP_REPLY" },
    ];
    for (const user of users) {
        for (let i = 0; i < randomInt(3, 10); i++) {
            const tmpl = randomFrom(notifTemplates);
            await prisma.notification.create({
                data: {
                    userId: user.id,
                    title: tmpl.title,
                    message: `You have a new ${tmpl.type.toLowerCase().replace(/_/g, " ")} update.`,
                    type: tmpl.type,
                    isRead: Math.random() > 0.4,
                    createdAt: hoursAgo(randomInt(1, 168)),
                },
            });
            notifCount++;
        }
    }
    console.log(`  ✓ ${notifCount} notifications`);

    // ── Company Settings ──────────────────────────────────────────────────────
    console.log("Seeding company settings...");
    const existingSettings = await prisma.companySettings.findFirst();
    if (!existingSettings) {
        await prisma.companySettings.create({
            data: {
                companyName: "CRM SCHOLAR PRIVATE LIMITED",
                shortName: "CRMS360",
                gstin: "22AAAAA0000A1Z5",
                address: "123, Tech Park Phase 1",
                city: "Chennai",
                state: "Tamil Nadu",
                pincode: "600001",
            },
        });
        console.log("  ✓ Company settings created");
    } else {
        console.log("  ✓ Company settings already exist");
    }

    // ── Custom Field Definitions ─────────────────────────────────────────────
    console.log("Creating custom field definitions...");
    const cfDefs = [
        { name: "Budget Range", fieldKey: "budget_range", type: "SELECT", options: ["< 1 Lakh", "1-5 Lakhs", "5-10 Lakhs", "> 10 Lakhs"], order: 1 },
        { name: "Preferred Contact", fieldKey: "preferred_contact", type: "SELECT", options: ["Phone", "WhatsApp", "Email", "In-Person"], order: 2 },
        { name: "Company Size", fieldKey: "company_size", type: "SELECT", options: ["1-10", "11-50", "51-200", "200+"], order: 3 },
        { name: "Decision Date", fieldKey: "decision_date", type: "DATE", order: 4 },
        { name: "Special Notes", fieldKey: "special_notes", type: "TEXT", order: 5 },
        { name: "Is Priority", fieldKey: "is_priority", type: "CHECKBOX", order: 6 },
    ];
    let cfCount = 0;
    for (const cf of cfDefs) {
        try {
            await prisma.customFieldDef.create({
                data: {
                    name: cf.name,
                    fieldKey: cf.fieldKey,
                    type: cf.type,
                    options: cf.options ? cf.options : null,
                    order: cf.order,
                },
            });
            cfCount++;
        } catch (e) {
            if (e.code !== "P2002") throw e;
        }
    }
    console.log(`  ✓ ${cfCount} custom field definitions`);

    // ── WhatsApp Campaign ────────────────────────────────────────────────────
    console.log("Creating WhatsApp campaigns...");
    const optInLeads = leads.filter(l => l.whatsappOptIn && l.phone).slice(0, 20);
    if (optInLeads.length > 0) {
        await prisma.whatsAppCampaign.create({
            data: {
                name: "Q3 Product Launch Campaign",
                templateName: "scholar360_product_launch",
                parameters: ["Premium Plan", "30% off", "September 2024"],
                status: "COMPLETED",
                totalCount: optInLeads.length,
                sentCount: optInLeads.length - 2,
                failedCount: 2,
                deliveredCount: optInLeads.length - 4,
                readCount: Math.floor(optInLeads.length * 0.6),
                repliedCount: Math.floor(optInLeads.length * 0.2),
                startedAt: daysAgo(7),
                completedAt: daysAgo(6),
                createdById: director.id,
                recipients: {
                    create: optInLeads.map((lead, idx) => ({
                        leadId: lead.id,
                        phone: lead.phoneNormalized || "919999999999",
                        status: idx < 2 ? "FAILED" : idx < 4 ? "SENT" : idx < 10 ? "DELIVERED" : "READ",
                        sentAt: idx >= 2 ? daysAgo(6) : null,
                        failReason: idx < 2 ? "Phone number not registered on WhatsApp" : null,
                        replyText: idx >= 12 && idx < 16 ? randomFrom(WA_REPLIES) : null,
                        repliedAt: idx >= 12 && idx < 16 ? daysAgo(5) : null,
                    })),
                },
            },
        });

        await prisma.whatsAppCampaign.create({
            data: {
                name: "Follow-up October Campaign",
                templateName: "scholar360_follow_up",
                parameters: ["Special Offer"],
                status: "DRAFT",
                totalCount: 10,
                createdById: director.id,
                recipients: {
                    create: optInLeads.slice(0, 10).map(lead => ({
                        leadId: lead.id,
                        phone: lead.phoneNormalized || "919999999999",
                        status: "QUEUED",
                    })),
                },
            },
        });
        console.log("  ✓ 2 WhatsApp campaigns (1 COMPLETED, 1 DRAFT)");
    }

    // ── WhatsApp Auto-Reply Rules ────────────────────────────────────────────
    console.log("Creating auto-reply rules...");
    await prisma.whatsAppAutoReply.createMany({
        data: [
            { name: "Price Enquiry Auto-Reply", active: true, triggerType: "KEYWORD", keyword: "price", replyTemplate: "scholar360_pricing_info", replyParams: [], createdById: director.id },
            { name: "Demo Request Auto-Reply", active: true, triggerType: "KEYWORD", keyword: "demo", replyTemplate: "scholar360_demo_schedule", replyParams: [], createdById: director.id },
            { name: "48h No-Reply Timeout", active: true, triggerType: "NO_REPLY_TIMEOUT", timeoutHours: 48, replyTemplate: "scholar360_follow_up", replyParams: ["our team"], createdById: director.id },
        ],
        skipDuplicates: true,
    });
    console.log("  ✓ 3 auto-reply rules");

    // ── Automation Rules (department-stage based) ─────────────────────────────
    console.log("Creating automation rules...");
    const autoRule1 = await prisma.automationRule.create({
        data: {
            name: "New Lead — Welcome Journey",
            description: "When a new lead is created, send a welcome WhatsApp (if phone) and create a follow-up task for the SALES consultant.",
            isActive: true,
            triggerType: "LEAD_CREATED",
            triggerConfig: { constraints: [{ type: "PREVENT_DUPLICATES" }] },
            conditions: { create: [] },
            actions: {
                create: [
                    { type: "SEND_WHATSAPP", order: 0, config: { templateName: "welcome_lead", parameters: ["{{lead.name}}"] } },
                    { type: "CREATE_TASK", order: 1, config: { title: "Follow up with new lead", dueDaysFromNow: 1, priority: "HIGH" } },
                ],
            },
        },
    });

    const autoRule2 = await prisma.automationRule.create({
        data: {
            name: "Loan Approved — Notify & Invoice Task",
            description: "When a LOAN service reaches APPROVED, notify the consultant and create a commission-invoicing task.",
            isActive: true,
            triggerType: "STAGE_CHANGED",
            triggerConfig: { department: "LOAN", stage: "APPROVED" },
            conditions: { create: [] },
            actions: {
                create: [
                    { type: "SEND_NOTIFICATION", order: 0, config: { title: "Loan approved", message: "A loan service was approved — proceed to invoicing." } },
                    { type: "CREATE_TASK", order: 1, config: { title: "Raise loan commission invoice", dueDaysFromNow: 2, priority: "MEDIUM" } },
                ],
            },
        },
    });

    // Automation logs (keyed by leadId; department/stage carried in details).
    for (let i = 0; i < 20; i++) {
        const lead = randomFrom(leads);
        await prisma.automationLog.create({
            data: {
                rule: { connect: { id: randomFrom([autoRule1.id, autoRule2.id]) } },
                lead: { connect: { id: lead.id } },
                status: randomFrom(["SUCCESS", "SUCCESS", "SUCCESS", "FAILED", "SKIPPED"]),
                details: { message: "Rule executed", department: "SALES" },
                createdAt: randomDate(daysAgo(30), new Date()),
            },
        });
    }
    console.log("  ✓ 2 automation rules + 20 logs");

    // ── Invoices ─────────────────────────────────────────────────────────────
    console.log("Creating invoices...");
    const invoiceStatuses = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "CANCELLED"];
    for (let i = 0; i < 15; i++) {
        const lead = leads[i];
        const subtotal = randomFloat(10000, 200000);
        const cgst = parseFloat((subtotal * 0.09).toFixed(2));
        const sgst = parseFloat((subtotal * 0.09).toFixed(2));
        await prisma.invoice.create({
            data: {
                invoiceNumber: `INV-2024-${String(i + 1).padStart(4, "0")}`,
                invoiceType: randomFrom(["PROFORMA", "TAX_INVOICE"]),
                clientName: lead.name,
                clientEmail: lead.email,
                clientPhone: lead.phone,
                subtotal,
                cgst,
                sgst,
                total: subtotal + cgst + sgst,
                status: randomFrom(invoiceStatuses),
                dueDate: new Date(Date.now() + randomInt(7, 60) * 86400000),
                createdBy: { connect: { id: director.id } },
                items: {
                    create: [
                        {
                            description: randomFrom(["CRM License", "LMS Platform", "White-label Setup", "Support Package"]),
                            price: subtotal,
                            quantity: 1,
                            taxRate: 18,
                            taxableValue: subtotal,
                            amount: subtotal,
                        },
                    ],
                },
            },
        });
    }
    console.log("  ✓ 15 invoices");

    // ── Sessions ─────────────────────────────────────────────────────────────
    console.log("Creating sessions...");
    for (const user of users.slice(0, 8)) {
        await prisma.session.create({
            data: {
                userId: user.id,
                device: randomFrom(["Chrome/Windows", "Safari/Mac", "Chrome/Android", "Firefox/Windows"]),
                createdAt: hoursAgo(randomInt(1, 72)),
            },
        });
    }
    console.log("  ✓ 8 sessions");

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("\n✅ Seed complete!\n");
    console.log("═══════════════════════════════════════════");
    console.log("  Login credentials (all passwords: Password@123)");
    console.log("═══════════════════════════════════════════");
    for (const u of USER_DEFS) {
        console.log(`  ${u.role.padEnd(12)} │ ${u.email.padEnd(26)} │ ${u.departments.join(", ")}`);
    }
    console.log("═══════════════════════════════════════════");
    console.log(`
  Data Summary:
  • ${users.length} users with department memberships
  • 200 leads / ${serviceCount} department services
  • ${commissionCount} commissions (per-department)
  • ${activityCount} timeline activities
  • ${noteCount} notes
  • ${reminderCount} reminders (mix of overdue + upcoming)
  • ${callCount} call logs
  • ${emailCount} email logs (with open/click tracking data)
  • ${waCount} WhatsApp messages (inbound + outbound)
  • ${taskCount} tasks (some overdue)
  • ${notifCount} notifications
  • 2 WhatsApp campaigns
  • 3 auto-reply rules
  • 2 automation rules + 20 logs
  • 15 invoices
  • 6 custom field definitions
`);
}

main()
    .catch(e => { console.error("Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
