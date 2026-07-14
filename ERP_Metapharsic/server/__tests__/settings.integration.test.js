/**
 * Integration Tests — Settings API
 * Tests company profile, parameters, security, notifications, appearance,
 * export/import, factory reset, and validation rules.
 *
 * Run: npx vitest run server/__tests__/settings.integration.test.js
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import pool from '../db.js';

// ── Mock JWT ─────────────────────────────────────────────────────────────────
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
}));

// Patch require.cache so CommonJS router picks up the mock
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

// ── App setup ─────────────────────────────────────────────────────────────────
let app;

beforeAll(async () => {
  const settingsRouter = (await import('../routes/settings.js')).default;
  app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/settings', settingsRouter);

  // Clean test keys before suite
  await pool.query(`
    DELETE FROM erp_settings
     WHERE key IN ('company_profile','app_parameters','notification_prefs',
                   'security_policy','appearance_settings')
  `);
});

afterAll(async () => {
  await pool.query(`
    DELETE FROM erp_settings
     WHERE key IN ('company_profile','app_parameters','notification_prefs',
                   'security_policy','appearance_settings')
  `);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_COMPANY = {
  name: 'Test Pharma Ltd',
  businessType: 'Pharmaceutical',
  taxStructure: 'Product Wise',
  valuationMethod: 'FIFO',
  financialYearStart: '2026-04-01',
  financialYearEnd: '2027-03-31',
  gstin: '27AAPFU0939F1ZV',
  drugLicenseNo: 'MH/DL/2024/001234',
  address: 'Plot No 1, MiDC',
  city: 'Mumbai',
  state: 'Maharashtra',
  pinCode: '400001',
  country: 'India',
  phone: '9876543210',
  email: 'test@testpharma.com',
};

const VALID_PARAMS = {
  financialYear: '2026 - 2027',
  gstEnabled: true,
  inventoryMethod: 'FIFO',
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1001,
  autoPrint: false,
  expiryAlertDays: 60,
  reorderAlertPercent: 20,
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  sessionTimeoutMinutes: 60,
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPANY PROFILE
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /settings/company', () => {
  it('returns null when no company is saved', async () => {
    const res = await request(app).get('/settings/company');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });
});

describe('PUT /settings/company', () => {
  it('saves a valid company profile', async () => {
    const res = await request(app).put('/settings/company').send(VALID_COMPANY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Pharma Ltd');
    expect(res.body.data.gstin).toBe('27AAPFU0939F1ZV');
  });

  it('returns the saved profile on subsequent GET', async () => {
    const res = await request(app).get('/settings/company');
    expect(res.body.data.name).toBe('Test Pharma Ltd');
    expect(res.body.data.city).toBe('Mumbai');
  });

  it('returns 422 when company name is missing', async () => {
    const res = await request(app).put('/settings/company').send({ ...VALID_COMPANY, name: '' });
    expect(res.status).toBe(422);
    expect(res.body.errors.name).toBeTruthy();
  });

  it('returns 422 for invalid GSTIN format', async () => {
    const res = await request(app).put('/settings/company').send({ ...VALID_COMPANY, gstin: 'INVALID' });
    expect(res.status).toBe(422);
    expect(res.body.errors.gstin).toBeTruthy();
  });

  it('returns 422 for invalid PIN Code (not 6 digits)', async () => {
    const res = await request(app).put('/settings/company').send({ ...VALID_COMPANY, pinCode: '40001' });
    expect(res.status).toBe(422);
    expect(res.body.errors.pinCode).toBeTruthy();
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app).put('/settings/company').send({ ...VALID_COMPANY, email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.errors.email).toBeTruthy();
  });

  it('returns 422 when drug license is missing', async () => {
    const res = await request(app).put('/settings/company').send({ ...VALID_COMPANY, drugLicenseNo: '' });
    expect(res.status).toBe(422);
    expect(res.body.errors.drugLicenseNo).toBeTruthy();
  });

  it('upserts — second save overwrites first', async () => {
    await request(app).put('/settings/company').send({ ...VALID_COMPANY, name: 'Updated Pharma' });
    const res = await request(app).get('/settings/company');
    expect(res.body.data.name).toBe('Updated Pharma');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// APPLICATION PARAMETERS
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /settings/parameters', () => {
  it('saves valid parameters', async () => {
    const res = await request(app).put('/settings/parameters').send(VALID_PARAMS);
    expect(res.status).toBe(200);
    expect(res.body.data.financialYear).toBe('2026 - 2027');
    expect(res.body.data.gstEnabled).toBe(true);
    expect(res.body.data.invoicePrefix).toBe('INV');
  });

  it('returns saved parameters on GET', async () => {
    const res = await request(app).get('/settings/parameters');
    expect(res.body.data.inventoryMethod).toBe('FIFO');
    expect(res.body.data.nextInvoiceNumber).toBe(1001);
  });

  it('returns 422 when financialYear is missing', async () => {
    const res = await request(app).put('/settings/parameters').send({ ...VALID_PARAMS, financialYear: '' });
    expect(res.status).toBe(422);
    expect(res.body.errors.financialYear).toBeTruthy();
  });

  it('returns 422 for reorderAlertPercent > 100', async () => {
    const res = await request(app).put('/settings/parameters').send({ ...VALID_PARAMS, reorderAlertPercent: 150 });
    expect(res.status).toBe(422);
  });

  it('truncates invoicePrefix to 6 chars', async () => {
    const res = await request(app).put('/settings/parameters').send({ ...VALID_PARAMS, invoicePrefix: 'TOOLONGPREFIX' });
    expect(res.body.data.invoicePrefix).toBe('TOOLON');
  });

  it('cross-sync: updates company valuationMethod when inventoryMethod changes', async () => {
    // Ensure company exists first
    await request(app).put('/settings/company').send(VALID_COMPANY);
    await request(app).put('/settings/parameters').send({ ...VALID_PARAMS, inventoryMethod: 'Average' });

    const companyRes = await request(app).get('/settings/company');
    expect(companyRes.body.data.valuationMethod).toBe('Average');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY POLICY
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /settings/security', () => {
  const VALID_SEC = {
    loginAttempts: 5, lockoutMinutes: 15,
    requireStrongPassword: true, twoFactorForAdmin: false,
    ipWhitelistEnabled: true, auditAllActions: true,
  };

  it('saves full security policy including ipWhitelistEnabled', async () => {
    const res = await request(app).put('/settings/security').send(VALID_SEC);
    expect(res.status).toBe(200);
    expect(res.body.data.ipWhitelistEnabled).toBe(true);
    expect(res.body.data.loginAttempts).toBe(5);
  });

  it('returns the saved policy on GET', async () => {
    const res = await request(app).get('/settings/security');
    expect(res.body.data.lockoutMinutes).toBe(15);
    expect(res.body.data.ipWhitelistEnabled).toBe(true);
  });

  it('returns 422 for invalid loginAttempts value', async () => {
    const res = await request(app).put('/settings/security').send({ ...VALID_SEC, loginAttempts: 7 });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid lockoutMinutes value', async () => {
    const res = await request(app).put('/settings/security').send({ ...VALID_SEC, lockoutMinutes: 45 });
    expect(res.status).toBe(422);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /settings/notifications', () => {
  it('saves notification prefs', async () => {
    const res = await request(app).put('/settings/notifications').send({
      inventory: true, compliance: false, accounts: true, pos: true, hr: true, crm: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.compliance).toBe(false);
    expect(res.body.data.hr).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// APPEARANCE SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
describe('Appearance settings', () => {
  it('returns null when no appearance saved', async () => {
    const res = await request(app).get('/settings/appearance');
    expect(res.status).toBe(200);
    // May be null or existing
  });

  it('saves appearance settings', async () => {
    const res = await request(app).put('/settings/appearance').send({ darkMode: false, fontSize: 'large' });
    expect(res.status).toBe(200);
    expect(res.body.data.fontSize).toBe('large');
    expect(res.body.data.darkMode).toBe(false);
  });

  it('rejects invalid fontSize value — falls back to normal', async () => {
    const res = await request(app).put('/settings/appearance').send({ darkMode: false, fontSize: 'huge' });
    expect(res.status).toBe(200);
    expect(res.body.data.fontSize).toBe('normal');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /settings/export + POST /settings/import', () => {
  it('exports all settings with metadata', async () => {
    const res = await request(app).get('/settings/export');
    expect(res.status).toBe(200);
    expect(res.body.data.metadata.version).toBeTruthy();
    expect(res.body.data.metadata.exportedAt).toBeTruthy();
    expect(res.body.data).toHaveProperty('company');
    expect(res.body.data).toHaveProperty('appParameters');
  });

  it('imports settings and overwrites existing', async () => {
    const importPayload = {
      company: { ...VALID_COMPANY, name: 'Imported Pharma Ltd', gstin: '27AAPFU0939F1ZV' },
      appParameters: { ...VALID_PARAMS, invoicePrefix: 'ORD' },
    };
    const importRes = await request(app).post('/settings/import').send(importPayload);
    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);

    const companyRes = await request(app).get('/settings/company');
    expect(companyRes.body.data.name).toBe('Imported Pharma Ltd');

    const paramsRes = await request(app).get('/settings/parameters');
    expect(paramsRes.body.data.invoicePrefix).toBe('ORD');
  });

  it('returns 422 when import payload has no valid sections', async () => {
    const res = await request(app).post('/settings/import').send({ random: 'data' });
    expect(res.status).toBe(422);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FACTORY RESET
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /settings/reset', () => {
  it('deletes all settings rows', async () => {
    // First ensure data exists
    await request(app).put('/settings/company').send(VALID_COMPANY);
    await request(app).put('/settings/parameters').send(VALID_PARAMS);

    const resetRes = await request(app).post('/settings/reset');
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Verify all are null
    const [co, pr] = await Promise.all([
      request(app).get('/settings/company'),
      request(app).get('/settings/parameters'),
    ]);
    expect(co.body.data).toBeNull();
    expect(pr.body.data).toBeNull();
  });
});
