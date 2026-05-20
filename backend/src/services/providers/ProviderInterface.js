class ProviderInterface {
    constructor(integration) {
        this.integration = integration;
    }

    /** Return { authUrl } to redirect user for OAuth, or null for non-OAuth providers */
    async getAuthUrl() { throw new Error("Not implemented"); }

    /** Exchange OAuth code for tokens; return { accessToken, refreshToken, expiresAt, metadata } */
    async exchangeCode(code) { throw new Error("Not implemented"); }

    /** Refresh access token; return { accessToken, expiresAt } */
    async refresh() { throw new Error("Not implemented"); }

    /** Validate current credentials; return { ok, message } */
    async validate() { throw new Error("Not implemented"); }

    /** Pull data from provider; return { synced: Number } */
    async sync() { throw new Error("Not implemented"); }

    /** Revoke tokens and clean up */
    async disconnect() { return { ok: true }; }
}

module.exports = ProviderInterface;
