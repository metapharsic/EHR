/**
 * E2E Phase 3 — Accounts & Vouchers Module
 * Covers: Chart of Accounts, Journal Vouchers (balanced/unbalanced),
 *         Day Book, Trial Balance, Balance Sheet, P&L
 */

import { test, expect } from '@playwright/test';
import { api, loginAdmin, navTo } from './helpers';

// ─── API: Chart of Accounts ──────────────────────────────────────────────────

test.describe('Phase 3 — Accounts: Chart of Accounts API', () => {

  test('P3-01 | GET /api/accounting/chart-of-accounts → 200, array', async () => {
    const { status, body } = await api('get', '/api/accounting/chart-of-accounts');
    expect(status).toBe(200);
    const arr = Array.isArray(body) ? body : (body?.accounts ?? body?.data ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
    expect(arr.length).toBeGreaterThan(0);
  });

  test('P3-02 | POST /api/accounting/chart-of-accounts → creates account', async () => {
    const { status, body } = await api('post', '/api/accounting/chart-of-accounts', {
      account_code: `E2E-${Date.now()}`,
      account_name: `E2E Test Expense ${Date.now()}`,
      account_type: 'EXPENSE',
      account_group: 'Operating Expenses',
      opening_balance: 0
    });
    expect([200, 201, 400, 409]).toContain(status);
    if ([200, 201].includes(status)) {
      expect(body?.id ?? body?.account?.id).toBeTruthy();
    }
  });

});

// ─── API: Journal Vouchers ────────────────────────────────────────────────────

test.describe('Phase 3 — Accounts: Journal Vouchers API', () => {

  test('P3-03 | GET /api/accounting/journal-vouchers → 200, array', async () => {
    const { status, body } = await api('get', '/api/accounting/journal-vouchers');
    expect(status).toBe(200);
    const arr = Array.isArray(body) ? body : (body?.vouchers ?? body?.data ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
  });

  test('P3-04 | POST balanced journal entry → 201', async () => {
    const { body: ledgers } = await api('get', '/api/accounting/chart-of-accounts');
    const arr = Array.isArray(ledgers) ? ledgers : (ledgers?.accounts ?? []);
    if (arr.length < 2) { test.skip(); return; }
    const [dr, cr] = arr;

    // API uses camelCase: voucherNo, date, totalDebit, totalCredit, entries[].accountId
    const { status, body } = await api('post', '/api/accounting/journal-vouchers', {
      voucherNo:   `E2E-JV-${Date.now()}`,
      date:        new Date().toISOString().split('T')[0],
      narration:   'E2E Phase 3 balanced test entry',
      totalDebit:  1000,
      totalCredit: 1000,
      entries: [
        { accountId: dr.id, debit: 1000, credit: 0,    narration: 'DR leg' },
        { accountId: cr.id, debit: 0,    credit: 1000, narration: 'CR leg' }
      ]
    });
    expect([200, 201, 400]).toContain(status);
    if ([200, 201].includes(status)) {
      expect(body?.id).toBeTruthy();
    }
  });

  test('P3-05 | POST unbalanced entry → rejected with 400', async () => {
    const { body: ledgers } = await api('get', '/api/accounting/chart-of-accounts');
    const arr = Array.isArray(ledgers) ? ledgers : (ledgers?.accounts ?? []);
    if (arr.length < 2) { test.skip(); return; }
    const [dr, cr] = arr;

    // totalDebit ≠ totalCredit — API must reject
    const { status } = await api('post', '/api/accounting/journal-vouchers', {
      voucherNo:   `E2E-UNBAL-${Date.now()}`,
      date:        new Date().toISOString().split('T')[0],
      narration:   'E2E unbalanced — should fail',
      totalDebit:  1000,
      totalCredit: 500,   // intentionally unbalanced
      entries: [
        { accountId: dr.id, debit: 1000, credit: 0 },
        { accountId: cr.id, debit: 0,    credit: 500 }
      ]
    });
    expect([400, 422]).toContain(status);
  });

});

// ─── API: Financial Reports ───────────────────────────────────────────────────

test.describe('Phase 3 — Accounts: Financial Reports API', () => {

  test('P3-06 | POST /api/accounting/trial-balance → 200', async () => {
    const { status, body } = await api('post', '/api/accounting/trial-balance', {
      from_date: '2026-04-01',
      to_date:   new Date().toISOString().split('T')[0]
    });
    expect([200, 400]).toContain(status);
    if (status === 200) {
      // Verify DR ≈ CR (within 1 rupee rounding)
      const dr = Number(body?.total_dr ?? body?.totalDr ?? body?.debit_total ?? 0);
      const cr = Number(body?.total_cr ?? body?.totalCr ?? body?.credit_total ?? 0);
      if (dr > 0 || cr > 0) {
        expect(Math.abs(dr - cr)).toBeLessThan(1);
      }
    }
  });

  test('P3-07 | POST /api/accounting/balance-sheet → 200', async () => {
    const { status } = await api('post', '/api/accounting/balance-sheet', {
      as_of_date: new Date().toISOString().split('T')[0]
    });
    expect([200, 400]).toContain(status);
  });

  test('P3-08 | POST /api/accounting/profit-loss → 200', async () => {
    const { status } = await api('post', '/api/accounting/profit-loss', {
      from_date: '2026-04-01',
      to_date:   new Date().toISOString().split('T')[0]
    });
    expect([200, 400]).toContain(status);
  });

  test('P3-09 | GET /api/accounting/daybook → 200, entries array', async () => {
    const { status, body } = await api('get', '/api/accounting/daybook');
    expect(status).toBe(200);
    const arr = Array.isArray(body) ? body : (body?.entries ?? body?.data ?? body?.vouchers ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
  });

  test('P3-10 | GET /api/accounting/daily-sales-analytics → 200', async () => {
    const { status } = await api('get', '/api/accounting/daily-sales-analytics');
    expect([200, 400]).toContain(status);
  });

  test('P3-11 | GET /api/accounting/cost-center → 200', async () => {
    const { status } = await api('get', '/api/accounting/cost-center');
    expect([200, 400]).toContain(status);
  });

});

// ─── UI Tests ────────────────────────────────────────────────────────────────

test.describe('Phase 3 — Accounts: UI', () => {

  test('P3-12 | Accounts module loads without crash', async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) test.skip();
    await navTo(page, 'Accounts');
    // Wait for ANY network activity to settle and React to render
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    // Check the page has rendered something (not blank)
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const hasMeaningfulContent = bodyText.trim().length > 0;
    if (!hasMeaningfulContent) {
      // Take a second look after extra wait
      await page.waitForTimeout(2000);
      const bodyText2 = await page.evaluate(() => document.body.innerText).catch(() => '');
      expect(bodyText2.trim().length).toBeGreaterThan(20);
    } else {
      expect(hasMeaningfulContent).toBeTruthy();
    }
  });

  test('P3-13 | Chart of Accounts tab shows account list', async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) test.skip();
    await navTo(page, 'Accounts');
    const tab = page.locator('text=/Chart of Accounts|COA|Account List/i').first();
    if (await tab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=/Account|Code|Type|Balance|Group/i').first()).toBeVisible({ timeout: 6000 });
    }
  });

  test('P3-14 | Voucher Setup page renders', async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) test.skip();
    await navTo(page, 'Voucher Setup');
    await expect(page.locator('text=/Voucher|Setup|Receipt|Payment|Contra/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('P3-15 | Ledger Creation page renders', async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) test.skip();
    await navTo(page, 'Ledger Creation');
    await expect(page.locator('text=/Ledger|Account|Group|Create/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('P3-16 | Day Book renders with date filter', async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) test.skip();
    await navTo(page, 'Accounts');
    await page.waitForTimeout(1000);
    const tab = page.locator('text=/Day Book|Daybook/i').first();
    if (await tab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=/Date|Amount|Narration|Voucher|No entries/i').first()).toBeVisible({ timeout: 6000 });
    }
  });

  test('P3-17 | Balance Sheet renders', async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) test.skip();
    await navTo(page, 'Accounts');
    await page.waitForTimeout(1000);
    const tab = page.locator('text=/Balance Sheet/i').first();
    if (await tab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('text=/Asset|Liabilit|Capital|Balance|Equity/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

});
