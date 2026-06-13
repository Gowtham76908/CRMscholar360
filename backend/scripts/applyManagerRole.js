const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    // Add ADMIN value to the Role enum (safe — no-op if already exists)
    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'ADMIN'
                  AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
            ) THEN
                ALTER TYPE "Role" ADD VALUE 'ADMIN';
            END IF;
        END
        $$;
    `);

    console.log("ADMIN role value added to Role enum");
}

main()
    .catch((e) => { console.error(e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
