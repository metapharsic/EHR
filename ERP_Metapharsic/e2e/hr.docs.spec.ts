
import { test, expect } from '@playwright/test';

test.describe('HRMS Document Repository Automation', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.fill('[placeholder="Enter your ID"]', 'admin');
    await page.fill('[placeholder="••••••••"]', 'admin');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard or error
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 30000 }),
      page.waitForSelector('.text-red-600', { timeout: 30000 }).then(() => { throw new Error("Login failed"); })
    ]);
    
    // Navigate to HRMS
    await page.click('text=HRMS');
    await page.waitForSelector('text=HR Copilot');
  });

  test('searchable employee selection in documents', async ({ page }) => {
    await page.click('button:has-text("Documents")');
    
    // Check if placeholder is visible
    await expect(page.locator('text=Document Repository')).toBeVisible();
    
    // Open selector
    const selector = page.locator('text=— Select —').first();
    await selector.click();
    
    // Search for an employee
    const searchInput = page.locator('[placeholder="Search name, code, or department..."]');
    await searchInput.waitFor({ state: 'visible' });
    await searchInput.fill('EMP');
    
    // Wait for filtered list and select the first one
    const firstOption = page.locator('.custom-scrollbar div.group').first();
    await firstOption.waitFor({ state: 'visible' });
    await firstOption.click();
    
    // Check if the documents table or empty state for specific employee is shown
    await expect(page.locator('text=/No documents found for this employee|File Name/')).toBeVisible();
  });

  test('selection sync across modules', async ({ page }) => {
    // Select an employee in the main list
    await page.click('button:has-text("Employees")');
    await page.waitForTimeout(1000); // Wait for list
    
    // Click view icon on the first employee
    await page.locator('button.text-indigo-600').first().click();
    
    // Close profile drawer if it opens (optional, but good to test sync)
    // Actually, just having it selected is enough
    
    // Go to Documents
    await page.click('button:has-text("Documents")');
    
    // Check if the employee is already selected
    const selectedText = await page.locator('.truncate.text-slate-700').textContent();
    expect(selectedText).toContain('EMP');
  });
});
