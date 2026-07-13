const prisma = require("../utils/prisma");
const { encrypt, decrypt } = require("../utils/encrypt");
const { getProvider } = require("../services/providers/registry");
const { ApiError } = require("../utils/apiError");

// ── helpers ──────────────────────────────────────────────────────────────────

const DEFAULTS = [
    { platform: "meta_leads",      label: "Meta Lead Ads" },
    { platform: "whatsapp_cloud",  label: "WhatsApp Cloud API" },
    { platform: "google_ads",      label: "Google Ads" },
    { platform: "email_smtp",      label: "Email / SMTP" },
    { platform: "linkedin_serper", label: "LinkedIn Lead Search" },
    { platform: "fasterq",         label: "Fasterq Calls" },
    { platform: "website_webhook", label: "Website Webhook" },
    { platform: "livekit",         label: "LiveKit Video" },
];

// Providers that auto-connect after configure (no OAuth needed)
const API_KEY_PROVIDERS = new Set([
    "linkedin_serper", "fasterq", "website_webhook",
    "whatsapp_cloud", "google_ads", "livekit",
]);

let _defaultsSeeded = false;

async function ensureDefaults() {
    if (_defaultsSeeded) return;
    for (const d of DEFAULTS) {
        const createData = { platform: d.platform, isConnected: false };
        if (d.platform === "linkedin_serper" && process.env.SERPER_API_KEY) {
            createData.config = { apiKey: encrypt(process.env.SERPER_API_KEY) };
            createData.isConnected = true;
        }
        await prisma.integration.upsert({
            where:  { platform: d.platform },
            create: createData,
            update: d.platform === "linkedin_serper" && process.env.SERPER_API_KEY
                ? { config: { apiKey: encrypt(process.env.SERPER_API_KEY) }, isConnected: true }
                : {},
        });
    }
    _defaultsSeeded = true;
}

function safeIntegration(i) {
    // Strip all sensitive / encrypted fields before sending to client
    // eslint-disable-next-line no-unused-vars
    const { accessToken, refreshToken, config, ...rest } = i;
    return rest;
}

async function addLog(integrationId, type, message, status = "INFO", metadata = null) {
    await prisma.integrationLog.create({
        data: { integrationId, type, message, status, metadata },
    });
}

// ── controllers ──────────────────────────────────────────────────────────────

