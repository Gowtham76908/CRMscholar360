const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for 'dharun' or 'jeykrishnan' in Users...");
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: "dharun", mode: "insensitive" } },
                { email: { contains: "dharun", mode: "insensitive" } },
                { name: { contains: "jeykrishnan", mode: "insensitive" } },
                { email: { contains: "jeykrishnan", mode: "insensitive" } },
            ]
        }
    });
    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`));

    console.log("\nSearching for 'dharun' or 'jeykrishnan' in Leads...");
    const leads = await prisma.lead.findMany({
        where: {
            OR: [
                { name: { contains: "dharun", mode: "insensitive" } },
                { email: { contains: "dharun", mode: "insensitive" } },
                { name: { contains: "jeykrishnan", mode: "insensitive" } },
                { email: { contains: "jeykrishnan", mode: "insensitive" } },
            ]
        }
    });
    console.log(`Found ${leads.length} leads:`);
    leads.forEach(l => console.log(`- ID: ${l.id}, Name: ${l.name}, Email: ${l.email}, Phone: ${l.phone}`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
