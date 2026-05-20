const ProviderInterface = require("./ProviderInterface");
const { decrypt } = require("../../utils/encrypt");

class WhatsAppProvider extends ProviderInterface {
    _token() {
        const cfg = this.integration?.config || {};
        if (!cfg.accessToken) return null;
        try { return decrypt(cfg.accessToken); } catch { return cfg.accessToken; }
    }

    async validate() {
        const token = this._token();
        if (!token) return { ok: false, message: "No access token configured" };
        const cfg = this.integration?.config || {};
        if (!cfg.phoneNumberId) return { ok: false, message: "Phone Number ID not configured" };
        try {
            const res = await fetch(
                `https://graph.facebook.com/v19.0/${cfg.phoneNumberId}?access_token=${token}`
            );
            const json = await res.json();
            if (json.error) return { ok: false, message: json.error.message };
            return { ok: true, message: `Connected: ${json.display_phone_number || cfg.phoneNumberId}` };
        } catch (err) {
            return { ok: false, message: err.message };
        }
    }

    async sync() {
        const token = this._token();
        if (!token) throw new Error("Not connected — configure access token first");
        const cfg = this.integration?.config || {};
        if (!cfg.wabaId) throw new Error("WhatsApp Business Account ID not configured");

        const res = await fetch(
            `https://graph.facebook.com/v19.0/${cfg.wabaId}/message_templates?access_token=${token}`
        );
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        return { synced: (json.data || []).length, templates: json.data || [] };
    }

    async disconnect() {
        return { ok: true };
    }
}

module.exports = WhatsAppProvider;
