/**
 * Phase 3 migration — creates ManagerNote table.
 * Safe to run multiple times (idempotent).
 */
const prisma = require("../src/utils/prisma");

async function run() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ManagerNote" (
            "id"        TEXT         NOT NULL PRIMARY KEY,
            "authorId"  TEXT         NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
            "subjectId" TEXT         NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
            "content"   TEXT         NOT NULL,
            "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ManagerNote_subjectId_idx" ON "ManagerNote"("subjectId")
    `);
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ManagerNote_authorId_idx" ON "ManagerNote"("authorId")
    `);

    console.log("[Phase3] ManagerNote table ensured");
}

run()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
