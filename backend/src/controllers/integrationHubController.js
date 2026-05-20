const prisma = require("../utils/prisma");
const { encrypt, decrypt } = require("../utils/encrypt");
const { getProvider } = require("../services/providers/registry");

// ── helpers ──────────────────────────────────────────────────────────────────

const DEFAULTS = [
    { platform: "meta_leads",      label: "Meta Lead Ads" },
    { platform: "whatsapp_wati",   label: "WhatsApp (WATI)" },
    { platform: "whatsapp_cloud",  label: "WhatsApp Cloud API" },
    { platform: "google_ads",      label: "Google Ads" },
    { platform: "email_smtp",      label: "Email / SMTP" },
    { platform: "linkedin_serper", label: "LinkedIn Lead Search" },
    { platform: "salestrail",      label: "Salestrail Calls" },
    { platform: "website_webhook", label: "Website Webhook" },
];

// Providers that auto-connect after configure (no OAuth needed)
const API_KEY_PROVIDERS = new Set([
    "whatsapp_wati", "linkedin_serper", "salestrail", "website_webhook",
    "meta_leads", "whatsapp_cloud", "google_ads",
]);

async function ensureDefaults() {
    for (const d of DEFAULTS) {
        const existing = await prisma.integration.findUnique({ where: { platform: d.platform } });
        if (!existing) {
            const createData = { platform: d.platform, isConnected: false };
            // Auto-seed linkedin_serper from env if key is available
            if (d.platform === "linkedin_serper" && process.env.SERPER_API_KEY) {
                createData.config = { apiKey: encrypt(process.env.SERPER_API_KEY) };
                createData.isConnected = true;
            }
            await prisma.integration.create({ data: createData });
        } else if (d.platform === "linkedin_serper" && !existing.isConnected && process.env.SERPER_API_KEY) {
            await prisma.integration.update({
                where: { platform: d.platform },
                data: { config: { apiKey: encrypt(process.env.SERPER_API_KEY) }, isConnected: true },
            });
        }
    }
}

function safeIntegration(i) {
    // Strip encrypted fields before sending to client
    const { accessToken, refreshToken, ...rest } = i;
    return rest;
}

async function addLog(integrationId, type, message, status = "INFO", metadata = null) {
    await prisma.integrationLog.create({
        data: { integrationId, type, message, status, metadata },
    });
}

// ── controllers ──────────────────────────────────────────────────────────────

