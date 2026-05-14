require("dotenv").config();
const prisma = require("./src/utils/prisma");

async function main() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "leadId" TEXT NOT NULL,
            "userId" TEXT,
            phone TEXT NOT NULL,
            direction TEXT NOT NULL DEFAULT 'OUTBOUND',
            "templateName" TEXT,
            "messageBody" TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'SENT',
            "watiMessageId" TEXT,
            "replyText" TEXT,
            "providerPayload" JSONB,
            "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deliveredAt" TIMESTAMP(3),
            "readAt" TIMESTAMP(3),
            "repliedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "WhatsAppMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
            CONSTRAINT "WhatsAppMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id)
        )
    `);
    console.log("Table created");

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "WhatsAppMessage_leadId_idx" ON "WhatsAppMessage"("leadId")
    `);
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "WhatsAppMessage_watiMessageId_idx" ON "WhatsAppMessage"("watiMessageId")
    `);
    console.log("Indexes created");
}

main().catch(console.error).finally(() => prisma.$disconnect());
