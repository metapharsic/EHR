/**
 * Integration Tests — Inventory Hub (Backend)
 * Tests: GET /inventory, POST /inventory validation, PUT validation,
 *        DELETE, GET /:id/batches, analytics comprehensive data shape,
 *        optimize endpoint correctness.
 *
 * Run: npx vitest run server/__tests__/inventory.hub.integration.test.js
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import pool from '../db.js';

// ── Mock JWT ──────────────────────────────────────────────────────────────────
vi.mock('../utils/jwt.js', () => ({
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: () => (_req, _res, next) => next(),
  verify2FAMiddleware: (_req, _res, next) => next(),
}));
vi.mock('../utils/jwt', () => ({
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: () => (_req, _res, next) => next(),
  verify2FAMiddleware: (_req, _res, next) => next(),
}));

beforeAll(async () => {
  const { createRequire } = await import('module');
  const { fileURLToPath } = await import('url');
  const { dirname, resolve } = await import('path');
  const req = createRequire(import.meta.url);
  const __dir = dirname(fileURLToPath(import.meta.url));
  const jwtPath = resolve(__dir, '../utils/jwt.js');
  const mock = {
    verifyTokenMiddleware: (r, _s, n) => { r.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' }; n(); },
    verifyRoleMiddleware: () => (_r, _s, n) => n(),
    verify2FAMiddleware: (_r, _s, n) => n(),
  };
  req.cache[jwtPath] = { id: jwtPath, filename: jwtPath, loaded: true, exports: mock, parent: null, children: [], paths: [] };
});

let app;
let testProductId;

beforeAll(async () => {
  const inventoryRouter  = (await import('../routes/inventory.js')).default;
  const analyticsRouter  = (await import('../routes/analytics.js')).default;
  app = express();
  app.use(express.json());
  app.use('/inventory', inventoryRouter);
  app.use('/analytics', analyticsRouter);
});

afterAll(async () => {
  if (testProductId) {
    await pool.query('DELETE FROM products WHERE id = $1', [testProductId]).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /inventory — list
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /inventory', () => {
  it('returns 200 with an array or data wrapper', async () => {
    const res = await request(app).get('/inventory');
    expect(res.status).toBe(200);
    const body = res.body;
    // May return raw array or { success, data: [] }
    const items = body?.data ?? body;
    expect(Array.isArray(items)).toBe(true);
  });

  it('each item has required fields for the UI', async () => {
    const res = await request(app).get('/inventory');
    const items = res.body?.data ?? res.body;
    if (!Array.isArray(items) || items.length === 0) return;

    const first = items[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('code');
    expect(first).toHaveProperty('currentStock');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /inventory — validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /inventory — validation', () => {
  const VALID_PRODUCT = {
    name: 'Test Medicine Integration',
    code: `TEST-${Date.now()}`,
    genericName: 'Test Generic',
    manufacturer: 'Test Labs',
    mrp: 100,
    purchaseRate: 60,
    sellingRate: 90,
    ptr: 80,
    pts: 75,
    taxRate: 12,
    uom: 'Strip',
    reorderLevel: 50,
    maintainBatches: true,
    trackExpiry: true,
  };

  it('creates a valid product and returns 201', async () => {
    const res = await request(app).post('/inventory').send(VALID_PRODUCT);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(VALID_PRODUCT.name);
    testProductId = res.body.data.id;
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/inventory').send({ ...VALID_PRODUCT, name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/inventory').send({ ...VALID_PRODUCT, code: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when genericName is missing', async () => {
    const res = await request(app).post('/inventory').send({ ...VALID_PRODUCT, genericName: '' });
    expect(res.status).toBe(400);
  });

  // FIX VERIFICATION: negative prices now rejected
  it('returns 422 for negative MRP', async () => {
    const res = await request(app).post('/inventory').send({
      ...VALID_PRODUCT, code: `TEST-NEG-MRP-${Date.now()}`, mrp: -10,
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/mrp.*negative|cannot be negative/i);
  });

  it('returns 422 for negative purchaseRate', async () => {
    const res = await request(app).post('/inventory').send({
      ...VALID_PRODUCT, code: `TEST-NEG-PR-${Date.now()}`, purchaseRate: -5,
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for negative sellingRate', async () => {
    const res = await request(app).post('/inventory').send({
      ...VALID_PRODUCT, code: `TEST-NEG-SR-${Date.now()}`, sellingRate: -1,
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 when taxRate > 100', async () => {
    const res = await request(app).post('/inventory').send({
      ...VALID_PRODUCT, code: `TEST-TAX-${Date.now()}`, taxRate: 150,
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 when taxRate < 0', async () => {
    const res = await request(app).post('/inventory').send({
      ...VALID_PRODUCT, code: `TEST-TAKNEG-${Date.now()}`, taxRate: -5,
    });
    expect(res.status).toBe(422);
  });

  it('accepts taxRate = 0 (zero-rated GST)', async () => {
    const res = await request(app).post('/inventory').send({
      ...VALID_PRODUCT, code: `TEST-ZERO-GST-${Date.now()}`, taxRate: 0,
    });
    expect(res.status).toBe(201);
    // Cleanup
    if (res.body.data?.id) {
      await pool.query('DELETE FROM products WHERE id = $1', [res.body.data.id]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /inventory/:id — validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('PUT /inventory/:id — validation', () => {
  it('returns 404 for non-existent product', async () => {
    const res = await request(app).put('/inventory/00000000-0000-0000-0000-000000000999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 422 for negative MRP on update', async () => {
    if (!testProductId) return;
    const res = await request(app).put(`/inventory/${testProductId}`).send({ mrp: -50 });
    expect(res.status).toBe(422);
  });

  it('updates a product successfully', async () => {
    if (!testProductId) return;
    const res = await request(app).put(`/inventory/${testProductId}`).send({
      name: 'Test Medicine Updated',
      genericName: 'Test Generic',
      code: `TEST-UPD-${Date.now()}`,
      manufacturer: 'Test Labs',
      mrp: 110,
      purchaseRate: 65,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /inventory/:id/batches
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /inventory/:id/batches', () => {
  it('returns batches array for a product', async () => {
    if (!testProductId) return;
    const res = await request(app).get(`/inventory/${testProductId}/batches`);
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
  });

  it('returns empty array for product with no batches', async () => {
    if (!testProductId) return;
    const res = await request(app).get(`/inventory/${testProductId}/batches`);
    const data = res.body?.data ?? res.body;
    // New product has no batches
    expect(data.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /inventory/:id
// ═══════════════════════════════════════════════════════════════════════════════
describe('DELETE /inventory/:id', () => {
  it('deletes an existing product', async () => {
    if (!testProductId) return;
    const res = await request(app).delete(`/inventory/${testProductId}`);
    expect([200, 204]).toContain(res.status);
    testProductId = null; // prevent afterAll double-delete
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app).delete('/inventory/00000000-0000-0000-0000-000000000999');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics — comprehensive endpoint data shape (Fix Verification)
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /analytics/inventory/comprehensive — data wrapper shape', () => {
  it('returns { success, data: { abcAnalysis, fsnAnalysis, ... } }', async () => {
    const res = await request(app).get('/analytics/inventory/comprehensive');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Must have .data wrapper — this is what InventoryHub.tsx unwraps
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('abcAnalysis');
    expect(res.body.data).toHaveProperty('fsnAnalysis');
    expect(res.body.data).toHaveProperty('vedAnalysis');
    expect(res.body.data).toHaveProperty('deadStock');
    expect(res.body.data).toHaveProperty('metadata');
    expect(res.body.data).toHaveProperty('expiryLifecycle');
  });

  it('metadata has totalValue, totalProducts fields', async () => {
    const res = await request(app).get('/analytics/inventory/comprehensive');
    const meta = res.body.data?.metadata;
    expect(meta).toHaveProperty('totalValue');
    expect(meta).toHaveProperty('totalProducts');
    expect(typeof meta.totalValue).toBe('number');
    expect(typeof meta.totalProducts).toBe('number');
  });

  it('deadStock is an array', async () => {
    const res = await request(app).get('/analytics/inventory/comprehensive');
    expect(Array.isArray(res.body.data?.deadStock)).toBe(true);
  });

  it('fsnAnalysis has fast, slow, nonMoving arrays', async () => {
    const res = await request(app).get('/analytics/inventory/comprehensive');
    const fsn = res.body.data?.fsnAnalysis;
    expect(Array.isArray(fsn.fast)).toBe(true);
    expect(Array.isArray(fsn.slow)).toBe(true);
    expect(Array.isArray(fsn.nonMoving)).toBe(true);
  });

  it('fsnAnalysis items have unitsSold field for velocity calculation', async () => {
    const res = await request(app).get('/analytics/inventory/comprehensive');
    const fast = res.body.data?.fsnAnalysis?.fast ?? [];
    for (const item of fast.slice(0, 3)) {
      expect(item).toHaveProperty('unitsSold');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /analytics/inventory/optimize
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /analytics/inventory/optimize', () => {
  it('returns { success: true } directly (not wrapped in .data)', async () => {
    const res = await request(app).post('/analytics/inventory/optimize');
    expect(res.status).toBe(200);
    // FIX VERIFICATION: response must have success at root level (not .data.success)
    expect(res.body.success).toBe(true);
    expect(res.body).not.toHaveProperty('data'); // not wrapped
    expect(res.body).toHaveProperty('processingTime');
  });

  it('processingTime is a non-negative number', async () => {
    const res = await request(app).post('/analytics/inventory/optimize');
    expect(typeof res.body.processingTime).toBe('number');
    expect(res.body.processingTime).toBeGreaterThanOrEqual(0);
  });
});
