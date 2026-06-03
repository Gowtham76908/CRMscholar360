/**
 * Auto-provision the database on Render deploys.
 *
 * Render's build command runs `npm install`, which triggers this hook. On a
 * fresh database the schema and login don't exist yet, so login 500s. Here we
 * generate the client, sync the schema (`db push`, since the migration history
 * has drifted), and seed (idempotent — only an empty DB is populated).
 *
 * Guards:
 *   - Only runs on Render (process.env.RENDER is set automatically there), so a
 *     local `npm install` never touches any database.
 *   - Skips if DATABASE_URL is missing.
 */
const { execSync } = require("child_process");

if (!process.env.RENDER) {
    process.exit(0); // local / CI install — do nothing
}
if (!process.env.DATABASE_URL) {
    console.warn("[postinstall] On Render but DATABASE_URL is not set — skipping schema sync/seed.");
    process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

try {
    console.log("[postinstall] Render detected — provisioning database…");
    run("npx prisma generate");
    run("npx prisma db push --skip-generate");
    run("node prisma/seed.js");
    console.log("[postinstall] Database ready (schema synced, seed ensured).");
} catch (err) {
    // Fail the build loudly so a broken DB surfaces during deploy, not at login.
    console.error("[postinstall] Database provisioning failed:", err.message);
    process.exit(1);
}
