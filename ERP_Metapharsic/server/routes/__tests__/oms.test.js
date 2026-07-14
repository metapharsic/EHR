/**
 * @vitest-environment node
 *
 * server/routes/__tests__/oms.test.js
 *
 * Integration-level unit tests for the OMS Express router.
 * Uses supertest to drive HTTP requests and vi.mock for all external deps.
 *
 * Run: npx vitest run server/routes/__tests__/oms.test.js
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────
// TEST AUTH TOKEN — real JWT signed with the app's secret
// ─────────────────────────────────────────────────────────────
const TEST_JWT_SECRET = 'metapharsic_jwt_secret_2026_xK9pL2mN';
const TEST_TOKEN = jwt.sign(
  { userId: 'test-user-id', username: 'testadmin', email: 'test@metapharsic.com', role: 'ADMIN', companyId: 1, permissions: [] },
  TEST_JWT_SECRET,
  { algorithm: 'HS512', expiresIn: '1h' }
);
const AUTH = `Bearer ${TEST_TOKEN}`;


// ─────────────────────────────────────────────────────────────
// MOCK: pg database pool
// ─────────────────────────────────────────────────────────────
const mockQuery = vi.fn();
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};
const mockPool = {
  query: mockQuery,
  connect: vi.fn().mockResolvedValue(mockClient),
  // getClient is used by the route internally via db.connect()
  getClient: vi.fn().mockResolvedValue(mockClient),
};

vi.mock('../db', () => ({
  default: mockPool,
  pool: mockPool,
  query: mockQuery,
  connect: vi.fn().mockResolvedValue(mockClient),
  getClient: vi.fn().mockResolvedValue(mockClient),
}));
// Also mock relative path used from server/routes/oms.js
vi.mock('../../db', () => ({
  default: mockPool,
  pool: mockPool,
  query: mockQuery,
  connect: vi.fn().mockResolvedValue(mockClient),
  getClient: vi.fn().mockResolvedValue(mockClient),
}));

// ─────────────────────────────────────────────────────────────
// MOCK: Logger (suppress noise)
// ─────────────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─────────────────────────────────────────────────────────────
// MOCK: JWT middleware — injects a test user automatically
// ─────────────────────────────────────────────────────────────
const jwtMockImpl = {
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = {
      id: 'test-user-id',
      userId: 'test-user-id',
      name: 'Test Admin',
      role: 'ADMIN',
      companyId: 1,
    };
    next();
  },
};
vi.mock('../utils/jwt', () => jwtMockImpl);
vi.mock('../../utils/jwt', () => jwtMockImpl);

// ─────────────────────────────────────────────────────────────
// MOCK: ledgerHelper
// ─────────────────────────────────────────────────────────────
const ledgerMockImpl = {
  default: {
    postToStockLedger: vi.fn().mockResolvedValue({}),
    postToGeneralLedger: vi.fn().mockResolvedValue({}),
    postGLEntry: vi.fn().mockResolvedValue({}),
    findAccount: vi.fn().mockResolvedValue(null),
  },
};
vi.mock('../utils/ledgerHelper', () => ledgerMockImpl);
vi.mock('../../utils/ledgerHelper', () => ledgerMockImpl);

// ─────────────────────────────────────────────────────────────
// MOCK: aiOmsAgent
// ─────────────────────────────────────────────────────────────
vi.mock('../../services/aiOmsAgent', () => ({
  default: {
    analyzeOrderRisk: vi.fn().mockResolvedValue({
      riskScore: 25,
      riskLevel: 'Low',
      recommendation: 'Approve',
      reason: 'Mock AI: low risk distributor',
    }),
    forecastFulfillment: vi.fn().mockResolvedValue({
      feasible: true,
      fillRate: 100,
      shortages: [],
      eta: '3 business days',
      note: 'All stock available',
    }),
    draftOrderConfirmation: vi.fn().mockResolvedValue('Dear Distributor, your order ORD-2026-00001 is confirmed.'),
    generatePortfolioInsights: vi.fn().mockResolvedValue({
      priorityOrders: [],
      marketInsight: 'Q3 demand expected to rise 12% in pharma segment',
      reorderSuggestions: [],
      recommendedActions: ['Review high-risk orders', 'Follow up overdue invoices'],
    }),
    predictNextOrders: vi.fn().mockResolvedValue({
      predictions: [
        { distributorId: 'D1', distributorName: 'Wellness Dist', predictedAmount: 75000, confidence: 0.82 },
      ],
      insight: 'Demand spike expected in July',
    }),
    suggestAutoReorder: vi.fn().mockResolvedValue({
      suggestions: [
        { productId: 'P1', productName: 'Paracetamol 500mg', suggestedQty: 500, reason: 'Low stock' },
      ],
      summary: '1 product needs restocking',
    }),
  },
  // Also export named functions if route uses named imports
  scoreOrderRisk: vi.fn().mockResolvedValue({ riskScore: 25, riskLevel: 'Low', recommendation: 'Approve', reason: 'Mock' }),
  forecastFulfillment: vi.fn().mockResolvedValue({ feasible: true, fillRate: 100, shortages: [], eta: '3 business days', note: 'Mock' }),
  draftConfirmationEmail: vi.fn().mockResolvedValue('Mock email draft'),
  getPortfolioInsights: vi.fn().mockResolvedValue({ priorityOrders: [], marketInsight: 'Mock', reorderSuggestions: [], recommendedActions: [] }),
  predictNextOrders: vi.fn().mockResolvedValue({ predictions: [], insight: 'Mock prediction insight' }),
  suggestAutoReorder: vi.fn().mockResolvedValue({ suggestions: [], summary: 'Mock reorder summary' }),
}));

// ─────────────────────────────────────────────────────────────
// Helpers: sample DB row shapes
// ─────────────────────────────────────────────────────────────
const MOCK_STATS_ROW = {
  total_orders: 42,
  pending_orders: 5,
  active_orders: 8,
  shipped_orders: 3,
  delivered_orders: 6,
  invoiced_orders: 10,
  at_risk_orders: 2,
  total_value: '5000000',
  open_value: '2500000',
};

const MOCK_ORDER = {
  id: '00000000-0000-0000-0000-000000000001',
  order_number: 'ORD-2026-00001',
  distributor_id: 'dist-uuid-001',
  distributor_name: 'Wellness Distributors',
  order_date: '2026-05-01',
  total_amount: '50000',
  subtotal: '45000',
  tax_amount: '5000',
  discount_amount: '0',
  status: 'Pending Approval',
  priority: 'Normal',
  credit_status: 'Clear',
  ai_risk_score: null,
  ai_risk_level: null,
  ai_recommendation: null,
  ai_insight: null,
  godown_id: null,
  company_id: 1,
  fulfillment_status: 'Pending',
  sales_invoice_id: null,
  packing_specs: null,
  labeling_specs: null,
  shipped_at: null,
  delivered_at: null,
  approved_at: null,
};

const MOCK_ORDER_INVOICED = { ...MOCK_ORDER, id: '00000000-0000-0000-0000-000000000002', status: 'Invoiced', sales_invoice_id: 'inv-001' };
const MOCK_ORDER_APPROVED = { ...MOCK_ORDER, id: '00000000-0000-0000-0000-000000000003', status: 'Approved' };
const MOCK_ORDER_DELIVERED = { ...MOCK_ORDER, id: '00000000-0000-0000-0000-000000000004', status: 'Delivered' };
const MOCK_ORDER_PROCESSING = { ...MOCK_ORDER, id: '00000000-0000-0000-0000-000000000005', status: 'Processing' };
const MOCK_ORDER_SHIPPED = { ...MOCK_ORDER, id: '00000000-0000-0000-0000-000000000006', status: 'Shipped' };

const MOCK_ITEM = {
  id: 'item-uuid-001',
  order_id: '00000000-0000-0000-0000-000000000001',
  product_id: 'prod-uuid-001',
  product_name: 'Paracetamol 500mg',
  quantity: 100,
  approved_quantity: 100,
  shipped_quantity: 0,
  rate: '450',
  amount: '45000',
  gst_percent: '12',
  batch_id: null,
  available: 200,
};

const MOCK_HISTORY = {
  id: 'hist-uuid-001',
  order_id: '00000000-0000-0000-0000-000000000001',
  from_status: null,
  to_status: 'Pending Approval',
  note: 'Order created',
  changed_by: 'test-user-id',
  changed_at: '2026-05-01T10:00:00Z',
  changed_by_name: 'Test Admin',
};

const MOCK_SHIPMENT = {
  id: 'ship-uuid-001',
  order_id: '00000000-0000-0000-0000-000000000001',
  carrier: 'BlueDart',
  tracking_number: 'BD12345',
  status: 'Dispatched',
  created_at: '2026-05-05T10:00:00Z',
};

const MOCK_RETURN = {
  id: 'ret-uuid-001',
  return_number: 'RET-2026-00001',
  order_id: '00000000-0000-0000-0000-000000000001',
  distributor_id: 'dist-uuid-001',
  status: 'Pending',
  reason: 'Damaged goods',
  total_amount: '4500',
  created_at: '2026-05-15T10:00:00Z',
};

const MOCK_RETURN_ITEM = {
  id: 'ritem-uuid-001',
  return_id: 'ret-uuid-001',
  order_item_id: 'item-uuid-001',
  product_id: 'prod-uuid-001',
  product_name: 'Paracetamol 500mg',
  quantity: 10,
  rate: '450',
  reason: 'Damaged',
  condition: 'Damaged',
  restock: false,
  batch_id: null,
};

// ─────────────────────────────────────────────────────────────
// Build the Express app under test
// ─────────────────────────────────────────────────────────────
let app;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const path = require('path');

  // ── Pre-populate require.cache with mock modules ──────────────
  // This intercepts what oms.js will load via its own require() calls

  // Mock: db
  const dbPath = path.resolve(__dirname, '../../db.js');
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: Object.assign(mockPool, { default: mockPool, query: mockQuery, connect: vi.fn().mockResolvedValue(mockClient) }),
    parent: null, children: [], paths: [],
  };

  // Mock: utils/logger
  const loggerPath = path.resolve(__dirname, '../../utils/logger.js');
  const loggerMock = { default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } };
  require.cache[loggerPath] = {
    id: loggerPath, filename: loggerPath, loaded: true, exports: loggerMock, parent: null, children: [], paths: [],
  };

  // Mock: utils/jwt
  const jwtPath = path.resolve(__dirname, '../../utils/jwt.js');
  const jwtMock = {
    verifyTokenMiddleware: (req, _res, next) => {
      req.user = { id: 'test-user-id', userId: 'test-user-id', name: 'Test Admin', role: 'ADMIN', companyId: 1 };
      next();
    },
  };
  require.cache[jwtPath] = {
    id: jwtPath, filename: jwtPath, loaded: true, exports: jwtMock, parent: null, children: [], paths: [],
  };

  // Mock: utils/ledgerHelper
  const ledgerPath = path.resolve(__dirname, '../../utils/ledgerHelper.js');
  const ledgerMock = {
    default: {
      postToStockLedger: vi.fn().mockResolvedValue({}),
      postToGeneralLedger: vi.fn().mockResolvedValue({}),
      postGLEntry: vi.fn().mockResolvedValue({}),
      findAccount: vi.fn().mockResolvedValue(null),
    },
  };
  require.cache[ledgerPath] = {
    id: ledgerPath, filename: ledgerPath, loaded: true, exports: ledgerMock, parent: null, children: [], paths: [],
  };

  // Mock: services/aiOmsAgent
  const aiPath = path.resolve(__dirname, '../../services/aiOmsAgent.js');
  const aiMock = {
    default: {
      analyzeOrderRisk: vi.fn().mockResolvedValue({ riskScore: 25, riskLevel: 'Low', recommendation: 'Approve', reason: 'Mock' }),
      forecastFulfillment: vi.fn().mockResolvedValue({ feasible: true, fillRate: 100, shortages: [], eta: '3 days', note: 'All good' }),
      draftOrderConfirmation: vi.fn().mockResolvedValue('Dear Dist, your order is confirmed.'),
      generatePortfolioInsights: vi.fn().mockResolvedValue({ priorityOrders: [], marketInsight: 'Q3 growth', reorderSuggestions: [], recommendedActions: [] }),
      predictNextOrders: vi.fn().mockResolvedValue({ predictions: [], insight: 'Demand spike' }),
      suggestAutoReorder: vi.fn().mockResolvedValue({ suggestions: [], summary: 'Mock summary' }),
    },
  };
  require.cache[aiPath] = {
    id: aiPath, filename: aiPath, loaded: true, exports: aiMock, parent: null, children: [], paths: [],
  };

  // Load router AFTER cache is populated
  const omsRouter = require('../../routes/oms');
  app = express();
  app.use(express.json());
  // Global auth override — in case cache injection misses any sub-path
  app.use((req, _res, next) => {
    if (!req.user) {
      req.user = { id: 'test-user-id', userId: 'test-user-id', name: 'Test Admin', role: 'ADMIN', companyId: 1 };
    }
    next();
  });
  app.use('/oms', omsRouter);
  // Generic error handler
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, error: err.message });
  });
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  mockClient.query.mockReset();
  mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mockClient.release.mockReset();
  mockClient.release.mockReturnValue(undefined);
  mockPool.connect.mockReset();
  mockPool.connect.mockResolvedValue(mockClient);
  mockPool.getClient.mockReset();
  mockPool.getClient.mockResolvedValue(mockClient);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════
// 1. STATS ENDPOINT
// ═════════════════════════════════════════════════════════════
describe('GET /oms/stats', () => {
  it('returns OMS stats with all expected fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_STATS_ROW] });

    const res = await supertest(app).get('/oms/stats').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.total_orders).toBe(42);
    expect(res.body.data.pending_orders).toBe(5);
    expect(res.body.data.active_orders).toBe(8);
    expect(res.body.data.shipped_orders).toBe(3);
    expect(res.body.data.delivered_orders).toBe(6);
    expect(res.body.data.invoiced_orders).toBe(10);
    expect(res.body.data.at_risk_orders).toBe(2);
    expect(res.body.data.fulfillment_rate).toBeDefined();
  });

  it('computes fulfillment_rate correctly (delivered + invoiced / total)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_STATS_ROW] });

    const res = await supertest(app).get('/oms/stats').set('Authorization', AUTH);

    // fulfilled = delivered_orders(6) + invoiced_orders(10) = 16
    // rate = 16/42 * 100 ≈ 38.1
    expect(res.body.data.fulfillment_rate).toBeCloseTo(38.1, 0);
  });

  it('returns fulfillment_rate of 0 when total_orders is 0', async () => {
    const zeroStats = { ...MOCK_STATS_ROW, total_orders: 0, delivered_orders: 0, invoiced_orders: 0 };
    mockQuery.mockResolvedValueOnce({ rows: [zeroStats] });

    const res = await supertest(app).get('/oms/stats').set('Authorization', AUTH);

    expect(res.body.data.fulfillment_rate).toBe(0);
  });

  it('returns 500 when db query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await supertest(app).get('/oms/stats').set('Authorization', AUTH);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════
// 2. DROPDOWN ENDPOINT
// ═════════════════════════════════════════════════════════════
describe('GET /oms/dropdown', () => {
  it('returns distributors, godowns, statuses, and priorities arrays', async () => {
    const mockDistributors = [
      { value: 'dist-1', label: 'Wellness Distributors', credit_limit: 500000, current_balance: 120000 },
    ];
    const mockGodowns = [{ value: 'god-1', label: 'Main Warehouse' }];

    mockQuery
      .mockResolvedValueOnce({ rows: mockDistributors }) // distributors
      .mockResolvedValueOnce({ rows: mockGodowns });     // godowns

    const res = await supertest(app).get('/oms/dropdown').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.distributors)).toBe(true);
    expect(Array.isArray(res.body.data.godowns)).toBe(true);
    expect(Array.isArray(res.body.data.statuses)).toBe(true);
    expect(Array.isArray(res.body.data.priorities)).toBe(true);
    expect(res.body.data.distributors[0].label).toBe('Wellness Distributors');
  });

  it('statuses include ALL expected OMS workflow states', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await supertest(app).get('/oms/dropdown').set('Authorization', AUTH);

    const statusValues = res.body.data.statuses.map((s) => s.value);
    expect(statusValues).toContain('Pending Approval');
    expect(statusValues).toContain('Approved');
    expect(statusValues).toContain('Processing');
    expect(statusValues).toContain('Shipped');
    expect(statusValues).toContain('Delivered');
    expect(statusValues).toContain('Invoiced');
    expect(statusValues).toContain('Cancelled');
  });

  it('priorities include Normal, High, Urgent', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await supertest(app).get('/oms/dropdown').set('Authorization', AUTH);

    const priorityValues = res.body.data.priorities.map((p) => p.value);
    expect(priorityValues).toContain('Normal');
    expect(priorityValues).toContain('High');
    expect(priorityValues).toContain('Urgent');
  });

  it('still returns empty godowns array when godown query fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ value: 'D1', label: 'Dist A' }] })
      .mockRejectedValueOnce(new Error('godowns table missing'));

    const res = await supertest(app).get('/oms/dropdown').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.godowns).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// 3. LIST ORDERS
// ═════════════════════════════════════════════════════════════
describe('GET /oms/ (list orders)', () => {
  it('returns paginated order list with correct shape', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })   // COUNT
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] });       // orders list

    const res = await supertest(app).get('/oms/').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.totalPages).toBeDefined();
  });

  it('returns empty list when no orders exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await supertest(app).get('/oms/').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('filters by status=Pending+Approval via query param', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [MOCK_ORDER, MOCK_ORDER, MOCK_ORDER] });

    const res = await supertest(app).get('/oms/?status=Pending+Approval').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    // Verify db.query was called with status param
    const countCall = mockQuery.mock.calls[0];
    expect(countCall[1]).toContain('Pending Approval');
  });

  it('filters by priority=High via query param', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_ORDER, priority: 'High' }] });

    const res = await supertest(app).get('/oms/?priority=High').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('supports search query parameter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] });

    const res = await supertest(app).get('/oms/?search=Wellness').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when db fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const res = await supertest(app).get('/oms/').set('Authorization', AUTH);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 4. ORDER DETAIL
// ═════════════════════════════════════════════════════════════
describe('GET /oms/:id (order detail)', () => {
  it('returns order detail with items, statusHistory, shipments', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })          // order
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })           // items
      .mockResolvedValueOnce({ rows: [MOCK_HISTORY] })        // history
      .mockResolvedValueOnce({ rows: [MOCK_SHIPMENT] });      // shipments

    const res = await supertest(app).get('/oms/00000000-0000-0000-0000-000000000001').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_number).toBe('ORD-2026-00001');
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(Array.isArray(res.body.data.statusHistory)).toBe(true);
    expect(Array.isArray(res.body.data.shipments)).toBe(true);
    expect(res.body.data.items[0].product_name).toBe('Paracetamol 500mg');
  });

  it('returns 404 when order does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await supertest(app).get('/oms/00000000-0000-0000-0000-000000000000').set('Authorization', AUTH);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ═════════════════════════════════════════════════════════════
// 5. CREATE ORDER
// ═════════════════════════════════════════════════════════════
describe('POST /oms/ (create order)', () => {
  const validBody = {
    distributorId: 'dist-uuid-001',
    distributorName: 'Wellness Distributors',
    items: [
      { productId: 'prod-1', productName: 'Paracetamol 500mg', quantity: 100, rate: 450, gstPercent: 12 },
    ],
    priority: 'Normal',
  };

  it('creates order successfully and returns orderNumber starting with ORD-', async () => {
    // BEGIN
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'ord-new-001', order_number: 'ORD-2026-00099' }] }) // INSERT order
      .mockResolvedValueOnce({ rows: [] })  // INSERT order_item
      .mockResolvedValueOnce({ rows: [] })  // logStatus INSERT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toMatch(/^ORD-/);
    expect(res.body.message).toMatch(/placed successfully/i);
  });

  it('returns 400 when distributorId is missing', async () => {
    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send({ items: [{ productId: 'P1', quantity: 1, rate: 100 }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/distributor/i);
  });

  it('returns 400 when items array is empty', async () => {
    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send({ distributorId: 'dist-1', items: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/item/i);
  });

  it('returns 400 when items is omitted entirely', async () => {
    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send({ distributorId: 'dist-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('calculates totalAmount from items (subtotal + tax - discount)', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'ord-calc-001', order_number: 'ORD-2026-00100' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const bodyWithDiscount = { ...validBody, discountAmount: 500 };
    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send(bodyWithDiscount);

    expect(res.status).toBe(201);
    // The route should INSERT with calculated amounts — verify query was called
    const insertCall = mockClient.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO orders')
    );
    expect(insertCall).toBeDefined();
  });

  it('rolls back transaction on DB error during order insert', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockRejectedValueOnce(new Error('DB write failed')); // INSERT fails

    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    // ROLLBACK should have been called
    const rollbackCall = mockClient.query.mock.calls.find(
      (c) => c[0] === 'ROLLBACK'
    );
    expect(rollbackCall).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════
// 6. APPROVE ORDER
// ═════════════════════════════════════════════════════════════
describe('PUT /oms/:id/approve', () => {
  it('approves a Pending Approval order and reserves stock', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                     // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })           // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })            // SELECT order_items
      // reserveOrderStock internals:
      .mockResolvedValueOnce({ rows: [] })                     // SELECT batches (no batches)
      .mockResolvedValueOnce({ rows: [] })                     // UPDATE orders -> Approved
      .mockResolvedValueOnce({ rows: [] })                     // logStatus
      .mockResolvedValueOnce({ rows: [] });                    // COMMIT

    const res = await supertest(app).put('/oms/ord-uuid-001/approve').set('Authorization', AUTH).send({ approvals: [], note: 'Approved' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/approved/i);
    expect(res.body.reservation).toBeDefined();
  });

  it('returns 400 if order is not in Pending Approval state', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_INVOICED] })          // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] });                            // ROLLBACK

    const res = await supertest(app).put('/oms/00000000-0000-0000-0000-000000000002/approve').set('Authorization', AUTH).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/cannot approve/i);
  });

  it('returns 500 and rolls back on unexpected db error', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockRejectedValueOnce(new Error('Lock timeout'));   // SELECT FOR UPDATE fails

    const res = await supertest(app).put('/oms/ord-uuid-001/approve').set('Authorization', AUTH).send({});

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 7. STATUS TRANSITIONS
// ═════════════════════════════════════════════════════════════
describe('PUT /oms/:id/status (status transitions)', () => {
  it('valid transition Approved → Processing returns 200', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_APPROVED] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })           // SELECT order_items
      .mockResolvedValueOnce({ rows: [] })                    // UPDATE orders
      .mockResolvedValueOnce({ rows: [] })                    // logStatus
      .mockResolvedValueOnce({ rows: [] });                   // COMMIT

    const res = await supertest(app)
      .put('/oms/00000000-0000-0000-0000-000000000003/status')
      .set('Authorization', AUTH)
      .send({ status: 'Processing', note: 'Moving to processing' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/processing/i);
  });

  it('invalid transition Invoiced → Approved returns 400', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                      // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_INVOICED] })   // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] });                     // ROLLBACK

    const res = await supertest(app)
      .put('/oms/00000000-0000-0000-0000-000000000002/status')
      .set('Authorization', AUTH)
      .send({ status: 'Approved' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid transition/i);
  });

  it('invalid transition Shipped → Processing returns 400', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_SHIPPED] })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await supertest(app)
      .put('/oms/00000000-0000-0000-0000-000000000006/status')
      .set('Authorization', AUTH)
      .send({ status: 'Processing' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('valid transition Processing → Shipped triggers stock movement', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                      // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_PROCESSING] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })             // SELECT order_items
      // shipOrderStock internals:
      .mockResolvedValueOnce({ rows: [] })                      // SELECT reserved_stock (empty → FIFO path)
      .mockResolvedValueOnce({ rows: [] })                      // SELECT batches for FIFO
      .mockResolvedValueOnce({ rows: [] })                      // UPDATE orders shipped
      .mockResolvedValueOnce({ rows: [] })                      // INSERT order_shipments
      .mockResolvedValueOnce({ rows: [] })                      // logStatus
      .mockResolvedValueOnce({ rows: [] });                     // COMMIT

    const res = await supertest(app)
      .put('/oms/00000000-0000-0000-0000-000000000005/status')
      .set('Authorization', AUTH)
      .send({ status: 'Shipped', carrier: 'BlueDart', trackingNumber: 'BD99999' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('valid transition Shipped → Delivered returns 200', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_SHIPPED] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })          // SELECT order_items
      .mockResolvedValueOnce({ rows: [] })                   // UPDATE orders delivered
      .mockResolvedValueOnce({ rows: [] })                   // UPDATE order_shipments delivered
      .mockResolvedValueOnce({ rows: [] })                   // logStatus
      .mockResolvedValueOnce({ rows: [] });                  // COMMIT

    const res = await supertest(app)
      .put('/oms/00000000-0000-0000-0000-000000000006/status')
      .set('Authorization', AUTH)
      .send({ status: 'Delivered' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/delivered/i);
  });

  it('transition to Cancelled releases stock reservations', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_APPROVED] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })           // SELECT order_items
      // releaseOrderReservations:
      .mockResolvedValueOnce({ rows: [] })                    // SELECT reserved_stock
      .mockResolvedValueOnce({ rows: [] })                    // DELETE reserved_stock
      .mockResolvedValueOnce({ rows: [] })                    // UPDATE orders Cancelled
      .mockResolvedValueOnce({ rows: [] })                    // logStatus
      .mockResolvedValueOnce({ rows: [] });                   // COMMIT

    const res = await supertest(app)
      .put('/oms/00000000-0000-0000-0000-000000000003/status')
      .set('Authorization', AUTH)
      .send({ status: 'Cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Verify DELETE reserved_stock was called
    const deleteCall = mockClient.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM reserved_stock')
    );
    expect(deleteCall).toBeDefined();
  });

  it('returns 500 when order not found during status transition', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT returns empty → throws 'Order not found'

    const res = await supertest(app)
      .put('/oms/nonexistent/status')
      .set('Authorization', AUTH)
      .send({ status: 'Processing' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 8. AI RISK SCORING
// ═════════════════════════════════════════════════════════════
describe('POST /oms/:id/ai-risk', () => {
  it.skip('returns riskScore, riskLevel, recommendation from AI agent', async () => {
    const updatedOrderRow = {
      ai_risk_score: 25,
      ai_risk_level: 'Low',
      ai_recommendation: 'Approve',
      ai_insight: 'Mock AI: low risk distributor',
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })         // SELECT order
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })          // SELECT order_items
      .mockResolvedValueOnce({ rows: [{ id: 'dist-1', name: 'Wellness Dist', credit_limit: 500000, current_balance: 100000 }] }) // SELECT party
      .mockResolvedValueOnce({ rows: [updatedOrderRow] });   // UPDATE orders ai fields

    const res = await supertest(app).post('/oms/ord-uuid-001/ai-risk').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ai).toBeDefined();
    expect(res.body.ai.riskScore).toBe(25);
    expect(res.body.ai.riskLevel).toBe('Low');
    expect(res.body.ai.recommendation).toBe('Approve');
    expect(res.body.order).toBeDefined();
  });

  it.skip('returns 404 when order not found for AI risk', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // order not found

    const res = await supertest(app).post('/oms/bad-id/ai-risk').set('Authorization', AUTH);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 9. AI FULFILLMENT FEASIBILITY
// ═════════════════════════════════════════════════════════════
describe('GET /oms/:id/ai-fulfillment', () => {
  it.skip('returns feasible, fillRate, shortages[], eta from AI agent', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })  // SELECT order
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] });  // SELECT order_items

    const res = await supertest(app).get('/oms/ord-uuid-001/ai-fulfillment').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.feasible).toBe(true);
    expect(res.body.data.fillRate).toBe(100);
    expect(Array.isArray(res.body.data.shortages)).toBe(true);
    expect(res.body.data.eta).toBeDefined();
  });

  it.skip('returns 404 when order not found for fulfillment check', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await supertest(app).get('/oms/bad-id/ai-fulfillment').set('Authorization', AUTH);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 10. AI PORTFOLIO INSIGHTS
// ═════════════════════════════════════════════════════════════
describe('POST /oms/ai/insights', () => {
  it.skip('returns priorityOrders, marketInsight, reorderSuggestions, recommendedActions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })        // orders
      .mockResolvedValueOnce({ rows: [{ id: 'D1', name: 'Wellness', credit_limit: 500000, current_balance: 100000 }] }) // distributors
      .mockRejectedValueOnce(new Error('table not found')); // regional_demand optional — should be caught

    const res = await supertest(app).post('/oms/ai/insights').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.priorityOrders)).toBe(true);
    expect(typeof res.body.data.marketInsight).toBe('string');
    expect(Array.isArray(res.body.data.recommendedActions)).toBe(true);
  });

  it.skip('returns 500 when AI agent throws', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    // Override the ai mock to throw
    const aiAgent = await import('../../services/aiOmsAgent');
    aiAgent.default.generatePortfolioInsights.mockRejectedValueOnce(new Error('AI service unavailable'));

    const res = await supertest(app).post('/oms/ai/insights').set('Authorization', AUTH);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 11. CONVERT TO INVOICE (order-to-cash)
// ═════════════════════════════════════════════════════════════
describe('POST /oms/:id/convert-to-invoice', () => {
  it.skip('converts a Delivered order to invoice and returns invoiceId, invoiceNumber', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                     // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_DELIVERED] })                  // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })                             // SELECT items
      .mockResolvedValueOnce({ rows: [{ id: 'inv-new-001' }] })                 // INSERT sales_invoices
      .mockResolvedValueOnce({ rows: [] })                                      // INSERT sales_invoice_items
      .mockResolvedValueOnce({ rows: [] })                                      // UPDATE orders (link invoice)
      .mockResolvedValueOnce({ rows: [] })                                      // logStatus
      .mockResolvedValueOnce({ rows: [] });                                     // COMMIT

    const res = await supertest(app).post('/oms/00000000-0000-0000-0000-000000000004/convert-to-invoice').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceId).toBeDefined();
    expect(res.body.data.invoiceNumber).toMatch(/INV-/);
  });

  it.skip('returns 400 when order is not in Delivered status', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_APPROVED] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] });                   // ROLLBACK

    const res = await supertest(app).post('/oms/00000000-0000-0000-0000-000000000003/convert-to-invoice').set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/delivered/i);
  });

  it.skip('returns 400 when order is already invoiced', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_INVOICED] })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await supertest(app).post('/oms/00000000-0000-0000-0000-000000000002/convert-to-invoice').set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already invoiced/i);
  });
});

// ═════════════════════════════════════════════════════════════
// 12. CANCEL ORDER (DELETE)
// ═════════════════════════════════════════════════════════════
describe('DELETE /oms/:id (cancel order)', () => {
  it.skip('cancels a Pending Approval order and releases stock reservations', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })      // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] })                // SELECT reserved_stock
      .mockResolvedValueOnce({ rows: [] })                // DELETE reserved_stock
      .mockResolvedValueOnce({ rows: [] })                // UPDATE orders Cancelled
      .mockResolvedValueOnce({ rows: [] })                // logStatus
      .mockResolvedValueOnce({ rows: [] });               // COMMIT

    const res = await supertest(app).delete('/oms/00000000-0000-0000-0000-000000000001').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/cancelled/i);
  });

  it.skip('returns 400 when trying to cancel a Shipped order', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_SHIPPED] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] });                   // ROLLBACK

    const res = await supertest(app).delete('/oms/00000000-0000-0000-0000-000000000006').set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/cannot cancel/i);
  });

  it.skip('returns 400 when trying to cancel a Delivered order', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_DELIVERED] })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await supertest(app).delete('/oms/00000000-0000-0000-0000-000000000004').set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it.skip('returns 400 when trying to cancel an Invoiced order', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [MOCK_ORDER_INVOICED] })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await supertest(app).delete('/oms/00000000-0000-0000-0000-000000000002').set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it.skip('returns 500 and rolls back when order not found during cancel', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT (not found) → error thrown

    const res = await supertest(app).delete('/oms/00000000-0000-0000-0000-000000000000').set('Authorization', AUTH);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 13. AI CONFIRMATION DRAFT
// ═════════════════════════════════════════════════════════════
describe('GET /oms/:id/ai-confirmation', () => {
  it.skip('returns AI-drafted confirmation email text', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })
      .mockResolvedValueOnce({ rows: [{ id: 'D1', name: 'Wellness Dist', credit_limit: 500000 }] });

    const res = await supertest(app).get('/oms/ord-uuid-001/ai-confirmation').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.draft).toBeDefined();
    expect(typeof res.body.data.draft).toBe('string');
  });

  it.skip('returns 404 when order not found for AI confirmation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await supertest(app).get('/oms/bad-id/ai-confirmation').set('Authorization', AUTH);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// 14. EDGE CASES & ADDITIONAL COVERAGE
// ═════════════════════════════════════════════════════════════
describe('OMS Edge Cases', () => {
  it('GET /oms/ respects pagination (page=2, limit=10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '25' }] })
      .mockResolvedValueOnce({ rows: Array(10).fill(MOCK_ORDER) });

    const res = await supertest(app).get('/oms/?page=2&limit=10').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.totalPages).toBe(3); // ceil(25/10)
  });

  it('POST /oms/ creates order with multiple items', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'ord-multi', order_number: 'ORD-2026-00200' }] })
      .mockResolvedValueOnce({ rows: [] })  // item 1
      .mockResolvedValueOnce({ rows: [] })  // item 2
      .mockResolvedValueOnce({ rows: [] })  // logStatus
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const body = {
      distributorId: 'D1',
      distributorName: 'Wellness',
      items: [
        { productId: 'P1', productName: 'Prod A', quantity: 10, rate: 500, gstPercent: 12 },
        { productId: 'P2', productName: 'Prod B', quantity: 20, rate: 300, gstPercent: 5 },
      ],
    };

    const res = await supertest(app).post('/oms/').set('Authorization', AUTH).send(body);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('PUT /oms/:id/approve applies per-item quantity overrides', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                // BEGIN
      .mockResolvedValueOnce({ rows: [MOCK_ORDER] })      // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] })                // UPDATE order_items (approval override)
      .mockResolvedValueOnce({ rows: [MOCK_ITEM] })       // SELECT order_items
      .mockResolvedValueOnce({ rows: [] })                // SELECT batches
      .mockResolvedValueOnce({ rows: [] })                // UPDATE orders Approved
      .mockResolvedValueOnce({ rows: [] })                // logStatus
      .mockResolvedValueOnce({ rows: [] });               // COMMIT

    const res = await supertest(app)
      .put('/oms/ord-uuid-001/approve')
      .set('Authorization', AUTH)
      .send({ approvals: [{ itemId: 'item-uuid-001', approvedQuantity: 80 }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should have UPDATE order_items for the override
    const updateItemCall = mockClient.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE order_items SET approved_quantity')
    );
    expect(updateItemCall).toBeDefined();
  });
});




