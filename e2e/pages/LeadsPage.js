// @ts-check
export class LeadsPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.search = page.getByPlaceholder(/Search by name, phone or email/i);
    this.addLead = page.getByRole("button", { name: /Add Lead/i });
    this.leadsTab = page.getByRole("button", { name: /^Leads/ });
    this.searchLeadsTab = page.getByRole("button", { name: /Search Leads/i });
  }

  async goto() {
    await this.page.goto("/leads");
  }

  /** Any lead row links to /leads/:id */
  rows() {
    return this.page.locator('a[href^="/leads/"]');
  }

  async searchFor(term) {
    await this.search.fill(term);
    // debounced (300ms) → URL updates
    await this.page.waitForURL(/[?&]search=/, { timeout: 5000 });
  }
}
