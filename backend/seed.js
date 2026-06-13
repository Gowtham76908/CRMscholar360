/**
 * DCRM - Comprehensive System Seed Script
 * Creates realistic operational data for end-to-end QA testing.
 * Run: node seed.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

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
const STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"];

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
    "Update lead status after call",
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
    "Client budget is 2-5 lakhs. Product fits. Move to negotiation.",
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

const DEPARTMENTS_DATA = [
    "Sales", "Marketing", "Technical", "Customer Support", "Management"
];

// ─── Main Seed ────────────────────────────────────────────────────────────────

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
    await prisma.notification.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.userStatusLog.deleteMany({});
    await prisma.customFieldDef.deleteMany({});
    console.log("  ✓ Cleanup done\n");
}

async function main() {
    console.log("🌱 Starting DCRM seed...\n");
    await cleanup();

    // ── Departments ──────────────────────────────────────────────────────────
    console.log("Creating departments...");
    const departments = [];
    for (const name of DEPARTMENTS_DATA) {
        const dept = await prisma.department.upsert({
            where: { name },
            create: { name },
            update: {},
        });
        departments.push(dept);
    }
    console.log(`  ✓ ${departments.length} departments`);

    // ── Users ────────────────────────────────────────────────────────────────
    console.log("Creating users...");
    const passwordHash = await bcrypt.hash("Password@123", 10);

    const userDefs = [
        // SUPER_ADMIN
        {
            name: "System Admin",
            email: "admin@dcrm.io",
            phone: "+91 9999999999",
            role: "SUPER_ADMIN",
            department: "Management",
            jobTitle: "CEO & Founder",
        },
        // ADMINs
        {
            name: "Priya Sharma",
            email: "priya.sharma@dcrm.io",
            phone: "+91 9876543210",
            role: "ADMIN",
            department: "Sales",
            jobTitle: "Sales Manager",
        },
        {
            name: "Vikram Patel",
            email: "vikram.patel@dcrm.io",
            phone: "+91 9988776655",
            role: "ADMIN",
            department: "Marketing",
            jobTitle: "Marketing Head",
        },
        // TEAM_LEADs
        {
            name: "Karthik Reddy",
            email: "karthik.reddy@dcrm.io",
            phone: "+91 9876512345",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Senior Sales Executive",
        },
        {
            name: "Ananya Nair",
            email: "ananya.nair@dcrm.io",
            phone: "+91 9765432109",
            role: "EMPLOYEE",
            department: "Customer Support",
            jobTitle: "Support Lead",
        },
        // EMPLOYEEs
        {
            name: "Rahul Krishnan",
            email: "rahul.krishnan@dcrm.io",
            phone: "+91 9654321098",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Sales Executive",
        },
        {
            name: "Sneha Iyer",
            email: "sneha.iyer@dcrm.io",
            phone: "+91 9543210987",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Business Development Executive",
        },
        {
            name: "Deepak Rao",
            email: "deepak.rao@dcrm.io",
            phone: "+91 9432109876",
            role: "EMPLOYEE",
            department: "Technical",
            jobTitle: "Technical Support",
        },
        {
            name: "Meera Pillai",
            email: "meera.pillai@dcrm.io",
            phone: "+91 9321098765",
            role: "EMPLOYEE",
            department: "Marketing",
            jobTitle: "Content Executive",
        },
        {
            name: "Arun Venkataraman",
            email: "arun.venkat@dcrm.io",
            phone: "+91 9210987654",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Sales Executive",
        },
        // AGENTs
        {
            name: "Suresh Murugesan",
            email: "suresh.agent@dcrm.io",
            phone: "+91 9109876543",
            role: "EMPLOYEE",
            department: "Customer Support",
            jobTitle: "Support Agent",
        },
        {
            name: "Kavya Annamalai",
            email: "kavya.agent@dcrm.io",
            phone: "+91 9009876543",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Sales Agent",
        },
        {
            name: "Nikhil Natarajan",
            email: "nikhil.agent@dcrm.io",
            phone: "+91 8998765432",
            role: "EMPLOYEE",
            department: "Technical",
            jobTitle: "Technical Agent",
        },
        {
            name: "Divya Selvaraj",
            email: "divya.agent@dcrm.io",
            phone: "+91 8887654321",
            role: "EMPLOYEE",
            department: "Customer Support",
            jobTitle: "Customer Agent",
        },
        {
            name: "Bala Chandrasekaran",
            email: "bala.agent@dcrm.io",
            phone: "+91 8776543210",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Lead Generation Agent",
        },
    ];

    const users = [];
    for (const def of userDefs) {
        const deptId = departments.find(d => d.name === def.department)?.id;
        const phone = def.phone.replace(/\s/g, "");
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
                departmentId: deptId,
                isActive: true,
                onlineStatus: randomFrom(["ONLINE", "OFFLINE", "BREAK"]),
                lastSeen: hoursAgo(randomInt(0, 48)),
            },
            update: { name: def.name, role: def.role, jobTitle: def.jobTitle },
        });
        users.push(user);
    }
    console.log(`  ✓ ${users.length} users (1 SUPER_ADMIN, 2 ADMIN, 2 EMPLOYEE, 5 EMPLOYEE, 5 AGENT)`);

    const salesUsers = users.filter(u => ["EMPLOYEE", "EMPLOYEE", "EMPLOYEE"].includes(u.role));
    const adminUsers = users.filter(u => ["SUPER_ADMIN", "ADMIN"].includes(u.role));
    const allAssignableUsers = [...salesUsers, ...adminUsers.slice(0, 1)];

    // ── Leads ────────────────────────────────────────────────────────────────
    console.log("Creating 200 leads...");
    const leads = [];

    const statusDistribution = [
        ...Array(50).fill("NEW"),
        ...Array(40).fill("CONTACTED"),
        ...Array(35).fill("FOLLOW_UP"),
        ...Array(40).fill("CONVERTED"),
        ...Array(35).fill("LOST"),
    ];

    for (let i = 0; i < 200; i++) {
        const firstName = randomFrom(FIRST_NAMES);
        const lastName = randomFrom(LAST_NAMES);
        const name = `${firstName} ${lastName}`;
        const city = randomFrom(CITIES);
        const company = i % 3 === 0 ? randomFrom(COMPANIES) : null;
        const status = statusDistribution[i % statusDistribution.length];
        const source = randomFrom(SOURCES);
        const enquiryType = randomFrom(ENQUIRY_TYPES);
        const assignedTo = i % 5 === 0 ? null : randomFrom(allAssignableUsers);
        const createdAt = randomDate(daysAgo(180), new Date());

        // Varied data quality: each phone is unique via index suffix
        let phone = null;
        let email = null;
        // Base phone: use index to guarantee uniqueness
        const basePhone = `9${String(700000000 + i).padStart(9, "0")}`;

        if (i % 7 === 0) {
            // Missing phone — email only
            phone = null;
            email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${randomFrom(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"])}`;
        } else if (i % 13 === 0) {
            // Missing both — low quality
            phone = null;
            email = null;
        } else {
            phone = basePhone;
            email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company ? company.toLowerCase().replace(/\s+/g, "").slice(0, 10) + ".com" : randomFrom(["gmail.com", "yahoo.com", "company.in"])}`;
        }

        const dealValue = status === "CONVERTED"
            ? randomInt(50000, 500000)
            : status === "NEGOTIATION"
            ? randomInt(30000, 300000)
            : status === "LOST" ? null
            : randomInt(10000, 200000);

        const score = randomInt(10, 95);
        const category = score > 70 ? "HOT" : score > 40 ? "WARM" : "COLD";
        const whatsappOptIn = randomFrom([true, true, true, false]); // 75% opt-in

        const lead = await prisma.lead.create({
            data: {
                name,
                email: email || null,
                phone: phone ? `+91${phone}` : null,
                phoneNormalized: phone ? `91${phone}` : null,
                source,
                enquiryType,
                status,
                assignedToId: assignedTo?.id || null,
                score,
                category,
                company: company || undefined,
                whatsappOptIn,
                whatsappOptInAt: whatsappOptIn ? randomDate(daysAgo(90), new Date()) : null,
                firstResponseAt: status !== "NEW" ? randomDate(createdAt, new Date()) : null,
                customFields: randomFrom([
                    undefined,
                    { budget_range: randomFrom(["< 1 Lakh", "1-5 Lakhs", "5-10 Lakhs", "> 10 Lakhs"]) },
                    { budget_range: randomFrom(["< 1 Lakh", "1-5 Lakhs"]), preferred_contact: randomFrom(["Phone", "WhatsApp", "Email"]) },
                    undefined,
                ]),
                createdAt,
            },
        });

        leads.push(lead);
    }
    console.log(`  ✓ ${leads.length} leads created`);

    // ── Activities / Timeline ────────────────────────────────────────────────
    console.log("Creating timeline activities...");
    let activityCount = 0;

    for (const lead of leads) {
        const numActivities = randomInt(1, 8);
        const activityTypes = [
            "LEAD_CREATED", "STATUS_CHANGED", "NOTE_ADDED", "CALL_LOGGED",
            "EMAIL_SENT", "WHATSAPP_SENT", "REMINDER_SET", "LEAD_ASSIGNED",
            "TASK_CREATED", "FOLLOW_UP_SCHEDULED",
        ];

        for (let j = 0; j < numActivities; j++) {
            const action = j === 0 ? "LEAD_CREATED" : randomFrom(activityTypes);
            const user = randomFrom(allAssignableUsers);
            await prisma.activity.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    user: { connect: { id: user.id } },
                    action,
                    metadata: action === "STATUS_CHANGED"
                        ? { from: randomFrom(["NEW", "CONTACTED"]), to: lead.status }
                        : action === "LEAD_ASSIGNED"
                        ? { assignedTo: user.name }
                        : null,
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
        const user = lead.assignedToId ? { id: lead.assignedToId } : randomFrom(allAssignableUsers);
        const isOverdue = Math.random() > 0.5;
        await prisma.reminder.create({
            data: {
                leadId: lead.id,
                userId: user.id, // Reminder has no relation defined, uses raw FK
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
            const user = lead.assignedToId ? { id: lead.assignedToId } : randomFrom(allAssignableUsers);
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
            const user = lead.assignedToId ? { id: lead.assignedToId } : randomFrom(allAssignableUsers);
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
            const user = lead.assignedToId ? { id: lead.assignedToId } : randomFrom(allAssignableUsers);
            const isInbound = j > 0 && Math.random() > 0.6;
            const status = isInbound ? "REPLIED" : randomFrom(["SENT", "DELIVERED", "READ", "FAILED"]);
            await prisma.whatsAppMessage.create({
                data: {
                    lead: { connect: { id: lead.id } },
                    user: { connect: { id: user.id } },
                    phone: lead.phoneNormalized || lead.phone || "919999999999",
                    direction: isInbound ? "INBOUND" : "OUTBOUND",
                    templateName: !isInbound ? "dcrm_follow_up" : null,
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
        const user = lead.assignedToId ? { id: lead.assignedToId } : randomFrom(allAssignableUsers);
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
        const user = randomFrom(allAssignableUsers);
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
        { title: "New Lead Assigned", type: "LEAD_ASSIGNED" },
        { title: "Reminder Due", type: "REMINDER" },
        { title: "Task Due Soon", type: "TASK_DUE" },
        { title: "Lead Status Updated", type: "STATUS_CHANGED" },
        { title: "New WhatsApp Reply", type: "WHATSAPP_REPLY" },
    ];
    for (const user of allAssignableUsers) {
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

    // ── Company Settings (if not present) ───────────────────────────────────
    console.log("Seeding company settings...");
    const existingSettings = await prisma.companySettings.findFirst();
    if (!existingSettings) {
        await prisma.companySettings.create({
            data: {
                companyName: "HEXITE TECHNOLOGIES PRIVATE LIMITED",
                shortName: "HXZ",
                gstin: "33AAHCH4159D1ZT",
                address: "No 98, Varadharajan Street Kaladipet",
                city: "Chennai",
                state: "Tamil Nadu",
                pincode: "600019",
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
    const adminUser = adminUsers[0];
    const optInLeads = leads.filter(l => l.whatsappOptIn && l.phone).slice(0, 20);

    if (optInLeads.length > 0) {
        const campaign = await prisma.whatsAppCampaign.create({
            data: {
                name: "Q3 Product Launch Campaign",
                templateName: "dcrm_product_launch",
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
                createdById: adminUser.id,
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

        // Draft campaign for testing start flow
        await prisma.whatsAppCampaign.create({
            data: {
                name: "Follow-up October Campaign",
                templateName: "dcrm_follow_up",
                parameters: ["Special Offer"],
                status: "DRAFT",
                totalCount: 10,
                createdById: adminUser.id,
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
            {
                name: "Price Enquiry Auto-Reply",
                active: true,
                triggerType: "KEYWORD",
                keyword: "price",
                replyTemplate: "dcrm_pricing_info",
                replyParams: [],
                createdById: adminUser.id,
            },
            {
                name: "Demo Request Auto-Reply",
                active: true,
                triggerType: "KEYWORD",
                keyword: "demo",
                replyTemplate: "dcrm_demo_schedule",
                replyParams: [],
                createdById: adminUser.id,
            },
            {
                name: "48h No-Reply Timeout",
                active: true,
                triggerType: "NO_REPLY_TIMEOUT",
                timeoutHours: 48,
                replyTemplate: "dcrm_follow_up",
                replyParams: ["our team"],
                createdById: adminUser.id,
            },
        ],
        skipDuplicates: true,
    });
    console.log("  ✓ 3 auto-reply rules");

    // ── Automation Rules ─────────────────────────────────────────────────────
    console.log("Creating automation rules...");
    const employee1 = salesUsers[0];

    const autoRule1 = await prisma.automationRule.create({
        data: {
            name: "Auto-assign new Facebook leads",
            description: "Assigns every new Facebook lead to the first available sales executive",
            isActive: true,
            triggerType: "LEAD_CREATED",
            conditions: {
                create: [{ field: "source", operator: "equals", value: "FACEBOOK" }],
            },
            actions: {
                create: [{ type: "ASSIGN_LEAD", config: { userId: employee1.id, userName: employee1.name }, order: 1 }],
            },
        },
    });

    const autoRule2 = await prisma.automationRule.create({
        data: {
            name: "Notify on conversion",
            description: "Creates a task and notification when lead is converted",
            isActive: true,
            triggerType: "STATUS_CHANGED",
            triggerConfig: { status: "CONVERTED" },
            conditions: { create: [] },
            actions: {
                create: [
                    { type: "CREATE_TASK", config: { title: "Send welcome email to new client", dueDays: 1 }, order: 1 },
                    { type: "SEND_NOTIFICATION", config: { message: "Lead has been converted!" }, order: 2 },
                ],
            },
        },
    });

    // Automation logs
    for (let i = 0; i < 20; i++) {
        await prisma.automationLog.create({
            data: {
                rule: { connect: { id: randomFrom([autoRule1.id, autoRule2.id]) } },
                lead: { connect: { id: randomFrom(leads).id } },
                status: randomFrom(["SUCCESS", "SUCCESS", "SUCCESS", "FAILED", "SKIPPED"]),
                details: { message: "Rule executed successfully" },
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
                createdBy: { connect: { id: adminUser.id } },
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
    for (const u of userDefs) {
        console.log(`  ${u.role.padEnd(12)} │ ${u.email}`);
    }
    console.log("═══════════════════════════════════════════");
    console.log(`
  Data Summary:
  • ${departments.length} departments
  • ${users.length} users
  • 200 leads (across all statuses)
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
