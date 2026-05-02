const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    console.log("Resetting database...");

    // Delete all data in reverse dependency order
    // Based on schema.prisma:
    // Models: User, Lead, Note, Task, Integration, Activity, Reminder, Commission, Permission, CallLog, Session, Workspace

    // Deleting dependents first
    await prisma.note.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.task.deleteMany();
    await prisma.reminder.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.callLog.deleteMany();
    await prisma.session.deleteMany();

    // Now deleting core entities
    await prisma.lead.deleteMany();
    await prisma.user.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.permission.deleteMany();

    console.log("Database cleared.");

    console.log("Creating Super Admin...");

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const superAdmin = await prisma.user.create({
        data: {
            name: "Super Admin",
            email: "admin@gmail.com",
            password: hashedPassword,
            role: "SUPER_ADMIN",
            department: "Management",
            isActive: true
        }
    });

    console.log("Super Admin created:", superAdmin.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
