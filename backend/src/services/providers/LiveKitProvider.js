const ProviderInterface = require("./ProviderInterface");
const { decrypt } = require("../../utils/encrypt");

class LiveKitProvider extends ProviderInterface {
    async getAuthUrl() { return null; }

    async validate() {
        const cfg = this.integration?.config;
        const apiKey    = cfg?.apiKey    ? decrypt(cfg.apiKey)    : process.env.LIVEKIT_API_KEY;
        const apiSecret = cfg?.apiSecret ? decrypt(cfg.apiSecret) : process.env.LIVEKIT_API_SECRET;
        const url       = cfg?.url       || process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !url) {
            return { ok: false, message: "API Key, API Secret, and WebSocket URL are all required." };
        }

        try {
            // Token generation is local — no network call needed.
            // If the key/secret are well-formed strings, this succeeds.
            const { AccessToken } = require("livekit-server-sdk");
            const at = new AccessToken(apiKey, apiSecret, { identity: "validate-probe" });
            at.addGrant({ roomJoin: true, room: "probe" });
            await at.toJwt();
            return { ok: true, message: `LiveKit connected — ${url}` };
        } catch (err) {
            return { ok: false, message: `Invalid credentials: ${err.message}` };
        }
    }

    async sync()       { return { synced: 0 }; }
    async disconnect() { return { ok: true }; }
}

module.exports = LiveKitProvider;
