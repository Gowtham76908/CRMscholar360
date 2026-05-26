const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerId" TEXT`);

    await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3)`);

    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AssignmentHistory" (
            "id" TEXT NOT NULL,
            "leadId" TEXT NOT NULL,
            "employeeId" TEXT NOT NULL,
            "previousEmployeeId" TEXT,
            "reason" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id")
        )
    `);

    // Add FK constraints only if they don't already exist
    const constraints = await prisma.$queryRaw`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'AssignmentHistory'
    `;
    const names = constraints.map(c => c.constraint_name);

    if (!names.includes("AssignmentHistory_leadId_fkey")) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AssignmentHistory"
            ADD CONSTRAINT "AssignmentHistory_leadId_fkey"
            FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    }
    if (!names.includes("AssignmentHistory_employeeId_fkey")) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AssignmentHistory"
            ADD CONSTRAINT "AssignmentHistory_employeeId_fkey"
            FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON UPDATE CASCADE
        `);
    }
    if (!names.includes("AssignmentHistory_previousEmployeeId_fkey")) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AssignmentHistory"
            ADD CONSTRAINT "AssignmentHistory_previousEmployeeId_fkey"
            FOREIGN KEY ("previousEmployeeId") REFERENCES "User"("id") ON UPDATE CASCADE
        `);
    }

    // User.managerId FK
    const userConstraints = await prisma.$queryRaw`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'User' AND constraint_type = 'FOREIGN KEY'
    `;
    const userFKs = userConstraints.map(c => c.constraint_name);
    if (!userFKs.includes("User_managerId_fkey")) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "User"
            ADD CONSTRAINT "User_managerId_fkey"
            FOREIGN KEY ("managerId") REFERENCES "User"("id") ON UPDATE CASCADE
        `);
    }

    // Indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User"("managerId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssignmentHistory_leadId_idx" ON "AssignmentHistory"("leadId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssignmentHistory_employeeId_idx" ON "AssignmentHistory"("employeeId")`);

    console.log("Organization schema applied successfully");
}

main()
    .catch((e) => { console.error(e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
