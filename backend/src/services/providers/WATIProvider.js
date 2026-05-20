const ProviderInterface = require("./ProviderInterface");
const { decrypt } = require("../../utils/encrypt");
const axios = require("axios");

class WATIProvider extends ProviderInterface {
    async getAuthUrl() { return null; } // API key — no OAuth

    async validate() {
        const cfg = this.integration?.config;
        if (!cfg?.endpoint || !cfg?.token) return { ok: false, message: "WATI endpoint and token required" };
        try {
            const token = decrypt(cfg.token);
            const res = await axios.get(`${cfg.endpoint}/api/v1/getMessageTemplates`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
            });
            const approved = (res.data?.messageTemplates ?? []).filter(t => t.status === "approved").length;
            return { ok: true, message: `Connected — ${approved} approved templates` };
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            return { ok: false, message: msg };
        }
    }

    async sync() {
        const cfg = this.integration?.config;
        if (!cfg?.endpoint || !cfg?.token) throw new Error("Not configured");
        const token = decrypt(cfg.token);
        const res = await axios.get(`${cfg.endpoint}/api/v1/getMessageTemplates`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const approved = (res.data?.messageTemplates ?? []).filter(t => t.status === "approved");
        return { synced: approved.length, templates: approved.map(t => t.elementName) };
    }

    async disconnect() { return { ok: true }; }
}

module.exports = WATIProvider;
