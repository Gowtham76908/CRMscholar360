const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    const email = "admin@scholar360.io";
    const newPassword = "123456";

    console.log(`Resetting password for ${email}...`);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.log("User not found!");
        return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
    });

    console.log("Password reset successfully to:", newPassword);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
