// @ts-check
import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES, API_URL } from "./fixtures/roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, ".auth");

/**
 * Logs in every role via the API once and persists the resulting auth token
 * cookie + user object to disk. Per-test fixtures replay these so we don't pay
 * a UI login on every test.
 */
export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const ctx = await request.newContext();

  for (const role of Object.values(ROLES)) {
    const res = await ctx.post(`${API_URL}/auth/login`, {
      data: { email: role.email, password: role.password },
    });
    if (!res.ok()) {
      throw new Error(
        `Global setup: login failed for ${role.key} (${role.email}) — HTTP ${res.status()}. ` +
          `Is the backend running on ${API_URL} and seeded?`
      );
    }
    const body = await res.json();
    const cookies = res.headers()["set-cookie"] || "";
    const tokenMatch = /token=([^;]+)/.exec(cookies);
    const token = tokenMatch ? tokenMatch[1] : body.token;

    fs.writeFileSync(
      path.join(AUTH_DIR, `${role.key}.json`),
      JSON.stringify({ user: body.user, token, cookieToken: token }, null, 2)
    );
  }

  await ctx.dispose();
}

export { AUTH_DIR };
