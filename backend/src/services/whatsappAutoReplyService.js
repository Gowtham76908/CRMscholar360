const prisma = require("../utils/prisma");
const { sendTemplateMessage } = require("./whatsappService");

async function processInboundReply(leadId, phone, text) {
    const rules = await prisma.whatsAppAutoReply.findMany({
        where: { active: true, triggerType: "KEYWORD" },
    });

    for (const rule of rules) {
        if (!rule.keyword) continue;
        if (!text.toLowerCase().includes(rule.keyword.toLowerCase())) continue;

        try {
            const params = Array.isArray(rule.replyParams) ? rule.replyParams : [];
            const result = await sendTemplateMessage(phone, rule.replyTemplate, params);

            await prisma.whatsAppMessage.create({
                data: {
                    leadId,
                    phone,
                    direction: "OUTBOUND",
                    templateName: rule.replyTemplate,
                    messageBody: params.join(" | "),
                    status: result.status,
                    watiMessageId: result.watiMessageId,
                    providerPayload: result.raw,
                },
            });

            await prisma.activity.create({
                data: {
                    leadId,
                    action: "WHATSAPP_AUTO_REPLY",
                    metadata: { ruleName: rule.name, keyword: rule.keyword, template: rule.replyTemplate },
                },
            });

            // Only fire first matching rule
            break;
        } catch (err) {
            console.error(`[AutoReply] Rule "${rule.name}" failed:`, err.message);
        }
    }
}

async function runNoReplyTimeoutCheck() {
    const rules = await prisma.whatsAppAutoReply.findMany({
        where: { active: true, triggerType: "NO_REPLY_TIMEOUT", timeoutHours: { not: null } },
    });

    for (const rule of rules) {
        const cutoff = new Date(Date.now() - rule.timeoutHours * 60 * 60 * 1000);

        const timedOut = await prisma.whatsAppCampaignRecipient.findMany({
            where: {
                status: { in: ["SENT", "DELIVERED"] },
                sentAt: { lt: cutoff },
            },
            include: { lead: { select: { id: true } } },
        });

        for (const recipient of timedOut) {
            try {
                const params = Array.isArray(rule.replyParams) ? rule.replyParams : [];
                const result = await sendTemplateMessage(recipient.phone, rule.replyTemplate, params);

                await prisma.whatsAppMessage.create({
                    data: {
                        leadId: recipient.leadId,
                        phone: recipient.phone,
                        direction: "OUTBOUND",
                        templateName: rule.replyTemplate,
                        messageBody: params.join(" | "),
                        status: result.status,
                        watiMessageId: result.watiMessageId,
                        providerPayload: result.raw,
                    },
                });

                // Mark recipient so it doesn't get re-sent on next cron tick
                await prisma.whatsAppCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: { status: "FOLLOWED_UP" },
                });
            } catch (err) {
                console.error(`[NoReplyTimeout] Recipient ${recipient.id} failed:`, err.message);
            }
        }
    }
}

module.exports = { processInboundReply, runNoReplyTimeoutCheck };
