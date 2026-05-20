const ProviderInterface = require("./ProviderInterface");
const nodemailer = require("nodemailer");
const { decrypt } = require("../../utils/encrypt");

class EmailProvider extends ProviderInterface {
    async getAuthUrl() { return null; } // SMTP — no OAuth

    async validate() {
        if (!this.integration?.config) return { ok: false, message: "Not configured" };
        const cfg = this.integration.config;
        if (!cfg.host || !cfg.port || !cfg.user) return { ok: false, message: "Missing SMTP fields" };
        try {
            const pass = cfg.pass ? decrypt(cfg.pass) : "";
            const transporter = nodemailer.createTransporter({
                host: cfg.host,
                port: Number(cfg.port),
                secure: cfg.secure || false,
                auth: { user: cfg.user, pass },
                connectionTimeout: 8000,
            });
            await transporter.verify();
            return { ok: true, message: `SMTP connected via ${cfg.host}` };
        } catch (err) {
            return { ok: false, message: err.message };
        }
    }

    async sync() { return { synced: 0 }; }
    async disconnect() { return { ok: true }; }
}

module.exports = EmailProvider;
