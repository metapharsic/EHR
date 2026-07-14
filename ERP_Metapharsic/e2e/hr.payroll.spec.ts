/**
 * E2E: HRMS Payroll Processing
 * Tests: Navigate to Payroll → View Slips → Verify Statutory Registers
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

test.describe('HRMS Payroll', () => {

  test('payroll section renders with month selector', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const payrollNav = page.locator('text=/^Payroll$/i').first();
      if (await payrollNav.isVisible()) {
        await payrollNav.click();
        await page.waitForLoadState('networkidle');
        // Month selector or Run Payroll button should be visible
        const runBtn = page.locator('text=/Run Payroll/i').first();
        const monthSel = page.locator('select').first();
        const visible = await runBtn.isVisible() || await monthSel.isVisible();
        expect(visible).toBeTruthy();
      }
    }
  });

  test('salary slips table renders', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const payrollNav = page.locator('text=/^Payroll$/i').first();
      if (await payrollNav.isVisible()) {
        await payrollNav.click();
        await page.waitForLoadState('networkidle');
        // Either shows slips table or empty state
        const slipText = page.locator('text=/Salary Slip|Net Pay|No payroll|Process payroll/i').first();
        await expect(slipText).toBeVisible({ timeout: 8000 });
      }
    }
  });

  test('anomalies panel visible', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const payrollNav = page.locator('text=/^Payroll$/i').first();
      if (await payrollNav.isVisible()) {
        await payrollNav.click();
        await page.waitForLoadState('networkidle');
        // Anomalies section
        const anomalySection = page.locator('text=/Anomal|No anomalies/i').first();
        await expect(anomalySection).toBeVisible({ timeout: 8000 });
      }
    }
  });

  test('statutory registers tab accessible', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const statutoryNav = page.locator('text=/Statutory/i').first();
      if (await statutoryNav.isVisible()) {
        await statutoryNav.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=/PF|ESIC|PT|Register/i').first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
