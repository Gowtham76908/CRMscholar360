const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const normalizePhone = require("../utils/normalizePhone");
const { getTemplates, sendTemplateMessage } = require("../services/whatsappService");
const { processInboundReply } = require("../services/whatsappAutoReplyService");
const { ApiError } = require("../utils/apiError");

// GET /api/whatsapp/templates
const listTemplates = async (req, res, next) => {
    try {
        const templates = await getTemplates();
        res.json(templates);
    } catch (err) {
        return next(err);
    }
};

// POST /api/whatsapp/send
const sendMessage = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { leadId, templateName, parameters = [] } = req.body;

        if (!leadId || !templateName) {
            return res.status(400).json({ message: "leadId and templateName are required" });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });
        if (!lead.phone) return res.status(400).json({ message: "Lead has no phone number" });

        const normalized = normalizePhone(lead.phone);
        if (!normalized) return res.status(400).json({ message: "Lead phone number is invalid" });

        const result = await sendTemplateMessage(normalized, templateName, parameters);

        // Build message body preview (replace {{1}}, {{2}} etc.)
        let messageBody = templateName;
        parameters.forEach((val, i) => {
            messageBody = messageBody.replace(`{{${i + 1}}}`, val);
        });

        const record = await prisma.whatsAppMessage.create({
            data: {
                leadId,
                userId,
                phone: normalized,
                direction: "OUTBOUND",
                templateName,
                messageBody,
                status: result.status,
                watiMessageId: result.watiMessageId,
                providerPayload: result.raw,
                sentAt: new Date(),
            },
        });

        await logActivity({
            leadId,
            userId,
            action: "WHATSAPP_SENT",
            metadata: { templateName, messageId: record.id, phone: normalized },
        });

        res.status(201).json(record);
    } catch (err) {
        return next(err);
    }
};

// GET /api/whatsapp/messages?direction=inbound&limit=10
const getInboundMessages = async (req, res, next) => {
    try {
        const { direction, limit = 20 } = req.query;
        const where = {};
        if (direction) where.direction = direction.toUpperCase();

        const messages = await prisma.whatsAppMessage.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: Math.min(parseInt(limit) || 20, 100),
            include: {
                lead: { select: { id: true, name: true } },
            },
        });
        res.json({ data: messages });
    } catch (err) {
        return next(err);
    }
};

// GET /api/whatsapp/:leadId/messages
const getMessages = async (req, res, next) => {
    try {
        const messages = await prisma.whatsAppMessage.findMany({
            where: { leadId: req.params.leadId },
            orderBy: { createdAt: "desc" },
        });
        res.json(messages);
    } catch (err) {
        return next(err);
    }
};

// POST /api/whatsapp/webhook  (no auth — WATI calls this)
const watiWebhook = async (req, res, next) => {
    try {
        console.log("WATI webhook:", JSON.stringify(req.body));
        const payload = req.body;

        // WATI delivery update: { eventType: "message-status-update", messageId, status }
        // WATI inbound reply:   { eventType: "message", waId, text: { body } }
        const eventType = payload.eventType ?? payload.type;

        if (eventType === "message-status-update" || payload.messageId) {
            const watiMessageId = String(payload.messageId ?? payload.id);
            const rawStatus = (payload.status ?? "").toLowerCase();

            const statusMap = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
            const status = statusMap[rawStatus];
            if (!status) return res.json({ ok: true });

            const now = new Date();
            const dateField = { DELIVERED: "deliveredAt", READ: "readAt" }[status];

            const updatedMsgs = await prisma.whatsAppMessage.findMany({
                where: { watiMessageId },
                select: { id: true },
            });
            await prisma.whatsAppMessage.updateMany({
                where: { watiMessageId },
                data: {
                    status,
                    ...(dateField ? { [dateField]: now } : {}),
                    providerPayload: payload,
                },
            });

            // Sync campaign recipient status
            if (updatedMsgs.length > 0 && (status === "DELIVERED" || status === "READ")) {
                const msgIds = updatedMsgs.map(m => m.id);
                const recipients = await prisma.whatsAppCampaignRecipient.findMany({
                    where: { messageId: { in: msgIds } },
                    select: { id: true, campaignId: true },
                });
                for (const r of recipients) {
                    await prisma.whatsAppCampaignRecipient.update({ where: { id: r.id }, data: { status } });
                    const countField = status === "DELIVERED" ? "deliveredCount" : "readCount";
                    await prisma.whatsAppCampaign.update({
                        where: { id: r.campaignId },
                        data: { [countField]: { increment: 1 } },
                    });
                }
            }
        } else if (eventType === "message" || payload.waId) {
            // Inbound reply from lead
            const phone = normalizePhone(payload.waId ?? payload.from ?? "");
            const replyText = payload.text?.body ?? payload.body ?? "";

            if (phone && replyText) {
                // Find the most recent OUTBOUND message to this phone
                const original = await prisma.whatsAppMessage.findFirst({
                    where: { phone, direction: "OUTBOUND" },
                    orderBy: { createdAt: "desc" },
                });

                if (original) {
                    const now = new Date();

                    await prisma.whatsAppMessage.update({
                        where: { id: original.id },
                        data: { status: "REPLIED", replyText, repliedAt: now },
                    });

                    // Create INBOUND record for the timeline
                    await prisma.whatsAppMessage.create({
                        data: {
                            leadId: original.leadId,
                            phone,
                            direction: "INBOUND",
                            messageBody: replyText,
                            status: "RECEIVED",
                            providerPayload: payload,
                        },
                    });

                    // Update campaign recipient if this message belongs to a campaign
                    const recipient = await prisma.whatsAppCampaignRecipient.findFirst({
                        where: { messageId: original.id },
                    });
                    if (recipient) {
                        await prisma.whatsAppCampaignRecipient.update({
                            where: { id: recipient.id },
                            data: { status: "REPLIED", replyText, repliedAt: now },
                        });
                        await prisma.whatsAppCampaign.update({
                            where: { id: recipient.campaignId },
                            data: { repliedCount: { increment: 1 } },
                        });
                    }

                    await logActivity({
                        leadId: original.leadId,
                        action: "WHATSAPP_REPLY",
                        metadata: { replyText, phone },
                    });

                    // Trigger keyword auto-reply rules
                    processInboundReply(original.leadId, phone, replyText).catch(err =>
                        console.error("[AutoReply] processInboundReply error:", err.message)
                    );
                }
            }
        }

        res.json({ ok: true });
    } catch (err) {
        return next(err);
    }
};

module.exports = { listTemplates, sendMessage, getMessages, getInboundMessages, watiWebhook };
