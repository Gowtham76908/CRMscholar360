const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("=== Database Cleanup Script: Removing Dharun References ===");

    // 1. Update Users
    console.log("\nChecking for users with name/email containing 'dharun'...");
    
    // Check for dharun@scholar360.io
    const superAdmin = await prisma.user.findFirst({
        where: {
            OR: [
                { email: "dharun@scholar360.io" },
                { email: "dharunjayakrishnan@gmail.com" },
                { name: "Dharun Jayakrishnan" }
            ]
        }
    });

    if (superAdmin) {
        console.log(`Found Super Admin user: ${superAdmin.email}. Updating to admin@scholar360.io / System Admin...`);
        await prisma.user.update({
            where: { id: superAdmin.id },
            data: {
                name: "System Admin",
                email: "admin@scholar360.io",
            }
        });
        console.log("  ✓ Updated Super Admin");
    } else {
        console.log("  – No Super Admin user with 'dharun' found");
    }

    // Check for dharun@zenxai.io
    const adminUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: "dharun@zenxai.io" },
                { name: "Dharun" }
            ]
        }
    });

    if (adminUser) {
        console.log(`Found Admin user: ${adminUser.email}. Updating to admin@zenxai.io / Admin...`);
        await prisma.user.update({
            where: { id: adminUser.id },
            data: {
                name: "Admin",
                email: "admin@zenxai.io",
            }
        });
        console.log("  ✓ Updated Admin User");
    } else {
        console.log("  – No Admin user with 'dharun' found");
    }

    // 2. Check for other users matching 'dharun'
    const otherUsers = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: "dharun", mode: "insensitive" } },
                { email: { contains: "dharun", mode: "insensitive" } }
            ]
        }
    });
    if (otherUsers.length > 0) {
        console.log(`Found ${otherUsers.length} other user(s) containing 'dharun'. Cleaning up...`);
        for (const u of otherUsers) {
            const newEmail = u.email.replace(/dharun/gi, "admin");
            const newName = u.name.replace(/dharun/gi, "Admin");
            await prisma.user.update({
                where: { id: u.id },
                data: {
                    name: newName,
                    email: newEmail
                }
            });
            console.log(`  ✓ Updated User ${u.email} -> ${newEmail}`);
        }
    }

    // 3. Update Tasks
    console.log("\nChecking for tasks containing 'Dharun'...");
    const tasks = await prisma.task.findMany({
        where: {
            OR: [
                { title: { contains: "dharun", mode: "insensitive" } },
                { description: { contains: "dharun", mode: "insensitive" } }
            ]
        }
    });

    if (tasks.length > 0) {
        console.log(`Found ${tasks.length} task(s) containing 'dharun'. Updating...`);
        for (const t of tasks) {
            const newTitle = t.title.replace(/dharun/gi, "Admin");
            const newDescription = t.description ? t.description.replace(/dharun/gi, "Admin") : null;
            await prisma.task.update({
                where: { id: t.id },
                data: {
                    title: newTitle,
                    description: newDescription
                }
            });
            console.log(`  ✓ Updated Task ID: ${t.id} - "${t.title}" -> "${newTitle}"`);
        }
    } else {
        console.log("  – No tasks containing 'dharun' found");
    }

    // 4. Update/Delete Leads
    console.log("\nChecking for leads containing 'dharun' or 'jeykrishnan'...");
    const leads = await prisma.lead.findMany({
        where: {
            OR: [
                { name: { contains: "dharun", mode: "insensitive" } },
                { email: { contains: "dharun", mode: "insensitive" } },
                { name: { contains: "jeykrishnan", mode: "insensitive" } },
                { email: { contains: "jeykrishnan", mode: "insensitive" } }
            ]
        }
    });

    if (leads.length > 0) {
        console.log(`Found ${leads.length} lead(s) matching Dharun/Jeykrishnan. Deleting or renaming...`);
        for (const l of leads) {
            // Since it's a sample lead, let's delete it if possible, otherwise rename it to something generic
            try {
                // Try deleting lead
                await prisma.lead.delete({ where: { id: l.id } });
                console.log(`  ✓ Deleted lead: ${l.name} (${l.email})`);
            } catch (err) {
                // If deletion fails due to references (reminders, callLogs, notes, tasks), let's anonymize/rename it
                await prisma.lead.update({
                    where: { id: l.id },
                    data: {
                        name: "John Doe",
                        email: "john.doe@example.com",
                        phone: "+919876543219"
                    }
                });
                console.log(`  ✓ Renamed lead (delete failed): ${l.name} -> John Doe`);
            }
        }
    } else {
        console.log("  – No leads matching 'dharun' or 'jeykrishnan' found");
    }

    console.log("\n=== Database Cleanup Completed Successfully! ===");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
