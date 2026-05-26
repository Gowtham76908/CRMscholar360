const MetaProvider = require("./MetaProvider");
const WhatsAppProvider = require("./WhatsAppProvider");
const GoogleAdsProvider = require("./GoogleAdsProvider");
const EmailProvider = require("./EmailProvider");
const LinkedInProvider = require("./LinkedInProvider");
const SalestrailProvider = require("./SalestrailProvider");
const WebhookProvider = require("./WebhookProvider");

const PROVIDERS = {
    meta_leads:      MetaProvider,
    whatsapp_cloud:  WhatsAppProvider,
    google_ads:      GoogleAdsProvider,
    email_smtp:      EmailProvider,
    linkedin_serper: LinkedInProvider,
    salestrail:      SalestrailProvider,
    website_webhook: WebhookProvider,
};

function getProvider(platform, integration) {
    const Cls = PROVIDERS[platform];
    if (!Cls) throw new Error(`Unknown provider: ${platform}`);
    return new Cls(integration);
}

module.exports = { getProvider, PROVIDER_KEYS: Object.keys(PROVIDERS) };
