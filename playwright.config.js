// @ts-check
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Scholar360 CRM E2E suite.
 *
 * Assumes the app is already running locally:
 *   - Frontend (Vite):  http://localhost:5173
 *   - Backend  (API):   http://localhost:5001/api
 *
 * The backend talks to a *shared* remote Postgres, so the default run is
 * scoped to NON-MUTATING tests. Mutating/CRUD specs are tagged `@mutating`
 * and excluded here — run them explicitly with `--grep @mutating` against a
 * disposable database.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/.artifacts",
  globalSetup: "./e2e/global-setup.js",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/report", open: "never" }],
    ["json", { outputFile: "e2e/report/results.json" }],
  ],

  // Exclude mutating specs from the default run (shared DB safety).
  grepInvert: process.env.RUN_MUTATING ? undefined : /@mutating/,

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: "chromium",
      testIgnore: /.*\.mobile\.spec\.js/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testMatch: /.*\.mobile\.spec\.js/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