const getAll = async (req, res) => {
    try {
        await ensureDefaults();
        const integrations = await prisma.integration.findMany({
            orderBy: { createdAt: "asc" },
            include: { logs: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
        res.json(integrations.map(safeIntegration));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const startOAuth = async (req, res) => {
    const { platform } = req.params;
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        const provider = getProvider(platform, integration);
        const { authUrl } = await provider.getAuthUrl(platform);
        res.json({ authUrl });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const oauthCallback = async (req, res) => {
    const { platform } = req.params;
    const { code, error, state } = req.query;

    // This endpoint is loaded inside a popup — always respond with HTML that postMessages the result
    const closeWithResult = (ok, payload) => {
        const msg = JSON.stringify({ type: "DCRM_OAUTH", ok, payload });
        res.send(`<script>
            window.opener && window.opener.postMessage(${JSON.stringify(msg)}, "*");
            window.close();
        </script>`);
    };

    if (error) {
        return closeWithResult(false, { message: error });
    }

    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration) return closeWithResult(false, { message: "Integration not found" });

        const provider = getProvider(platform, integration);
        const tokens = await provider.exchangeCode(code);

        await prisma.integration.update({
            where: { platform },
            data: {
                isConnected: true,
                status: "CONNECTED",
                accessToken: tokens.accessToken ? encrypt(tokens.accessToken) : null,
                refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
                expiresAt: tokens.expiresAt || null,
                metadata: { ...(integration.metadata || {}), ...(tokens.metadata || {}) },
                errorMessage: null,
                lastSynced: new Date(),
            },
        });

        await addLog(integration.id, "CONNECTED", `${platform} connected via OAuth`, "SUCCESS");
        closeWithResult(true, { platform });
    } catch (err) {
        try {
            const integration = await prisma.integration.findUnique({ where: { platform } });
            if (integration) {
                await prisma.integration.update({
                    where: { platform },
                    data: { status: "ERROR", isConnected: false, errorMessage: err.message },
                });
                await addLog(integration.id, "AUTH_FAILED", err.message, "ERROR");
            }
        } catch (_) {}
        closeWithResult(false, { message: err.message });
    }
};

const configure = async (req, res) => {
    const { platform } = req.params;
    const { config, metadata } = req.body;
    try {
        let integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration) {
            const label = DEFAULTS.find(d => d.platform === platform)?.label || platform;
            integration = await prisma.integration.create({
                data: { platform, isConnected: false, metadata: { label } },
            });
        }

        const updateData = {};
        if (config) {
            const safeConfig = { ...config };
            // Encrypt sensitive fields
            if (safeConfig.pass)          safeConfig.pass          = encrypt(safeConfig.pass);
            if (safeConfig.token)         safeConfig.token         = encrypt(safeConfig.token);
            if (safeConfig.apiKey)        safeConfig.apiKey        = encrypt(safeConfig.apiKey);
            if (safeConfig.pass2)         safeConfig.pass2         = encrypt(safeConfig.pass2);
            if (safeConfig.accessToken)   safeConfig.accessToken   = encrypt(safeConfig.accessToken);
            if (safeConfig.refreshToken)  safeConfig.refreshToken  = encrypt(safeConfig.refreshToken);
            if (safeConfig.developerToken) safeConfig.developerToken = encrypt(safeConfig.developerToken);
            updateData.config = safeConfig;
        }
        if (metadata) {
            updateData.metadata = { ...(integration.metadata || {}), ...metadata };
        }

        // website_webhook is always connected (just show the URL)
        if (platform === "website_webhook") {
            await prisma.integration.update({
                where: { platform },
                data: { ...updateData, isConnected: true, status: "CONNECTED", errorMessage: null },
            });
            await addLog(integration.id, "CONNECTED", "Website webhook endpoint active", "SUCCESS");
            return res.json({ ok: true, message: "Webhook endpoint active" });
        }

        const updated = await prisma.integration.update({
            where: { platform },
            data: updateData,
        });

        // For providers that validate on configure, test and mark status
        if ((platform === "email_smtp" || API_KEY_PROVIDERS.has(platform)) && config) {
            const provider = getProvider(platform, updated);
            const { ok, message } = await provider.validate();
            await prisma.integration.update({
                where: { platform },
                data: { isConnected: ok, status: ok ? "CONNECTED" : "ERROR", errorMessage: ok ? null : message },
            });
            const logType = ok ? "CONNECTED" : "AUTH_FAILED";
            await addLog(integration.id, logType, message, ok ? "SUCCESS" : "ERROR");
            return res.json({ ok, message });
        }

        res.json(safeIntegration(updated));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const testConnection = async (req, res) => {
    const { platform } = req.params;
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration) return res.status(404).json({ message: "Not found" });

        const provider = getProvider(platform, integration);
        const result = await provider.validate();

        await prisma.integration.update({
            where: { platform },
            data: {
                status: result.ok ? "CONNECTED" : "ERROR",
                isConnected: result.ok,
                errorMessage: result.ok ? null : result.message,
            },
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const sync = async (req, res) => {
    const { platform } = req.params;
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration || !integration.isConnected) {
            return res.status(400).json({ message: "Integration not connected" });
        }

        await addLog(integration.id, "SYNC_STARTED", `Sync started for ${platform}`, "INFO");

        const provider = getProvider(platform, integration);
        let result;
        try {
            result = await provider.sync();
        } catch (syncErr) {
            await prisma.integration.update({
                where: { platform },
                data: { status: "ERROR", errorMessage: syncErr.message },
            });
            await addLog(integration.id, "SYNC_FAILED", syncErr.message, "ERROR");
            return res.status(500).json({ message: syncErr.message });
        }

        await prisma.integration.update({
            where: { platform },
            data: { lastSynced: new Date(), status: "CONNECTED", errorMessage: null },
        });
        await addLog(integration.id, "SYNC_COMPLETED", `Synced ${result.synced ?? 0} records`, "SUCCESS", result);

        res.json({ ...result, lastSynced: new Date() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const disconnect = async (req, res) => {
    const { platform } = req.params;
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration) return res.status(404).json({ message: "Not found" });

        const provider = getProvider(platform, integration);
        await provider.disconnect();

        await prisma.integration.update({
            where: { platform },
            data: {
                isConnected: false,
                status: "DISCONNECTED",
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                errorMessage: null,
                metadata: { label: (integration.metadata || {}).label },
            },
        });

        await addLog(integration.id, "DISCONNECTED", `${platform} disconnected`, "INFO");
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getLogs = async (req, res) => {
    const { platform } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration) return res.status(404).json({ message: "Not found" });

        const logs = await prisma.integrationLog.findMany({
            where: { integrationId: integration.id },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAll, startOAuth, oauthCallback, configure, testConnection, sync, disconnect, getLogs, ensureIntegrationDefaults: ensureDefaults };
