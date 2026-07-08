// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

const test = authedTest("SUPER_ADMIN");

test.describe("Broken-link scan", () => {
  test("no dead in-app anchors (href='#' / empty) on core pages", async ({ page }) => {
    for (const path of ["/dashboard", "/leads", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      const dead = await page.$$eval("a[href]", (as) =>
        as
          .map((a) => a.getAttribute("href"))
          .filter((h) => h === "#" || h === "" || h === "javascript:void(0)")
      );
      expect(dead, `dead anchors on ${path}`).toEqual([]);
    }
  });

  test("internal links from the dashboard resolve without a 404", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    const hrefs = await page.$$eval("a[href^='/']", (as) =>
      Array.from(new Set(as.map((a) => a.getAttribute("href"))))
        .filter((h) => h && !h.startsWith("/leads/") && !h.includes(":"))
        .slice(0, 12)
    );

    for (const href of hrefs) {
      await page.goto(href);
      await expect(page, `visiting ${href}`).not.toHaveURL(/\/login/);
      await expect(page.getByText("Page not found"), `404 at ${href}`).toHaveCount(0);
    }
  });
});
