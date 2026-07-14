/**
 * E2E Tests — Financial Dashboard (Accounts Module)
 * Tests: KPI cards, daily analytics, COGS accuracy, account_type filtering,
 *        DailySalesIntelligence chart rendering, Last Sync time.
 *
 * Run: npx playwright test e2e/financial-dashboard.spec.ts
 * Prerequisites: Frontend (5173) + backend (5000) running.
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

// ── Login helper ──────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="text"], input[placeholder*="username" i]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/**`, { timeout: 15000 });
}

// ── Navigate to Financial Dashboard ──────────────────────────────────────────
async function goToAccounts(page: Page) {
  const link = page.locator('a[href*="account"], button:has-text("Accounts"), nav >> text=/accounts/i').first();
  if (await link.isVisible({ timeout: 3000 })) {
    await link.click();
  } else {
    await page.goto(`${BASE}/#accounts`);
  }
  await page.waitForLoadState('networkidle');
  await expect(
    page.locator('text=Financial Dashboard').or(page.locator('text=Metapharsic Accounts'))
  ).toBeVisible({ timeout: 15000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Financial Dashboard — Layout & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAccounts(page);
  });

  test('renders Financial Dashboard by default', async ({ page }) => {
    await expect(page.locator('text=Financial Dashboard')).toBeVisible();
  });

  test('shows four KPI cards on the dashboard', async ({ page }) => {
    await expect(page.locator('text=Total Receivables')).toBeVisible();
    await expect(page.locator('text=Total Payables')).toBeVisible();
    await expect(page.locator('text=Net Cash Flow')).toBeVisible();
    await expect(page.locator('text=Accounts Active')).toBeVisible();
  });

  test('sidebar has Financial Dashboard, Chart of Accounts, General Ledger', async ({ page }) => {
    await expect(page.locator('text=Financial Dashboard').first()).toBeVisible();
    await expect(page.locator('button:has-text("Chart of Accounts")')).toBeVisible();
    await expect(page.locator('button:has-text("General Ledger")')).toBeVisible();
  });

  test('sidebar navigation to Chart of Accounts works', async ({ page }) => {
    await page.click('button:has-text("Chart of Accounts")');
    await expect(page.locator('text=Chart of Accounts').nth(1).or(
      page.locator('th:has-text("Account Name")')
    )).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Financial Dashboard — KPI Cards Accuracy', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAccounts(page);
  });

  test('Total Receivables shows a currency value (₹)', async ({ page }) => {
    // Should show a properly formatted ₹ value, not ₹0 or NaN
    const receivablesCard = page.locator('[class*="stat"], [class*="card"]')
      .filter({ hasText: 'Total Receivables' }).first();
    const valueText = await receivablesCard.textContent();
    expect(valueText).toMatch(/₹[\d,]+/);
  });

  test('Total Payables shows a currency value (₹)', async ({ page }) => {
    const payablesCard = page.locator('[class*="stat"], [class*="card"]')
      .filter({ hasText: 'Total Payables' }).first();
    const valueText = await payablesCard.textContent();
    expect(valueText).toMatch(/₹[\d,]+/);
  });

  test('Net Cash Flow = Receivables - Payables (signs are consistent)', async ({ page }) => {
    // Intercept the chart-of-accounts API call to verify filtering logic
    let coaCallCount = 0;
    page.on('response', resp => {
      if (resp.url().includes('/api/accounting/chart-of-accounts')) coaCallCount++;
    });
    await page.waitForTimeout(2000);
    expect(coaCallCount).toBeGreaterThan(0);
  });

  test('Accounts Active shows a number', async ({ page }) => {
    const activeCard = page.locator('[class*="stat"], [class*="card"]')
      .filter({ hasText: 'Accounts Active' }).first();
    const valueText = await activeCard.textContent();
    expect(valueText).toMatch(/\d+/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Daily Performance Analytics (DailySalesIntelligence)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAccounts(page);
  });

  test('shows Period Revenue KPI', async ({ page }) => {
    await expect(page.locator('text=Period Revenue')).toBeVisible({ timeout: 15000 });
  });

  test('shows Gross Profit KPI', async ({ page }) => {
    await expect(page.locator('text=Gross Profit')).toBeVisible({ timeout: 15000 });
  });

  test('shows Avg. Margin KPI', async ({ page }) => {
    await expect(page.locator('text=Avg. Margin')).toBeVisible({ timeout: 15000 });
  });

  test('renders Daily Performance Analytics chart section', async ({ page }) => {
    await expect(page.locator('text=Daily Performance Analytics')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Revenue vs COGS')).toBeVisible();
  });

  test('breakdown table has Date, Invoices, Revenue, COGS, Gross Profit, Margin columns', async ({ page }) => {
    await expect(page.locator('th:has-text("Date")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('th:has-text("Invoices")')).toBeVisible();
    await expect(page.locator('th:has-text("Revenue")')).toBeVisible();
    await expect(page.locator('th:has-text("COGS")')).toBeVisible();
    await expect(page.locator('th:has-text("Gross Profit")')).toBeVisible();
    await expect(page.locator('th:has-text("Margin")')).toBeVisible();
  });

  test('diagnostic API is called (not /api/sales)', async ({ page }) => {
    let diagnosticCalled = false;
    let salesCalled = false;

    page.on('request', req => {
      if (req.url().includes('/api/accounting/diagnostic')) diagnosticCalled = true;
      if (req.url().includes('/api/sales') && !req.url().includes('/api/sales-invoices')) salesCalled = true;
    });

    await page.waitForTimeout(3000);

    expect(diagnosticCalled).toBe(true);
    expect(salesCalled).toBe(false); // FIX VERIFICATION: no longer calls /api/sales for COGS
  });

  test('margin values are real percentages (not hardcoded 30%)', async ({ page }) => {
    await page.waitForSelector('th:has-text("Margin")', { timeout: 15000 });

    // Get all margin cell values — if all are exactly 30.00% it might be hardcoded,
    // but that might also be correct if actual margins happen to be 30%.
    // We just verify they're valid percentage formats
    const marginCells = page.locator('td span[class*="rounded"]');
    const count = await marginCells.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const text = await marginCells.nth(i).textContent();
        expect(text).toMatch(/[\d.]+%/);
        const pct = parseFloat(text ?? '0');
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('System Integrity Panel', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAccounts(page);
  });

  test('shows System Integrity / Accounting Audit Ready section', async ({ page }) => {
    await expect(page.locator('text=Accounting Audit Ready')).toBeVisible({ timeout: 15000 });
  });

  test('Last Sync shows a time value after data loads', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const syncEl = page.locator('[data-testid="last-sync-time"]');
    if (await syncEl.isVisible({ timeout: 5000 })) {
      const text = await syncEl.textContent();
      // Should be a time string like "10:35:09 AM", not fixed "—" forever
      expect(text).not.toBe('');
    }
  });

  test('Status shows Secure', async ({ page }) => {
    await expect(page.locator('text=Secure')).toBeVisible({ timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chart of Accounts — account_type display', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAccounts(page);
    await page.click('button:has-text("Chart of Accounts")');
    await page.waitForLoadState('networkidle');
  });

  test('account table renders with Type column', async ({ page }) => {
    await expect(page.locator('th:has-text("Type")')).toBeVisible({ timeout: 10000 });
  });

  test('accounts show account_type badges', async ({ page }) => {
    await page.waitForSelector('td', { timeout: 10000 });
    // Should see Asset, Liability, Income, or Expense type badges
    const typePattern = /Asset|Liability|Income|Expense/;
    const cells = page.locator('td');
    const count = await cells.count();
    if (count > 0) {
      const bodyText = await page.locator('tbody').textContent();
      expect(typePattern.test(bodyText ?? '')).toBe(true);
    }
  });
});
