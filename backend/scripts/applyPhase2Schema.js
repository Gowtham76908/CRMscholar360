const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    // Add AvailabilityStatus enum
    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AvailabilityStatus') THEN
                CREATE TYPE "AvailabilityStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ON_LEAVE');
            END IF;
        END
        $$;
    `);

    // Ensure ONLINE, OFFLINE, ON_LEAVE all exist (idempotent adds)
    FOR_EACH: for (const val of ['ONLINE', 'OFFLINE', 'ON_LEAVE']) {
        await prisma.$executeRawUnsafe(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = '${val}'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AvailabilityStatus')
                ) THEN
                    ALTER TYPE "AvailabilityStatus" ADD VALUE '${val}';
                END IF;
            END
            $$;
        `);
    }

    // Create EmployeeProfile table
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "EmployeeProfile" (
            "id"                 TEXT NOT NULL,
            "employeeId"         TEXT NOT NULL,
            "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'ONLINE',
            "maxDailyLeads"      INTEGER NOT NULL DEFAULT 20,
            "currentLeadLoad"    INTEGER NOT NULL DEFAULT 0,
            "lastAssignedAt"     TIMESTAMP(3),
            "responseSpeed"      DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            "performanceScore"   DOUBLE PRECISION NOT NULL DEFAULT 0.5,
            "isAcceptingLeads"   BOOLEAN NOT NULL DEFAULT true,
            "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
        )
    `);

    // Unique constraint on employeeId
    const uqConstraints = await prisma.$queryRaw`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'EmployeeProfile' AND constraint_type = 'UNIQUE'
    `;
    const uqNames = uqConstraints.map(c => c.constraint_name);

    if (!uqNames.includes("EmployeeProfile_employeeId_key")) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "EmployeeProfile"
            ADD CONSTRAINT "EmployeeProfile_employeeId_key" UNIQUE ("employeeId")
        `);
    }

    // FK: EmployeeProfile.employeeId → User.id
    const fkConstraints = await prisma.$queryRaw`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'EmployeeProfile' AND constraint_type = 'FOREIGN KEY'
    `;
    const fkNames = fkConstraints.map(c => c.constraint_name);

    if (!fkNames.includes("EmployeeProfile_employeeId_fkey")) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "EmployeeProfile"
            ADD CONSTRAINT "EmployeeProfile_employeeId_fkey"
            FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    }

    // Indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmployeeProfile_availabilityStatus_idx" ON "EmployeeProfile"("availabilityStatus")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmployeeProfile_isAcceptingLeads_idx" ON "EmployeeProfile"("isAcceptingLeads")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmployeeProfile_employeeId_idx"       ON "EmployeeProfile"("employeeId")`);

    // Seed EmployeeProfile rows for all existing employees who don't have one
    await prisma.$executeRawUnsafe(`
        INSERT INTO "EmployeeProfile" ("id", "employeeId", "updatedAt")
        SELECT gen_random_uuid()::text, u."id", NOW()
        FROM "User" u
        WHERE u.role = 'EMPLOYEE'
          AND NOT EXISTS (
              SELECT 1 FROM "EmployeeProfile" ep WHERE ep."employeeId" = u."id"
          )
    `);

    console.log("Phase 2 schema applied successfully");
}

main()
    .catch((e) => { console.error(e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
