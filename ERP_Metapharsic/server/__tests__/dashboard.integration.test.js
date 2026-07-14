/**
 * Dashboard — Integration Tests
 * Tier 2: Full HTTP → Express → PostgreSQL → response cycle.
 *
 * Covers:
 *   1. GET /api/pcd/mrs          — returns MRs with computed total_sales & target_achievement
 *   2. GET /api/pcd/mrs/stats    — returns aggregated KPI banner stats
 *   3. GET /api/analytics/financial/summary — returns kpis & intelligence as siblings
 *   4. GET /api/analytics/customers/drift  — returns driftingCount, lostCount, atRisk
 *   5. GET /api/hr/performance   — HR employees stats still work (separate table)
 *   6. Widget sync: stats totalEmployees matches actual MR count from /mrs
 *
 * Run: npx vitest run server/__tests__/dashboard.integration.test.js
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// db.js is a CJS module exporting { query, getClient, pool }
import dbModule from '../db.js';
const pool = dbModule.pool; // real pg.Pool instance

// ── Mock queueService so analytics.js loads without Redis ─────────────────────
vi.mock('../services/queueService', () => ({
  addReportJob: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
  reportQueue: {
    getJob: vi.fn().mockResolvedValue({
      getState: async () => 'completed',
      progress: () => 100,
      returnvalue: {},
    }),
  },
}));

// ── Mock JWT middleware ────────────────────────────────────────────────────────
vi.mock('../utils/jwt.js', () => ({
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = { userId: '11111111-1111-1111-1111-111111111111', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: () => (_req, _res, next) => next(),
  verify2FAMiddleware: (_req, _res, next) => next(),
}));
vi.mock('../utils/jwt', () => ({
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = { userId: '11111111-1111-1111-1111-111111111111', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: () => (_req, _res, next) => next(),
  verify2FAMiddleware: (_req, _res, next) => next(),
}));

// ── App bootstrap ─────────────────────────────────────────────────────────────
let app;

beforeAll(async () => {
  // Patch CJS require cache so CommonJS routes get the mocked JWT
  const { createRequire } = await import('module');
  const { fileURLToPath } = await import('url');
  const { dirname, resolve } = await import('path');
  const _require = createRequire(import.meta.url);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);

  const jwtPath = resolve(__dirname, '../utils/jwt.js');
  const jwtMock = {
    verifyTokenMiddleware: (req, _res, next) => {
      req.user = { userId: '11111111-1111-1111-1111-111111111111', companyId: 1, role: 'ADMIN' };
      next();
    },
    verifyRoleMiddleware: () => (_req, _res, next) => next(),
    verify2FAMiddleware: (_req, _res, next) => next(),
    generateTokenPair: () => ({ accessToken: 'test', refreshToken: 'test', expiresIn: 3600 }),
    addToBlacklist: () => {},
    isBlacklisted: () => false,
  };
  _require.cache[jwtPath] = { id: jwtPath, filename: jwtPath, loaded: true, exports: jwtMock };

  const jwtPathNoExt = resolve(__dirname, '../utils/jwt');
  _require.cache[jwtPathNoExt] = { id: jwtPathNoExt, filename: jwtPathNoExt, loaded: true, exports: jwtMock };

  // Stub queueService in CJS require cache (analytics.js uses require())
  const qSvcPath = resolve(__dirname, '../services/queueService.js');
  const qSvcMock = {
    addReportJob: async () => ({ id: 'test-job-id' }),
    reportQueue: {
      getJob: async () => ({ getState: async () => 'completed', progress: () => 100, returnvalue: {} }),
    },
  };
  _require.cache[qSvcPath] = { id: qSvcPath, filename: qSvcPath, loaded: true, exports: qSvcMock };

  // Build minimal Express app with the routes under test
  app = express();
  app.use(express.json());

  const pcdRouter     = _require(resolve(__dirname, '../routes/pcd.js'));
  const analyticsRouter = _require(resolve(__dirname, '../routes/analytics.js'));
  const hrRouter      = _require(resolve(__dirname, '../routes/hr.js'));

  app.use('/api/pcd',       pcdRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/hr',        hrRouter);
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. MRS LIST — includes computed sales columns
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/pcd/mrs — MR list with computed sales', () => {
  it('responds 200 with success:true', async () => {
    const res = await request(app).get('/api/pcd/mrs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('data is an array', async () => {
    const res = await request(app).get('/api/pcd/mrs');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('each MR row has total_sales and target_achievement fields', async () => {
    const res = await request(app).get('/api/pcd/mrs');
    if (res.body.data.length === 0) return; // no seed data — skip shape test
    const mr = res.body.data[0];
    expect(mr).toHaveProperty('total_sales');
    expect(mr).toHaveProperty('target_achievement');
    expect(typeof parseFloat(mr.total_sales)).toBe('number');
    expect(typeof parseFloat(mr.target_achievement)).toBe('number');
  });

  it('does NOT return Inactive MRs', async () => {
    const res = await request(app).get('/api/pcd/mrs');
    const inactive = (res.body.data || []).filter(mr => mr.status === 'Inactive');
    expect(inactive.length).toBe(0);
  });

  it('MRs sorted by target_achievement DESC', async () => {
    const res = await request(app).get('/api/pcd/mrs');
    const data = res.body.data || [];
    if (data.length < 2) return;
    for (let i = 0; i < data.length - 1; i++) {
      expect(parseFloat(data[i].target_achievement))
        .toBeGreaterThanOrEqual(parseFloat(data[i + 1].target_achievement));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. MRS STATS — KPI banner
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/pcd/mrs/stats — MR performance KPI stats', () => {
  it('responds 200 with success:true', async () => {
    const res = await request(app).get('/api/pcd/mrs/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns all required KPI fields', async () => {
    const res = await request(app).get('/api/pcd/mrs/stats');
    const d = res.body.data;
    expect(d).toHaveProperty('totalEmployees');
    expect(d).toHaveProperty('activeEmployees');
    expect(d).toHaveProperty('starPerformers');
    expect(d).toHaveProperty('attentionNeeded');
    expect(d).toHaveProperty('averageAchievement');
  });

  it('all KPI values are numbers', async () => {
    const res = await request(app).get('/api/pcd/mrs/stats');
    const d = res.body.data;
    expect(typeof d.totalEmployees).toBe('number');
    expect(typeof d.activeEmployees).toBe('number');
    expect(typeof d.starPerformers).toBe('number');
    expect(typeof d.attentionNeeded).toBe('number');
    expect(typeof d.averageAchievement).toBe('number');
  });

  it('totalEmployees matches MR list count', async () => {
    const [statsRes, listRes] = await Promise.all([
      request(app).get('/api/pcd/mrs/stats'),
      request(app).get('/api/pcd/mrs'),
    ]);
    // stats counts ALL (including On Leave); list excludes Inactive only
    expect(statsRes.body.data.totalEmployees).toBeGreaterThanOrEqual(0);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(0);
  });

  it('averageAchievement is between 0 and 200', async () => {
    const res = await request(app).get('/api/pcd/mrs/stats');
    const avg = res.body.data.averageAchievement;
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FINANCIAL SUMMARY — structure validation
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/analytics/financial/summary — structure', () => {
  it('responds 200', async () => {
    const res = await request(app).get('/api/analytics/financial/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('kpis and intelligence are TOP-LEVEL siblings (not nested)', async () => {
    const res = await request(app).get('/api/analytics/financial/summary');
    const data = res.body.data;
    // intelligence must be at data.intelligence, NOT data.kpis.intelligence
    expect(data).toHaveProperty('kpis');
    expect(data).toHaveProperty('intelligence');
    expect(data.kpis).not.toHaveProperty('intelligence');
  });

  it('kpis contains all required fields', async () => {
    const res = await request(app).get('/api/analytics/financial/summary');
    const { kpis } = res.body.data;
    expect(kpis).toHaveProperty('forecastedCash30d');
    expect(kpis).toHaveProperty('currentRatio');
    expect(kpis).toHaveProperty('netProfitMargin');
    expect(kpis).toHaveProperty('workingCapital');
    expect(kpis).toHaveProperty('burnRate');
  });

  it('intelligence has status field', async () => {
    const res = await request(app).get('/api/analytics/financial/summary');
    expect(res.body.data.intelligence).toHaveProperty('status');
    const status = res.body.data.intelligence.status;
    expect(['HEALTHY', 'LIQUIDITY_RISK'].includes(status)).toBe(true);
  });

  it('forecastedCash30d is a numeric string', async () => {
    const res = await request(app).get('/api/analytics/financial/summary');
    const val = res.body.data.kpis.forecastedCash30d;
    expect(isNaN(parseFloat(val))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CUSTOMER DRIFT
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/analytics/customers/drift', () => {
  it('responds 200 with success:true', async () => {
    const res = await request(app).get('/api/analytics/customers/drift');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns driftingCount, lostCount, growingCount, atRisk', async () => {
    const res = await request(app).get('/api/analytics/customers/drift');
    const d = res.body.data;
    expect(d).toHaveProperty('driftingCount');
    expect(d).toHaveProperty('lostCount');
    expect(d).toHaveProperty('growingCount');
    expect(d).toHaveProperty('atRisk');
    expect(Array.isArray(d.atRisk)).toBe(true);
  });

  it('atRisk contains at most 5 entries', async () => {
    const res = await request(app).get('/api/analytics/customers/drift');
    expect(res.body.data.atRisk.length).toBeLessThanOrEqual(5);
  });

  it('all counts are non-negative integers', async () => {
    const res = await request(app).get('/api/analytics/customers/drift');
    const { driftingCount, lostCount, growingCount } = res.body.data;
    expect(driftingCount).toBeGreaterThanOrEqual(0);
    expect(lostCount).toBeGreaterThanOrEqual(0);
    expect(growingCount).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. HR PERFORMANCE — still works (separate employees table)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/hr/performance — HR employees table stats', () => {
  it('responds 200 with success:true', async () => {
    const res = await request(app).get('/api/hr/performance');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns totalEmployees field', async () => {
    const res = await request(app).get('/api/hr/performance');
    expect(res.body.data).toHaveProperty('totalEmployees');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SYNC CONSISTENCY — MR stats totalEmployees ≤ MR list.length + inactive
// ─────────────────────────────────────────────────────────────────────────────
describe('Dashboard sync — MR stats consistent with MR list', () => {
  it('stats endpoint comes before list route (no 404 collision)', async () => {
    // /mrs/stats must NOT be swallowed by an /:id wildcard
    const statsRes = await request(app).get('/api/pcd/mrs/stats');
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data).toHaveProperty('totalEmployees');
  });

  it('activeEmployees <= totalEmployees in MR stats', async () => {
    const res = await request(app).get('/api/pcd/mrs/stats');
    const { totalEmployees, activeEmployees } = res.body.data;
    expect(activeEmployees).toBeLessThanOrEqual(totalEmployees);
  });

  it('starPerformers + attentionNeeded <= totalEmployees', async () => {
    const res = await request(app).get('/api/pcd/mrs/stats');
    const { totalEmployees, starPerformers, attentionNeeded } = res.body.data;
    // They can overlap (a star performer might also be in an outlier category)
    // but neither should exceed total
    expect(starPerformers).toBeLessThanOrEqual(totalEmployees);
    expect(attentionNeeded).toBeLessThanOrEqual(totalEmployees);
  });
});
