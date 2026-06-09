const prisma = require("../utils/prisma");
const { runCampaign } = require("../services/whatsappCampaignService");
const { ApiError } = require("../utils/apiError");

async function createCampaign(req, res, next) {
    try {
        const { name, templateName, parameters, leadIds } = req.body;
        if (!name || !templateName || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: "name, templateName, and leadIds[] are required" });
        }

        // Opt-in enforcement: only include leads that have whatsappOptIn=true AND have a phone number
        const eligibleLeads = await prisma.lead.findMany({
            where: { id: { in: leadIds }, whatsappOptIn: true, phone: { not: null } },
            select: { id: true, phone: true, phoneNormalized: true },
        });

        if (eligibleLeads.length === 0) {
            return res.status(400).json({
                error: "No opted-in leads found. Leads must have WhatsApp opt-in enabled before they can receive campaign messages.",
                totalRequested: leadIds.length,
                eligibleCount: 0,
            });
        }

        const skippedCount = leadIds.length - eligibleLeads.length;

        const campaign = await prisma.whatsAppCampaign.create({
            data: {
                name,
                templateName,
                parameters: parameters ?? [],
                totalCount: eligibleLeads.length,
                createdById: req.user.id,
                recipients: {
                    create: eligibleLeads.map(lead => ({
                        leadId: lead.id,
                        phone: lead.phoneNormalized || lead.phone,
                        status: "QUEUED",
                    })),
                },
            },
            include: { recipients: { select: { id: true, status: true } } },
        });

        res.status(201).json({ campaign, skippedCount });
    } catch (e) {
        return next(e);
    }
}

async function startCampaign(req, res, next) {
    try {
        const { id } = req.params;

        // Idempotency: only transition DRAFT → RUNNING
        const updated = await prisma.whatsAppCampaign.updateMany({
            where: { id, status: "DRAFT" },
            data: { status: "RUNNING", startedAt: new Date() },
        });

        if (updated.count === 0) {
            const existing = await prisma.whatsAppCampaign.findUnique({ where: { id }, select: { status: true } });
            if (!existing) return res.status(404).json({ error: "Campaign not found" });
            return res.status(409).json({ error: `Campaign cannot be started from status: ${existing.status}` });
        }

        // Fire-and-forget — do NOT await
        runCampaign(id).catch(err => console.error(`[Campaign ${id}] runCampaign error:`, err.message));

        res.json({ message: "Campaign started" });
    } catch (e) {
        return next(e);
    }
}

async function pauseCampaign(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await prisma.whatsAppCampaign.updateMany({
            where: { id, status: "RUNNING" },
            data: { status: "PAUSED" },
        });
        if (updated.count === 0) return res.status(409).json({ error: "Campaign is not running" });
        res.json({ message: "Campaign paused" });
    } catch (e) {
        return next(e);
    }
}

async function resumeCampaign(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await prisma.whatsAppCampaign.updateMany({
            where: { id, status: "PAUSED" },
            data: { status: "RUNNING" },
        });
        if (updated.count === 0) return res.status(409).json({ error: "Campaign is not paused" });
        runCampaign(id).catch(err => console.error(`[Campaign ${id}] resume error:`, err.message));
        res.json({ message: "Campaign resumed" });
    } catch (e) {
        return next(e);
    }
}

async function listCampaigns(req, res, next) {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;

        const [campaigns, total] = await prisma.$transaction([
            prisma.whatsAppCampaign.findMany({
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: { createdBy: { select: { id: true, name: true } } },
            }),
            prisma.whatsAppCampaign.count(),
        ]);

        res.json({ campaigns, total, page, pages: Math.ceil(total / limit) });
    } catch (e) {
        return next(e);
    }
}

async function getCampaign(req, res, next) {
    try {
        const { id } = req.params;
        const campaign = await prisma.whatsAppCampaign.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, name: true } },
                recipients: {
                    include: { lead: { select: { id: true, name: true, phone: true } } },
                    orderBy: [{ status: "asc" }, { sentAt: "desc" }],
                    take: 1000, // cap inline recipients so a large campaign can't return a huge payload
                },
            },
        });
        if (!campaign) return res.status(404).json({ error: "Campaign not found" });
        res.json(campaign);
    } catch (e) {
        return next(e);
    }
}

// Auto-reply CRUD

async function listAutoReplies(req, res, next) {
    try {
        const rules = await prisma.whatsAppAutoReply.findMany({
            orderBy: { createdAt: "desc" },
            include: { createdBy: { select: { id: true, name: true } } },
            take: 200, // bound the payload — auto-reply rule sets are small by nature
        });
        res.json(rules);
    } catch (e) {
        return next(e);
    }
}

async function createAutoReply(req, res, next) {
    try {
        const { name, triggerType, keyword, timeoutHours, replyTemplate, replyParams } = req.body;
        if (!name || !triggerType || !replyTemplate) {
            return res.status(400).json({ error: "name, triggerType, and replyTemplate are required" });
        }
        if (triggerType === "KEYWORD" && !keyword) {
            return res.status(400).json({ error: "keyword is required for KEYWORD trigger" });
        }
        if (triggerType === "NO_REPLY_TIMEOUT" && !timeoutHours) {
            return res.status(400).json({ error: "timeoutHours is required for NO_REPLY_TIMEOUT trigger" });
        }

        const rule = await prisma.whatsAppAutoReply.create({
            data: {
                name,
                triggerType,
                keyword: keyword ?? null,
                timeoutHours: timeoutHours ? parseInt(timeoutHours, 10) : null,
                replyTemplate,
                replyParams: replyParams ?? [],
                createdById: req.user.id,
            },
        });
        res.status(201).json(rule);
    } catch (e) {
        return next(e);
    }
}

async function updateAutoReply(req, res, next) {
    try {
        const { id } = req.params;
        const { name, active, keyword, timeoutHours, replyTemplate, replyParams } = req.body;
        const rule = await prisma.whatsAppAutoReply.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(active !== undefined && { active }),
                ...(keyword !== undefined && { keyword }),
                ...(timeoutHours !== undefined && { timeoutHours: parseInt(timeoutHours, 10) }),
                ...(replyTemplate !== undefined && { replyTemplate }),
                ...(replyParams !== undefined && { replyParams }),
            },
        });
        res.json(rule);
    } catch (e) {
        if (e.code === "P2025") return next(e);
        return next(e);
    }
}

async function deleteAutoReply(req, res, next) {
    try {
        const { id } = req.params;
        await prisma.whatsAppAutoReply.delete({ where: { id } });
        res.json({ message: "Deleted" });
    } catch (e) {
        if (e.code === "P2025") return next(e);
        return next(e);
    }
}

module.exports = {
    createCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    listCampaigns,
    getCampaign,
    listAutoReplies,
    createAutoReply,
    updateAutoReply,
    deleteAutoReply,
};
