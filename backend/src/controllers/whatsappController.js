const crypto = require("crypto");
const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const normalizePhone = require("../utils/normalizePhone");
const { getTemplates, sendTemplateMessage, _getConfig: getWhatsAppConfig } = require("../services/whatsappService");
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

// ── Meta webhook helpers ─────────────────────────────────────────────────────

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw request body.
 * Meta signs each webhook POST with HMAC-SHA256 keyed by the app secret.
 */
function verifyMetaSignature(req, appSecret) {
    const header = req.headers["x-hub-signature-256"];
    if (!header || !appSecret || !req.rawBody) return false;
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
    if (header.length !== expected.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
    } catch {
        return false;
    }
}

async function handleStatusUpdate(statusObj) {
    const wamid = String(statusObj.id);
    const rawStatus = (statusObj.status || "").toLowerCase();
    const statusMap = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
    const status = statusMap[rawStatus];
    if (!status) return;

    const now = new Date();
    const dateField = { DELIVERED: "deliveredAt", READ: "readAt" }[status];

    const updatedMsgs = await prisma.whatsAppMessage.findMany({
        where: { watiMessageId: wamid },
        select: { id: true },
    });
    await prisma.whatsAppMessage.updateMany({
        where: { watiMessageId: wamid },
        data: {
            status,
            ...(dateField ? { [dateField]: now } : {}),
            providerPayload: statusObj,
        },
    });

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
}

async function handleInboundMessage(msgObj) {
    const phone = normalizePhone(msgObj.from || "");
    const replyText = msgObj.text?.body || msgObj.button?.text || msgObj.interactive?.button_reply?.title || "";
    if (!phone || !replyText) return;

    const original = await prisma.whatsAppMessage.findFirst({
        where: { phone, direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
    });
    if (!original) return;

    const now = new Date();
    await prisma.whatsAppMessage.update({
        where: { id: original.id },
        data: { status: "REPLIED", replyText, repliedAt: now },
    });
    await prisma.whatsAppMessage.create({
        data: {
            leadId:          original.leadId,
            phone,
            direction:       "INBOUND",
            messageBody:     replyText,
            status:          "RECEIVED",
            providerPayload: msgObj,
        },
    });

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

    processInboundReply(original.leadId, phone, replyText).catch(err =>
        console.error("[AutoReply] processInboundReply error:", err.message)
    );
}

// GET /api/whatsapp/webhook  — Meta subscription handshake
const verifyWebhookSubscription = async (req, res) => {
    try {
        const mode      = req.query["hub.mode"];
        const challenge = req.query["hub.challenge"];
        const token     = req.query["hub.verify_token"];

        const cfg = await getWhatsAppConfig().catch(() => null);
        const expected = cfg?.verifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN;

        if (mode === "subscribe" && expected && token === expected) {
            return res.status(200).send(challenge);
        }
        return res.status(403).json({ error: "Verification failed" });
    } catch (err) {
        return res.status(403).json({ error: err.message });
    }
};

// POST /api/whatsapp/webhook  — Meta Cloud API event delivery
const metaWebhook = async (req, res, next) => {
    try {
        // Signature verification — Meta signs the raw body with the app secret.
        const cfg = await getWhatsAppConfig().catch(() => null);
        const appSecret = cfg?.appSecret || process.env.META_APP_SECRET;
        if (!appSecret) {
            console.error("[MetaWebhook] No app secret configured — rejecting");
            return res.status(500).json({ error: "Webhook secret not configured" });
        }
        if (!verifyMetaSignature(req, appSecret)) {
            return res.status(401).json({ error: "Invalid signature" });
        }

        const payload = req.body || {};
        // Meta sends: { object, entry: [{ id, changes: [{ value: { messages, statuses }, field }] }] }
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value || {};
                for (const statusObj of value.statuses || []) {
                    await handleStatusUpdate(statusObj);
                }
                for (const msgObj of value.messages || []) {
                    await handleInboundMessage(msgObj);
                }
            }
        }

        // Meta requires a 200 within 5s or it retries — always respond fast.
        res.status(200).json({ ok: true });
    } catch (err) {
        // Even on internal errors, return 200 so Meta doesn't hammer-retry.
        // The error is logged for our side.
        console.error("[MetaWebhook] handler error:", err.message);
        res.status(200).json({ ok: true });
    }
};

module.exports = { listTemplates, sendMessage, getMessages, getInboundMessages, metaWebhook, verifyWebhookSubscription };
