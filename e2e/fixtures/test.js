// @ts-check
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES } from "./roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "..", ".auth");

function loadAuth(roleKey) {
  const file = path.join(AUTH_DIR, `${roleKey}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing auth state for ${roleKey}. Did global-setup run?`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Applies a role's authentication to a browser context:
 *  - sets the httpOnly-style `token` cookie so API calls are authorised
 *  - seeds sessionStorage (`user`, `token`) so the SPA restores the session
 *    (AuthContext reads sessionStorage on mount — storageState can't do this).
 */
export async function authenticateContext(context, roleKey) {
  const { user, cookieToken } = loadAuth(roleKey);

  await context.addCookies([
    {
      name: "token",
      value: cookieToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await context.addInitScript(
    ({ user, token }) => {
      try {
        sessionStorage.setItem("user", JSON.stringify(user));
        if (token) sessionStorage.setItem("token", token);
      } catch {
        /* ignore */
      }
    },
    { user, token: cookieToken }
  );

  return user;
}

/**
 * Builds a Playwright `test` object whose `page` is pre-authenticated as the
 * given role. Usage:  const test = authedTest("EMPLOYEE");
 */
export function authedTest(roleKey) {
  if (!ROLES[roleKey]) throw new Error(`Unknown role ${roleKey}`);
  return base.extend({
    roleUser: [
      async ({ context }, use) => {
        const user = await authenticateContext(context, roleKey);
        await use(user);
      },
      { auto: true },
    ],
    role: [ROLES[roleKey], { option: false }],
  });
}

// Unauthenticated test object (public/auth flows).
export const test = base;
export { expect };