const getAll = async (req, res, next) => {
    try {
        await ensureDefaults();
        const integrations = await prisma.integration.findMany({
            orderBy: { createdAt: "asc" },
            include: { logs: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
        res.json(integrations.map(safeIntegration));
    } catch (err) {
        return next(err);
    }
};

// Backend URL the OAuth popup redirects back to. Must be listed in the Meta app's
// "Valid OAuth Redirect URIs". Override with META_REDIRECT_URI for production.
function callbackUri(req, platform) {
    if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    return `${proto}://${req.get("host")}/api/integration-hub/oauth/${platform}/callback`;
}

const startOAuth = async (req, res, next) => {
    const { platform } = req.params;
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        const provider = getProvider(platform, integration);
        const { authUrl } = await provider.getAuthUrl(platform, { redirectUri: callbackUri(req, platform) });
        res.json({ authUrl });
    } catch (err) {
        return next(err);
    }
};

const oauthCallback = async (req, res, next) => {
    const { platform } = req.params;
    const { code, error, state } = req.query;

    // This popup must keep window.opener so it can postMessage the result back to
    // the app that opened it. Helmet's default Cross-Origin-Opener-Policy:same-origin
    // severs that link for a cross-origin popup (frontend and backend are different
    // domains), leaving the popup blank. Relax COOP for this response only.
    res.set("Cross-Origin-Opener-Policy", "unsafe-none");

    // This endpoint is loaded inside a popup — always respond with HTML that postMessages the result
    const closeWithResult = (ok, payload) => {
        const msg = JSON.stringify({ type: "SCHOLAR360_OAUTH", ok, payload });
        res.send(`<!doctype html><html><body style="font-family:system-ui;padding:24px;text-align:center;color:#334155">
            <p id="m">Finishing sign-in… you can close this window.</p>
            <script>
                try {
                    if (window.opener) {
                        window.opener.postMessage(${JSON.stringify(msg)}, "*");
                        window.close();
                    } else {
                        document.getElementById("m").textContent =
                            "Sign-in complete. Please close this window and return to the app.";
                    }
                } catch (e) {
                    document.getElementById("m").textContent =
                        "Sign-in complete. Please close this window and return to the app.";
                }
            </script>
        </body></html>`);
    };

    if (error) {
        return closeWithResult(false, { message: error });
    }

    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        if (!integration) return closeWithResult(false, { message: "Integration not found" });

        const provider = getProvider(platform, integration);

        // Meta Lead Ads: OAuth yields a user token, but the user must still choose
        // which Page to sync. Store the user token, return the Page list, defer connect.
        if (platform === "meta_leads") {
            const { userToken } = await provider.exchangeCode(code, { redirectUri: callbackUri(req, platform) });
            const pages = await provider.fetchPages(userToken);
            await prisma.integration.update({
                where: { platform },
                data: {
                    status: "PENDING",
                    isConnected: false,
                    config: { ...(integration.config || {}), userToken: encrypt(userToken) },
                    errorMessage: null,
                },
            });
            await addLog(integration.id, "AUTH", "Facebook login successful — awaiting Page selection", "SUCCESS");
            return closeWithResult(true, { platform, pages: pages.map(p => ({ id: p.id, name: p.name, tasks: p.tasks })) });
        }

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

const configure = async (req, res, next) => {
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
            if (safeConfig.appSecret)     safeConfig.appSecret     = encrypt(safeConfig.appSecret);
            if (safeConfig.apiSecret)     safeConfig.apiSecret     = encrypt(safeConfig.apiSecret);
            updateData.config = safeConfig;
        }
        if (metadata) {
            updateData.metadata = { ...(integration.metadata || {}), ...metadata };
        }

        // website_webhook is always connected (just show the URL)
        if (platform === "website_webhook") {
            // Persist apiKey in metadata so safeIntegration can return it to the UI
            // (config is stripped by safeIntegration to avoid leaking secrets, but apiKey
            //  must be visible to the user so they can copy their existing embed code)
            if (config?.apiKey) {
                updateData.metadata = {
                    ...(integration.metadata || {}),
                    ...(updateData.metadata || {}),
                    apiKey: config.apiKey,
                };
            }
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

            // WhatsApp send/template service caches the integration config — invalidate
            // it on reconfigure so the next send picks up the new credentials.
            if (platform === "whatsapp_cloud") {
                try { require("../services/whatsappService").clearConfigCache(); } catch {}
            }
            return res.json({ ok, message });
        }

        res.json(safeIntegration(updated));
    } catch (err) {
        return next(err);
    }
};

// POST /:platform/pages — re-list Pages using the stored user token (in case the
// popup was dismissed or the user wants to change Page later).
const listPages = async (req, res, next) => {
    const { platform } = req.params;
    try {
        const integration = await prisma.integration.findUnique({ where: { platform } });
        const userTokenEnc = integration?.config?.userToken;
        if (!userTokenEnc) return res.status(400).json({ message: "Connect with Facebook first" });
        const provider = getProvider(platform, integration);
        const pages = await provider.fetchPages(decrypt(userTokenEnc));
        res.json(pages.map(p => ({ id: p.id, name: p.name, tasks: p.tasks })));
    } catch (err) {
        return next(err);
    }
};

// POST /:platform/select-page { pageId } — finalize: store the chosen Page's token
// and Page ID, then mark the integration connected.
const selectMetaPage = async (req, res, next) => {
    const { platform } = req.params;
    const { pageId } = req.body;
    try {
        if (!pageId) return res.status(400).json({ message: "pageId is required" });
        const integration = await prisma.integration.findUnique({ where: { platform } });
        const userTokenEnc = integration?.config?.userToken;
        if (!userTokenEnc) return res.status(400).json({ message: "Connect with Facebook first" });

        const provider = getProvider(platform, integration);
        const pages = await provider.fetchPages(decrypt(userTokenEnc));
        const page = pages.find(p => String(p.id) === String(pageId));
        if (!page) return res.status(404).json({ message: "Page not found for this account" });

        await prisma.integration.update({
            where: { platform },
            data: {
                config: {
                    ...(integration.config || {}),
                    accessToken: encrypt(page.accessToken),
                    pageId: page.id,
                },
                metadata: { ...(integration.metadata || {}), pageName: page.name, pageId: page.id },
                isConnected: true,
                status: "CONNECTED",
                errorMessage: null,
            },
        });
        await addLog(integration.id, "CONNECTED", `Page selected: ${page.name}`, "SUCCESS");
        res.json({ ok: true, pageName: page.name });
    } catch (err) {
        return next(err);
    }
};

const testConnection = async (req, res, next) => {
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
        return next(err);
    }
};

const sync = async (req, res, next) => {
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
            return next(syncErr);
        }

        await prisma.integration.update({
            where: { platform },
            data: { lastSynced: new Date(), status: "CONNECTED", errorMessage: null },
        });
        await addLog(integration.id, "SYNC_COMPLETED", `Synced ${result.synced ?? 0} records`, "SUCCESS", result);

        res.json({ ...result, lastSynced: new Date() });
    } catch (err) {
        return next(err);
    }
};

const disconnect = async (req, res, next) => {
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
        return next(err);
    }
};

const getLogs = async (req, res, next) => {
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
        return next(err);
    }
};

const getAllLogs = async (req, res, next) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    try {
        const logs = await prisma.integrationLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                integration: { select: { platform: true, metadata: true } },
            },
        });
        res.json(logs);
    } catch (err) {
        return next(err);
    }
};

module.exports = { getAll, startOAuth, oauthCallback, configure, listPages, selectMetaPage, testConnection, sync, disconnect, getLogs, getAllLogs, ensureIntegrationDefaults: ensureDefaults };
