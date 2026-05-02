const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching all users...");
    const users = await prisma.user.findMany();

    if (users.length === 0) {
        console.log("No users found.");
    } else {
        console.table(users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            isActive: u.isActive,
            passwordHash: u.password.substring(0, 10) + "..." // Show partial hash
        })));
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
