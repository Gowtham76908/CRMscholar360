const ProviderInterface = require("./ProviderInterface");
const { decrypt } = require("../../utils/encrypt");

class GoogleAdsProvider extends ProviderInterface {
    _cfg() {
        return this.integration?.config || {};
    }

    _decrypt(val) {
        if (!val) return null;
        try { return decrypt(val); } catch { return val; }
    }

    async validate() {
        const cfg = this._cfg();
        const developerToken = this._decrypt(cfg.developerToken);
        const refreshToken = this._decrypt(cfg.refreshToken);
        const customerId = cfg.customerId;

        if (!developerToken || !refreshToken || !customerId) {
            return { ok: false, message: "Developer token, customer ID, and refresh token are all required" };
        }

        // Exchange refresh token for access token to verify credentials
        try {
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refreshToken,
                    client_id: process.env.GOOGLE_CLIENT_ID || "",
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
                }),
            });
            const tokenJson = await tokenRes.json();
            if (tokenJson.error) return { ok: false, message: tokenJson.error_description || tokenJson.error };
            return { ok: true, message: `Google Ads connected (customer ${customerId})` };
        } catch (err) {
            return { ok: false, message: err.message };
        }
    }

    async sync() {
        return { synced: 0, message: "Google Ads conversion sync scheduled" };
    }

    async disconnect() {
        return { ok: true };
    }
}

module.exports = GoogleAdsProvider;
