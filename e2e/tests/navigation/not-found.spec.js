// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

const test = authedTest("EMPLOYEE");

test.describe("Not-found handling", () => {
  test("an authenticated unknown route renders the 404 page", async ({ page }) => {
    await page.goto("/definitely-not-a-real-route-xyz");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });

  test("the 404 page offers a way back into the app", async ({ page }) => {
    await page.goto("/definitely-not-a-real-route-xyz");
    const backLink = page.getByRole("link").first();
    await expect(backLink).toBeVisible();
  });
});
