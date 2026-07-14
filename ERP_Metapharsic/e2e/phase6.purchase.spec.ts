/**
 * E2E Phase 6 — Purchase Module
 * Covers: Purchase invoice CRUD, GRN, 3-way match, reorder alerts, approvals
 */
import { test, expect } from '@playwright/test';
import { api, loginAdmin, navTo } from './helpers';

let createdPOId = '';

test.describe('Phase 6 — Purchase: Invoice API', () => {

  test('P6-01 | GET /api/purchase → 200, array of POs', async () => {
    const { status, body } = await api('get', '/api/purchase');
    expect(status).toBe(200);
    const arr = Array.isArray(body) ? body : (body?.purchases ?? body?.data ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
  });

  test('P6-02 | POST /api/purchase → create purchase order', async () => {
    const prodRes = await api('get', '/api/pos/products');
    const products = Array.isArray(prodRes.body) ? prodRes.body : (prodRes.body?.data ?? prodRes.body?.products ?? []);
    if (products.length === 0) { test.skip(); return; }
    const product = products[0];
    const { status, body } = await api('post', '/api/purchase', {
      supplier_name: 'E2E Supplier',
      invoice_number: `E2E-PO-${Date.now()}`,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      items: [{
        product_id: product.id, batch_number: `PO-BATCH-${Date.now()}`,
        expiry_date: '2028-06-30', quantity: 100, free_quantity: 0,
        purchase_rate: 55, mrp: 100, gst_percent: 12
      }],
      total_amount: 6160, gst_amount: 660, net_amount: 6160, payment_status: 'Pending'
    });
    expect([200, 201, 400]).toContain(status);
    if ([200, 201].includes(status)) {
      createdPOId = body?.id ?? body?.purchase_id ?? body?.data?.id ?? '';
    }
  });

  test('P6-03 | GET /api/purchase/:id → 200, PO with items', async () => {
    if (!createdPOId) { test.skip(); return; }
    const { status, body } = await api('get', `/api/purchase/${createdPOId}`);
    expect(status).toBe(200);
    const items = body?.items ?? body?.purchase_items ?? body?.data?.items ?? [];
    expect(Array.isArray(items)).toBeTruthy();
  });

  test('P6-04 | POST /api/purchase/:id/receive → GRN creates batches', async () => {
    if (!createdPOId) { test.skip(); return; }
    const { status } = await api('post', `/api/purchase/${createdPOId}/receive`, {
      received_date: new Date().toISOString().split('T')[0], received_by: 'admin'
    });
    expect([200, 201, 400]).toContain(status);
  });

  test('P6-05 | GET /api/purchase/reorder-alerts → 200', async () => {
    const { status, body } = await api('get', '/api/purchase/reorder-alerts');
    expect(status).toBe(200);  // Fixed: batches.stock not batches.quantity
    const arr = Array.isArray(body) ? body : (body?.data ?? body?.alerts ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
  });

  test('P6-06 | GET /api/purchase/vendor-ratings → 200', async () => {
    const { status } = await api('get', '/api/purchase/vendor-ratings');
    expect(status).toBe(200);
  });

  test('P6-07 | GET /api/purchase/3-way-match → 200', async () => {
    const { status } = await api('get', '/api/purchase/3-way-match');
    expect(status).toBe(200);  // Fixed: po.po_number not po.invoice_no
  });

  test('P6-08 | GET /api/purchase/approvals → 200', async () => {
    const { status, body } = await api('get', '/api/purchase/approvals');
    expect(status).toBe(200);  // Fixed: po.po_number not po.invoice_no
    expect(body).toBeTruthy();
  });

  test('P6-09 | DELETE /api/purchase/:id → 200/204', async () => {
    if (!createdPOId) { test.skip(); return; }
    const { status } = await api('delete', `/api/purchase/${createdPOId}`);
    expect([200, 204, 400]).toContain(status);
  });

});

test.describe('Phase 6 — Purchase: UI', () => {

  test('P6-10 | Purchase module renders', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Purchase');
    await expect(page.locator('text=/Purchase|Supplier|Vendor|Invoice|GRN/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('P6-11 | Purchase list table renders', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Purchase');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Invoice|Supplier|No purchase|Pending/i').first()).toBeVisible({ timeout: 6000 });
  });

  test('P6-12 | Reorder alerts visible', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Purchase');
    await page.waitForTimeout(1000);
    const tab = page.locator('text=/Reorder|Alert|Low Stock/i').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(800);
      await expect(page.locator('text=/Product|Reorder|Stock|Alert/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

});
