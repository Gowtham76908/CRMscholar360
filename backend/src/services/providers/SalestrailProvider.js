const ProviderInterface = require("./ProviderInterface");

class SalestrailProvider extends ProviderInterface {
    async getAuthUrl() { return null; }

    async validate() {
        const cfg = this.integration?.config;
        if (!cfg?.user || !cfg?.pass) return { ok: false, message: "Salestrail credentials required" };
        // Salestrail is webhook-based — credentials are validated when webhook is hit.
        // We just confirm they're stored.
        return { ok: true, message: "Webhook credentials configured" };
    }

    async sync() { return { synced: 0 }; }
    async disconnect() { return { ok: true }; }
}

module.exports = SalestrailProvider;
