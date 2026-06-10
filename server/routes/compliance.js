const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const db      = require("../db");
const { verifyTokenMiddleware } = require("../utils/jwt");
const { sendExpiryAlerts, sendTestNotification } = require("../services/complianceNotificationService");

router.use(verifyTokenMiddleware);

// ── Multer — certificate uploads ───────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "certificates");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW STATS — single endpoint for the dashboard tab
// ══════════════════════════════════════════════════════════════════════════════

router.get("/stats", async (req, res) => {
  try {
    const [licRow, tempRow, auditRow, h1Row] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                                             AS total,
          COUNT(*) FILTER (WHERE expiry_date IS NULL OR expiry_date > CURRENT_DATE + 30)     AS valid,
          COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)     AS expiring,
          COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE)                                 AS expired,
          COUNT(*) FILTER (WHERE status = 'Suspended')                                       AS suspended
        FROM drug_licenses
        WHERE status != 'Revoked'
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'Warning' AND log_date >= CURRENT_DATE - 30) AS breaches_30d,
          COUNT(*) FILTER (WHERE log_date = CURRENT_DATE)                               AS logs_today
        FROM temperature_logs
      `),
      db.query(`
        SELECT score_percentage, audit_date
        FROM compliance_audits
        ORDER BY audit_date DESC LIMIT 1
      `),
      db.query(`
        SELECT COUNT(*) AS total_month
        FROM h1_register
        WHERE entry_date >= CURRENT_DATE - 30
      `),
    ]);

    const lic     = licRow.rows[0];
    const temp    = tempRow.rows[0];
    const lastAudit = auditRow.rows[0] || null;

    res.json({
      success: true,
      data: {
        licenses: {
          total:     parseInt(lic.total),
          valid:     parseInt(lic.valid),
          expiring:  parseInt(lic.expiring),
          expired:   parseInt(lic.expired),
          suspended: parseInt(lic.suspended),
        },
        temperature: {
          breaches30d: parseInt(temp.breaches_30d),
          logsToday:   parseInt(temp.logs_today),
        },
        lastAudit: lastAudit ? {
          score:    parseFloat(lastAudit.score_percentage) || 0,
          date:     lastAudit.audit_date,
        } : null,
        h1: {
          totalMonth: parseInt(h1Row.rows[0].total_month),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// LICENSES
// ══════════════════════════════════════════════════════════════════════════════

router.get("/licenses", async (req, res) => {
  try {
    const { category } = req.query;
    let query = "SELECT * FROM drug_licenses WHERE 1=1";
    const params = [];
    if (category && category !== 'All') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += " ORDER BY expiry_date ASC NULLS LAST";
    const { rows } = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/licenses", async (req, res) => {
  try {
    const { name, license_number, expiry_date, start_date, category, status, notes, issued_by } = req.body;
    if (!name || !license_number)
      return res.status(400).json({ success: false, error: "Name and number required" });

    const { rows } = await db.query(
      `INSERT INTO drug_licenses (name,license_number,expiry_date,start_date,category,status,notes,issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, license_number, expiry_date||null, start_date||null, category||null, status||"Valid", notes||null, issued_by||null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/licenses/:id", async (req, res) => {
  try {
    const { name, license_number, expiry_date, start_date, category, status, notes, issued_by } = req.body;
    if (!name || !license_number)
      return res.status(400).json({ success: false, error: "Name and number required" });

    const { rows } = await db.query(
      `UPDATE drug_licenses SET name=$1,license_number=$2,expiry_date=$3,start_date=$4,category=$5,
       status=$6,notes=$7,issued_by=$8,updated_at=CURRENT_TIMESTAMP
       WHERE id=$9 RETURNING *`,
      [name, license_number, expiry_date||null, start_date||null, category||null, status||"Valid", notes||null, issued_by||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/licenses/:id", async (req, res) => {
  try {
    const existing = await db.query("SELECT file_path FROM drug_licenses WHERE id=$1", [req.params.id]);
    if (existing.rows[0]?.file_path) {
      const full = path.join(UPLOAD_DIR, path.basename(existing.rows[0].file_path));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    const { rows } = await db.query("DELETE FROM drug_licenses WHERE id=$1 RETURNING id,name", [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Certificate upload ─────────────────────────────────────────────────────
router.post("/licenses/:id/upload", upload.single("certificate"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const filePath = `/uploads/certificates/${req.file.filename}`;
    const fileName = req.file.originalname;
    const existing = await db.query("SELECT file_path FROM drug_licenses WHERE id=$1", [req.params.id]);
    if (existing.rows[0]?.file_path) {
      const old = path.join(UPLOAD_DIR, path.basename(existing.rows[0].file_path));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const { rows } = await db.query(
      "UPDATE drug_licenses SET file_path=$1,file_name=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *",
      [filePath, fileName, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "License not found" });
    res.json({ success: true, data: rows[0], file_url: filePath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/licenses/:id/certificate", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT file_path,file_name FROM drug_licenses WHERE id=$1", [req.params.id]);
    if (!rows.length || !rows[0].file_path)
      return res.status(404).json({ success: false, error: "No certificate attached" });
    const full = path.join(UPLOAD_DIR, path.basename(rows[0].file_path));
    if (!fs.existsSync(full))
      return res.status(404).json({ success: false, error: "File not found on disk" });
    res.download(full, rows[0].file_name || "certificate");
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/licenses/:id/send-alert", async (req, res) => {
  try {
    const licRes  = await db.query("SELECT * FROM drug_licenses WHERE id=$1", [req.params.id]);
    if (!licRes.rows.length) return res.status(404).json({ success: false, error: "License not found" });
    const settRes = await db.query("SELECT * FROM compliance_notification_settings LIMIT 1");
    if (!settRes.rows.length) return res.status(400).json({ success: false, error: "Notification settings not configured" });
    const result = await sendExpiryAlerts(licRes.rows, settRes.rows[0]);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RISK SCORE  (enhanced — 5 factors)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/risk-score', async (req, res) => {
  try {
    const [licRows, tempBreachRow, auditRow] = await Promise.all([
      db.query("SELECT expiry_date, status, category FROM drug_licenses WHERE status != 'Revoked'"),
      db.query("SELECT COUNT(*) AS cnt FROM temperature_logs WHERE status='Warning' AND log_date >= CURRENT_DATE - 30"),
      db.query("SELECT score_percentage FROM compliance_audits ORDER BY audit_date DESC LIMIT 1"),
    ]);

    const now = new Date();
    let riskScore = 10;
    const factors = [];

    // Factor 1: expired licenses
    const expired = licRows.rows.filter(l => l.expiry_date && new Date(l.expiry_date) < now);
    if (expired.length > 0) { riskScore += expired.length * 20; factors.push({ name: 'Expired Licenses', impact: 'High', detail: `${expired.length} expired` }); }
    else { factors.push({ name: 'Expired Licenses', impact: 'Low', detail: 'None' }); }

    // Factor 2: expiring within 30d
    const expiring = licRows.rows.filter(l => {
      if (!l.expiry_date) return false;
      const d = Math.ceil((new Date(l.expiry_date) - now) / 86400000);
      return d >= 0 && d <= 30;
    });
    if (expiring.length > 0) { riskScore += expiring.length * 10; factors.push({ name: 'Expiring Soon', impact: expiring.length > 1 ? 'High' : 'Medium', detail: `${expiring.length} within 30d` }); }
    else { factors.push({ name: 'Expiring Soon', impact: 'Low', detail: 'None' }); }

    // Factor 3: suspended
    const suspended = licRows.rows.filter(l => l.status === 'Suspended');
    if (suspended.length > 0) { riskScore += suspended.length * 25; factors.push({ name: 'Suspended', impact: 'High', detail: `${suspended.length} suspended` }); }
    else { factors.push({ name: 'Suspended', impact: 'Low', detail: 'None' }); }

    // Factor 4: temp breaches
    const breaches = parseInt(tempBreachRow.rows[0].cnt) || 0;
    if (breaches > 3) { riskScore += 15; factors.push({ name: 'Cold Chain', impact: 'High', detail: `${breaches} breaches (30d)` }); }
    else if (breaches > 0) { riskScore += 5; factors.push({ name: 'Cold Chain', impact: 'Medium', detail: `${breaches} breaches (30d)` }); }
    else { factors.push({ name: 'Cold Chain', impact: 'Low', detail: 'No breaches' }); }

    // Factor 5: last audit score
    const lastAuditScore = auditRow.rows[0] ? parseFloat(auditRow.rows[0].score_percentage) : null;
    if (lastAuditScore === null) { riskScore += 10; factors.push({ name: 'Last Audit', impact: 'Medium', detail: 'No audit on record' }); }
    else if (lastAuditScore < 60) { riskScore += 15; factors.push({ name: 'Last Audit', impact: 'High', detail: `Score: ${lastAuditScore}%` }); }
    else if (lastAuditScore < 80) { riskScore += 5; factors.push({ name: 'Last Audit', impact: 'Medium', detail: `Score: ${lastAuditScore}%` }); }
    else { factors.push({ name: 'Last Audit', impact: 'Low', detail: `Score: ${lastAuditScore}%` }); }

    riskScore = Math.min(riskScore, 100);
    const riskLevel = riskScore > 70 ? 'Critical' : riskScore > 40 ? 'Medium' : 'Low';

    res.json({ success: true, data: { score: riskScore, level: riskLevel, factors, lastAnalyzed: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

router.get("/notification-settings", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM compliance_notification_settings LIMIT 1");
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/notification-settings", async (req, res) => {
  try {
    const { email_enabled, email_address, whatsapp_enabled, whatsapp_number, whatsapp_apikey,
            alert_days_30, alert_days_15, alert_days_7, alert_days_1 } = req.body;
    await db.query(
      `UPDATE compliance_notification_settings SET
        email_enabled=$1, email_address=$2,
        whatsapp_enabled=$3, whatsapp_number=$4, whatsapp_apikey=$5,
        alert_days_30=$6, alert_days_15=$7, alert_days_7=$8, alert_days_1=$9,
        updated_at=CURRENT_TIMESTAMP`,
      [email_enabled, email_address, whatsapp_enabled, whatsapp_number, whatsapp_apikey,
       alert_days_30, alert_days_15, alert_days_7, alert_days_1]
    );
    const { rows } = await db.query("SELECT * FROM compliance_notification_settings LIMIT 1");
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/notification-test", async (req, res) => {
  try {
    const { channel } = req.body;
    const settRes = await db.query("SELECT * FROM compliance_notification_settings LIMIT 1");
    if (!settRes.rows.length) return res.status(400).json({ success: false, error: "Settings not found" });
    const result = await sendTestNotification(settRes.rows[0], channel);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/notification-logs", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT l.*,d.name AS license_name FROM compliance_notification_log l
       LEFT JOIN drug_licenses d ON d.id=l.license_id
       ORDER BY l.sent_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// H1 REGISTER
// ══════════════════════════════════════════════════════════════════════════════

router.get("/h1", async (req, res) => {
  try {
    const { drug, from, to, page=1, limit=100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = "SELECT * FROM h1_register WHERE 1=1";
    const params = [];
    if (drug)  { params.push(`%${drug}%`);  query += ` AND (drug_name ILIKE $${params.length} OR patient_name ILIKE $${params.length} OR invoice_no ILIKE $${params.length})`; }
    if (from)  { params.push(from);          query += ` AND entry_date >= $${params.length}`; }
    if (to)    { params.push(to);            query += ` AND entry_date <= $${params.length}`; }
    query += ` ORDER BY entry_date DESC, id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), offset);
    const { rows } = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post("/h1", async (req, res) => {
  try {
    const { entry_date, invoice_no, patient_name, doctor_name, drug_name, batch_number, quantity } = req.body;
    if (!patient_name || !drug_name || !quantity)
      return res.status(400).json({ success: false, error: "Patient, drug and quantity required" });
    const { rows } = await db.query(
      `INSERT INTO h1_register (entry_date,invoice_no,patient_name,doctor_name,drug_name,batch_number,quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [entry_date||null, invoice_no||null, patient_name, doctor_name||null, drug_name, batch_number||null, quantity]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete("/h1/:id", async (req, res) => {
  try {
    const { rows } = await db.query("DELETE FROM h1_register WHERE id=$1 RETURNING id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Record not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEMPERATURE LOGS
// ══════════════════════════════════════════════════════════════════════════════

router.get("/temp-logs", async (req, res) => {
  try {
    const { equipment, limit=100 } = req.query;
    let query = "SELECT * FROM temperature_logs WHERE 1=1";
    const params = [];
    if (equipment && equipment !== 'All') {
      params.push(equipment);
      query += ` AND equipment_name = $${params.length}`;
    }
    query += ` ORDER BY log_date DESC, log_time DESC LIMIT $${params.length+1}`;
    params.push(parseInt(limit));
    const { rows } = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/temp-equipment", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT DISTINCT equipment_name FROM temperature_logs WHERE equipment_name IS NOT NULL ORDER BY equipment_name"
    );
    const names = rows.map(r => r.equipment_name);
    if (!names.includes('Refrigerator 1')) names.unshift('Refrigerator 1');
    res.json({ success: true, data: names });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post("/temp-logs", async (req, res) => {
  try {
    const { temperature, equipment_name, checked_by, remarks } = req.body;
    const temp = parseFloat(temperature);
    if (isNaN(temp)) return res.status(400).json({ success: false, error: "Valid temperature required" });
    const status = (temp >= 2 && temp <= 8) ? "OK" : "Warning";
    const { rows } = await db.query(
      "INSERT INTO temperature_logs (temperature,equipment_name,checked_by,remarks,status) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [temp, equipment_name||'Refrigerator 1', checked_by||null, remarks||null, status]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUDITS  (now DB-backed)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/audits", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM compliance_audits ORDER BY audit_date DESC LIMIT 50");
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post("/audits", async (req, res) => {
  try {
    const { audit_date, auditor_name, score_percentage, status, notes, checklist } = req.body;
    const { rows } = await db.query(
      `INSERT INTO compliance_audits (audit_date,auditor_name,score_percentage,status,notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [audit_date||new Date().toISOString().slice(0,10), auditor_name||null,
       score_percentage!=null ? score_percentage : null, status||"Completed", notes||null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete("/audits/:id", async (req, res) => {
  try {
    const { rows } = await db.query("DELETE FROM compliance_audits WHERE id=$1 RETURNING id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/temp", (req, res) => res.redirect("/api/compliance/temp-logs"));

module.exports = router;
