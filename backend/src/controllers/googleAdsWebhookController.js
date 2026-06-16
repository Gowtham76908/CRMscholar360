const prisma = require("../utils/prisma");
const leadService = require("../services/leadService");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const { runRulesForLead } = require("../services/automationEngine");

// Google Ads stores a "Key" (webhook key) that it sends as ?google_key=... on every request.
// We verify it matches what's saved in the Integration row.
const getWebhookKey = async () => {
    try {
        const intg = await prisma.integration.findUnique({ where: { platform: "google_ads" } });
        return intg?.config?.webhookKey || process.env.GOOGLE_ADS_WEBHOOK_KEY || null;
    } catch {
        return process.env.GOOGLE_ADS_WEBHOOK_KEY || null;
    }
};

// Parse Google Ads lead payload into flat object
// Google sends: { lead_id, user_column_data: [{ column_name, string_value }, ...], ... }
const parseGoogleAdsPayload = (body) => {
    const columns = body.user_column_data || [];
    const data = {};
    for (const col of columns) {
        const key = (col.column_name || "").toLowerCase().replace(/\s+/g, "_");
        data[key] = col.string_value || "";
    }

    return {
        name: data.full_name || data.name || [data.first_name, data.last_name].filter(Boolean).join(" ") || "Google Ads Lead",
        email: data.email || data.email_address || "",
        phone: data.phone_number || data.phone || "",
        campaignName: body.campaign_name || body.google_key || "",
        adGroupName: body.ad_group_name || "",
        gclidId: body.lead_id || body.gclid || "",
        rawData: data,
    };
};

// GET /api/google-ads/webhook — verification ping from Google Ads
const verifyGoogleAdsWebhook = async (req, res) => {
    const { google_key } = req.query;
    const expectedKey = await getWebhookKey();

    // Fail closed in production: an unconfigured key must not leave the endpoint open.
    if (!expectedKey) {
        if (process.env.NODE_ENV === "production") return res.status(403).json({ error: "Webhook key not configured" });
    } else if (google_key !== expectedKey) {
        return res.status(403).json({ error: "Invalid google_key" });
    }

    // Google expects a 200 response with the key echoed back
    res.status(200).json({ google_key });
};

// POST /api/google-ads/webhook — real lead payload from Google Ads
const receiveGoogleAdsLead = async (req, res, next) => {
    try {
        const { google_key } = req.query;
        const expectedKey = await getWebhookKey();

        // Fail closed in production: an unconfigured key must not leave the endpoint open.
        if (!expectedKey) {
            if (process.env.NODE_ENV === "production") return res.status(403).json({ error: "Webhook key not configured" });
        } else if (google_key !== expectedKey) {
            return res.status(403).json({ error: "Invalid google_key" });
        }

        const { name, email, phone, campaignName, adGroupName, gclidId, rawData } = parseGoogleAdsPayload(req.body);

        if (!name && !email && !phone) {
            return res.status(400).json({ error: "No identifiable lead data in payload" });
        }

        // Deduplicate
        const orConditions = [];
        if (phone) orConditions.push({ phone });
        if (email) orConditions.push({ email });

        if (orConditions.length > 0) {
            const existing = await prisma.lead.findFirst({ where: { OR: orConditions } });
            if (existing) {
                await logActivity({
                    leadId: existing.id,
                    action: "WEBHOOK_DUPLICATE_HIT",
                    metadata: { source: "GOOGLE_ADS", campaignName, gclidId }
                });
                return res.status(200).json({ message: "Lead already exists", leadId: existing.id });
            }
        }

        const { score, category } = calculateLeadScore({ source: "WEBSITE", phone, email });

        // Centralized creation: Lead + SALES LeadDepartment (unassigned)
        const newLead = await leadService.createLead({
            name: name || "Google Ads Lead",
            email: email || null,
            phone: phone || null,
            source: "WEBSITE",
            enquiryType: "SERVICES",
            score,
            category,
        });

        await logActivity({
            leadId: newLead.id,
            action: "LEAD_CREATED_VIA_WEBHOOK",
            metadata: { source: "GOOGLE_ADS", campaignName, adGroupName, gclidId, rawData }
        });

        // Fire automation rules async. The SALES service is created unassigned for
        // a manager to allocate (auto-distribution retired).
        runRulesForLead("LEAD_CREATED", newLead).catch(console.error);

        res.status(200).json({ message: "Lead received", leadId: newLead.id });
    } catch (error) {
        return next(error);
    }
};

module.exports = { receiveGoogleAdsLead, verifyGoogleAdsWebhook };
