const MetaProvider = require("./MetaProvider");
const WhatsAppProvider = require("./WhatsAppProvider");
const GoogleAdsProvider = require("./GoogleAdsProvider");
const EmailProvider = require("./EmailProvider");
const LinkedInProvider = require("./LinkedInProvider");
const FasterqProvider = require("./FasterqProvider");
const WebhookProvider = require("./WebhookProvider");
const LiveKitProvider = require("./LiveKitProvider");

const PROVIDERS = {
    meta_leads:      MetaProvider,
    whatsapp_cloud:  WhatsAppProvider,
    google_ads:      GoogleAdsProvider,
    email_smtp:      EmailProvider,
    linkedin_serper: LinkedInProvider,
    fasterq:         FasterqProvider,
    website_webhook: WebhookProvider,
    livekit:         LiveKitProvider,
};

function getProvider(platform, integration) {
    const Cls = PROVIDERS[platform];
    if (!Cls) throw new Error(`Unknown provider: ${platform}`);
    return new Cls(integration);
}

module.exports = { getProvider, PROVIDER_KEYS: Object.keys(PROVIDERS) };
