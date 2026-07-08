// Inspect the saved Meta Lead Ads access token: decrypt it and ask Meta what it contains.
// Usage:
//   node scripts/decodeMetaToken.js
// Requires the same env as the backend (DATABASE_URL, ENCRYPTION_KEY). If the integration
// has App ID + App Secret saved (or META_APP_ID/META_APP_SECRET in env) it also runs
// debug_token to reveal the granted scopes.
require("dotenv").config();
const prisma = require("../src/utils/prisma");
const { decrypt } = require("../src/utils/encrypt");

(async () => {
    const intg = await prisma.integration.findUnique({ where: { platform: "meta_leads" } });
    if (!intg) { console.log("No meta_leads integration found."); process.exit(0); }

    const cfg = intg.config || {};
    if (!cfg.accessToken) { console.log("No access token saved."); process.exit(0); }

    let token = cfg.accessToken;
    try { token = decrypt(token); } catch { /* stored plaintext */ }

    let appSecret = cfg.appSecret ? (() => { try { return decrypt(cfg.appSecret); } catch { return cfg.appSecret; } })() : process.env.META_APP_SECRET;
    const appId = cfg.appId || process.env.META_APP_ID;

    console.log("Token (first 12 chars):", token.slice(0, 12) + "…", "length:", token.length);

    // 1) Who does the token belong to?
    const me = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`).then(r => r.json());
    console.log("\n/me =>", me.error ? me.error.message : `${me.name} (${me.id})`);

    // 2) What scopes / type does the token have? (needs an app access token)
    if (appId && appSecret) {
        const appToken = `${appId}|${appSecret}`;
        const dbg = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${token}&access_token=${appToken}`).then(r => r.json());
        const d = dbg.data || {};
        console.log("\n── debug_token ──");
        console.log("type      :", d.type);            // USER or PAGE
        console.log("app_id    :", d.app_id);
        console.log("valid     :", d.is_valid);
        console.log("expires   :", d.expires_at ? new Date(d.expires_at * 1000).toISOString() : "never");
        console.log("scopes    :", (d.scopes || []).join(", "));
        const needed = ["leads_retrieval", "pages_manage_ads", "pages_read_engagement", "pages_show_list"];
        const missing = needed.filter(s => !(d.scopes || []).includes(s));
        console.log("\nMISSING for lead sync:", missing.length ? missing.join(", ") : "none ✅");
        if (d.type !== "PAGE") console.log("⚠️  This is a", d.type, "token — lead sync needs a PAGE token (GET /me/accounts).");
    } else {
        console.log("\n(no App ID + App Secret available — falling back to /me/permissions)");
        const perms = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${token}`).then(r => r.json());
        console.log(JSON.stringify(perms, null, 2));
    }

    // 3) List Pages this user manages + their page tokens
    console.log("\n── /me/accounts (your Pages) ──");
    const accts = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,tasks&access_token=${token}`).then(r => r.json());
    if (accts.error) {
        console.log("error:", accts.error.message);
    } else if (!(accts.data || []).length) {
        console.log("No Pages returned — this user isn't an admin of any Page (or pages_show_list was denied).");
    } else {
        for (const p of accts.data) {
            console.log(`\nPage: ${p.name} (${p.id})`);
            console.log("tasks:", (p.tasks || []).join(", ") || "none");
            console.log("PAGE TOKEN:", p.access_token);
            if (appId && appSecret) {
                const appToken = `${appId}|${appSecret}`;
                const dbg = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${p.access_token}&access_token=${appToken}`).then(r => r.json());
                console.log("page token scopes:", (dbg.data?.scopes || []).join(", "));
            }
        }
    }

    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
