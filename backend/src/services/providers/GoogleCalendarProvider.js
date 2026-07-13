const ProviderInterface = require("./ProviderInterface");
const { decrypt } = require("../../utils/encrypt");

class GoogleCalendarProvider extends ProviderInterface {
    async getAuthUrl() { return null; }

    async validate() {
        const cfg = this.integration?.config;
        const clientId = cfg?.clientId ? decrypt(cfg.clientId) : process.env.GOOGLE_CLIENT_ID;
        const clientSecret = cfg?.clientSecret ? decrypt(cfg.clientSecret) : process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = cfg?.redirectUri || process.env.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return { ok: false, message: "Client ID, Client Secret, and Redirect URI are all required." };
        }

        return { ok: true, message: "Google Calendar Credentials Configured." };
    }

    async sync()       { return { synced: 0 }; }
    async disconnect() { return { ok: true }; }
}

module.exports = GoogleCalendarProvider;
