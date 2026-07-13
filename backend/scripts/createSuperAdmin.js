/**
 * createSuperAdmin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a SUPER_ADMIN user in a fresh database.
 *
 * Usage (interactive):
 *   node scripts/createSuperAdmin.js
 *
 * Usage (non-interactive — pass args directly):
 *   node scripts/createSuperAdmin.js "Admin Name" admin@example.com MyPassword123
 *
 * Run from the backend directory after `prisma migrate deploy`.
 */

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const readline = require("readline");

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ask(rl, question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    if (password.length < 8) return "Password must be at least 8 characters.";
    return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║         CRMScholar360 — Super Admin Setup                ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    // Check if a SUPER_ADMIN already exists
    const existing = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    if (existing) {
        console.log(`⚠️  A SUPER_ADMIN already exists: ${existing.name} <${existing.email}>`);
        console.log("   If you want to create another, continue. Otherwise press Ctrl+C.\n");
    }

    let name, email, password;

    // Accept CLI arguments or prompt interactively
    if (process.argv[2] && process.argv[3] && process.argv[4]) {
        name     = process.argv[2].trim();
        email    = process.argv[3].trim().toLowerCase();
        password = process.argv[4];
        console.log(`📋 Using provided arguments:`);
        console.log(`   Name  : ${name}`);
        console.log(`   Email : ${email}`);
        console.log(`   Pass  : ${"*".repeat(password.length)}\n`);
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        name = (await ask(rl, "👤 Full Name    : ")).trim();
        if (!name) { console.error("❌ Name is required."); rl.close(); process.exit(1); }

        email = (await ask(rl, "📧 Email Address: ")).trim().toLowerCase();
        if (!validateEmail(email)) { console.error("❌ Invalid email address."); rl.close(); process.exit(1); }

        password = (await ask(rl, "🔒 Password      : ")).trim();
        const pwErr = validatePassword(password);
        if (pwErr) { console.error(`❌ ${pwErr}`); rl.close(); process.exit(1); }

        rl.close();
        console.log();
    }

    // Check if email is already taken
    const duplicate = await prisma.user.findUnique({ where: { email } });
    if (duplicate) {
        console.error(`❌ A user with email "${email}" already exists (role: ${duplicate.role}).`);
        process.exit(1);
    }

    // Hash password and create user
    console.log("⏳ Creating Super Admin...");
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: passwordHash,
            role: "SUPER_ADMIN",
            isActive: true,
            onlineStatus: "OFFLINE",
        },
    });

    // Also ensure the user is a member of all departments
    const ALL_DEPARTMENTS = ["SALES", "LOAN", "ACCOMMODATION_TICKETS", "FOREX", "MISCELLANEOUS"];
    for (const dept of ALL_DEPARTMENTS) {
        await prisma.userDepartment.create({
            data: { userId: user.id, department: dept },
        }).catch(() => {}); // ignore if already exists
    }

    // Seed minimal company settings if none exist
    const settingsExist = await prisma.companySettings.findFirst();
    if (!settingsExist) {
        await prisma.companySettings.create({
            data: { companyName: "My Company" },
        });
        console.log("📋 Created blank company settings (update via Settings → Company in the app).");
    }

    console.log("\n✅ Super Admin created successfully!");
    console.log("─────────────────────────────────────────────────────────");
    console.log(`   ID    : ${user.id}`);
    console.log(`   Name  : ${user.name}`);
    console.log(`   Email : ${user.email}`);
    console.log(`   Role  : ${user.role}`);
    console.log("─────────────────────────────────────────────────────────");
    console.log("   Login at your deployed frontend URL and sign in with");
    console.log("   the credentials above.\n");
}

main()
    .catch((err) => {
        console.error("\n❌ Error:", err.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
