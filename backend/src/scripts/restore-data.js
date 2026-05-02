/**
 * CRM Data Restoration Script
 * ============================
 * Restores the CRM to a functional state by re-creating users (Dharun & Kishor),
 * sample leads, and tasks for the current month.
 *
 * Usage: node src/scripts/restore-data.js
 *
 * Safe to re-run — uses upsert to avoid duplicates.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    console.log("\n=== CRM Data Restoration Script ===\n");

    // ──────────────────────────────────────────────
    // 1. RESTORE USERS
    // ──────────────────────────────────────────────
    console.log("Step 1: Restoring users...");

    const dharunPassword = await bcrypt.hash("dharun123", 10);
    const kishorPassword = await bcrypt.hash("kishor123", 10);

    const dharun = await prisma.user.upsert({
        where: { email: "dharun@zenxai.io" },
        update: {
            name: "Dharun",
            role: "ADMIN",
            department: "Management",
            jobTitle: "Admin Manager",
            isActive: true,
            onlineStatus: "OFFLINE",
        },
        create: {
            name: "Dharun",
            email: "dharun@zenxai.io",
            password: dharunPassword,
            role: "ADMIN",
            department: "Management",
            jobTitle: "Admin Manager",
            isActive: true,
            onlineStatus: "OFFLINE",
        },
    });
    console.log(`  ✓ Dharun (ADMIN) — ${dharun.email}`);

    const kishor = await prisma.user.upsert({
        where: { email: "kishor@zenxai.io" },
        update: {
            name: "Kishor M V S",
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Sales Executive",
            isActive: true,
            onlineStatus: "OFFLINE",
        },
        create: {
            name: "Kishor M V S",
            email: "kishor@zenxai.io",
            password: kishorPassword,
            role: "EMPLOYEE",
            department: "Sales",
            jobTitle: "Sales Executive",
            isActive: true,
            onlineStatus: "OFFLINE",
        },
    });
    console.log(`  ✓ Kishor M V S (EMPLOYEE) — ${kishor.email}`);

    // ──────────────────────────────────────────────
    // 2. RESTORE LEADS
    // ──────────────────────────────────────────────
    console.log("\nStep 2: Creating sample leads...");

    const leadsData = [
        {
            name: "Arjun Sharma",
            phone: "9876543210",
            email: "arjun.sharma@example.com",
            source: "FACEBOOK",
            enquiryType: "PRODUCT",
            status: "NEW",
            score: 30,
            category: "Warm",
        },
        {
            name: "Priya Nair",
            phone: "9876543211",
            email: "priya.nair@example.com",
            source: "INSTAGRAM",
            enquiryType: "WHITE_LABEL",
            status: "CONTACTED",
            score: 55,
            category: "Hot",
        },
        {
            name: "Ravi Kumar",
            phone: "9876543212",
            email: "ravi.kumar@example.com",
            source: "WEBSITE",
            enquiryType: "LMS",
            status: "FOLLOW_UP",
            score: 40,
            category: "Warm",
        },
        {
            name: "Deepa Menon",
            phone: "9876543213",
            email: "deepa.menon@example.com",
            source: "GMAIL",
            enquiryType: "SERVICES",
            status: "CONVERTED",
            score: 80,
            category: "Hot",
        },
        {
            name: "Suresh Babu",
            phone: "9876543214",
            email: "suresh.babu@example.com",
            source: "PHONE_CALL",
            enquiryType: "PRODUCT",
            status: "NEW",
            score: 20,
            category: "Cold",
        },
    ];

    const createdLeads = [];
    for (const leadData of leadsData) {
        // Check if lead already exists by phone
        let lead = await prisma.lead.findFirst({
            where: { phone: leadData.phone }
        });

        if (!lead) {
            lead = await prisma.lead.create({
                data: {
                    ...leadData,
                    assignedToId: kishor.id,
                    firstResponseAt: new Date(),
                },
            });
            console.log(`  ✓ Lead created: ${lead.name}`);
        } else {
            console.log(`  – Lead already exists: ${lead.name}`);
        }
        createdLeads.push(lead);
    }

    // ──────────────────────────────────────────────
    // 3. RESTORE TASKS (current month: March 2026)
    // ──────────────────────────────────────────────
    console.log("\nStep 3: Creating sample tasks...");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Completed tasks — on time (before due date)
    const completedTasksData = [
        {
            title: "Follow up with Arjun Sharma",
            dueDate: new Date(Date.UTC(currentYear, currentMonth, 10)),
            completedAt: new Date(Date.UTC(currentYear, currentMonth, 9)),
            lead: createdLeads[0],
        },
        {
            title: "Send product demo to Priya Nair",
            dueDate: new Date(Date.UTC(currentYear, currentMonth, 15)),
            completedAt: new Date(Date.UTC(currentYear, currentMonth, 14)),
            lead: createdLeads[1],
        },
        {
            title: "Prepare LMS proposal for Ravi Kumar",
            dueDate: new Date(Date.UTC(currentYear, currentMonth, 20)),
            completedAt: new Date(Date.UTC(currentYear, currentMonth, 19)),
            lead: createdLeads[2],
        },
        {
            title: "Close deal with Deepa Menon",
            dueDate: new Date(Date.UTC(currentYear, currentMonth, 5)),
            completedAt: new Date(Date.UTC(currentYear, currentMonth, 4)),
            lead: createdLeads[3],
        },
    ];

    // Pending tasks — due in the future
    const pendingTasksData = [
        {
            title: "Initial call with Suresh Babu",
            dueDate: new Date(Date.UTC(currentYear, currentMonth + 1, 5)),
            lead: createdLeads[4],
        },
        {
            title: "Send white-label catalogue to new leads",
            dueDate: new Date(Date.UTC(currentYear, currentMonth + 1, 10)),
            lead: null,
        },
        {
            title: "Monthly lead report for Dharun",
            dueDate: new Date(Date.UTC(currentYear, currentMonth + 1, 3)),
            lead: null,
        },
    ];

    let tasksCreated = 0;

    for (const t of completedTasksData) {
        const existing = await prisma.task.findFirst({
            where: { title: t.title, assignedToId: kishor.id }
        });
        if (!existing) {
            await prisma.task.create({
                data: {
                    title: t.title,
                    dueDate: t.dueDate,
                    status: "COMPLETED",
                    completedAt: t.completedAt,
                    assignedToId: kishor.id,
                    leadId: t.lead?.id ?? null,
                },
            });
            console.log(`  ✓ Completed task: ${t.title}`);
            tasksCreated++;
        } else {
            console.log(`  – Task already exists: ${t.title}`);
        }
    }

    for (const t of pendingTasksData) {
        const existing = await prisma.task.findFirst({
            where: { title: t.title, assignedToId: kishor.id }
        });
        if (!existing) {
            await prisma.task.create({
                data: {
                    title: t.title,
                    dueDate: t.dueDate,
                    status: "PENDING",
                    assignedToId: kishor.id,
                    leadId: t.lead?.id ?? null,
                },
            });
            console.log(`  ✓ Pending task: ${t.title}`);
            tasksCreated++;
        } else {
            console.log(`  – Task already exists: ${t.title}`);
        }
    }

    // ──────────────────────────────────────────────
    // 4. RESTORE ATTENDANCE (for leaderboard points)
    // ──────────────────────────────────────────────
    console.log("\nStep 4: Creating attendance records for current month...");

    // Create attendance for the first 20 working days of the current month
    const attendanceDays = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= Math.min(daysInMonth, now.getDate()); day++) {
        const date = new Date(Date.UTC(currentYear, currentMonth, day));
        const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            attendanceDays.push(day);
        }
    }

    let attendanceCreated = 0;
    for (const day of attendanceDays) {
        const attendanceDate = new Date(Date.UTC(currentYear, currentMonth, day));
        // Check-in time: 9:30 AM (before 10 AM → earns punctuality bonus)
        const checkIn = new Date(Date.UTC(currentYear, currentMonth, day, 4, 0, 0)); // 9:30 AM IST = 04:00 UTC

        try {
            await prisma.attendance.upsert({
                where: {
                    userId_date: {
                        userId: kishor.id,
                        date: attendanceDate,
                    },
                },
                update: {},
                create: {
                    userId: kishor.id,
                    date: attendanceDate,
                    checkIn: checkIn,
                    status: "PRESENT",
                },
            });
            attendanceCreated++;
        } catch (err) {
            // Skip duplicates silently
        }
    }
    console.log(`  ✓ ${attendanceCreated} attendance records created/verified for Kishor`);

    // ──────────────────────────────────────────────
    // 5. SUMMARY
    // ──────────────────────────────────────────────
    console.log("\n=== Restoration Complete ===");
    console.log(`
  Users:
    • Dharun (ADMIN)      → dharun@zenxai.io      / dharun123
    • Kishor M V S (EMPLOYEE) → kishor@zenxai.io  / kishor123

  Data:
    • ${createdLeads.length} leads (assigned to Kishor)
    • ${tasksCreated} new tasks (${completedTasksData.length} completed, ${pendingTasksData.length} pending)
    • ${attendanceCreated} attendance records for the current month

  Leaderboard Points for Kishor (approx):
    • Attendance: ${attendanceCreated * 10} pts (${attendanceCreated} days × 10)
    • Punctuality Bonus: ${attendanceCreated * 5} pts (all check-ins before 10 AM)
    • Task Points: ${completedTasksData.length * 20} pts (${completedTasksData.length} completed × 20)
    • Timing Bonus: ${completedTasksData.length * 10} pts (all on-time)
    • TOTAL ≈ ${attendanceCreated * 10 + attendanceCreated * 5 + completedTasksData.length * 20 + completedTasksData.length * 10} pts

  Next Steps:
    1. Start backend: cd backend && npm run dev
    2. Start frontend: cd frontend && npm run dev
    3. Log in as Kishor or Dharun and verify:
       - Dashboard shows leads and tasks
       - Leaderboard shows scores
       - Messages connects without error
    `);
}

main()
    .catch((e) => {
        console.error("Restoration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
