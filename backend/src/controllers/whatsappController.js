const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const normalizePhone = require("../utils/normalizePhone");
const { getTemplates, sendTemplateMessage } = require("../services/whatsappService");

// GET /api/whatsapp/templates
const listTemplates = async (req, res) => {
    try {
        const templates = await getTemplates();
        res.json(templates);
    } catch (err) {
        console.error("WATI getTemplates error:", err.message);
        res.status(502).json({ message: "Failed to fetch templates from WATI", error: err.message });
    }
};

// POST /api/whatsapp/send
const sendMessage = async (req, res) => {
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
        console.error("WhatsApp send error:", err.message);
        res.status(500).json({ message: "Failed to send WhatsApp message", error: err.message });
    }
};

// GET /api/whatsapp/:leadId/messages
const getMessages = async (req, res) => {
    try {
        const messages = await prisma.whatsAppMessage.findMany({
            where: { leadId: req.params.leadId },
            orderBy: { createdAt: "desc" },
        });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch messages", error: err.message });
    }
};

// POST /api/whatsapp/webhook  (no auth — WATI calls this)
const watiWebhook = async (req, res) => {
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

            await prisma.whatsAppMessage.updateMany({
                where: { watiMessageId },
                data: {
                    status,
                    ...(dateField ? { [dateField]: now } : {}),
                    providerPayload: payload,
                },
            });
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
                    await prisma.whatsAppMessage.update({
                        where: { id: original.id },
                        data: {
                            status: "REPLIED",
                            replyText,
                            repliedAt: new Date(),
                        },
                    });

                    // Also create an INBOUND record for the timeline
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

                    await logActivity({
                        leadId: original.leadId,
                        action: "WHATSAPP_REPLY",
                        metadata: { replyText, phone },
                    });
                }
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error("WATI webhook error:", err.message);
        res.status(500).json({ message: "Webhook error", error: err.message });
    }
};

module.exports = { listTemplates, sendMessage, getMessages, watiWebhook };
