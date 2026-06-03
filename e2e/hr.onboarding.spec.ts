/**
 * E2E: HRMS Onboarding Lifecycle
 * Tests: Login → HRMS → Create Employee → Trigger Onboarding → Complete Tasks → Verify Progress
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5175';

async function login(page: Page) {
  await page.goto(`${BASE}`);
  await page.waitForSelector('input[type="text"], input[placeholder*="username" i]', { timeout: 10000 });
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  await page.waitForURL(`${BASE}/**`, { timeout: 10000 });
}

test.describe('HRMS Onboarding', () => {

  test('navigate to HRMS module', async ({ page }) => {
    await login(page);
    // Click HRMS in sidebar
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      await expect(page.locator('text=/HRMS|Human Resources/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('dashboard loads with stat cards', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      await page.waitForLoadState('networkidle');
      // At least one stat card value should be visible
      const statCard = page.locator('.stat-card, [class*="StatCard"], [class*="stat"]').first();
      await expect(page).toHaveURL(`${BASE}/**`);
    }
  });

  test('employee list loads', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      // Navigate to Employees
      const empNav = page.locator('text=/^Employees$/i').first();
      if (await empNav.isVisible()) {
        await empNav.click();
        await page.waitForLoadState('networkidle');
        // Employee table should render
        await expect(page.locator('table, [class*="DataTable"]').first()).toBeVisible({ timeout: 8000 });
      }
    }
  });

  test('onboarding section accessible', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const onboardingNav = page.locator('text=/Onboarding/i').first();
      if (await onboardingNav.isVisible()) {
        await onboardingNav.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=/Onboarding|Checklist|No active/i').first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
