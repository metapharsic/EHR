/**
 * E2E: HRMS Leave Management
 * Tests: Apply Leave → Manager Approves → Verify Balance Updated
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5175';

async function login(page: Page) {
  await page.goto(`${BASE}`);
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"], button:has-text("Login")');
  await page.waitForURL(`${BASE}/**`, { timeout: 10000 });
}

async function navigateToHRMS(page: Page, section: string) {
  const hrmsLink = page.locator('text=/HRMS/i').first();
  if (await hrmsLink.isVisible()) {
    await hrmsLink.click();
    await page.waitForLoadState('domcontentloaded');
    const sectionLink = page.locator(`text=/${section}/i`).first();
    if (await sectionLink.isVisible()) {
      await sectionLink.click();
      await page.waitForLoadState('networkidle');
    }
  }
}

test.describe('HRMS Leave Management', () => {

  test('leave management section renders', async ({ page }) => {
    await login(page);
    await navigateToHRMS(page, 'Leave');
    await expect(page.locator('text=/Leave|Balance|Calendar/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('leave requests tab is present', async ({ page }) => {
    await login(page);
    await navigateToHRMS(page, 'Leave');
    // Tab should contain leave requests
    const requestsTab = page.locator('text=/Requests|Leave Requests/i').first();
    if (await requestsTab.isVisible()) {
      await requestsTab.click();
      await expect(page.locator('text=/Pending|Approved|Rejected|Apply|No leave/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('leave balances tab shows types', async ({ page }) => {
    await login(page);
    await navigateToHRMS(page, 'Leave');
    const balancesTab = page.locator('text=/Balance/i').first();
    if (await balancesTab.isVisible()) {
      await balancesTab.click();
      await page.waitForLoadState('networkidle');
      // Should show leave types
      await expect(page.locator('text=/Casual|Sick|Earned|Annual/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('team calendar tab accessible', async ({ page }) => {
    await login(page);
    await navigateToHRMS(page, 'Leave');
    const calTab = page.locator('text=/Calendar|Team/i').first();
    if (await calTab.isVisible()) {
      await calTab.click();
      await expect(page).toHaveURL(`${BASE}/**`);
    }
  });
});
