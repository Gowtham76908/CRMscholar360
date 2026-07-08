// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";
import { ROLES } from "../../fixtures/roles.js";
import { AppShell } from "../../pages/AppShell.js";

for (const role of Object.values(ROLES)) {
  const test = authedTest(role.key);

  test.describe(`Dashboard — ${role.key}`, () => {
    test(`${role.key} lands on a working dashboard`, async ({ page }) => {
      await page.goto("/dashboard");
      await new AppShell(page).expectLoaded();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.locator("main")).toBeVisible();
    });
  });
}
