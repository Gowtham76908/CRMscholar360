// @ts-check
/**
 * @mutating — writes to the database. Excluded from the default run for shared-DB
 * safety. Run explicitly against a disposable DB:
 *
 *     RUN_MUTATING=1 npx playwright test --grep @mutating
 *
 * Strategy: create a uniquely-tagged lead via the authenticated API, verify it
 * surfaces in the Leads UI (search + detail), then delete it directly so no test
 * residue is left behind — even if an assertion fails.
 */
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL } from "../../fixtures/roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, "..", "..", "..", "backend");

/** Hard-delete a lead (and its dependent rows) via the backend's Prisma client. */
function deleteLead(id) {
  const script = `const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{try{await p.leadActivity.deleteMany({where:{leadId:'${id}'}}).catch(()=>{});await p.lead.delete({where:{id:'${id}'}});console.log('deleted');}catch(e){console.error(e.message);}finally{await p.$disconnect();}})();`;
  execFileSync("node", ["-e", script], { cwd: BACKEND_DIR, stdio: "ignore" });
}

const test = authedTest("SUPER_ADMIN");

const stamp = Date.now();
const LEAD = {
  name: `E2E Lead ${stamp}`,
  phone: `9${String(stamp).slice(-9)}`,
  email: `e2e.lead.${stamp}@example.com`,
  source: "WEBSITE",
  enquiryType: "PRODUCT",
};

test.describe("Leads CRUD @mutating", () => {
  let createdId;

  test.afterAll(() => {
    if (createdId) deleteLead(createdId);
  });

  test("create a lead via API and verify it in the Leads UI", async ({ page, request }) => {
    // CREATE
    const res = await request.post(`${API_URL}/leads`, { data: LEAD });
    expect(res.ok(), `create failed: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    createdId = body.id || body.lead?.id;
    expect(createdId).toBeTruthy();

    // READ (search surfaces the new lead)
    await page.goto(`/leads?search=${encodeURIComponent(LEAD.email)}`);
    await expect(page.getByText(LEAD.name).first()).toBeVisible({ timeout: 15000 });

    // READ detail
    await page.goto(`/leads/${createdId}`);
    await expect(page.getByText(LEAD.name).first()).toBeVisible({ timeout: 15000 });
  });

  test("validation: creating a lead without required fields is rejected", async ({ request }) => {
    const res = await request.post(`${API_URL}/leads`, { data: { name: "" } });
    expect(res.status()).toBe(400);
  });
});
