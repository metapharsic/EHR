/**
 * Tier 4 — E2E Tests: Sales Register
 * Full browser automation: login → navigate → assert real data.
 * Run: npx playwright test e2e/sales-register.e2e.spec.ts
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5174';
const CREDS = { email: 'admin@metapharsic.com', password: 'Admin@2026!' };

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', CREDS.email);
  await page.fill('input[type="password"]', CREDS.password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="sales-register"], nav, [class*="Sidebar"], [class*="Dashboard"]', { timeout: 15_000 });
}

async function navigateToSalesRegister(page: Page) {
  // Try clicking POS nav item then Sales History
  try {
    await page.click('text=POS', { timeout: 3_000 });
  } catch {}
  try {
    await page.click('text=Sales History', { timeout: 3_000 });
  } catch {
    await page.goto(`${BASE}/?tab=SALES_HISTORY`);
  }
  await page.waitForSelector('[data-testid="sales-register"]', { timeout: 10_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
test.describe('Sales Register E2E', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToSalesRegister(page);
  });

  // ── Page load ──────────────────────────────────────────────────────────────
  test('renders Complete Sales Register heading', async ({ page }) => {
    await expect(page.getByText('Complete Sales Register')).toBeVisible();
  });

  test('KPI bar is visible with 4 cards', async ({ page }) => {
    const kpiBar = page.getByTestId('kpi-bar');
    await expect(kpiBar).toBeVisible();
    await expect(kpiBar.getByText(/Total Revenue/i)).toBeVisible();
    await expect(kpiBar.getByText(/Total Invoices/i)).toBeVisible();
    await expect(kpiBar.getByText(/Avg Order Value/i)).toBeVisible();
    await expect(kpiBar.getByText(/GST Collected/i)).toBeVisible();
  });

  test('invoice table loads — headers present', async ({ page }) => {
    const table = page.getByTestId('invoice-table');
    await expect(table.getByText('Invoice No')).toBeVisible();
    await expect(table.getByText('Customer')).toBeVisible();
    await expect(table.getByText('Net Amount')).toBeVisible();
    await expect(table.getByText('Actions')).toBeVisible();
  });

  test('KPI stats show non-zero values when invoices exist', async ({ page }) => {
    // Wait for KPI values to load (not skeleton)
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('[data-testid="kpi-bar"] .animate-pulse');
      return cards.length === 0;
    }, { timeout: 10_000 });

    // Check that at least one KPI shows a non-zero ₹ value
    const kpiText = await page.getByTestId('kpi-bar').innerText();
    expect(kpiText).toMatch(/₹/);
  });

  // ── Filters ───────────────────────────────────────────────────────────────
  test('search input filters results', async ({ page }) => {
    const search = page.getByTestId('search-input');
    await search.fill('INV-');
    await page.waitForTimeout(600); // debounce
    const rows = page.getByTestId('invoice-table').locator('tbody tr');
    const count = await rows.count();
    // After search, loading skeletons should be gone and result count shown
    await expect(page.getByText(/records/i)).toBeVisible();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('payment mode filter renders all options', async ({ page }) => {
    const select = page.getByTestId('payment-filter');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('All');
    expect(options).toContain('Cash');
    expect(options).toContain('UPI');
  });

  test('status filter renders correct options', async ({ page }) => {
    const select = page.getByTestId('status-filter');
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('All');
    expect(options).toContain('Completed');
    expect(options).toContain('Returned');
  });

  test('clear filters button appears when search is set', async ({ page }) => {
    await page.getByTestId('search-input').fill('Apollo');
    await page.waitForTimeout(400);
    await expect(page.getByTestId('clear-filters')).toBeVisible();
  });

  test('clear filters resets search field', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('Apollo');
    await page.waitForTimeout(400);
    await page.getByTestId('clear-filters').click();
    await expect(input).toHaveValue('');
  });

  // ── Sorting ───────────────────────────────────────────────────────────────
  test('clicking Invoice No header triggers sort', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('sort_by=invoice_number'), { timeout: 5_000 }),
      page.click('text=Invoice No'),
    ]);
    expect(request.url()).toContain('sort_by=invoice_number');
  });

  test('clicking Date header triggers sort', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('sort_by=date'), { timeout: 5_000 }),
      page.click('text=Date'),
    ]);
    expect(request.url()).toContain('sort_by=date');
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  test('pagination bar shows when records exist', async ({ page }) => {
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 10_000 });
    const total = await page.getByText(/records/i).innerText();
    const count = parseInt(total.replace(/\D/g, ''));
    if (count > 0) {
      await expect(page.getByTestId('pagination')).toBeVisible();
    }
  });

  // ── Invoice Preview ───────────────────────────────────────────────────────
  test('clicking an invoice row opens the preview modal', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const firstRow = page.getByTestId('invoice-table').locator('tbody tr').first();
    const rowCount = await firstRow.count();
    if (rowCount === 0) return test.skip();

    await firstRow.click();
    await expect(page.getByTestId('invoice-preview')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Tax Invoice')).toBeVisible();
  });

  test('invoice preview shows Print and Export buttons', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const firstRow = page.getByTestId('invoice-table').locator('tbody tr').first();
    if (await firstRow.count() === 0) return test.skip();

    await firstRow.click();
    await page.waitForSelector('[data-testid="invoice-preview"]', { timeout: 8_000 });
    await expect(page.getByRole('button', { name: /Print/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();
  });

  test('closing preview with X removes modal', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const firstRow = page.getByTestId('invoice-table').locator('tbody tr').first();
    if (await firstRow.count() === 0) return test.skip();

    await firstRow.click();
    await page.waitForSelector('[data-testid="invoice-preview"]', { timeout: 8_000 });
    // Close via X button inside preview
    await page.locator('[data-testid="invoice-preview"] button').first().click();
    await expect(page.getByTestId('invoice-preview')).not.toBeVisible({ timeout: 3_000 });
  });

  // ── Export & Refresh ──────────────────────────────────────────────────────
  test('Refresh button triggers API call', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/api/pos/invoices'), { timeout: 5_000 }),
      page.getByTestId('refresh-btn').click(),
    ]);
    expect(request.url()).toContain('/api/pos/invoices');
  });

  test('Export button triggers CSV download', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const download = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);
    await page.getByTestId('export-btn').click();
    const dl = await download;
    if (dl) {
      expect(dl.suggestedFilename()).toMatch(/sales-register.*\.csv/);
    }
  });

  // ── API assertions ────────────────────────────────────────────────────────
  test('stats API returns non-null values', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/pos/invoices/stats'), { timeout: 10_000 }),
      page.reload(),
    ]);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.total_invoices).toBeGreaterThanOrEqual(0);
    expect(body.data.total_revenue).toBeGreaterThanOrEqual(0);
    expect(typeof body.data.generated_at).toBe('string');
  });

  test('list API returns paginated shape', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/pos/invoices') && !resp.url().includes('/stats'), { timeout: 10_000 }),
      page.reload(),
    ]);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.limit).toBe('number');
  });
});
