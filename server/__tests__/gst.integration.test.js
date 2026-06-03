/**
 * GST Compliance Module — Integration Tests
 * Tier 2: Full HTTP request → PostgreSQL → response cycle.
 *
 * Validates:
 *   - GSTR-1: Outward Supplies summary
 *   - GSTR-2: Inward Supplies summary
 *   - GSTR-3B: Monthly Summary aggregation
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import pool from '../db.js';

// ─── Mock JWT middleware ──────────────────────────────────────────────────────
vi.mock('../utils/jwt.js', () => ({
  verifyTokenMiddleware: (req, _res, next) => {
    req.user = { userId: '11111111-1111-1111-1111-111111111111', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: () => (_req, _res, next) => next(),
}));

// ─── Inject mock into CJS require cache ──────────────────────────────────────
let app;

beforeAll(async () => {
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
  };
  _require.cache[jwtPath] = { id: jwtPath, filename: jwtPath, loaded: true, exports: jwtMock };

  app = express();
  app.use(express.json());

  const gstRoutes = _require('../routes/gst.js');
  app.use('/api/gst', gstRoutes);

  // Setup Test Data
  await pool.query('BEGIN');
  try {
    // 1. Create a Test Party (Customer)
    const partyId = (await pool.query(`
        INSERT INTO parties (name, type, gstin, company_id) 
        VALUES ('GST Test Customer', 'Debtor', '27AAAAA0000A1Z5', 1) 
        RETURNING id
    `)).rows[0].id;

    // 2. Create a Test Sales Invoice (GSTR-1)
    const invoiceId = (await pool.query(`
        INSERT INTO sales_invoices (invoice_number, date, party_id, taxable_value, total_gst, net_amount, status, company_id)
        VALUES ('T-GST-SALES-001', '2025-04-10', $1, 1000, 180, 1180, 'Completed', 1)
        RETURNING id
    `, [partyId])).rows[0].id;

    await pool.query(`
        INSERT INTO sales_invoice_items (invoice_id, gst_percent, taxable_value, cgst_amount, sgst_amount, total_amount, quantity, mrp, rate)
        VALUES ($1, 18, 1000, 90, 90, 1180, 1, 1180, 1000)
    `, [invoiceId]);

    // 3. Create a Test Party (Supplier)
    const supplierId = (await pool.query(`
        INSERT INTO parties (name, type, gstin, company_id) 
        VALUES ('GST Test Supplier', 'Creditor', '27BBBBB0000B1Z5', 1) 
        RETURNING id
    `)).rows[0].id;

    // 4. Create a Test Purchase Invoice (GSTR-2)
    await pool.query(`
        INSERT INTO purchase_invoices (voucher_no, vendor_invoice_no, invoice_date, party_id, taxable_amount, cgst, sgst, net_amount, status)
        VALUES ('PV-001', 'S-GST-PURCH-001', '2025-04-15', $1, 2000, 180, 180, 2360, 'Approved')
    `, [supplierId]);

    // 5. Create GST Portal Data for Recon
    await pool.query(`
        INSERT INTO gst_portal_data (gstin, trade_name, invoice_number, invoice_date, taxable_value, cgst, sgst, total_gst, total_value, period_month, period_year, source)
        VALUES ('27BBBBB0000B1Z5', 'GST Test Supplier', 'S-GST-PURCH-001', '2025-04-15', 2000, 180, 180, 360, 2360, 4, 2025, '2B')
    `);

    // 6. Create Mismatched Portal Data
    await pool.query(`
        INSERT INTO gst_portal_data (gstin, trade_name, invoice_number, invoice_date, taxable_value, cgst, sgst, total_gst, total_value, period_month, period_year, source)
        VALUES ('27BBBBB0000B1Z5', 'GST Test Supplier', 'S-GST-PURCH-MISMATCH', '2025-04-20', 5000, 450, 450, 900, 5900, 4, 2025, '2B')
    `);

    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
});

afterAll(async () => {
  try {
    // Cleanup Test Data
    await pool.query(`DELETE FROM sales_invoice_items WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE invoice_number = 'T-GST-SALES-001')`);
    await pool.query(`DELETE FROM sales_invoices WHERE invoice_number = 'T-GST-SALES-001'`);
    await pool.query(`DELETE FROM purchase_invoices WHERE vendor_invoice_no = 'S-GST-PURCH-001'`);
    await pool.query(`DELETE FROM gst_portal_data WHERE gstin = '27BBBBB0000B1Z5'`);
    await pool.query(`DELETE FROM parties WHERE name IN ('GST Test Customer', 'GST Test Supplier')`);

    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
});

describe('GST Compliance Routes', () => {

  it('GST-01 | GET /api/gst/gstr1?month=4&year=2025 → Returns test sales invoice', async () => {
    const res = await request(app).get('/api/gst/gstr1?month=4&year=2025');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const testInvoice = res.body.data.find(inv => inv.invoiceNo === 'T-GST-SALES-001');
    expect(testInvoice).toBeDefined();
    expect(testInvoice.partyGstin).toBe('27AAAAA0000A1Z5');
    expect(testInvoice.taxableValue).toBe(1000);
    expect(testInvoice.cgst).toBe(90);
    expect(testInvoice.sgst).toBe(90);
  });

  it('GST-02 | GET /api/gst/gstr2?month=4&year=2025 → Returns test purchase invoice', async () => {
    const res = await request(app).get('/api/gst/gstr2?month=4&year=2025');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const testPurchase = res.body.data.find(inv => inv.invoiceNo === 'S-GST-PURCH-001');
    expect(testPurchase).toBeDefined();
    expect(testPurchase.partyGstin).toBe('27BBBBB0000B1Z5');
    expect(testPurchase.cgst).toBe(180);
    expect(testPurchase.sgst).toBe(180);
  });

  it('GST-03 | GET /api/gst/gstr3b?month=4&year=2025 → Returns aggregated summary', async () => {
    const res = await request(app).get('/api/gst/gstr3b?month=4&year=2025');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const outward = res.body.data.find(r => r.id === '3.1.a');
    expect(outward.cgst).toBeGreaterThanOrEqual(90);
    expect(outward.sgst).toBeGreaterThanOrEqual(90);
    
    const itc = res.body.data.find(r => r.id === '4.A.5');
    expect(itc.cgst).toBeGreaterThanOrEqual(180);
    expect(itc.sgst).toBeGreaterThanOrEqual(180);
  });

  it('GST-04 | GET /api/gst/gstr2?month=4&year=2025&recon=true → Returns reconciliation data', async () => {
    const res = await request(app).get('/api/gst/gstr2?month=4&year=2025&recon=true');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    // Check Matched
    const matched = res.body.data.find(inv => inv.invoiceNo === 'S-GST-PURCH-001');
    expect(matched).toBeDefined();
    expect(matched.status).toBe('Matched');
    
    // Check Missing in Books
    const missingInBooks = res.body.data.find(inv => inv.invoiceNo === 'S-GST-PURCH-MISMATCH');
    expect(missingInBooks).toBeDefined();
    expect(missingInBooks.status).toBe('Missing in Books');
  });

});
