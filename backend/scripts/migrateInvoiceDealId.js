require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "dealId" TEXT`);
    console.log("Column added");

    await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_dealId_fkey') THEN
                ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey"
                    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
        END $$
    `);
    console.log("FK added");

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_dealId_idx" ON "Invoice"("dealId")`);
    console.log("Index added");
    console.log("Migration complete");
}

main().catch(console.error).finally(() => prisma.$disconnect());
