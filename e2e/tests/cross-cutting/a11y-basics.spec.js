// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

const test = authedTest("SUPER_ADMIN");

const PAGES = ["/dashboard", "/leads", "/tasks", "/settings"];

test.describe("Accessibility basics", () => {
  for (const path of PAGES) {
    test(`${path} has a document title, one main landmark and no unlabelled images`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});

      // Document has a non-empty title.
      await expect(page).not.toHaveTitle("");

      // Exactly one <main> landmark.
      await expect(page.locator("main")).toHaveCount(1);

      // Every <img> has an alt attribute (may be empty for decorative, but present).
      const imgsMissingAlt = await page.locator("img:not([alt])").count();
      expect(imgsMissingAlt, "images missing an alt attribute").toBe(0);

      // Buttons are not left with an empty accessible name en masse.
      const namelessButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.filter((b) => {
          const hasText = (b.textContent || "").trim().length > 0;
          const hasLabel = b.getAttribute("aria-label") || b.getAttribute("title");
          const hasSvg = b.querySelector("svg");
          return !hasText && !hasLabel && !hasSvg;
        }).length;
      });
      expect(namelessButtons, "buttons with no accessible name and no icon").toBe(0);
    });
  }
});
