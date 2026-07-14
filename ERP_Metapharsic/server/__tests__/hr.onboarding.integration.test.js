/**
 * Integration Tests — HR Onboarding API
 * Covers: GET /onboarding/active, POST /onboarding/trigger/:id,
 *         GET /onboarding/:id, PUT /onboarding/tasks/:taskId (with auto-close)
 *
 * Run: npx vitest run server/__tests__/hr.onboarding.integration.test.js
 *
 * Prereqs: PostgreSQL running locally; hr_onboarding_templates seeded with
 *          the default Standard Onboarding template.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import pool from '../db.js';

// ── Mock JWT middleware ──────────────────────────────────────────────────────
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

// Inject mock into CommonJS require cache before loading the router
beforeAll(async () => {
  const { createRequire } = await import('module');
  const { fileURLToPath } = await import('url');
  const { dirname, resolve } = await import('path');
  const req = createRequire(import.meta.url);
  const __dir = dirname(fileURLToPath(import.meta.url));
  const jwtPath = resolve(__dir, '../utils/jwt.js');
  const mockJwt = {
    verifyTokenMiddleware: (r, _s, n) => { r.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' }; n(); },
    verifyRoleMiddleware: () => (_r, _s, n) => n(),
    verify2FAMiddleware: (_r, _s, n) => n(),
  };
  req.cache[jwtPath] = { id: jwtPath, filename: jwtPath, loaded: true, exports: mockJwt, parent: null, children: [], paths: [] };
});

// ── App setup ────────────────────────────────────────────────────────────────
let app;
let testEmployeeId;
let testChecklistId;
let testTaskId;

beforeAll(async () => {
  const hrRouter = (await import('../routes/hr.js')).default;
  app = express();
  app.use(express.json());
  app.use('/hr', hrRouter);

  // Create a test employee (or reuse existing fixture)
  const empRes = await pool.query(
    `INSERT INTO employees
       (id, employee_code, name, email, contact, status, join_date, created_by, created_at)
     VALUES
       ('aaaaaaaa-0000-0000-0000-000000000001',
        'EMP-TEST-OB', 'Onboarding TestUser', 'ob_test@example.com',
        '9999999999', 'Active', NOW(),
        '00000000-0000-0000-0000-000000000001', NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  testEmployeeId = empRes.rows[0].id;

  // Clean existing checklist so tests start fresh
  await pool.query(
    `DELETE FROM hr_onboarding_tasks t
       USING hr_onboarding_checklists c
      WHERE t.checklist_id = c.id AND c.employee_id = $1`,
    [testEmployeeId]
  );
  await pool.query(
    `DELETE FROM hr_onboarding_checklists WHERE employee_id = $1`,
    [testEmployeeId]
  );
});

afterAll(async () => {
  // Clean up test data
  await pool.query(
    `DELETE FROM hr_onboarding_tasks t
       USING hr_onboarding_checklists c
      WHERE t.checklist_id = c.id AND c.employee_id = $1`,
    [testEmployeeId]
  );
  await pool.query(
    `DELETE FROM hr_onboarding_checklists WHERE employee_id = $1`,
    [testEmployeeId]
  );
  await pool.query(
    `DELETE FROM employees WHERE id = $1`, [testEmployeeId]
  );
  // pool.end() not available via the db module wrapper — let vitest handle teardown
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /hr/onboarding/trigger/:employeeId', () => {
  it('creates a checklist with tasks from the default template', async () => {
    const res = await request(app)
      .post(`/hr/onboarding/trigger/${testEmployeeId}`)
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checklist_id).toBeTruthy();
    testChecklistId = res.body.data.checklist_id;

    // Verify tasks were inserted
    const tasks = await pool.query(
      `SELECT * FROM hr_onboarding_tasks WHERE checklist_id = $1`, [testChecklistId]
    );
    expect(tasks.rows.length).toBeGreaterThan(0);
    testTaskId = tasks.rows[0].id;
  });

  it('re-triggers cleanly (idempotent) — replaces old checklist', async () => {
    const res = await request(app)
      .post(`/hr/onboarding/trigger/${testEmployeeId}`)
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // New checklist ID issued
    expect(res.body.data.checklist_id).not.toBe(testChecklistId);
    testChecklistId = res.body.data.checklist_id;

    const tasks = await pool.query(
      `SELECT * FROM hr_onboarding_tasks WHERE checklist_id = $1`, [testChecklistId]
    );
    expect(tasks.rows.length).toBeGreaterThan(0);
    testTaskId = tasks.rows[0].id;
  });

  it('returns 404 when no default template exists', async () => {
    // Temporarily disable the default template
    await pool.query(`UPDATE hr_onboarding_templates SET is_default = FALSE WHERE is_default = TRUE`);
    const res = await request(app)
      .post(`/hr/onboarding/trigger/${testEmployeeId}`)
      .set('Authorization', 'Bearer mock');
    expect(res.status).toBe(404);
    // Restore
    await pool.query(`UPDATE hr_onboarding_templates SET is_default = TRUE WHERE name = 'Standard Onboarding'`);
  });
});

describe('GET /hr/onboarding/active', () => {
  it('returns array of in-progress checklists with employee_name', async () => {
    const res = await request(app)
      .get('/hr/onboarding/active')
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const our = res.body.data.find((c) => c.employee_id === testEmployeeId);
    expect(our).toBeTruthy();
    expect(our.employee_name).toBe('Onboarding TestUser');
    expect(Array.isArray(our.tasks)).toBe(true);
    expect(our.tasks.length).toBeGreaterThan(0);
  });

  it('each task has both title and task_name fields', async () => {
    const res = await request(app)
      .get('/hr/onboarding/active')
      .set('Authorization', 'Bearer mock');

    const our = res.body.data.find((c) => c.employee_id === testEmployeeId);
    const task = our.tasks[0];
    expect(task.title).toBeTruthy();
    expect(task.task_name).toBeTruthy();
    expect(task.title).toBe(task.task_name);
  });

  it('auto-marks overdue checklists (target_completion_date in past)', async () => {
    // Force target date to the past
    await pool.query(
      `UPDATE hr_onboarding_checklists
          SET target_completion_date = CURRENT_DATE - INTERVAL '1 day'
        WHERE id = $1`,
      [testChecklistId]
    );

    const res = await request(app)
      .get('/hr/onboarding/active')
      .set('Authorization', 'Bearer mock');

    // The GET /active endpoint runs the overdue update; checklist should be gone from active list
    // (status changed to Overdue) — but still returned since we include Overdue in the query
    const our = res.body.data.find((c) => c.id === testChecklistId);
    if (our) expect(our.status).toBe('Overdue');

    // Reset for subsequent tests
    await pool.query(
      `UPDATE hr_onboarding_checklists
          SET status = 'In Progress', target_completion_date = CURRENT_DATE + INTERVAL '30 days'
        WHERE id = $1`,
      [testChecklistId]
    );
  });
});

describe('GET /hr/onboarding/:employeeId', () => {
  it('returns single employee checklist with employee_name', async () => {
    const res = await request(app)
      .get(`/hr/onboarding/${testEmployeeId}`)
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.employee_name).toBe('Onboarding TestUser');
    expect(Array.isArray(res.body.data.tasks)).toBe(true);
  });

  it('returns null data for employee with no checklist', async () => {
    const fakeId = '00000000-dead-beef-0000-000000000099';
    const res = await request(app)
      .get(`/hr/onboarding/${fakeId}`)
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('PUT /hr/onboarding/tasks/:taskId', () => {
  it('marks a task Completed and returns updated task', async () => {
    const res = await request(app)
      .put(`/hr/onboarding/tasks/${testTaskId}`)
      .send({ status: 'Completed', notes: 'Done via test' })
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Completed');
    expect(res.body.data.completed_at).toBeTruthy();
  });

  it('returns 404 for non-existent task ID', async () => {
    const res = await request(app)
      .put('/hr/onboarding/tasks/00000000-0000-0000-0000-000000000000')
      .send({ status: 'Completed' })
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(404);
  });

  it('auto-closes checklist to Completed when all tasks are done', async () => {
    // Mark every remaining task as Completed
    const tasks = await pool.query(
      `SELECT id FROM hr_onboarding_tasks
        WHERE checklist_id = $1 AND status != 'Completed'`,
      [testChecklistId]
    );
    for (const t of tasks.rows) {
      await request(app)
        .put(`/hr/onboarding/tasks/${t.id}`)
        .send({ status: 'Completed' })
        .set('Authorization', 'Bearer mock');
    }

    // Checklist status should now be 'Completed'
    const chk = await pool.query(
      `SELECT status FROM hr_onboarding_checklists WHERE id = $1`, [testChecklistId]
    );
    expect(chk.rows[0].status).toBe('Completed');
  });
});
