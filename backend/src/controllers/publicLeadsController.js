const prisma = require("../utils/prisma");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const { ApiError } = require("../utils/apiError");
const { decrypt } = require("../utils/encrypt");
const { assignLeadOrAlert: autoAssignLead } = require("../services/leadDistributionEngine");
const { runRulesForLead } = require("../services/automationEngine");

// Look up the workspace integration by API key
const findWorkspaceByKey = async (apiKey) => {
    if (!apiKey) return null;
    const intg = await prisma.integration.findFirst({
        where: { platform: "website_webhook" }
    });
    if (!intg?.config?.apiKey) return null;
    // apiKey is AES-encrypted when saved via configure endpoint — decrypt before comparing
    let storedKey;
    try { storedKey = decrypt(intg.config.apiKey); } catch { storedKey = intg.config.apiKey; }
    if (storedKey !== apiKey) return null;

    // Find workspace via a connected user
    const user = await prisma.user.findFirst({
        where: { workspaceId: { not: null } },
        select: { workspaceId: true }
    });
    return { workspaceId: user?.workspaceId || null, intg };
};

// GET /api/public/leads/config?key=...
const getFormConfig = async (req, res, next) => {
    try {
        const apiKey = req.query.key || req.headers["x-api-key"];
        const workspace = await findWorkspaceByKey(apiKey);
        if (!workspace) {
            return res.status(401).json({ error: "Invalid API key" });
        }

        const cfg = workspace.intg.config || {};
        res.json({
            fields: cfg.fields || ["name", "email", "phone"],
            title: cfg.formTitle || "Contact Us",
            buttonText: cfg.buttonText || "Send Message",
            successMessage: cfg.successMessage || "Thank you! We'll be in touch soon.",
            brandColor: cfg.brandColor || "#4f46e5",
        });
    } catch (err) {
        return next(err);
    }
};

// POST /api/public/leads?key=...
const capturePublicLead = async (req, res, next) => {
    try {
        const apiKey = req.query.key || req.headers["x-api-key"];
        const workspace = await findWorkspaceByKey(apiKey);
        if (!workspace) {
            return res.status(401).json({ error: "Invalid API key" });
        }

        const { name, email, phone, message, enquiryType, source: bodySource } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({ error: "Name is required" });
        }
        if (!email?.trim() && !phone?.trim()) {
            return res.status(400).json({ error: "At least one of email or phone is required" });
        }

        // Deduplicate
        const orConditions = [];
        if (phone?.trim()) orConditions.push({ phone: phone.trim() });
        if (email?.trim()) orConditions.push({ email: email.trim() });

        const existing = orConditions.length
            ? await prisma.lead.findFirst({ where: { OR: orConditions } })
            : null;

        if (existing) {
            await logActivity({
                leadId: existing.id,
                action: "WEBHOOK_DUPLICATE_HIT",
                metadata: { source: "WEBSITE_FORM", origin: req.headers.origin || "unknown" }
            });
            return res.status(200).json({ success: true, message: "Thank you! We'll be in touch." });
        }

        const { score, category } = calculateLeadScore({ source: "WEBSITE", phone, email });

        const newLead = await prisma.lead.create({
            data: {
                name: name.trim(),
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                source: "WEBSITE",
                enquiryType: enquiryType || "SERVICES",
                score,
                category,
                workspaceId: workspace.workspaceId || null,
                biodata: message?.trim() || null,
            }
        });

        await logActivity({
            leadId: newLead.id,
            action: "LEAD_CREATED_VIA_WEBHOOK",
            metadata: { source: "WEBSITE_FORM", origin: req.headers.origin || "unknown" }
        });

        // Fire automation rules + auto-assign async — don't block the public response
        runRulesForLead("LEAD_CREATED", newLead).catch(console.error);
        autoAssignLead(newLead.id, { reason: "AUTO_ASSIGNMENT" })
            .catch(err => console.error(`[AutoAssign] webhook ${newLead.id}:`, err.message || err));

        res.status(201).json({ success: true, message: "Thank you! We'll be in touch." });
    } catch (err) {
        return next(err);
    }
};

module.exports = { capturePublicLead, getFormConfig };
