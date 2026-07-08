// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

// Runs only under the `mobile` project (Pixel 7 viewport).
const test = authedTest("EMPLOYEE");

test.describe("Responsiveness — mobile viewport", () => {
  test("bottom mobile nav is shown and the desktop rail is hidden", async ({ page }) => {
    await page.goto("/dashboard");

    // Bottom nav (fixed, md:hidden) is visible on a phone.
    const mobileNav = page.locator("nav.fixed.bottom-0");
    await expect(mobileNav).toBeVisible();

    // Desktop rail (aside, hidden md:flex) is not visible on a phone.
    await expect(page.locator("aside").first()).toBeHidden();
  });

  test("the page does not overflow horizontally", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    // Allow a couple of px for sub-pixel rounding.
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("mobile nav can navigate to the CRM section", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("nav.fixed.bottom-0 button", { hasText: "CRM" }).click();
    await expect(page).toHaveURL(/\/leads/);
  });
});
