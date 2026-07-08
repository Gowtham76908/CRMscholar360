// @ts-check
import { expect } from "@playwright/test";

/**
 * The authenticated application shell: navigation rail (desktop), mobile nav,
 * and helpers shared across authed pages.
 */
export class AppShell {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.rail = page.locator("aside").first();
  }

  /** A mode button in the desktop rail, identified by its `title` label. */
  modeButton(label) {
    return this.page.locator(`aside button[title^="${label}"]`);
  }

  async expectLoaded() {
    // Rail is desktop-only (hidden md:flex); on desktop viewport it must exist.
    await expect(this.rail).toBeVisible();
  }

  async goto(pathname) {
    await this.page.goto(pathname);
  }
}
