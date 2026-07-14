/**
 * HRMS Integration Tests — Real PostgreSQL, real routes.
 * Tests the full request→DB→response cycle for critical HR flows.
 *
 * Run: node --experimental-vm-modules node_modules/.bin/vitest run server/__tests__/hr.integration.test.js
 * Or via: npx vitest run server/__tests__/hr.integration.test.js
 *
 * Prereqs: Backend server NOT running (we mount express directly).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import pool from '../db.js';

// Mock JWT middlewares for ES imports
vi.mock('../utils/jwt.js', () => ({
  verifyTokenMiddleware: (req, res, next) => {
    req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: (allowedRoles) => (req, res, next) => {
    next();
  },
  verify2FAMiddleware: (req, res, next) => {
    next();
  }
}));

vi.mock('../utils/jwt', () => ({
  verifyTokenMiddleware: (req, res, next) => {
    req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: (allowedRoles) => (req, res, next) => {
    next();
  },
  verify2FAMiddleware: (req, res, next) => {
    next();
  }
}));

let app;
let adminToken;
let testEmployeeId;
let testDeptId;
let testLeaveId;

// ---- Setup ----
beforeAll(async () => {
  // Inject mock JWT middleware directly into CommonJS require.cache
  // so that CommonJS require('../utils/jwt') inside server/routes/hr.js gets the mock
  const { createRequire } = await import('module');
  const { fileURLToPath } = await import('url');
  const { dirname, resolve } = await import('path');
  const requireModule = createRequire(import.meta.url);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const jwtPath = resolve(__dirname, '../utils/jwt.js');
  const jwtMock = {
    verifyTokenMiddleware: (req, res, next) => {
      req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
      next();
    },
    verifyRoleMiddleware: (allowedRoles) => (req, res, next) => {
      next();
    },
    verify2FAMiddleware: (req, res, next) => {
      next();
    }
  };
  requireModule.cache[jwtPath] = {
    id: jwtPath,
    filename: jwtPath,
    loaded: true,
    exports: jwtMock,
    parent: null,
    children: [],
    paths: []
  };

  // Build a minimal express app with just the HR router
  app = express();
  app.use(express.json());

  // Mock auth middleware — inject test user
  app.use((req, _res, next) => {
    req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
    next();
  });

  const hrRouter = (await import('../routes/hr.js')).default;
  app.use('/api/hr', hrRouter);

  // Clean up any stale integration test data first
  await pool.query("DELETE FROM hr_candidates WHERE email LIKE 'candidate%' OR name = 'Test Candidate'");
  await pool.query("DELETE FROM hr_job_requisitions WHERE title = 'Integration Test Role'");
  await pool.query("DELETE FROM employees WHERE name = 'HRMS Test Employee' OR email LIKE 'hrms.test.%'");
  await pool.query("DELETE FROM hr_departments WHERE name = 'HRMS Test Department' OR code = 'HRMS-TEST'");

  // Error handler
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: err.message });
  });
});

afterAll(async () => {
  // Cleanup test data
  if (testEmployeeId) {
    await pool.query("UPDATE employees SET status = 'Terminated' WHERE id = $1", [testEmployeeId]);
  }
  await pool.query("DELETE FROM hr_departments WHERE name = 'HRMS Test Department'");
  await pool.pool.end();
});

// ============================================================
// DEPARTMENTS
// ============================================================

describe('HR Departments', () => {
  it('GET /departments returns array', async () => {
    const res = await request(app).get('/api/hr/departments');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /departments creates a department', async () => {
    const res = await request(app)
      .post('/api/hr/departments')
      .send({ name: 'HRMS Test Department', code: 'HRMS-TEST' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testDeptId = res.body.data.id;
    expect(testDeptId).toBeTruthy();
  });

  it('GET /departments/tree returns nested structure', async () => {
    const res = await request(app).get('/api/hr/departments/tree');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================================
// EMPLOYEES
// ============================================================

describe('HR Employees', () => {
  it('GET /employees returns array', async () => {
    const res = await request(app).get('/api/hr/employees');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /employees creates with auto employee_code', async () => {
    const res = await request(app)
      .post('/api/hr/employees')
      .send({
        name: 'HRMS Test Employee',
        email: `hrms.test.${Date.now()}@metapharsic.test`,
        contact: '9999999999',
        base_salary: 30000,
        ctc: 360000,
        employment_type: 'Permanent',
        department_id: testDeptId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.employee_code).toMatch(/^EMP-/);
    testEmployeeId = res.body.data.id;
  });

  it('GET /employees/:id/profile returns full profile', async () => {
    if (!testEmployeeId) return;
    const res = await request(app).get(`/api/hr/employees/${testEmployeeId}/profile`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testEmployeeId);
    expect(res.body.data).toHaveProperty('documents');
    expect(res.body.data).toHaveProperty('timeline');
  });

  it('PUT /employees/:id/profile updates fields', async () => {
    if (!testEmployeeId) return;
    const res = await request(app)
      .put(`/api/hr/employees/${testEmployeeId}/profile`)
      .send({ grade: 'L2', work_location: 'Mumbai' });
    expect(res.status).toBe(200);
    expect(res.body.data.grade).toBe('L2');
  });
});

// ============================================================
// LEAVE MANAGEMENT
// ============================================================

describe('HR Leave Management', () => {
  it('GET /leave-balances/:empId returns balances', async () => {
    if (!testEmployeeId) return;
    const res = await request(app).get(`/api/hr/leave-balances/${testEmployeeId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /leave/apply creates a pending leave', async () => {
    if (!testEmployeeId) return;
    const res = await request(app)
      .post('/api/hr/leave/apply')
      .send({
        employee_id: testEmployeeId,
        leave_type: 'Casual',
        start_date: '2026-07-10',
        end_date: '2026-07-10',
        days: 1,
        reason: 'Integration test leave',
      });
    // May fail if no leave balance provisioned — check for either 201 or 400 (insufficient balance)
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      testLeaveId = res.body.data?.id;
    }
  });

  it('PUT /leave/:id/reject rejects a leave', async () => {
    if (!testLeaveId) return;
    const res = await request(app)
      .put(`/api/hr/leave/${testLeaveId}/reject`)
      .send({ rejection_reason: 'Test rejection' });
    expect([200, 404]).toContain(res.status);
  });
});

// ============================================================
// ATTENDANCE
// ============================================================

describe('HR Attendance', () => {
  it('POST /attendance/clock-in records attendance', async () => {
    if (!testEmployeeId) return;
    const res = await request(app)
      .post('/api/hr/attendance/clock-in')
      .send({
        employee_id: testEmployeeId,
        work_from_home: false,
        device_id: 'INTEGRATION_TEST',
      });
    // May 409 if already clocked in today — both are acceptable
    expect([201, 409, 400]).toContain(res.status);
  });

  it('GET /attendance/summary returns monthly grid', async () => {
    if (!testEmployeeId) return;
    const res = await request(app)
      .get(`/api/hr/attendance/summary?empId=${testEmployeeId}&month=6&year=2026`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('grid');
  });

  it('GET /attendance/summary (Org View) returns data for all active employees', async () => {
    const res = await request(app)
      .get('/api/hr/attendance/summary?month=6&year=2026');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Should have at least our test employee or the default admin
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ============================================================
// PAYROLL ENGINE
// ============================================================

describe('Payroll Processing', () => {
  it('GET /payroll/anomalies returns array', async () => {
    const res = await request(app).get('/api/hr/payroll/anomalies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /payroll/cost-summary returns dept breakdown', async () => {
    const res = await request(app).get('/api/hr/payroll/cost-summary?month=June&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
  });
});

// ============================================================
// ATS
// ============================================================

describe('ATS Recruitment', () => {
  let testReqId;
  let testCandidateId;

  it('POST /ats/requisitions creates a requisition', async () => {
    const res = await request(app)
      .post('/api/hr/ats/requisitions')
      .send({
        title: 'Integration Test Role',
        positions: 2,
        employment_type: 'Permanent',
        location: 'Mumbai',
        department_id: testDeptId,
      });
    expect(res.status).toBe(201);
    testReqId = res.body.data?.id;
  });

  it('POST /ats/candidates creates a candidate', async () => {
    const res = await request(app)
      .post('/api/hr/ats/candidates')
      .send({
        name: 'Test Candidate',
        email: `candidate.${Date.now()}@test.com`,
        phone: '8888888888',
        role_applied: 'Integration Test Role',
        experience_years: 2,
        skills: ['React', 'Node.js'],
        source: 'Portal',
        requisition_id: testReqId,
      });
    expect(res.status).toBe(201);
    testCandidateId = res.body.data?.id;
  });

  it('POST /ats/candidates/:id/ai-screen scores candidate', async () => {
    if (!testCandidateId) return;
    const res = await request(app)
      .post(`/api/hr/ats/candidates/${testCandidateId}/ai-screen`);
    expect(res.status).toBe(200);
    expect(res.body.data?.fitScore).toBeGreaterThanOrEqual(0);
  });

  it('PUT /ats/candidates/:id/stage moves stage', async () => {
    if (!testCandidateId) return;
    const res = await request(app)
      .put(`/api/hr/ats/candidates/${testCandidateId}/stage`)
      .send({ stage: 'Screened', notes: 'Passed initial screen' });
    expect(res.status).toBe(200);
  });

  it('GET /ats/offers returns all offers', async () => {
    const res = await request(app).get('/api/hr/ats/offers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /ats/candidates/:id/hire converts candidate to employee', async () => {
    if (!testCandidateId) return;
    const res = await request(app)
      .post(`/api/hr/ats/candidates/${testCandidateId}/hire`)
      .send({});
    // Status 201 for success, or 400 if already hired
    expect([201, 400]).toContain(res.status);
  });

  // Cleanup
  afterAll(async () => {
    if (testCandidateId) await pool.query('DELETE FROM hr_candidates WHERE id = $1', [testCandidateId]);
    if (testReqId) await pool.query('DELETE FROM hr_job_requisitions WHERE id = $1', [testReqId]);
  });
});

// ============================================================
// DOCUMENTS
// ============================================================

describe('HR Documents', () => {
  let testDocId;

  it('GET /employees/:id/documents returns success', async () => {
    if (!testEmployeeId) return;
    const res = await request(app).get(`/api/hr/employees/${testEmployeeId}/documents`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /employees/:id/documents uploads a file', async () => {
    if (!testEmployeeId) return;
    // We use a mock buffer to simulate a file upload
    const res = await request(app)
      .post(`/api/hr/employees/${testEmployeeId}/documents`)
      .field('doc_type', 'ID Proof')
      .field('description', 'Test upload')
      .attach('file', Buffer.from('test content'), 'test.txt');
    
    expect(res.status).toBe(201);
    expect(res.body.data.doc_type).toBe('ID Proof');
    testDocId = res.body.data.id;
  });

  it('DELETE /employees/:id/documents/:docId removes a document', async () => {
    if (!testDocId) return;
    const res = await request(app)
      .delete(`/api/hr/employees/${testEmployeeId}/documents/${testDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================
// ANALYTICS
// ============================================================

describe('HR Analytics', () => {
  it('GET /analytics/headcount returns breakdown', async () => {
    const res = await request(app).get('/api/hr/analytics/headcount');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total');
  });

  it('GET /analytics/attrition returns rate', async () => {
    const res = await request(app).get('/api/hr/analytics/attrition');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('overall_rate');
  });

  it('GET /analytics/compliance-score returns score', async () => {
    const res = await request(app).get('/api/hr/analytics/compliance-score');
    expect(res.status).toBe(200);
  });
});

// ============================================================
// AI ENDPOINTS
// ============================================================

describe('HR AI Endpoints', () => {
  it('POST /ai/attrition returns prediction (heuristic fallback)', async () => {
    const res = await request(app).post('/api/hr/ai/attrition');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('atRiskEmployees');
    expect(res.body.data).toHaveProperty('recommendedActions');
  });

  it('POST /ai/weekly-briefing returns briefing', async () => {
    const res = await request(app).post('/api/hr/ai/weekly-briefing');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('executiveSummary');
    expect(res.body.data).toHaveProperty('priorityActions');
  });

  it('POST /ai/copilot answers leave query', async () => {
    const res = await request(app)
      .post('/api/hr/ai/copilot')
      .send({ query: 'What is my leave balance?', context: { leave_balance: { Casual: 3 } } });
    expect(res.status).toBe(200);
    expect(typeof res.body.data?.answer).toBe('string');
    // Must NOT return PAN/bank in response
    expect(res.body.data.answer).not.toMatch(/[A-Z]{5}[0-9]{4}[A-Z]/); // PAN pattern
  });
});
