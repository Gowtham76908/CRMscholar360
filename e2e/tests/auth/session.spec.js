// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

const test = authedTest("EMPLOYEE");

test.describe("Session lifecycle", () => {
  test("logout via the profile menu returns to /login and blocks back-nav", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.locator('button[title="Profile & Status"]').click();
    await page.getByRole("button", { name: "Logout" }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    // Session cleared → protected route bounces back to login.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a 401 from the API expires the session and redirects to /login", async ({ page }) => {
    // Simulate an expired/invalid token: every data API call 401s. The axios
    // interceptor dispatches `auth:logout`, which AuthContext turns into a
    // redirect. We preset the route so the first authenticated fetch trips it.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.route("**/api/**", (route) => {
      if (route.request().url().includes("/auth/login")) return route.continue();
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "TOKEN_EXPIRED", message: "jwt expired" } }),
      });
    });

    // A post-mount SPA navigation fires an authenticated fetch that now 401s.
    // The click may race with the resulting redirect (element detaches) — that
    // race is exactly the redirect we're asserting, so tolerate the click error.
    await page.locator('aside button[title^="CRM"]').click({ timeout: 3000 }).catch(() => {});
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("directly dispatched auth:logout tears the session down", async ({ page }) => {
    // Exercises the AuthContext listener wiring in isolation.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "TOKEN_EXPIRED" } }))
    );
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
