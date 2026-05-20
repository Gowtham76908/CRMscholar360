const ProviderInterface = require("./ProviderInterface");

class WebhookProvider extends ProviderInterface {
    async getAuthUrl() { return null; }
    async validate() { return { ok: true, message: "Webhook endpoint active" }; }
    async sync() { return { synced: 0 }; }
    async disconnect() { return { ok: true }; }
}

module.exports = WebhookProvider;
