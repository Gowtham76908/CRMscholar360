/**
 * Fixes schema drift and missing cascade deletes found during QA audit.
 * Run once: node fix-schema-issues.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("🔧 Applying schema fixes...\n");

    // 1. Drop the rogue UNIQUE constraint on Lead.phoneNormalized
    //    (schema.prisma only defines @@index, not @unique)
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_phoneNormalized_key"
        `);
        console.log("✓ Dropped unique constraint on Lead.phoneNormalized");
    } catch (e) {
        console.log("  Lead.phoneNormalized unique constraint not found (already removed or never existed):", e.message);
    }

    // 2. Add missing indexes for performance
    const indexes = [
        { table: "Activity", col: "leadId",  name: "Activity_leadId_idx" },
        { table: "Activity", col: "userId",  name: "Activity_userId_idx" },
        { table: "Note",     col: "leadId",  name: "Note_leadId_idx" },
        { table: "CallLog",  col: "userId",  name: "CallLog_userId_idx" },
        { table: "Reminder", col: "userId",  name: "Reminder_userId_idx" },
        { table: "Reminder", col: "leadId",  name: "Reminder_leadId_idx" },
        { table: "Commission","col": "userId", name: "Commission_userId_idx" },
        { table: "Commission","col": "leadId", name: "Commission_leadId_idx" },
    ];

    for (const { table, col, name } of indexes) {
        try {
            await prisma.$executeRawUnsafe(
                `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" ("${col}")`
            );
            console.log(`✓ Index ${name} ensured`);
        } catch (e) {
            console.log(`  Failed to create ${name}: ${e.message}`);
        }
    }

    // 3. Add cascade delete on AutomationLog → Lead and AutomationLog → AutomationRule
    //    (Prisma migration workaround — add FK constraint with CASCADE)
    try {
        // First drop existing FK if any
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AutomationLog" DROP CONSTRAINT IF EXISTS "AutomationLog_leadId_fkey"
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_leadId_fkey"
            FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log("✓ AutomationLog.leadId → CASCADE DELETE");
    } catch (e) {
        console.log("  AutomationLog.leadId cascade:", e.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AutomationLog" DROP CONSTRAINT IF EXISTS "AutomationLog_ruleId_fkey"
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_ruleId_fkey"
            FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log("✓ AutomationLog.ruleId → CASCADE DELETE");
    } catch (e) {
        console.log("  AutomationLog.ruleId cascade:", e.message);
    }

    // 4. Add cascade delete on Note → Lead (currently no cascade)
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Note" DROP CONSTRAINT IF EXISTS "Note_leadId_fkey"
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Note" ADD CONSTRAINT "Note_leadId_fkey"
            FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log("✓ Note.leadId → CASCADE DELETE");
    } catch (e) {
        console.log("  Note.leadId cascade:", e.message);
    }

    // 5. Add cascade delete on Activity → Lead
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_leadId_fkey"
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey"
            FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log("✓ Activity.leadId → CASCADE DELETE");
    } catch (e) {
        console.log("  Activity.leadId cascade:", e.message);
    }

    // 6. Add cascade delete on CallLog → Lead
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "CallLog" DROP CONSTRAINT IF EXISTS "CallLog_leadId_fkey"
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_leadId_fkey"
            FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log("✓ CallLog.leadId → CASCADE DELETE");
    } catch (e) {
        console.log("  CallLog.leadId cascade:", e.message);
    }

    console.log("\n✅ Schema fixes complete!");
}

main()
    .catch(e => { console.error("Fix failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
