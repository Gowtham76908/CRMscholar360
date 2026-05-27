const ProviderInterface = require("./ProviderInterface");

class GoogleAdsProvider extends ProviderInterface {
    _cfg() {
        return this.integration?.config || {};
    }

    async validate() {
        const cfg = this._cfg();
        const webhookKey = cfg.webhookKey;

        if (!webhookKey) {
            return { ok: false, message: "Webhook Key is required. Set any secret string here and use the same value in Google Ads → Lead Form → Webhook Key." };
        }

        return { ok: true, message: "Google Ads webhook configured. Paste the Webhook URL into Google Ads Lead Form Extension settings." };
    }

    async sync() {
        return { synced: 0, message: "Leads arrive automatically via webhook when users submit Google Ads Lead Forms." };
    }

    async disconnect() {
        return { ok: true };
    }
}

module.exports = GoogleAdsProvider;
