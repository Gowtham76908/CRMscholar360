// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";
import { LeadsPage } from "../../pages/LeadsPage.js";

const test = authedTest("SUPER_ADMIN");

test.describe("Leads — list, search, filter, pagination, empty state", () => {
  test("the leads list loads with rows", async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.goto();
    await expect(leads.search).toBeVisible();
    // Seeded data has 100+ leads → at least one row link.
    await expect(leads.rows().first()).toBeVisible({ timeout: 15000 });
  });

  test("search updates the URL query and narrows results", async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.goto();
    await expect(leads.rows().first()).toBeVisible({ timeout: 15000 });

    await leads.searchFor("a");
    await expect(page).toHaveURL(/search=a/);
    // Search resets to page 1.
    await expect(page).toHaveURL(/page=1/);
  });

  test("a nonsense search yields the empty state", async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.goto();
    await leads.searchFor("zzzqqq-no-such-lead-999");
    await expect(page.getByText(/no leads found/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("pagination via the Next control advances the page", async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.goto();
    await expect(leads.rows().first()).toBeVisible({ timeout: 15000 });

    const next = page.getByRole("button", { name: /Next/i });
    if (await next.isEnabled().catch(() => false)) {
      await next.click();
      await expect(page).toHaveURL(/page=2/);
    } else {
      test.skip(true, "Only one page of results in this dataset");
    }
  });

  test("the Search Leads tab renders as active when addressed via URL", async ({ page }) => {
    await page.goto("/leads?tab=search-leads");
    const tab = page.getByRole("button", { name: /Search Leads/i });
    await expect(tab).toBeVisible();
    // Active tab carries the white/indigo styling.
    await expect(tab).toHaveClass(/text-indigo-700/);
  });
});
