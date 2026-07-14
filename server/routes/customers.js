/**
 * Customer Compliance API — Wholesale Drug License (WDL) compliance tracking
 * Entity types: Retail Chemist, Wholesale Dealer, Hospital, Clinic, Doctor, Govt, Other
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');
const { sendExpiryAlerts } = require('../services/complianceNotificationService');
const logger = require('../utils/logger');
const kafka = require('../services/kafka');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'customer-docs');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mimetype);
    cb(null, ok);
  },
});

router.use(verifyTokenMiddleware);

// ── Required documents per entity type ──────────────────────────────────────
const REQUIRED_DOCS = {
  'Retail Chemist': ['dl_20a', 'dl_20a_expiry', 'dl_20b', 'dl_20b_expiry', 'pharmacist_name', 'pharmacist_reg_no', 'gstin', 'mobile'],
  'Wholesale Dealer': ['dl_20c', 'dl_20c_expiry', 'dl_20d', 'dl_20d_expiry', 'gstin', 'mobile'],
  'Hospital': ['hospital_reg_no', 'hospital_reg_expiry', 'gstin', 'mobile'],
  'Clinic': ['doctor_reg_no', 'doctor_degree', 'mobile'],
  'Doctor': ['doctor_reg_no', 'doctor_degree', 'mobile'],
  'Government': ['firm_reg_no', 'mobile'],
  'Other': ['mobile'],
};

// Compute compliance status for a party row
function computeCompliance(p) {
  if (!p.entity_type) return { status: 'INCOMPLETE', score: 0 };
  const required = REQUIRED_DOCS[p.entity_type] || ['mobile'];
  const today = new Date();
  const d30 = new Date(today); d30.setDate(d30.getDate() + 30);
  const d90 = new Date(today); d90.setDate(d90.getDate() + 90);

  // Collect all expiry dates present on the party
  const expiryFields = [
    p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
    p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry,
    p.fssai_expiry, p.firm_reg_expiry,
  ].filter(Boolean).map(d => new Date(d));

  // Check missing required fields
  const missing = required.filter(f => !p[f] || p[f] === '');
  if (missing.length > 0) return { status: 'INCOMPLETE', score: Math.round((1 - missing.length / required.length) * 100) };

  // Check expiry dates
  const expired = expiryFields.filter(d => d < today);
  if (expired.length > 0) return { status: 'EXPIRED', score: 10 };

  const critical = expiryFields.filter(d => d <= d30);
  if (critical.length > 0) return { status: 'CRITICAL', score: 50 };

  const warning = expiryFields.filter(d => d <= d90);
  if (warning.length > 0) return { status: 'EXPIRING_SOON', score: 75 };

  return { status: 'COMPLETE', score: 100 };
}

// ── GET /api/customers — list with compliance ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search = '', entity_type = 'All', compliance = 'All', status = 'Active', page = 1, limit = 50, scope = '' } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    // scope=all → Party & Entity Registry master view (all parties incl. Creditors/suppliers).
    // default → customers only (Debtor/Both), preserving behavior for CustomerDatabasePage.
    let where = scope === 'all' ? "WHERE 1=1" : "WHERE p.type IN ('Debtor','Both')";

    // status filter: 'Active' (default) hides deleted/inactive, 'All' shows everything except hard-Deleted, else exact match
    if (status === 'All') {
      where += " AND p.status != 'Deleted'";
    } else {
      params.push(status); where += ` AND p.status = $${params.length}`;
    }

    if (search) { params.push(`%${search}%`); where += ` AND (p.name ILIKE $${params.length} OR p.mobile ILIKE $${params.length} OR p.drug_license_no ILIKE $${params.length})`; }
    if (entity_type === '__null__') { where += ` AND p.entity_type IS NULL`; }
    else if (entity_type !== 'All') { params.push(entity_type); where += ` AND p.entity_type = $${params.length}`; }
    if (compliance !== 'All') { params.push(compliance); where += ` AND p.compliance_status = $${params.length}`; }

    const { rows } = await db.query(`
      SELECT p.id, p.name, p.type, p.entity_type, p.mobile, p.email, p.whatsapp_number,
             p.party_code, p.city, p.state, p.gstin, p.drug_license_no,
             p.dl_20a, p.dl_20a_expiry, p.dl_20b, p.dl_20b_expiry,
             p.dl_20c, p.dl_20c_expiry, p.dl_20d, p.dl_20d_expiry,
             p.dl_expiry_date, p.pharmacist_name, p.pharmacist_reg_no, p.pharmacist_reg_expiry,
             p.doctor_reg_no, p.doctor_degree, p.hospital_reg_no, p.hospital_reg_expiry,
             p.fssai_no, p.fssai_expiry, p.firm_reg_no, p.firm_reg_expiry,
             p.compliance_status, p.compliance_score, p.last_compliance_check,
             p.credit_limit as "creditLimit", p.current_balance as "currentBalance",
             p.status, p.category, p.contact_person as "contactPerson",
             p.address, p.pan, p.credit_days as "creditDays",
             (SELECT COUNT(*) FROM customer_documents cd WHERE cd.party_id = p.id) as doc_count,
             (SELECT COUNT(*) FROM customer_documents cd WHERE cd.party_id = p.id AND cd.verified = true) as verified_doc_count
      FROM parties p
      ${where}
      ORDER BY p.compliance_status ASC, p.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Recompute compliance live (catches newly expired docs)
    const updated = rows.map(p => {
      const { status, score } = computeCompliance(p);
      return { ...p, compliance_status: status, compliance_score: score };
    });

    const countRes = await db.query(`SELECT COUNT(*) FROM parties p ${where}`, params);

    res.json({ success: true, data: updated, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    logger.error('GET /customers failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/customers/alerts — all EXPIRED/CRITICAL/EXPIRING_SOON ──────────
router.get('/alerts', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.name, p.entity_type, p.mobile, p.whatsapp_number, p.email,
             p.compliance_status, p.compliance_score,
             p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
             p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry,
             p.fssai_expiry, p.firm_reg_expiry,
             p.dl_20a, p.dl_20b, p.dl_20c, p.dl_20d, p.drug_license_no,
             p.pharmacist_name, p.pharmacist_reg_no, p.doctor_reg_no, p.doctor_degree,
             p.hospital_reg_no, p.firm_reg_no, p.gstin, p.city
      FROM parties p
      WHERE p.type IN ('Debtor','Both')
        AND p.status != 'Deleted'
      ORDER BY p.name
    `);

    const alerts = rows.map(p => {
      const { status, score } = computeCompliance(p);
      return { ...p, compliance_status: status, compliance_score: score };
    }).filter(p => ['EXPIRED', 'CRITICAL', 'EXPIRING_SOON', 'INCOMPLETE'].includes(p.compliance_status));

    const summary = {
      expired: alerts.filter(a => a.compliance_status === 'EXPIRED').length,
      critical: alerts.filter(a => a.compliance_status === 'CRITICAL').length,
      expiring: alerts.filter(a => a.compliance_status === 'EXPIRING_SOON').length,
      incomplete: alerts.filter(a => a.compliance_status === 'INCOMPLETE').length,
      total: alerts.length,
    };

    res.json({ success: true, data: alerts, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/customers/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM parties WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Customer not found' });
    const docs = await db.query('SELECT * FROM customer_documents WHERE party_id = $1 ORDER BY doc_type', [req.params.id]);
    const p = rows[0];
    const { status, score } = computeCompliance(p);
    res.json({ success: true, data: { ...p, compliance_status: status, compliance_score: score, documents: docs.rows } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/customers/:id — update compliance fields ───────────────────────
router.post('/', async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { name, entity_type = null, mobile = null, email = null, city = null, type = 'Debtor', status = 'Active' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });

    // Duplicate guard — same name+mobile already active for this company
    if (mobile) {
      const dup = await db.query(
        `SELECT id, name FROM parties WHERE company_id = $1 AND mobile = $2 AND status != 'Deleted' LIMIT 1`,
        [companyId, mobile]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ success: false, error: `Party already exists with this mobile: ${dup.rows[0].name}`, existingId: dup.rows[0].id });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO parties (company_id, name, entity_type, mobile, email, city, type, status, compliance_status, compliance_score, party_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'INCOMPLETE',0, nextval('party_code_seq')::text) RETURNING id, name, party_code`,
      [companyId, name, entity_type, mobile, email, city, type, status]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Fields whose changes are logged to audit_logs for credit-history tracking (see docs/workflows/credit-tracking-flow.md)
const CREDIT_TRACKED_FIELDS = ['credit_limit', 'credit_days', 'status'];

router.put('/:id', async (req, res) => {
  try {
    const fields = [
      'entity_type','name','mobile','email','whatsapp_number','address','city','state','pin_code',
      'gstin','pan','drug_license_no','dl_expiry_date',
      'dl_20a','dl_20a_expiry','dl_20b','dl_20b_expiry',
      'dl_20c','dl_20c_expiry','dl_20d','dl_20d_expiry',
      'pharmacist_name','pharmacist_reg_no','pharmacist_reg_expiry',
      'doctor_reg_no','doctor_degree',
      'hospital_reg_no','hospital_reg_expiry',
      'fssai_no','fssai_expiry','firm_reg_no','firm_reg_expiry',
      'credit_limit','credit_days','category','contact_person',
      'bank_name','account_number','ifsc_code','remarks','territory','route','status',
    ];

    // Snapshot old values for the tracked fields before overwriting them.
    const { rows: [before] } = await db.query(
      `SELECT ${CREDIT_TRACKED_FIELDS.join(', ')} FROM parties WHERE id = $1`,
      [req.params.id]
    );
    if (!before) return res.status(404).json({ success: false, error: 'Not found' });

    const sets = []; const vals = [];
    fields.forEach(f => {
      if (f in req.body) { vals.push(req.body[f] || null); sets.push(`${f} = $${vals.length}`); }
    });

    // Compute new compliance status
    const merged = { ...req.body };
    const { status, score } = computeCompliance(merged);
    vals.push(status, score, new Date(), req.params.id);
    sets.push(`compliance_status = $${vals.length - 3}`, `compliance_score = $${vals.length - 2}`, `last_compliance_check = $${vals.length - 1}`, `updated_at = NOW()`);

    const { rows } = await db.query(
      `UPDATE parties SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id, name, compliance_status, compliance_score`,
      vals
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });

    // Log credit-relevant field changes as recognizable audit_logs rows (module=CREDIT_TRACKING).
    for (const f of CREDIT_TRACKED_FIELDS) {
      if (f in req.body) {
        const oldVal = before[f];
        const newVal = req.body[f] || null;
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          await db.query(
            `INSERT INTO audit_logs (user_id, action, module, table_name, record_id, entity_type, entity_id, changes, status)
             VALUES ($1, $2, 'CREDIT_TRACKING', 'parties', $3, 'party', $3, $4, 'success')`,
            [
              req.user?.id || req.user?.userId || null,
              `${f.toUpperCase()}_CHANGED`,
              req.params.id,
              JSON.stringify({ field: f, old_value: oldVal, new_value: newVal, party_name: rows[0].name })
            ]
          ).catch(e => logger.error('Credit history audit log failed', { error: e.message }));
        }
      }
    }

    // Broadcast to Kafka (erp.party.events) so the WebSocket layer live-refreshes
    // POS/Wholesale/OMS party pickers and Customer DB on other logged-in screens.
    kafka.events.party.updated(rows[0], req.user?.username).catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error('PUT /customers/:id failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/customers/:id/credit-history — credit_limit/credit_days/status change log ──
router.get('/:id/credit-history', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT al.*, u.name as changed_by_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = 'party' AND al.entity_id = $1 AND al.module = 'CREDIT_TRACKING'
       ORDER BY al.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/customers/:id/documents ────────────────────────────────────────
router.get('/:id/documents', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customer_documents WHERE party_id = $1 ORDER BY doc_type, created_at DESC', [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/customers/:id/documents — add doc (JSON) ──────────────────────
router.post('/:id/documents', async (req, res) => {
  try {
    const { doc_type, doc_number, expiry_date, file_path, file_name, notes } = req.body;
    if (!doc_type) return res.status(400).json({ success: false, error: 'doc_type required' });
    const { rows } = await db.query(
      `INSERT INTO customer_documents (party_id, doc_type, doc_number, expiry_date, file_path, file_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, doc_type, doc_number || null, expiry_date || null, file_path || null, file_name || null, notes || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/customers/:id/documents/upload — multipart file upload ─────────
router.post('/:id/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const { doc_type = 'OTHER', doc_number, expiry_date, notes } = req.body;
    const file_path = `/uploads/customer-docs/${req.file.filename}`;
    const { rows } = await db.query(
      `INSERT INTO customer_documents (party_id, doc_type, doc_number, expiry_date, file_path, file_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, doc_type, doc_number || null, expiry_date || null, file_path, req.file.originalname, notes || null]
    );
    logger.info('Customer doc uploaded', { party: req.params.id, doc_type, file: req.file.filename });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error('Doc upload failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/customers/documents/:docId/verify ──────────────────────────────
router.put('/documents/:docId/verify', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE customer_documents SET verified = true, verified_by = $1, verified_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [req.user?.username || 'System', req.params.docId]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/customers/documents/:docId ──────────────────────────────────
router.delete('/documents/:docId', async (req, res) => {
  try {
    await db.query('DELETE FROM customer_documents WHERE id = $1', [req.params.docId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/customers/send-alerts — trigger email+WA for expiring docs ────
router.post('/send-alerts', async (req, res) => {
  try {
    const { rows: expiring } = await db.query(`
      SELECT p.name as "name", p.drug_license_no as "license_number",
             LEAST(p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
                   p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry) as expiry_date,
             p.mobile, p.whatsapp_number, p.email, p.compliance_status
      FROM parties p
      WHERE p.type IN ('Debtor','Both')
        AND p.status != 'Deleted'
        AND LEAST(p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
                  p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry)
            <= CURRENT_DATE + 90
      ORDER BY expiry_date ASC
    `);
    if (expiring.length) await sendExpiryAlerts(expiring);
    res.json({ success: true, sent: expiring.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
