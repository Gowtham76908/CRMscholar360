require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const DEPARTMENTS = ["Sales", "Marketing", "Engineering", "Support", "Finance", "HR"];

const EMPLOYEES = [
    // Super Admin
    { email: "admin@gmail.com",        name: "Super Admin",      role: "SUPER_ADMIN", dept: "IT",          jobTitle: "CTO" },
    // Admins
    { email: "ravi.kumar@dcrm.com",    name: "Ravi Kumar",       role: "ADMIN",       dept: "Sales",       jobTitle: "Sales Manager" },
    { email: "priya.sharma@dcrm.com",  name: "Priya Sharma",     role: "ADMIN",       dept: "Marketing",   jobTitle: "Marketing Head" },
    // Sales team
    { email: "arjun.nair@dcrm.com",    name: "Arjun Nair",       role: "EMPLOYEE",    dept: "Sales",       jobTitle: "Sales Executive" },
    { email: "deepa.menon@dcrm.com",   name: "Deepa Menon",      role: "EMPLOYEE",    dept: "Sales",       jobTitle: "Sales Executive" },
    { email: "karthik.v@dcrm.com",     name: "Karthik Venkat",   role: "EMPLOYEE",    dept: "Sales",       jobTitle: "Senior Sales Rep" },
    { email: "sneha.iyer@dcrm.com",    name: "Sneha Iyer",       role: "EMPLOYEE",    dept: "Sales",       jobTitle: "Account Executive" },
    // Engineering
    { email: "rahul.dev@dcrm.com",     name: "Rahul Desai",      role: "EMPLOYEE",    dept: "Engineering", jobTitle: "Software Engineer" },
    { email: "ananya.code@dcrm.com",   name: "Ananya Krishnan",  role: "EMPLOYEE",    dept: "Engineering", jobTitle: "Frontend Developer" },
    { email: "vijay.backend@dcrm.com", name: "Vijay Reddy",      role: "EMPLOYEE",    dept: "Engineering", jobTitle: "Backend Developer" },
    // Support
    { email: "meena.support@dcrm.com", name: "Meena Pillai",     role: "EMPLOYEE",    dept: "Support",     jobTitle: "Support Lead" },
    { email: "suresh.cx@dcrm.com",     name: "Suresh Babu",      role: "EMPLOYEE",    dept: "Support",     jobTitle: "Customer Success" },
    // Marketing
    { email: "lakshmi.mkt@dcrm.com",   name: "Lakshmi Rao",      role: "EMPLOYEE",    dept: "Marketing",   jobTitle: "Content Strategist" },
    // Finance / HR
    { email: "divya.hr@dcrm.com",      name: "Divya Nambiar",    role: "EMPLOYEE",    dept: "HR",          jobTitle: "HR Manager" },
    { email: "arun.finance@dcrm.com",  name: "Arun Pillai",      role: "EMPLOYEE",    dept: "Finance",     jobTitle: "Finance Analyst" },
];

// LeadSource: FACEBOOK, INSTAGRAM, GMAIL, WEBSITE, PHONE_CALL, LINKEDIN
// EnquiryType: PRODUCT, WHITE_LABEL, LMS, SERVICES
// LeadStatus: NEW, CONTACTED, FOLLOW_UP, CONVERTED, LOST
const LEADS = [
    { name: "Tech Solutions Pvt Ltd",   email: "contact@techsolutions.com", phone: "+919876543210", source: "WEBSITE",    enquiryType: "PRODUCT",     status: "FOLLOW_UP",  score: 82 },
    { name: "Sanjay Mehta",             email: "sanjay@gmail.com",          phone: "+919123456789", source: "FACEBOOK",   enquiryType: "SERVICES",    status: "NEW",        score: 45 },
    { name: "Global Exports Ltd",       email: "hello@globalexports.in",    phone: "+919988776655", source: "LINKEDIN",   enquiryType: "PRODUCT",     status: "CONTACTED",  score: 67 },
    { name: "Anita Bose",               email: "anita.bose@gmail.com",      phone: "+919871234567", source: "FACEBOOK",   enquiryType: "WHITE_LABEL", status: "CONVERTED",  score: 91 },
    { name: "Sunrise Traders",          email: "info@sunrisetraders.com",   phone: "+918765432109", source: "INSTAGRAM",  enquiryType: "PRODUCT",     status: "FOLLOW_UP",  score: 74 },
    { name: "Rohit Verma",              email: "rohit.v@hotmail.com",       phone: "+917654321098", source: "PHONE_CALL", enquiryType: "SERVICES",    status: "NEW",        score: 30 },
    { name: "Infinity Retail",          email: "sales@infinityretail.com",  phone: "+916543210987", source: "WEBSITE",    enquiryType: "PRODUCT",     status: "CONTACTED",  score: 58 },
    { name: "Dr. Kavitha Suresh",       email: "kavitha@clinicpro.in",      phone: "+915432109876", source: "LINKEDIN",   enquiryType: "LMS",         status: "CONTACTED",  score: 63 },
    { name: "BlueSky Analytics",        email: "info@bluesky.io",           phone: "+914321098765", source: "FACEBOOK",   enquiryType: "PRODUCT",     status: "FOLLOW_UP",  score: 79 },
    { name: "Naveen Choudhary",         email: "naveen.c@outlook.com",      phone: "+913210987654", source: "INSTAGRAM",  enquiryType: "SERVICES",    status: "NEW",        score: 22 },
    { name: "Precision Tools Co",       email: "contact@precisiontools.in", phone: "+912109876543", source: "WEBSITE",    enquiryType: "PRODUCT",     status: "LOST",       score: 41 },
    { name: "Aishwarya Nair",           email: "aish.nair@gmail.com",       phone: "+911098765432", source: "GMAIL",      enquiryType: "WHITE_LABEL", status: "CONVERTED",  score: 88 },
];

async function main() {
    const password = await bcrypt.hash("Demo@1234", 10);

    console.log("Seeding employees...");
    const createdUsers = [];
    for (const emp of EMPLOYEES) {
        const user = await prisma.user.upsert({
            where: { email: emp.email },
            update: { name: emp.name, role: emp.role, department: emp.dept, jobTitle: emp.jobTitle, isActive: true },
            create: {
                email: emp.email,
                name: emp.name,
                password,
                role: emp.role,
                department: emp.dept,
                jobTitle: emp.jobTitle,
                isActive: true,
            },
        });
        createdUsers.push(user);
        console.log(`  ✓ ${user.name} (${user.role})`);
    }

    // Assign leads to sales reps
    const salesReps = createdUsers.filter(u => u.department === "Sales");
    console.log("\nSeeding leads...");
    for (let i = 0; i < LEADS.length; i++) {
        const ld = LEADS[i];
        const assignee = salesReps[i % salesReps.length];
        await prisma.lead.upsert({
            where: { id: `seed-lead-${i + 1}` },
            update: { status: ld.status, score: ld.score },
            create: {
                id: `seed-lead-${i + 1}`,
                name: ld.name,
                email: ld.email,
                phone: ld.phone,
                source: ld.source,
                enquiryType: ld.enquiryType,
                status: ld.status,
                score: ld.score,
                assignedToId: assignee.id,
            },
        });
        console.log(`  ✓ ${ld.name} → ${assignee.name}`);
    }

    console.log("\nSeed complete!");
    console.log("Login credentials:");
    console.log("  admin@gmail.com  /  Demo@1234  (SUPER_ADMIN)");
    console.log("  ravi.kumar@dcrm.com  /  Demo@1234  (ADMIN)");
    console.log("  arjun.nair@dcrm.com  /  Demo@1234  (EMPLOYEE)");
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
