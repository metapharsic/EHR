import { test, expect } from '@playwright/test';
import { loginAdmin, navTo } from './helpers';

test.describe('GST Compliance Reports Automation', () => {
  test.beforeEach(async ({ page }) => {
    const success = await loginAdmin(page);
    if (!success) {
      console.warn('Login might have failed or 2FA is active');
    }
  });

  test('GST-E2E-01 | GSTR-3B Summary navigation and data display', async ({ page }) => {
    // Navigate to Accounts module via header button
    await page.getByRole('banner').getByRole('button', { name: /Accounts/i }).click();
    await page.waitForTimeout(1000);

    // Click GST Compliance in the Accounts sidebar
    await page.locator('text=GST Compliance').click();
    await page.waitForLoadState('networkidle');

    // Check if GSTR-3B is active by default and title is correct
    await expect(page.locator('h3:has-text("GST Compliance Reports")')).toBeVisible();
    await expect(page.locator('text=Form GSTR-3B')).toBeVisible();
    
    // Verify sections exist
    await expect(page.locator('text=3.1.a')).toBeVisible();
    await expect(page.locator('text=4.A.5')).toBeVisible();
  });

  test('GST-E2E-02 | Switch to GSTR-1 and GSTR-2 details', async ({ page }) => {
    await page.getByRole('banner').getByRole('button', { name: /Accounts/i }).click();
    await page.waitForTimeout(500);
    await page.locator('text=GST Compliance').click();

    // Switch to GSTR-1
    await page.getByRole('button', { name: /GSTR-1 \(Outward\)/i }).click();
    await expect(page.locator('text=GSTR-1 Detail')).toBeVisible();
    await expect(page.locator('th:has-text("Taxable Val")')).toBeVisible();

    // Switch to GSTR-2
    await page.getByRole('button', { name: /GSTR-2A\/2B \(Recon\)/i }).click();
    await expect(page.locator('text=GSTR-2 Detail')).toBeVisible();
  });

  test('GST-E2E-03 | Period selection updates reports', async ({ page }) => {
    await page.getByRole('banner').getByRole('button', { name: /Accounts/i }).click();
    await page.waitForTimeout(500);
    await page.locator('text=GST Compliance').click();

    // Select March 2025
    await page.selectOption('select', '3-2025');
    await page.waitForLoadState('networkidle');
    
    // Verify period text updated
    await expect(page.locator('text=Tax Period: March 2025')).toBeVisible();
  });

  test('GST-E2E-04 | Print functionality triggers new window', async ({ page }) => {
    await page.getByRole('banner').getByRole('button', { name: /Accounts/i }).click();
    await page.waitForTimeout(500);
    await page.locator('text=GST Compliance').click();

    // Trigger Print
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: /Print/i }).click()
    ]);
    
    await expect(popup).toBeDefined();
    const title = await popup.title();
    expect(title).toContain('GST Report');
  });

});
