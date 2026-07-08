// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

// Every static, param-free protected route reachable from the app shell.
export const ROUTES = [
  "/dashboard", "/my-day", "/leads", "/kanban", "/search-leads", "/linkedin-leads",
  "/deals", "/deals/pipeline", "/duplicates", "/tasks", "/sprints", "/automations",
  "/inbox", "/messages", "/whatsapp/campaigns", "/whatsapp/auto-replies",
  "/team", "/team-management", "/team-performance", "/department-queue",
  "/department-board", "/department-staffing", "/attendance", "/team-attendance",
  "/leave", "/leaderboard", "/reports", "/revenue-report", "/ai-usage",
  "/invoices", "/finance", "/fasterq", "/integrations", "/settings",
];

const test = authedTest("SUPER_ADMIN");

test.describe("Navigation smoke — SUPER_ADMIN reaches every page", () => {
  for (const route of ROUTES) {
    test(`renders ${route} without a crash or auth bounce`, async ({ page }) => {
      // Uncaught exceptions (pageerror) are always failures — React dev
      // *warnings* logged via console.error are pre-existing app noise and are
      // asserted separately/leniently in console-errors.spec.js.
      const fatal = [];
      page.on("pageerror", (err) => fatal.push(String(err)));

      await page.goto(route);
      // Not kicked back to login.
      await expect(page).not.toHaveURL(/\/login/);
      // ErrorBoundary did not catch a render crash.
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      // A NotFound was not rendered for a known-good route.
      await expect(page.getByText("Page not found")).toHaveCount(0);

      await page.waitForLoadState("networkidle").catch(() => {});
      expect(fatal, `uncaught exceptions on ${route}:\n${fatal.join("\n")}`).toEqual([]);
    });
  }
});
