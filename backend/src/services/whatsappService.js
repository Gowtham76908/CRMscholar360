// WhatsApp Cloud API client (Meta Graph API).
//
// Replaces the previous WATI implementation. All configuration is read from
// the Integration row (platform: "whatsapp_cloud") via the integration hub,
// so configuring it once in the UI enables both manual sends and automation.
//
// The return shape preserves the legacy `watiMessageId` key for backward
// compatibility with the WhatsAppMessage schema column — the value is now
// Meta's wamid (e.g. "wamid.HBgM...").

const prisma = require("../utils/prisma");
const { decrypt } = require("../utils/encrypt");

const META_API_VERSION = process.env.META_API_VERSION || "v19.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Light cache so we don't hit the DB on every send. Invalidated when the
// integration is configured (see clearConfigCache, called from the configure
// endpoint).
let _cached = { ts: 0, cfg: null };
const CFG_TTL_MS = 60_000;

async function _getConfig() {
    if (Date.now() - _cached.ts < CFG_TTL_MS && _cached.cfg) return _cached.cfg;

    const intg = await prisma.integration.findUnique({
        where: { platform: "whatsapp_cloud" },
        select: { config: true, isConnected: true },
    });
    if (!intg?.isConnected) {
        throw new Error("WhatsApp Cloud API not connected. Configure it in Settings → Integrations.");
    }
    const raw = intg.config || {};
    if (!raw.accessToken || !raw.phoneNumberId) {
        throw new Error("WhatsApp Cloud API missing accessToken / phoneNumberId.");
    }

    let token = raw.accessToken;
    try { token = decrypt(token); } catch { /* not encrypted — accept as-is */ }

    const cfg = {
        token,
        phoneNumberId:    raw.phoneNumberId,
        wabaId:           raw.wabaId || null,
        templateLanguage: raw.templateLanguage || "en_US",
        appSecret:        raw.appSecret ? (() => { try { return decrypt(raw.appSecret); } catch { return raw.appSecret; } })() : null,
        appId:            raw.appId || null,
        verifyToken:      raw.verifyToken || null,
    };
    _cached = { ts: Date.now(), cfg };
    return cfg;
}

function clearConfigCache() { _cached = { ts: 0, cfg: null }; }

/**
 * Fetch approved templates from the WABA.
 * Returns the Meta-format template list, filtered to APPROVED.
 */
async function getTemplates() {
    const { token, wabaId } = await _getConfig();
    if (!wabaId) throw new Error("WhatsApp Business Account ID (wabaId) not configured.");

    const res = await fetch(
        `${META_BASE}/${wabaId}/message_templates?limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return (json.data || []).filter(t => t.status === "APPROVED");
}

/**
 * Send a template message to a single recipient.
 *
 * @param {string}   phone         - E.164 number, will be stripped to digits
 * @param {string}   templateName  - Meta-approved template name
 * @param {string[]} parameters    - Body parameters (mapped to {{1}}..{{N}})
 * @returns {{ watiMessageId: string|null, status: "SENT"|"FAILED", raw: object }}
 */
async function sendTemplateMessage(phone, templateName, parameters = []) {
    let cfg;
    try {
        cfg = await _getConfig();
    } catch (err) {
        return { watiMessageId: null, status: "FAILED", raw: { error: err.message } };
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    const body = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
            name: templateName,
            language: { code: cfg.templateLanguage },
            ...(parameters.length > 0 && {
                components: [{
                    type: "body",
                    parameters: parameters.map(value => ({ type: "text", text: String(value) })),
                }],
            }),
        },
    };

    let json;
    try {
        const res = await fetch(`${META_BASE}/${cfg.phoneNumberId}/messages`, {
            method:  "POST",
            headers: {
                Authorization:  `Bearer ${cfg.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
        json = await res.json();
    } catch (err) {
        return { watiMessageId: null, status: "FAILED", raw: { error: err.message } };
    }

    if (json.error) {
        return { watiMessageId: null, status: "FAILED", raw: json };
    }

    const wamid = json.messages?.[0]?.id ?? null;
    return {
        watiMessageId: wamid,
        status: wamid ? "SENT" : "FAILED",
        raw: json,
    };
}

module.exports = {
    getTemplates,
    sendTemplateMessage,
    clearConfigCache,
    _getConfig, // exported for webhook signature verification
};
