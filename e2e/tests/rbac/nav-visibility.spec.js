// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";
import { ROLES } from "../../fixtures/roles.js";
import { AppShell } from "../../pages/AppShell.js";

// The Analytics rail mode is `adminOnly` — only managers (SUPER_ADMIN / ADMIN /
// TEAM_LEADER) should see it; a plain EMPLOYEE should not.
for (const role of Object.values(ROLES)) {
  const test = authedTest(role.key);

  test.describe(`RBAC nav visibility — ${role.key}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard");
      await new AppShell(page).expectLoaded();
    });

    test(`${role.key} ${role.isManager ? "sees" : "does not see"} the Analytics mode`, async ({ page }) => {
      const shell = new AppShell(page);
      if (role.isManager) {
        await expect(shell.modeButton("Analytics")).toBeVisible();
      } else {
        await expect(shell.modeButton("Analytics")).toHaveCount(0);
      }
    });

    test(`${role.key} always sees CRM and Workload modes`, async ({ page }) => {
      const shell = new AppShell(page);
      await expect(shell.modeButton("CRM")).toBeVisible();
      await expect(shell.modeButton("Workload")).toBeVisible();
    });
  });
}
