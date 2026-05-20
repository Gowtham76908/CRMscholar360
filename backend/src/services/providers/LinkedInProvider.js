const ProviderInterface = require("./ProviderInterface");
const { decrypt } = require("../../utils/encrypt");
const axios = require("axios");

class LinkedInProvider extends ProviderInterface {
    async getAuthUrl() { return null; }

    async validate() {
        const cfg = this.integration?.config;
        const rawKey = cfg?.apiKey ? decrypt(cfg.apiKey) : process.env.SERPER_API_KEY;
        if (!rawKey) return { ok: false, message: "Serper API key not configured. Add SERPER_API_KEY to .env." };
        try {
            const key = rawKey;
            const res = await axios.post("https://google.serper.dev/search",
                { q: "site:linkedin.com/in test", num: 1 },
                { headers: { "X-API-KEY": key, "Content-Type": "application/json" }, timeout: 8000 }
            );
            return { ok: true, message: `Serper API connected — credits remaining` };
        } catch (err) {
            return { ok: false, message: err.response?.data?.message || err.message };
        }
    }

    async sync() { return { synced: 0 }; }
    async disconnect() { return { ok: true }; }
}

module.exports = LinkedInProvider;
