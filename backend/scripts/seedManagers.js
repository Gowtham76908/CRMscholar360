require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const MANAGERS = [
    { email: "manager1@dcrm.com", name: "Arun Sharma",   dept: "Sales",     jobTitle: "Sales Manager" },
    { email: "manager2@dcrm.com", name: "Neha Kapoor",   dept: "Marketing", jobTitle: "Marketing Manager" },
];

const EMPLOYEES_PER_MANAGER = [
    // Manager 1 — Sales
    [
        { email: "emp1.sales@dcrm.com",  name: "Raj Patel",       jobTitle: "Sales Executive" },
        { email: "emp2.sales@dcrm.com",  name: "Anita Singh",     jobTitle: "Sales Executive" },
        { email: "emp3.sales@dcrm.com",  name: "Vikram Das",      jobTitle: "Senior Sales Rep" },
        { email: "emp4.sales@dcrm.com",  name: "Pooja Reddy",     jobTitle: "Account Executive" },
        { email: "emp5.sales@dcrm.com",  name: "Sunil Verma",     jobTitle: "Sales Executive" },
        { email: "emp6.sales@dcrm.com",  name: "Meera Joshi",     jobTitle: "Sales Executive" },
        { email: "emp7.sales@dcrm.com",  name: "Aryan Mehta",     jobTitle: "Sales Rep" },
        { email: "emp8.sales@dcrm.com",  name: "Divya Pillai",    jobTitle: "Sales Executive" },
        { email: "emp9.sales@dcrm.com",  name: "Kiran Rao",       jobTitle: "Sales Associate" },
        { email: "emp10.sales@dcrm.com", name: "Preethi Nair",    jobTitle: "Sales Executive" },
    ],
    // Manager 2 — Marketing
    [
        { email: "emp1.mkt@dcrm.com",  name: "Rohit Iyer",      jobTitle: "Marketing Executive" },
        { email: "emp2.mkt@dcrm.com",  name: "Sneha Menon",     jobTitle: "Content Strategist" },
        { email: "emp3.mkt@dcrm.com",  name: "Aditya Kumar",    jobTitle: "Digital Marketer" },
        { email: "emp4.mkt@dcrm.com",  name: "Lakshmi Babu",    jobTitle: "Marketing Executive" },
        { email: "emp5.mkt@dcrm.com",  name: "Deepak Nambiar",  jobTitle: "Brand Manager" },
        { email: "emp6.mkt@dcrm.com",  name: "Ritu Choudhary",  jobTitle: "Marketing Executive" },
        { email: "emp7.mkt@dcrm.com",  name: "Naveen Suresh",   jobTitle: "SEO Specialist" },
        { email: "emp8.mkt@dcrm.com",  name: "Kavitha Bose",    jobTitle: "Marketing Associate" },
        { email: "emp9.mkt@dcrm.com",  name: "Sanjay Krishnan", jobTitle: "Marketing Executive" },
        { email: "emp10.mkt@dcrm.com", name: "Ananya Pillai",   jobTitle: "Campaign Manager" },
    ],
];

async function main() {
    const password = await bcrypt.hash("Demo@1234", 10);

    console.log("\nSeeding managers...");
    const managers = [];
    for (const m of MANAGERS) {
        const user = await prisma.user.upsert({
            where: { email: m.email },
            update: { name: m.name, role: "ADMIN", department: m.dept, jobTitle: m.jobTitle, isActive: true },
            create: { email: m.email, name: m.name, password, role: "ADMIN", department: m.dept, jobTitle: m.jobTitle, isActive: true },
        });
        managers.push(user);
        console.log(`  Manager: ${user.name} — ${user.id}`);
    }

    console.log("\nSeeding employees...");
    for (let mi = 0; mi < managers.length; mi++) {
        const manager = managers[mi];
        const dept = MANAGERS[mi].dept;
        console.log(`\n  Under ${manager.name}:`);
        for (const emp of EMPLOYEES_PER_MANAGER[mi]) {
            const user = await prisma.user.upsert({
                where: { email: emp.email },
                update: { name: emp.name, role: "EMPLOYEE", department: dept, jobTitle: emp.jobTitle, managerId: manager.id, isActive: true },
                create: { email: emp.email, name: emp.name, password, role: "EMPLOYEE", department: dept, jobTitle: emp.jobTitle, managerId: manager.id, isActive: true },
            });
            await prisma.employeeProfile.upsert({
                where:  { employeeId: user.id },
                update: { availabilityStatus: "ONLINE", isAcceptingLeads: true, maxDailyLeads: 15 },
                create: { employeeId: user.id, availabilityStatus: "ONLINE", isAcceptingLeads: true, maxDailyLeads: 15 },
            });
            console.log(`    Employee: ${user.name} — ${user.id}`);
        }
    }

    console.log("\n✓ Done. Password for all accounts: Demo@1234");
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
