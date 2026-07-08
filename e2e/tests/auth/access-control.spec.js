// @ts-check
import { test, expect } from "../../fixtures/test.js";

const PROTECTED = ["/dashboard", "/leads", "/tasks", "/settings", "/invoices", "/team"];

test.describe("Authorization — unauthenticated access", () => {
  for (const route of PROTECTED) {
    test(`unauthenticated visit to ${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  }

  test("catch-all unknown route while logged out redirects to /login", async ({ page }) => {
    await page.goto("/this-does-not-exist-xyz");
    await expect(page).toHaveURL(/\/login/);
  });
});
