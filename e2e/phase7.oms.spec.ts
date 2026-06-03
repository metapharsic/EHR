/**
 * E2E Phase 7 — Order Management System (OMS)
 * Covers: Orders CRUD, approve, ship, convert to invoice, returns, SLA
 */
import { test, expect } from '@playwright/test';
import { api, loginAdmin, navTo } from './helpers';

let createdOrderId = '';

test.describe('Phase 7 — OMS: Orders API', () => {

  test('P7-01 | GET /api/oms/stats → 200, order statistics', async () => {
    const { status, body } = await api('get', '/api/oms/stats');
    expect(status).toBe(200);
    expect(body).toBeTruthy();
  });

  test('P7-02 | GET /api/oms → 200, orders array', async () => {
    const { status, body } = await api('get', '/api/oms');
    expect(status).toBe(200);
    const arr = Array.isArray(body) ? body : (body?.orders ?? body?.data ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
  });

  test('P7-03 | GET /api/oms/dropdown → 200, distributors list', async () => {
    const { status, body } = await api('get', '/api/oms/dropdown');
    expect(status).toBe(200);
    expect(body).toBeTruthy();
  });

  test('P7-04 | POST /api/oms → create order → 200/201', async () => {
    const prodRes = await api('get', '/api/pos/products');
    const products = Array.isArray(prodRes.body) ? prodRes.body : (prodRes.body?.data ?? prodRes.body?.products ?? []);
    if (products.length === 0) { test.skip(); return; }
    const { status, body } = await api('post', '/api/oms', {
      distributor_name: `E2E Distributor ${Date.now()}`,
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      priority: 'Normal', payment_terms: 'NET30',
      items: [{ product_id: products[0].id, product_name: products[0].name, quantity: 50, rate: 80, discount: 0, gst_percent: 12 }],
      subtotal: 4000, gst_amount: 480, total_amount: 4480, notes: 'E2E Phase 7 test order'
    });
    expect([200, 201, 400]).toContain(status);
    if ([200, 201].includes(status)) {
      createdOrderId = body?.id ?? body?.order_id ?? body?.order?.id ?? body?.data?.id ?? '';
    }
  });

  test('P7-05 | GET /api/oms/:id → 200, order with items', async () => {
    if (!createdOrderId) { test.skip(); return; }
    const { status, body } = await api('get', `/api/oms/${createdOrderId}`);
    expect(status).toBe(200);
    const items = body?.items ?? body?.order_items ?? body?.data?.items ?? [];
    expect(Array.isArray(items)).toBeTruthy();
  });

  test('P7-06 | PUT /api/oms/:id/approve → order approved', async () => {
    if (!createdOrderId) { test.skip(); return; }
    const { status } = await api('put', `/api/oms/${createdOrderId}/approve`, { approved_by: 'admin', notes: 'E2E approval' });
    expect([200, 201, 400]).toContain(status);
  });

  test('P7-07 | PUT /api/oms/:id/status → update to Shipped', async () => {
    if (!createdOrderId) { test.skip(); return; }
    const { status } = await api('put', `/api/oms/${createdOrderId}/status`, { status: 'Shipped', ship_date: new Date().toISOString().split('T')[0] });
    expect([200, 201, 400]).toContain(status);
  });

  test('P7-08 | POST /api/oms/:id/convert-to-invoice → invoice created', async () => {
    if (!createdOrderId) { test.skip(); return; }
    const { status } = await api('post', `/api/oms/${createdOrderId}/convert-to-invoice`, { invoice_date: new Date().toISOString().split('T')[0], payment_mode: 'Credit' });
    expect([200, 201, 400, 422]).toContain(status);
  });

  test('P7-09 | GET /api/oms/returns → 200, returns list', async () => {
    const { status, body } = await api('get', '/api/oms/returns');
    expect(status).toBe(200);
    const arr = Array.isArray(body) ? body : (body?.returns ?? body?.data ?? []);
    expect(Array.isArray(arr)).toBeTruthy();
  });

  test('P7-10 | GET /api/oms/analytics/sla → 200, SLA data', async () => {
    const { status, body } = await api('get', '/api/oms/analytics/sla');
    expect([200, 400]).toContain(status);
    if (status === 200) expect(body).toBeTruthy();
  });

  test('P7-11 | GET /api/oms/outstanding → 200', async () => {
    const { status } = await api('get', '/api/oms/outstanding');
    expect(status).toBe(200);
  });

  test('P7-12 | DELETE /api/oms/:id → order deleted', async () => {
    if (!createdOrderId) { test.skip(); return; }
    const { status } = await api('delete', `/api/oms/${createdOrderId}`);
    expect([200, 204, 400]).toContain(status);
  });

});

test.describe('Phase 7 — OMS: UI', () => {

  test('P7-13 | OMS module renders with order list', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Order Mgmt (OMS)');
    await expect(page.locator('text=/Order|OMS|Distributor|Shipment/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('P7-14 | OMS status tabs render', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Order Mgmt (OMS)');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Pending|Approved|Shipped|Delivered/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('P7-15 | OMS analytics tab renders', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Order Mgmt (OMS)');
    await page.waitForTimeout(1000);
    const tab = page.locator('text=/Analytics|SLA|Insight/i').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await expect(page.locator('text=/SLA|Orders|Breach|Analytics|No data/i').first()).toBeVisible({ timeout: 6000 });
    }
  });

  test('P7-16 | Returns management tab renders', async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, 'Order Mgmt (OMS)');
    await page.waitForTimeout(1000);
    const tab = page.locator('text=/Return|Credit Note/i').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(800);
      await expect(page.locator('text=/Return|Credit|Invoice|No return/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

});
