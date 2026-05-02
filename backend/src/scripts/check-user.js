const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    console.log("Checking for superadmin user...");
    const email = "admin@gmail.com";

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.log("User NOT found in database.");
    } else {
        console.log("User FOUND:", user.email, "Role:", user.role);
        console.log("Password Hash:", user.password);

        // Test password comparison
        const isMatch = await bcrypt.compare("admin123", user.password);
        console.log("Password 'admin123' match:", isMatch);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
