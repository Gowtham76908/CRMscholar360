const prisma = require("../utils/prisma");
const { sendTemplateMessage } = require("./whatsappService");

const SEND_DELAY_MS = 2500; // ~24/min — safe under WATI's 30/min limit

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCampaign(campaignId) {
    const recipients = await prisma.whatsAppCampaignRecipient.findMany({
        where: { campaignId, status: "QUEUED" },
        include: { lead: { select: { id: true, name: true } } },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
        // Idempotency: re-fetch campaign status before each send
        const campaign = await prisma.whatsAppCampaign.findUnique({
            where: { id: campaignId },
            select: { status: true, templateName: true, parameters: true },
        });

        if (!campaign || campaign.status === "PAUSED" || campaign.status === "FAILED") break;

        try {
            const params = Array.isArray(campaign.parameters) ? campaign.parameters : [];
            const result = await sendTemplateMessage(recipient.phone, campaign.templateName, params);

            const msg = await prisma.whatsAppMessage.create({
                data: {
                    leadId: recipient.leadId,
                    phone: recipient.phone,
                    direction: "OUTBOUND",
                    templateName: campaign.templateName,
                    messageBody: params.join(" | "),
                    status: result.status,
                    watiMessageId: result.watiMessageId,
                    providerPayload: result.raw,
                },
            });

            await prisma.whatsAppCampaignRecipient.update({
                where: { id: recipient.id },
                data: {
                    status: result.status === "FAILED" ? "FAILED" : "SENT",
                    sentAt: new Date(),
                    messageId: msg.id,
                    failReason: result.status === "FAILED" ? "Provider rejected" : null,
                },
            });

            if (result.status === "FAILED") {
                failedCount++;
            } else {
                sentCount++;
            }
        } catch (err) {
            await prisma.whatsAppCampaignRecipient.update({
                where: { id: recipient.id },
                data: { status: "FAILED", failReason: err.message?.slice(0, 255) },
            });
            failedCount++;
        }

        await delay(SEND_DELAY_MS);
    }

    // Re-check final status — if still RUNNING, mark COMPLETED
    const final = await prisma.whatsAppCampaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
    });

    if (final?.status === "RUNNING") {
        await prisma.whatsAppCampaign.update({
            where: { id: campaignId },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
                sentCount: { increment: sentCount },
                failedCount: { increment: failedCount },
            },
        });
    }
}

module.exports = { runCampaign };
