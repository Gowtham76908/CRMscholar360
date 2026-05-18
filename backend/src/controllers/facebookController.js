const prisma = require("../utils/prisma");
const axios = require("axios");
const calculateLeadScore = require("../utils/leadScorer");
const normalizePhone = require("../utils/normalizePhone");
const logActivity = require("../utils/activityLogger");
const { encrypt, decrypt } = require("../utils/encrypt");

const FB_API = "https://graph.facebook.com/v18.0";

const getIntegration = async () =>
    prisma.integration.findUnique({ where: { platform: "FACEBOOK_LEADS" } });

// Handles encrypted tokens (new) and plain-text tokens (legacy rows written before this change)
const resolveToken = (raw) => {
    if (!raw) return null;
    try { return decrypt(raw); } catch { return raw; }
};

// GET /api/facebook/status
const getStatus = async (req, res) => {
    try {
        const intg = await getIntegration();
        res.json({
            connected:   intg?.isConnected ?? false,
            lastSynced:  intg?.lastSynced ?? null,
            pageId:      intg?.config?.pageId ?? null,
        });
    } catch (e) {
        res.status(500).json({ message: "Error fetching Facebook status", error: e.message });
    }
};

// POST /api/facebook/connect
const connect = async (req, res) => {
    try {
        const { accessToken, pageId } = req.body;
        if (!accessToken || !pageId) {
            return res.status(400).json({ message: "accessToken and pageId are required" });
        }

        // Verify token works against the page
        try {
            await axios.get(`${FB_API}/${pageId}`, {
                params: { access_token: accessToken, fields: "id,name" },
            });
        } catch (e) {
            const msg = e.response?.data?.error?.message || "Invalid access token or page ID";
            return res.status(400).json({ message: msg });
        }

        await prisma.integration.upsert({
            where:  { platform: "FACEBOOK_LEADS" },
            create: { platform: "FACEBOOK_LEADS", isConnected: true, config: { accessToken: encrypt(accessToken), pageId } },
            update: { isConnected: true, config: { accessToken: encrypt(accessToken), pageId } },
        });

        res.json({ connected: true });
    } catch (e) {
        res.status(500).json({ message: "Error connecting Facebook", error: e.message });
    }
};

// DELETE /api/facebook/disconnect
const disconnect = async (req, res) => {
    try {
        await prisma.integration.upsert({
            where:  { platform: "FACEBOOK_LEADS" },
            create: { platform: "FACEBOOK_LEADS", isConnected: false },
            update: { isConnected: false, config: {} },
        });
        res.json({ disconnected: true });
    } catch (e) {
        res.status(500).json({ message: "Error disconnecting", error: e.message });
    }
};

// GET /api/facebook/forms
const listForms = async (req, res) => {
    try {
        const intg = await getIntegration();
        if (!intg?.isConnected || !intg?.config?.accessToken) {
            return res.status(400).json({ message: "Facebook not connected. Configure it in Settings → Facebook." });
        }

        const { data } = await axios.get(`${FB_API}/${intg.config.pageId}/leadgen_forms`, {
            params: {
                access_token: resolveToken(intg.config.accessToken),
                fields: "id,name,leads_count,created_time",
            },
        });

        res.json(data.data || []);
    } catch (e) {
        const msg = e.response?.data?.error?.message || e.message;
        res.status(500).json({ message: `Facebook API error: ${msg}` });
    }
};

// POST /api/facebook/sync  body: { formId }
const syncLeads = async (req, res) => {
    try {
        const userId = req.user.id;
        const { formId } = req.body;

        if (!formId) return res.status(400).json({ message: "formId is required" });

        const intg = await getIntegration();
        if (!intg?.isConnected || !intg?.config?.accessToken) {
            return res.status(400).json({ message: "Facebook not connected" });
        }

        const { data } = await axios.get(`${FB_API}/${formId}/leads`, {
            params: {
                access_token: resolveToken(intg.config.accessToken),
                fields: "id,created_time,field_data",
                limit: 100,
            },
        });

        const fbLeads = data.data || [];
        const results = { imported: 0, duplicates: 0, failed: 0, errors: [] };

        // Parse all leads upfront
        const parsed = fbLeads.map(fbLead => {
            const fields = {};
            (fbLead.field_data || []).forEach(f => {
                fields[f.name.toLowerCase().replace(/\s+/g, "_")] = f.values?.[0] ?? null;
            });
            const name  = fields.full_name || fields.name || `FB Lead ${fbLead.id}`;
            const email = fields.email ? fields.email.toLowerCase() : null;
            const phone = fields.phone_number || fields.phone || fields.mobile || null;
            return { fbId: fbLead.id, name, email, phone };
        });

        // Batch dedup: one query for all phones + one for all emails (vs N findFirst calls)
        const allPhones = [...new Set(parsed.map(r => r.phone ? normalizePhone(r.phone) : null).filter(Boolean))];
        const allEmails = [...new Set(parsed.map(r => r.email).filter(Boolean))];

        const [existingByPhone, existingByEmail] = await Promise.all([
            allPhones.length
                ? prisma.lead.findMany({ where: { phoneNormalized: { in: allPhones } }, select: { phoneNormalized: true } })
                : [],
            allEmails.length
                ? prisma.lead.findMany({ where: { email: { in: allEmails } }, select: { email: true } })
                : [],
        ]);

        const dupPhones = new Set(existingByPhone.map(l => l.phoneNormalized));
        const dupEmails = new Set(existingByEmail.map(l => l.email));

        for (const r of parsed) {
            try {
                const normalized = r.phone ? normalizePhone(r.phone) : null;
                if ((normalized && dupPhones.has(normalized)) || (r.email && dupEmails.has(r.email))) {
                    results.duplicates++;
                    continue;
                }

                const { score, category } = calculateLeadScore({ source: "FACEBOOK", phone: r.phone, email: r.email });

                const lead = await prisma.lead.create({
                    data: {
                        name:            r.name,
                        email:           r.email || null,
                        phone:           r.phone || null,
                        phoneNormalized: normalized,
                        source:          "FACEBOOK",
                        enquiryType:     "PRODUCT",
                        score,
                        category,
                    },
                });

                // Track newly inserted phones/emails so within-batch dupes are caught too
                if (normalized) dupPhones.add(normalized);
                if (r.email)    dupEmails.add(r.email);

                await logActivity({
                    leadId: lead.id,
                    userId,
                    action: "LEAD_CREATED",
                    metadata: { source: "FACEBOOK_ADS", fbLeadId: r.fbId },
                });

                results.imported++;
            } catch (e) {
                results.failed++;
                results.errors.push(`Lead ${r.fbId}: ${e.message}`);
            }
        }

        // Update lastSynced
        await prisma.integration.update({
            where: { platform: "FACEBOOK_LEADS" },
            data:  { lastSynced: new Date() },
        });

        res.json(results);
    } catch (e) {
        const msg = e.response?.data?.error?.message || e.message;
        res.status(500).json({ message: `Sync failed: ${msg}` });
    }
};

module.exports = { getStatus, connect, disconnect, listForms, syncLeads };
