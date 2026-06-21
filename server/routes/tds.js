'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');

router.use(verifyTokenMiddleware);

const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const COMPANY_ID = 1;

// ── Helper: financial year from month/year ──────────────────────────────────
function financialYear(month, year) {
  // April = month 4; FY starts April
  if (month >= 4) return `${year}-${String(year + 1).slice(2)}`;
  return `${year - 1}-${String(year).slice(2)}`;
}

// ── Helper: write audit log ─────────────────────────────────────────────────
async function writeAudit(userId, action, details) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, action, JSON.stringify(details)]
    );
  } catch (_) { /* non-fatal */ }
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/monthly-summary?month=6&year=2026
// ════════════════════════════════════════════════════════════════════════════
router.get('/monthly-summary', asyncRoute(async (req, res) => {
  const month = parseInt(req.query.month || new Date().getMonth() + 1);
  const year  = parseInt(req.query.year  || new Date().getFullYear());
  const fy    = req.query.financial_year || financialYear(month, year);

  // Section 192 — salary TDS from salary_slips
  const salaryTds = await db.query(`
    SELECT
      COUNT(DISTINCT employee_id)    AS "employees",
      COALESCE(SUM(basic_salary + COALESCE(hra,0) + COALESCE(allowances,0)), 0) AS "grossSalary",
      COALESCE(SUM(tds_amount), 0)   AS "tdsDeducted"
    FROM salary_slips
    WHERE month = $1 AND year = $2 AND status != 'Draft' AND company_id = $3
  `, [month, year, COMPANY_ID]);

  // Other sections from tds_entries
  const vendorTds = await db.query(`
    SELECT
      section,
      COUNT(*)                        AS "transactions",
      COALESCE(SUM(payment_amount),0) AS "grossPayment",
      COALESCE(SUM(total_tds),0)      AS "tdsDeducted"
    FROM tds_entries
    WHERE month = $1 AND financial_year = $2 AND company_id = $3
      AND source_type != 'SALARY'
    GROUP BY section
    ORDER BY section
  `, [month, fy, COMPANY_ID]);

  const totalSalaryTds  = parseFloat(salaryTds.rows[0]?.tdsDeducted  || 0);
  const totalVendorTds  = vendorTds.rows.reduce((s, r) => s + parseFloat(r.tdsDeducted), 0);

  const bySection = {};
  for (const row of vendorTds.rows) {
    bySection[`section${row.section}`] = {
      transactions: parseInt(row.transactions),
      grossPayment: parseFloat(row.grossPayment),
      tdsDeducted:  parseFloat(row.tdsDeducted),
    };
  }

  const dueDay7 = new Date(year, month, 7); // month is 0-indexed so month = next month

  res.json({
    month, year, financialYear: fy,
    section192: {
      employees:   parseInt(salaryTds.rows[0]?.employees || 0),
      grossSalary: parseFloat(salaryTds.rows[0]?.grossSalary || 0),
      tdsDeducted: totalSalaryTds,
    },
    ...bySection,
    totalTds: totalSalaryTds + totalVendorTds,
    challansRequired: [
      { section: '192',          amount: totalSalaryTds, dueDate: dueDay7.toISOString().split('T')[0] },
      { section: '194C/H/I/J/Q', amount: totalVendorTds, dueDate: dueDay7.toISOString().split('T')[0] },
    ],
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/entries?month=6&year=2026&section=194H&source_type=VENDOR
// ════════════════════════════════════════════════════════════════════════════
router.get('/entries', asyncRoute(async (req, res) => {
  const { month, year, financial_year, section, source_type, page = 1, limit = 50 } = req.query;
  const fy     = financial_year || (month && year ? financialYear(parseInt(month), parseInt(year)) : null);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = ['t.company_id = $1'];
  const params     = [COMPANY_ID];
  let   p          = 2;

  if (fy)          { conditions.push(`t.financial_year = $${p++}`); params.push(fy); }
  if (month)       { conditions.push(`t.month = $${p++}`);          params.push(parseInt(month)); }
  if (section)     { conditions.push(`t.section = $${p++}`);        params.push(section); }
  if (source_type) { conditions.push(`t.source_type = $${p++}`);    params.push(source_type); }

  const where = conditions.join(' AND ');

  const [rows, count] = await Promise.all([
    db.query(`
      SELECT
        t.id, t.financial_year AS "financialYear", t.month, t.section,
        t.deductee_type AS "deducteeType", t.deductee_name AS "deducteeName",
        t.deductee_pan AS "deducteePan", t.payment_date AS "paymentDate",
        t.payment_amount AS "paymentAmount", t.tds_rate AS "tdsRate",
        t.tds_amount AS "tdsAmount", t.surcharge, t.cess,
        t.total_tds AS "totalTds", t.challan_id AS "challanId",
        t.source_type AS "sourceType", t.source_id AS "sourceId",
        t.nature_of_payment AS "natureOfPayment",
        c.challan_number AS "challanNumber", c.challan_date AS "challanDate"
      FROM tds_entries t
      LEFT JOIN tds_challans c ON c.id = t.challan_id
      WHERE ${where}
      ORDER BY t.payment_date DESC
      LIMIT $${p} OFFSET $${p+1}
    `, [...params, parseInt(limit), offset]),
    db.query(`SELECT COUNT(*) FROM tds_entries t WHERE ${where}`, params),
  ]);

  res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
}));

// ════════════════════════════════════════════════════════════════════════════
// POST /api/tds/entries — manual TDS entry
// ════════════════════════════════════════════════════════════════════════════
router.post('/entries', asyncRoute(async (req, res) => {
  const {
    financialYear: fy, month, section, deducteeType, deducteeName, deducteePan,
    paymentDate, paymentAmount, tdsRate, surcharge = 0, cess = 0,
    sourceType = 'VENDOR', sourceId, natureOfPayment,
  } = req.body;

  if (!fy || !month || !section || !deducteeName || !paymentDate || !paymentAmount || !tdsRate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const tdsAmount = parseFloat(paymentAmount) * parseFloat(tdsRate) / 100;
  const totalTds  = tdsAmount + parseFloat(surcharge) + parseFloat(cess);

  const result = await db.query(`
    INSERT INTO tds_entries
      (financial_year, month, section, deductee_type, deductee_name, deductee_pan,
       payment_date, payment_amount, tds_rate, tds_amount, surcharge, cess, total_tds,
       source_type, source_id, nature_of_payment, company_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING id
  `, [fy, month, section, deducteeType, deducteeName, deducteePan,
      paymentDate, paymentAmount, tdsRate, tdsAmount, surcharge, cess, totalTds,
      sourceType, sourceId, natureOfPayment, COMPANY_ID, req.user?.id]);

  await writeAudit(req.user?.id, 'TDS_ENTRY_CREATED', { id: result.rows[0].id, section, deducteeName, totalTds });

  res.status(201).json({ id: result.rows[0].id, totalTds });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/challans?month=6&year=2026
// ════════════════════════════════════════════════════════════════════════════
router.get('/challans', asyncRoute(async (req, res) => {
  const { month, financial_year, section } = req.query;
  const conditions = ['company_id = $1'];
  const params     = [COMPANY_ID];
  let   p          = 2;

  if (financial_year) { conditions.push(`financial_year = $${p++}`); params.push(financial_year); }
  if (month)          { conditions.push(`month = $${p++}`);          params.push(parseInt(month)); }
  if (section)        { conditions.push(`section = $${p++}`);        params.push(section); }

  const result = await db.query(`
    SELECT
      id, challan_number AS "challanNumber", bsr_code AS "bsrCode",
      challan_date AS "challanDate", section, financial_year AS "financialYear",
      month, amount_paid AS "amountPaid", bank_name AS "bankName",
      acknowledgement_no AS "acknowledgementNo", status, created_at AS "createdAt"
    FROM tds_challans
    WHERE ${conditions.join(' AND ')}
    ORDER BY challan_date DESC
  `, params);

  res.json(result.rows);
}));

// ════════════════════════════════════════════════════════════════════════════
// POST /api/tds/challans — record a challan payment
// ════════════════════════════════════════════════════════════════════════════
router.post('/challans', asyncRoute(async (req, res) => {
  const {
    challanNumber, bsrCode, challanDate, section, financialYear: fy,
    month, amountPaid, bankName, acknowledgementNo,
  } = req.body;

  if (!challanNumber || !bsrCode || !challanDate || !section || !fy || !month || !amountPaid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await db.getClient ? db.getClient() : null;

  try {
    let challanId;

    if (client) {
      await client.query('BEGIN');
      const ins = await client.query(`
        INSERT INTO tds_challans
          (challan_number, bsr_code, challan_date, section, financial_year,
           month, amount_paid, bank_name, acknowledgement_no, company_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `, [challanNumber, bsrCode, challanDate, section, fy,
          month, amountPaid, bankName, acknowledgementNo, COMPANY_ID, req.user?.id]);
      challanId = ins.rows[0].id;
      await client.query('COMMIT');
    } else {
      // db.query variant (pool without getClient)
      const ins = await db.query(`
        INSERT INTO tds_challans
          (challan_number, bsr_code, challan_date, section, financial_year,
           month, amount_paid, bank_name, acknowledgement_no, company_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `, [challanNumber, bsrCode, challanDate, section, fy,
          month, amountPaid, bankName, acknowledgementNo, COMPANY_ID, req.user?.id]);
      challanId = ins.rows[0].id;
    }

    await writeAudit(req.user?.id, 'TDS_CHALLAN_CREATED', { challanId, challanNumber, section, amountPaid });

    res.status(201).json({ id: challanId, message: 'Challan recorded' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (client) client.release();
  }
}));

// ════════════════════════════════════════════════════════════════════════════
// PUT /api/tds/challans/:id — update acknowledgement or status
// ════════════════════════════════════════════════════════════════════════════
router.put('/challans/:id', asyncRoute(async (req, res) => {
  const { acknowledgementNo, status, bankName } = req.body;
  const { id } = req.params;

  await db.query(`
    UPDATE tds_challans
    SET acknowledgement_no = COALESCE($1, acknowledgement_no),
        status             = COALESCE($2, status),
        bank_name          = COALESCE($3, bank_name)
    WHERE id = $4 AND company_id = $5
  `, [acknowledgementNo, status, bankName, id, COMPANY_ID]);

  res.json({ message: 'Updated' });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/unlinked?month=6&financial_year=2025-26
// ════════════════════════════════════════════════════════════════════════════
router.get('/unlinked', asyncRoute(async (req, res) => {
  const { month, financial_year } = req.query;

  const conditions = ['company_id = $1', 'challan_id IS NULL'];
  const params     = [COMPANY_ID];
  let   p          = 2;

  if (financial_year) { conditions.push(`financial_year = $${p++}`); params.push(financial_year); }
  if (month)          { conditions.push(`month = $${p++}`);          params.push(parseInt(month)); }

  const result = await db.query(`
    SELECT
      id, section, deductee_name AS "deducteeName", deductee_pan AS "deducteePan",
      payment_date AS "paymentDate", total_tds AS "totalTds",
      financial_year AS "financialYear", month, source_type AS "sourceType"
    FROM tds_entries
    WHERE ${conditions.join(' AND ')}
    ORDER BY payment_date DESC
  `, params);

  res.json({ count: result.rows.length, entries: result.rows });
}));

// ════════════════════════════════════════════════════════════════════════════
// POST /api/tds/link-challan — link multiple entries to a challan
// Body: { challanId: 5, entryIds: [1,2,3] }
// ════════════════════════════════════════════════════════════════════════════
router.post('/link-challan', asyncRoute(async (req, res) => {
  const { challanId, entryIds } = req.body;

  if (!challanId || !Array.isArray(entryIds) || entryIds.length === 0) {
    return res.status(400).json({ error: 'challanId and entryIds[] required' });
  }

  // Verify challan belongs to this company
  const challan = await db.query(
    'SELECT id FROM tds_challans WHERE id = $1 AND company_id = $2',
    [challanId, COMPANY_ID]
  );
  if (!challan.rows.length) return res.status(404).json({ error: 'Challan not found' });

  await db.query(
    `UPDATE tds_entries SET challan_id = $1, updated_at = NOW()
     WHERE id = ANY($2) AND company_id = $3`,
    [challanId, entryIds, COMPANY_ID]
  );

  await writeAudit(req.user?.id, 'TDS_CHALLAN_LINKED', { challanId, entryCount: entryIds.length });

  res.json({ message: `${entryIds.length} entries linked to challan ${challanId}` });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/return-data?quarter=Q1&financial_year=2025-26&form=26Q
// ════════════════════════════════════════════════════════════════════════════
router.get('/return-data', asyncRoute(async (req, res) => {
  const { quarter = 'Q1', financial_year, form = '26Q' } = req.query;

  if (!financial_year) return res.status(400).json({ error: 'financial_year required' });

  const quarterMonths = { Q1: [4,5,6], Q2: [7,8,9], Q3: [10,11,12], Q4: [1,2,3] };
  const months = quarterMonths[quarter] || quarterMonths.Q1;

  // For 24Q (salary), filter section 192; for 26Q all others
  const sectionFilter = form === '24Q' ? "AND section = '192'" : "AND section != '192'";

  const entries = await db.query(`
    SELECT
      t.id, t.section, t.deductee_name AS "deducteeName", t.deductee_pan AS "deducteePan",
      t.payment_date AS "paymentDate", t.payment_amount AS "paymentAmount",
      t.tds_rate AS "tdsRate", t.tds_amount AS "tdsAmount", t.total_tds AS "totalTds",
      t.nature_of_payment AS "natureOfPayment", t.month,
      c.challan_number AS "challanNumber", c.bsr_code AS "bsrCode",
      c.challan_date AS "challanDate", c.amount_paid AS "challanAmount"
    FROM tds_entries t
    LEFT JOIN tds_challans c ON c.id = t.challan_id
    WHERE t.company_id = $1 AND t.financial_year = $2 AND t.month = ANY($3)
      ${sectionFilter}
    ORDER BY t.month, t.section, t.deductee_name
  `, [COMPANY_ID, financial_year, months]);

  const challans = await db.query(`
    SELECT DISTINCT
      c.challan_number AS "challanNumber", c.bsr_code AS "bsrCode",
      c.challan_date AS "challanDate", c.section, c.amount_paid AS "amountPaid",
      c.acknowledgement_no AS "acknowledgementNo"
    FROM tds_challans c
    WHERE c.company_id = $1 AND c.financial_year = $2 AND c.month = ANY($3)
    ORDER BY c.challan_date
  `, [COMPANY_ID, financial_year, months]);

  res.json({
    form, quarter, financialYear: financial_year,
    deductorDetails: { tan: 'TBD', pan: 'TBD', name: 'Metapharsic Lifesciences Pvt Ltd' },
    challans: challans.rows,
    deductees: entries.rows,
    totalEntries:   entries.rows.length,
    totalTdsAmount: entries.rows.reduce((s, r) => s + parseFloat(r.totalTds || 0), 0),
    missingPan:     entries.rows.filter(r => !r.deducteePan).length,
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/form16/:employeeId?financial_year=2025-26
// ════════════════════════════════════════════════════════════════════════════
router.get('/form16/:employeeId', asyncRoute(async (req, res) => {
  const { employeeId } = req.params;
  const { financial_year } = req.query;

  if (!financial_year) return res.status(400).json({ error: 'financial_year required' });

  // Employee basic info
  const emp = await db.query(
    `SELECT e.id, e.first_name || ' ' || e.last_name AS name,
            e.pan, e.designation, d.name AS department
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id = $1`,
    [employeeId]
  );
  if (!emp.rows.length) return res.status(404).json({ error: 'Employee not found' });

  // 12 months of salary slips
  const slips = await db.query(`
    SELECT
      month, year, basic_salary AS "basicSalary", hra,
      COALESCE(allowances, 0) AS allowances, gross_salary AS "grossSalary",
      tds_amount AS "tdsAmount", net_salary AS "netSalary"
    FROM salary_slips
    WHERE employee_id = $1 AND status != 'Draft'
      AND (
        (year = split_part($2,'-',1)::INTEGER AND month >= 4)
        OR
        (year = split_part($2,'-',2)::INTEGER + 2000 - 1 AND month <= 3
          AND length(split_part($2,'-',2)) = 2)
      )
    ORDER BY year, month
  `, [employeeId, financial_year]);

  // TDS workings
  const workings = await db.query(`
    SELECT month, tds_amount AS "tdsAmount", regime, gross_income AS "grossIncome",
           total_deductions AS "totalDeductions", taxable_income AS "taxableIncome"
    FROM hr_tds_workings
    WHERE employee_id = $1 AND financial_year = $2
    ORDER BY month
  `, [employeeId, financial_year]);

  // Challans for 192
  const challans = await db.query(`
    SELECT DISTINCT c.challan_number AS "challanNumber", c.bsr_code AS "bsrCode",
           c.challan_date AS "challanDate", c.amount_paid AS "amountPaid"
    FROM tds_challans c
    JOIN tds_entries te ON te.challan_id = c.id
    WHERE te.source_id = $1 AND c.section = '192' AND c.financial_year = $2
  `, [employeeId, financial_year]);

  res.json({
    employee:   emp.rows[0],
    financialYear: financial_year,
    salarySlips: slips.rows,
    tdsWorkings: workings.rows,
    challans:    challans.rows,
    totalTds:    slips.rows.reduce((s, r) => s + parseFloat(r.tdsAmount || 0), 0),
    totalGross:  slips.rows.reduce((s, r) => s + parseFloat(r.grossSalary || 0), 0),
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/form16a/:partyId?quarter=Q1&financial_year=2025-26
// ════════════════════════════════════════════════════════════════════════════
router.get('/form16a/:partyId', asyncRoute(async (req, res) => {
  const { partyId } = req.params;
  const { quarter = 'Q1', financial_year } = req.query;

  if (!financial_year) return res.status(400).json({ error: 'financial_year required' });

  const quarterMonths = { Q1: [4,5,6], Q2: [7,8,9], Q3: [10,11,12], Q4: [1,2,3] };
  const months = quarterMonths[quarter] || quarterMonths.Q1;

  const party = await db.query(
    'SELECT id, name, pan, gstin FROM parties WHERE id = $1',
    [partyId]
  );
  if (!party.rows.length) return res.status(404).json({ error: 'Party not found' });

  const entries = await db.query(`
    SELECT
      t.id, t.section, t.payment_date AS "paymentDate",
      t.payment_amount AS "paymentAmount", t.tds_rate AS "tdsRate",
      t.tds_amount AS "tdsAmount", t.total_tds AS "totalTds",
      t.nature_of_payment AS "natureOfPayment",
      c.challan_number AS "challanNumber", c.bsr_code AS "bsrCode",
      c.challan_date AS "challanDate"
    FROM tds_entries t
    LEFT JOIN tds_challans c ON c.id = t.challan_id
    WHERE t.company_id = $1 AND t.financial_year = $2 AND t.month = ANY($3)
      AND t.source_id = $4 AND t.source_type IN ('VENDOR','COMMISSION')
    ORDER BY t.payment_date
  `, [COMPANY_ID, financial_year, months, partyId]);

  res.json({
    quarter, financialYear: financial_year,
    deductee: party.rows[0],
    deductor: { name: 'Metapharsic Lifesciences Pvt Ltd', tan: 'TBD', pan: 'TBD' },
    entries:   entries.rows,
    totalPayment: entries.rows.reduce((s, r) => s + parseFloat(r.paymentAmount || 0), 0),
    totalTds:     entries.rows.reduce((s, r) => s + parseFloat(r.totalTds || 0), 0),
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/compliance-status?month=6&year=2026
// ════════════════════════════════════════════════════════════════════════════
router.get('/compliance-status', asyncRoute(async (req, res) => {
  const month = parseInt(req.query.month || new Date().getMonth() + 1);
  const year  = parseInt(req.query.year  || new Date().getFullYear());
  const fy    = financialYear(month, year);

  const [totalEntries, linked, missingPan, challans] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM tds_entries WHERE month=$1 AND financial_year=$2 AND company_id=$3`,
             [month, fy, COMPANY_ID]),
    db.query(`SELECT COUNT(*) FROM tds_entries WHERE month=$1 AND financial_year=$2 AND company_id=$3 AND challan_id IS NOT NULL`,
             [month, fy, COMPANY_ID]),
    db.query(`SELECT COUNT(*) FROM tds_entries WHERE month=$1 AND financial_year=$2 AND company_id=$3 AND deductee_pan IS NULL`,
             [month, fy, COMPANY_ID]),
    db.query(`SELECT COUNT(*), COALESCE(SUM(amount_paid),0) AS total_paid
              FROM tds_challans WHERE month=$1 AND financial_year=$2 AND company_id=$3`,
             [month, fy, COMPANY_ID]),
  ]);

  const total    = parseInt(totalEntries.rows[0].count);
  const linked_n = parseInt(linked.rows[0].count);
  const noPan    = parseInt(missingPan.rows[0].count);
  const challanCount = parseInt(challans.rows[0].count);
  const challanPaid  = parseFloat(challans.rows[0].total_paid);

  // Due date = 7th of next month
  const dueDate = new Date(year, month, 7);
  const today   = new Date();
  const daysLeft = Math.ceil((dueDate - today) / 86400000);

  res.json({
    month, year, financialYear: fy,
    totalEntries:    total,
    linkedToChallans: linked_n,
    unlinked:        total - linked_n,
    missingPan:      noPan,
    challans:        challanCount,
    challanAmountPaid: challanPaid,
    challanDueDate:  dueDate.toISOString().split('T')[0],
    daysUntilDue:    daysLeft,
    allLinked:       total > 0 && linked_n === total,
    status:          total === 0 ? 'NO_ENTRIES'
                   : linked_n === total && challanCount > 0 ? 'COMPLETE'
                   : challanCount > 0 ? 'PARTIAL'
                   : 'PENDING',
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/alerts
// ════════════════════════════════════════════════════════════════════════════
router.get('/alerts', asyncRoute(async (req, res) => {
  const today = new Date();
  const month = today.getMonth() + 1;  // current month
  const year  = today.getFullYear();
  const fy    = financialYear(month, year);

  // Previous month's unlinked entries (challan overdue)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevFy    = financialYear(prevMonth, prevYear);

  const [unlinked, noPan, prevUnlinked] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM tds_entries
              WHERE month=$1 AND financial_year=$2 AND company_id=$3 AND challan_id IS NULL`,
             [month, fy, COMPANY_ID]),
    db.query(`SELECT COUNT(*), array_agg(deductee_name) AS names
              FROM tds_entries
              WHERE company_id=$1 AND deductee_pan IS NULL`,
             [COMPANY_ID]),
    db.query(`SELECT COUNT(*) FROM tds_entries
              WHERE month=$1 AND financial_year=$2 AND company_id=$3 AND challan_id IS NULL`,
             [prevMonth, prevFy, COMPANY_ID]),
  ]);

  const alerts = [];

  if (parseInt(prevUnlinked.rows[0].count) > 0) {
    alerts.push({
      type: 'OVERDUE_CHALLAN',
      severity: 'HIGH',
      message: `${prevUnlinked.rows[0].count} TDS entries from last month are not linked to any challan. Challan was due on 7th — interest @ 1.5%/month applicable.`,
    });
  }

  if (parseInt(noPan.rows[0].count) > 0) {
    alerts.push({
      type: 'MISSING_PAN',
      severity: 'MEDIUM',
      message: `${noPan.rows[0].count} TDS entries have no deductee PAN — 20% TDS rate applies. Deductees: ${(noPan.rows[0].names || []).slice(0,3).join(', ')}`,
    });
  }

  if (parseInt(unlinked.rows[0].count) > 0) {
    const dueDate = new Date(year, month, 7);
    const daysLeft = Math.ceil((dueDate - today) / 86400000);
    alerts.push({
      type: 'CHALLAN_DUE',
      severity: daysLeft <= 3 ? 'HIGH' : 'LOW',
      message: `${unlinked.rows[0].count} entries this month not yet linked to challan. Due in ${daysLeft} days (7th).`,
    });
  }

  res.json({ alerts, generatedAt: today.toISOString() });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/tds/reconciliation?financial_year=2025-26
// ════════════════════════════════════════════════════════════════════════════
router.get('/reconciliation', asyncRoute(async (req, res) => {
  const { financial_year } = req.query;
  if (!financial_year) return res.status(400).json({ error: 'financial_year required' });

  // Summarise per section/month — 26AS comparison would require portal data import
  const summary = await db.query(`
    SELECT
      section, month,
      COUNT(*)                       AS "entries",
      COALESCE(SUM(total_tds),0)     AS "totalTds",
      COUNT(*) FILTER (WHERE challan_id IS NOT NULL) AS "linked",
      COUNT(*) FILTER (WHERE deductee_pan IS NULL)   AS "missingPan"
    FROM tds_entries
    WHERE financial_year = $1 AND company_id = $2
    GROUP BY section, month
    ORDER BY month, section
  `, [financial_year, COMPANY_ID]);

  res.json({
    financialYear: financial_year,
    note: 'Upload 26AS/AIS data for full deductee-level reconciliation (portal import feature TBD)',
    summary: summary.rows,
  });
}));

module.exports = router;
