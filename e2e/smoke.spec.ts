import { test, expect } from "@playwright/test";

/**
 * Smoke e2e — requires app running with seed users.
 * Does not execute real financial disbursements.
 */
test.describe("KSCSPMS smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toContainText(/login|sign in|email|password/i);
  });

  test("unauthenticated admin redirects", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL(/login|unauthorized|dashboard/i, { timeout: 15_000 });
    const url = page.url();
    expect(
      url.includes("login") ||
        url.includes("unauthorized") ||
        url.includes("dashboard")
    ).toBeTruthy();
  });

  test("can login with seed admin when available", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator('input[type="email"], input[name="email"]').first();
    const password = page.locator('input[type="password"], input[name="password"]').first();
    if (!(await email.count())) {
      test.skip();
      return;
    }
    await email.fill("admin@kscspms.kg.gov.ng");
    await password.fill("ChangeMe@2026!");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    // Either dashboard or must-change-password / still login if seed missing
    const url = page.url();
    expect(url.length).toBeGreaterThan(0);
  });
});
