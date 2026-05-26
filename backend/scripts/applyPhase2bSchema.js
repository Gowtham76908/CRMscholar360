/**
 * Phase 2b migration — adds sub-score columns to EmployeeProfile.
 * Safe to run multiple times (idempotent via IF NOT EXISTS).
 */
const prisma = require("../src/utils/prisma");

async function run() {
    const columns = [
        { name: "leadEffectiveness",    default: "0.5" },
        { name: "responseQuality",      default: "0.5" },
        { name: "followupDiscipline",   default: "0.5" },
        { name: "attendanceReliability", default: "0.5" },
    ];

    for (const col of columns) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "EmployeeProfile"
            ADD COLUMN IF NOT EXISTS "${col.name}" DOUBLE PRECISION NOT NULL DEFAULT ${col.default}
        `);
        console.log(`[Phase2b] Column ${col.name} ensured`);
    }

    console.log("[Phase2b] Migration complete");
}

run()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
