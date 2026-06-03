/**
 * Tier 2 — Integration Tests: Sales Register
 * Tests full HTTP → Express → DB → response cycle for /api/pos/invoices endpoints.
 * Run: npx vitest run server/__tests__/sales-register.integration.test.js
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// ─── Mock JWT middleware (inject into require cache before importing server) ──
vi.mock('../utils/jwt', () => ({
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = { userId: 'test-user-1', role: 'ADMIN', companyId: 1 };
    next();
  },
  verifyRoleMiddleware: () => (_req, _res, next) => next(),
  verify2FAMiddleware: (_req, _res, next) => next(),
}));

let app;

beforeAll(async () => {
  const { default: express } = await import('express');
  const posRouter = (await import('../routes/pos.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/pos', posRouter);
});

afterAll(() => {});

// ─── GET /api/pos/invoices ────────────────────────────────────────────────────
describe('GET /api/pos/invoices', () => {
  it('returns success shape with data array and total', async () => {
    const res = await request(app).get('/api/pos/invoices').expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.limit).toBe('number');
  });

  it('paginates with page and limit params', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?page=0&limit=5')
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.limit).toBe(5);
  });

  it('filters by search term', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?search=INV')
      .expect(200);
    expect(res.body.success).toBe(true);
    res.body.data.forEach((inv) => {
      const matchesInvoice = inv.invoice_number?.toLowerCase().includes('inv');
      const matchesCustomer = inv.customer_name?.toLowerCase().includes('inv');
      expect(matchesInvoice || matchesCustomer).toBe(true);
    });
  });

  it('filters by payment_mode', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?payment_mode=Cash')
      .expect(200);
    res.body.data.forEach((inv) => {
      expect(inv.payment_mode).toBe('Cash');
    });
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?status=Completed')
      .expect(200);
    res.body.data.forEach((inv) => {
      expect(inv.status).toBe('Completed');
    });
  });

  it('sorts by net_amount asc', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?sort_by=net_amount&sort_order=asc&limit=10')
      .expect(200);
    const amounts = res.body.data.map((i) => parseFloat(i.net_amount));
    for (let j = 1; j < amounts.length; j++) {
      expect(amounts[j]).toBeGreaterThanOrEqual(amounts[j - 1]);
    }
  });

  it('rejects invalid sort_by with safe fallback (no 500)', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?sort_by=DROP+TABLE')
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('caps limit at 500', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?limit=9999')
      .expect(200);
    expect(res.body.limit).toBeLessThanOrEqual(500);
  });

  it('returns empty array for nonsense search', async () => {
    const res = await request(app)
      .get('/api/pos/invoices?search=XYZZY_NONEXISTENT_99999')
      .expect(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

// ─── GET /api/pos/invoices/stats ─────────────────────────────────────────────
describe('GET /api/pos/invoices/stats', () => {
  it('returns all required KPI fields', async () => {
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(typeof d.total_invoices).toBe('number');
    expect(typeof d.total_revenue).toBe('number');
    expect(typeof d.avg_order_value).toBe('number');
    expect(typeof d.total_gst_collected).toBe('number');
    expect(typeof d.returns_count).toBe('number');
    expect(Array.isArray(d.monthly_trend)).toBe(true);
    expect(Array.isArray(d.payment_breakdown)).toBe(true);
    expect(typeof d.generated_at).toBe('string');
  });

  it('generated_at is a valid ISO timestamp (computed at request time)', async () => {
    const before = Date.now();
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    const after = Date.now();
    const ts = new Date(res.body.data.generated_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('total_revenue >= 0', async () => {
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    expect(res.body.data.total_revenue).toBeGreaterThanOrEqual(0);
  });

  it('avg_order_value >= 0', async () => {
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    expect(res.body.data.avg_order_value).toBeGreaterThanOrEqual(0);
  });

  it('monthly_trend has at most 6 entries', async () => {
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    expect(res.body.data.monthly_trend.length).toBeLessThanOrEqual(6);
  });

  it('accepts date_from / date_to range params', async () => {
    const res = await request(app)
      .get('/api/pos/invoices/stats?date_from=2024-01-01&date_to=2024-12-31')
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/pos/invoices/:id ────────────────────────────────────────────────
describe('GET /api/pos/invoices/:id', () => {
  it('returns 404 for a non-existent ID', async () => {
    const res = await request(app)
      .get('/api/pos/invoices/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('does not confuse /stats as a UUID lookup', async () => {
    // /stats must be resolved before /:id — this verifies route ordering
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total_invoices');
  });
});

// ─── POST /api/pos/invoices/:id/return ───────────────────────────────────────
describe('POST /api/pos/invoices/:id/return', () => {
  it('returns 404 for non-existent invoice', async () => {
    const res = await request(app)
      .post('/api/pos/invoices/00000000-0000-0000-0000-000000000000/return')
      .send({ reason: 'Test return' })
      .expect(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── DELETE /api/pos/invoices/:id ────────────────────────────────────────────
describe('DELETE /api/pos/invoices/:id', () => {
  it('returns 500 (not 200) for non-existent invoice', async () => {
    const res = await request(app)
      .delete('/api/pos/invoices/00000000-0000-0000-0000-000000000000');
    expect([500, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────
describe('Sales Register Invariants', () => {
  it('total in list response >= data.length', async () => {
    const res = await request(app).get('/api/pos/invoices?limit=5').expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.data.length);
  });

  it('stats.total_invoices matches count from list endpoint', async () => {
    const [listRes, statsRes] = await Promise.all([
      request(app).get('/api/pos/invoices?limit=1'),
      request(app).get('/api/pos/invoices/stats'),
    ]);
    expect(listRes.body.total).toBe(statsRes.body.data.total_invoices);
  });

  it('payment_breakdown totals sum <= total_revenue (within rounding)', async () => {
    const res = await request(app).get('/api/pos/invoices/stats').expect(200);
    const { payment_breakdown, total_revenue } = res.body.data;
    const breakdownSum = payment_breakdown.reduce((s, b) => s + parseFloat(b.total), 0);
    expect(Math.abs(breakdownSum - total_revenue)).toBeLessThanOrEqual(1);
  });
});
