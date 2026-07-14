
import { test, expect } from '@playwright/test';

test.describe('Journal Voucher Automation E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.fill('[placeholder="Enter your ID"]', 'admin');
    await page.fill('[placeholder="••••••••"]', 'Admin@1234');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard or error
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 30000 }),
      page.waitForSelector('.text-red-600', { timeout: 30000 }).then(() => { throw new Error("Login failed"); })
    ]);
    
    // Navigate to Accounts
    await page.click('text=Accounts');
    await page.waitForSelector('text=Financial Dashboard');
    
    // Open Journal Entry tab
    await page.click('text=Journal Entry');
    await page.waitForSelector('text=Journal Vouchers');
  });

  test('F2 shortcut opens new voucher form', async ({ page }) => {
    // Press F2
    await page.keyboard.press('F2');
    
    // Verify form is open
    await expect(page.locator('text=Journal Voucher Entry')).toBeVisible();
    await expect(page.locator('label:has-text("Voucher No.")')).toBeVisible();
  });

  test('apply provision template and post voucher', async ({ page }) => {
    // Press F2
    await page.keyboard.press('F2');
    
    // Click Provision template
    await page.click('button:has-text("Provision")');
    
    // Verify narration is filled
    const narrationInput = page.locator('input[placeholder="Being amount paid/received for..."]');
    await expect(narrationInput).toHaveValue(/Provision for expenses/);
    
    // Wait for accounts to load and select accounts (using first available)
    const selects = page.locator('select');
    // Row 1 Account
    await selects.nth(1).selectOption({ index: 1 }); // index 0 is Dr/Cr select? No, Row 1 Account is first.
    // Row 2 Account is at index 3 (offset by 3 selects per row)
    await selects.nth(4).selectOption({ index: 2 });
    
    // Enter amount in row 1
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('1500');
    
    // Enter in 2nd row
    const secondAmountInput = page.locator('input[type="number"]').nth(1);
    await secondAmountInput.fill('1500');
    
    // Check balanced status
    await expect(page.locator('text=Balanced')).toBeVisible();
    
    // Post (Alt+S)
    await page.keyboard.press('Alt+s');
    
    // Verify success and return to list
    await expect(page.locator('text=Voucher posted successfully')).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Journal Vouchers')).toBeVisible();
    
    // Verify it appears in the list
    await expect(page.locator('text=Provision for expenses')).toBeVisible();
  });

  test('filtering and search automation', async ({ page }) => {
    // Type in search
    const searchInput = page.locator('[placeholder="Search voucher no, narration..."]');
    await searchInput.fill('NONEXISTENT-JV');
    
    // Click Apply
    await page.click('button:has-text("Apply")');
    
    // Should see empty state
    await expect(page.locator('text=No Journal Vouchers Found')).toBeVisible();
    
    // Clear search and apply
    await searchInput.fill('');
    await page.click('button:has-text("Apply")');
    
    // Should see the table again
    await expect(page.locator('th:has-text("Voucher No")')).toBeVisible();
  });
});
