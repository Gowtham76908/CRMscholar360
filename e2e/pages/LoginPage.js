// @ts-check
import { expect } from "@playwright/test";

export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.email = page.getByPlaceholder("you@company.com");
    this.password = page.getByPlaceholder("••••••••");
    this.submit = page.getByRole("button", { name: "Sign in" });
    this.forgotLink = page.getByRole("link", { name: /forgot password/i });
    this.togglePassword = page.locator('form button[type="button"]');
  }

  async goto() {
    await this.page.goto("/login");
    await expect(this.submit).toBeVisible();
  }

  async login(email, password) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  /** Error banner shown on failed login (server-side). */
  errorBanner() {
    return this.page.locator("form div.bg-red-50");
  }
}
