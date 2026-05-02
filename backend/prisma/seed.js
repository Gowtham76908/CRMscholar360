require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
    const email = "admin@gmail.com";
    const password = "admin123";
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            name: "Super Admin",
            password: hashedPassword,
            role: "SUPER_ADMIN",
            isActive: true,
            department: "IT"
        },
    });

    console.log({ user });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
