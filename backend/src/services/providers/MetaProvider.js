const ProviderInterface = require("./ProviderInterface");
const prisma = require("../../utils/prisma");
const { decrypt } = require("../../utils/encrypt");

class MetaProvider extends ProviderInterface {
    _token() {
        const cfg = this.integration?.config || {};
        if (!cfg.accessToken) return null;
        try { return decrypt(cfg.accessToken); } catch { return cfg.accessToken; }
    }

    async validate() {
        const token = this._token();
        if (!token) return { ok: false, message: "No access token configured" };
        try {
            const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
            const json = await res.json();
            if (json.error) return { ok: false, message: json.error.message };
            return { ok: true, message: `Connected as ${json.name}` };
        } catch (err) {
            return { ok: false, message: err.message };
        }
    }

    async sync() {
        const token = this._token();
        if (!token) throw new Error("Not connected — configure access token first");
        const cfg = this.integration?.config || {};
        const pageId = cfg.pageId;
        if (!pageId) throw new Error("No Page ID configured");

        const formsRes = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?access_token=${token}&fields=id,name`
        );
        const formsJson = await formsRes.json();
        if (formsJson.error) throw new Error(formsJson.error.message);

        let synced = 0;
        for (const form of (formsJson.data || []).slice(0, 5)) {
            const leadsRes = await fetch(
                `https://graph.facebook.com/v19.0/${form.id}/leads?access_token=${token}&fields=field_data,created_time`
            );
            const leadsJson = await leadsRes.json();
            for (const lead of leadsJson.data || []) {
                const fields = Object.fromEntries(
                    (lead.field_data || []).map(f => [f.name, (f.values || [])[0] || ""])
                );
                const existing = await prisma.lead.findFirst({
                    where: { email: fields.email || null, source: "FACEBOOK" },
                });
                if (!existing && (fields.email || fields.phone_number)) {
                    await prisma.lead.create({
                        data: {
                            name: fields.full_name || fields.first_name || "Facebook Lead",
                            email: fields.email || null,
                            phone: fields.phone_number || null,
                            source: "FACEBOOK",
                            enquiryType: "PRODUCT",
                        },
                    });
                    synced++;
                }
            }
        }
        return { synced };
    }

    async disconnect() {
        return { ok: true };
    }
}

module.exports = MetaProvider;
