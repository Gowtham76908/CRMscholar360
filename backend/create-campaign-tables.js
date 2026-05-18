require("dotenv").config();
const prisma = require("./src/utils/prisma");

async function main() {
    // Add opt-in columns to Lead
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "Lead"
        ADD COLUMN IF NOT EXISTS "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "Lead"
        ADD COLUMN IF NOT EXISTS "whatsappOptInAt" TIMESTAMP(3)
    `);
    console.log("Lead opt-in columns added");

    // WhatsAppCampaign
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsAppCampaign" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name TEXT NOT NULL,
            "templateName" TEXT NOT NULL,
            parameters JSONB NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'DRAFT',
            "totalCount" INTEGER NOT NULL DEFAULT 0,
            "sentCount" INTEGER NOT NULL DEFAULT 0,
            "deliveredCount" INTEGER NOT NULL DEFAULT 0,
            "readCount" INTEGER NOT NULL DEFAULT 0,
            "repliedCount" INTEGER NOT NULL DEFAULT 0,
            "failedCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "startedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),
            "createdById" TEXT NOT NULL,
            CONSTRAINT "WhatsAppCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id)
        )
    `);
    console.log("WhatsAppCampaign table created");

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "WhatsAppCampaign_createdById_idx" ON "WhatsAppCampaign"("createdById")
    `);

    // WhatsAppCampaignRecipient
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsAppCampaignRecipient" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "campaignId" TEXT NOT NULL,
            "leadId" TEXT NOT NULL,
            phone TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'QUEUED',
            "messageId" TEXT UNIQUE,
            "failReason" TEXT,
            "sentAt" TIMESTAMP(3),
            "repliedAt" TIMESTAMP(3),
            "replyText" TEXT,
            CONSTRAINT "WhatsAppCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign"(id) ON DELETE CASCADE,
            CONSTRAINT "WhatsAppCampaignRecipient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
            CONSTRAINT "WhatsAppCampaignRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessage"(id)
        )
    `);
    console.log("WhatsAppCampaignRecipient table created");

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_campaignId_idx" ON "WhatsAppCampaignRecipient"("campaignId")
    `);
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_leadId_idx" ON "WhatsAppCampaignRecipient"("leadId")
    `);
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_phone_idx" ON "WhatsAppCampaignRecipient"(phone)
    `);

    // WhatsAppAutoReply
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsAppAutoReply" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name TEXT NOT NULL,
            active BOOLEAN NOT NULL DEFAULT true,
            "triggerType" TEXT NOT NULL,
            keyword TEXT,
            "timeoutHours" INTEGER,
            "replyTemplate" TEXT NOT NULL,
            "replyParams" JSONB NOT NULL DEFAULT '[]',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdById" TEXT NOT NULL,
            CONSTRAINT "WhatsAppAutoReply_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id)
        )
    `);
    console.log("WhatsAppAutoReply table created");

    console.log("All done! Run: npx prisma generate");
}

main().catch(console.error).finally(() => prisma.$disconnect());
