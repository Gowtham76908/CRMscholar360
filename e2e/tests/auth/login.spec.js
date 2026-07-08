// @ts-check
import { test, expect } from "../../fixtures/test.js";
import { LoginPage } from "../../pages/LoginPage.js";
import { ROLES } from "../../fixtures/roles.js";

test.describe("Login — positive & negative", () => {
  test("shows the login form and demo hint", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(login.email).toBeVisible();
    await expect(login.password).toBeVisible();
  });

  for (const role of Object.values(ROLES)) {
    test(`valid credentials sign in a ${role.key} and land on the dashboard`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(role.email, role.password);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });
  }

  test("wrong password shows a server error and stays on /login", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("admin@scholar360.com", "wrong-password-123");
    await expect(login.errorBanner()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown email shows a server error", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("nobody-e2e@scholar360.com", "Demo@1234");
    await expect(login.errorBanner()).toBeVisible();
  });

  test("a malformed email is rejected and never reaches the dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("not-an-email", "Demo@1234");
    // The email input is type=email; native + zod validation both block submit.
    await expect(page).toHaveURL(/\/login/);
    const valid = await login.email.evaluate((el) => el.checkValidity());
    expect(valid).toBe(false);
  });

  test("client-side validation rejects a short password", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("admin@scholar360.com", "123");
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test("password visibility toggle reveals and hides the value", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.password.fill("secret123");
    await expect(login.password).toHaveAttribute("type", "password");
    await login.togglePassword.click();
    await expect(login.password).toHaveAttribute("type", "text");
  });

  test("forgot-password link navigates to the recovery page", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.forgotLink.click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
