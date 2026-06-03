const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const db      = require("../db");
const { verifyTokenMiddleware } = require("../utils/jwt");
const { sendExpiryAlerts, sendTestNotification } = require("../services/complianceNotificationService");

// ?? Auth ??????????????????????????????????????????????????????????????????
router.use(verifyTokenMiddleware);

// ?? Multer ? certificate uploads ??????????????????????????????????????????
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ???????????????????????????????????????????????????????????????????????????
//  LICENSES
// ???????????????????????????????????????????????????????????????????????????

router.get("/licenses", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM drug_licenses ORDER BY expiry_date ASC NULLS LAST"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/licenses", async (req, res) => {
  try {
    const { name, license_number, expiry_date, category, status, notes, issued_by } = req.body;
    if (!name || !license_number)
      return res.status(400).json({ success: false, error: "Name and number required" });

    const { rows } = await db.query(
      `INSERT INTO drug_licenses (name,license_number,expiry_date,category,status,notes,issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, license_number, expiry_date||null, category||null, status||"Valid", notes||null, issued_by||null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/licenses/:id", async (req, res) => {
  try {
    const { name, license_number, expiry_date, category, status, notes, issued_by } = req.body;
    if (!name || !license_number)
      return res.status(400).json({ success: false, error: "Name and number required" });

    const { rows } = await db.query(
      `UPDATE drug_licenses SET name=$1,license_number=$2,expiry_date=$3,category=$4,
       status=$5,notes=$6,issued_by=$7,updated_at=CURRENT_TIMESTAMP
       WHERE id=$8 RETURNING *`,
      [name, license_number, expiry_date||null, category||null, status||"Valid", notes||null, issued_by||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/licenses/:id", async (req, res) => {
  try {
    // Delete associated file if exists
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

// ?? Upload certificate ????????????????????????????????????????????????????
router.post("/licenses/:id/upload", upload.single("certificate"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const filePath  = `/uploads/certificates/${req.file.filename}`;
    const fileName  = req.file.originalname;

    // Remove old file
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

// ?? Serve certificate file ????????????????????????????????????????????????
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

// ?? Manual alert for one license ?????????????????????????????????????????
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

// ============================================
// AI ERA: REGULATORY RISK SCORING
// ============================================

router.get('/risk-score', async (req, res) => {
  try {
    // Fetch licenses to assess risk
    const { rows } = await db.query(`
      SELECT expiry_date, status, category
      FROM drug_licenses
      WHERE status != 'Revoked'
    `);

    let riskScore = 15; // Base risk
    let highRiskCount = 0;
    const now = new Date();

    rows.forEach(lic => {
      if (lic.status === 'Suspended') {
        riskScore += 25;
        highRiskCount++;
      }
      
      if (lic.expiry_date) {
        const expiry = new Date(lic.expiry_date);
        const daysDiff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) {
          riskScore += 30; // Expired
          highRiskCount++;
        } else if (daysDiff <= 30) {
          riskScore += 15; // Expiring soon
        } else if (daysDiff <= 90) {
          riskScore += 5;
        }
      }
    });

    riskScore = Math.min(riskScore, 100);
    
    let riskLevel = 'Low';
    if (riskScore > 70) riskLevel = 'Critical';
    else if (riskScore > 40) riskLevel = 'Medium';

    res.json({
      success: true,
      data: {
        score: riskScore,
        level: riskLevel,
        factors: [
          { name: 'Expiring Licenses', impact: highRiskCount > 0 ? 'High' : 'Low' },
          { name: 'Suspended Entities', impact: rows.some(r => r.status === 'Suspended') ? 'High' : 'None' }
        ],
        lastAnalyzed: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ???????????????????????????????????????????????????????????????????????????
//  NOTIFICATION SETTINGS
// ???????????????????????????????????????????????????????????????????????????

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
    const {
      email_enabled, email_address,
      whatsapp_enabled, whatsapp_number, whatsapp_apikey,
      alert_days_30, alert_days_15, alert_days_7, alert_days_1,
    } = req.body;

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

// Notification logs
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

// ???????????????????????????????????????????????????????????????????????????
//  H1 REGISTER
// ???????????????????????????????????????????????????????????????????????????

router.get("/h1", async (req, res) => {
  try {
    const { drug, page=1, limit=50 } = req.query;
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM h1_register WHERE 1=1";
    const params = [];
    if (drug) { query += ` AND drug_name ILIKE $${params.length+1}`; params.push(`%${drug}%`); }
    query += ` ORDER BY entry_date DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post("/h1", async (req, res) => {
  try {
    const { entry_date,invoice_no,patient_name,doctor_name,drug_name,batch_number,quantity } = req.body;
    if (!patient_name || !drug_name || !quantity)
      return res.status(400).json({ success: false, error: "Patient, drug and quantity required" });
    const { rows } = await db.query(
      `INSERT INTO h1_register (entry_date,invoice_no,patient_name,doctor_name,drug_name,batch_number,quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [entry_date||null,invoice_no||null,patient_name,doctor_name,drug_name,batch_number||null,quantity]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ???????????????????????????????????????????????????????????????????????????
//  TEMPERATURE LOGS
// ???????????????????????????????????????????????????????????????????????????

router.get("/temp-logs", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM temperature_logs ORDER BY log_date DESC, log_time DESC LIMIT 100");
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post("/temp-logs", async (req, res) => {
  try {
    const { temperature, equipment_name, checked_by, remarks } = req.body;
    const status = (temperature >= 2 && temperature <= 8) ? "OK" : "Warning";
    const { rows } = await db.query(
      "INSERT INTO temperature_logs (temperature,equipment_name,checked_by,remarks,status) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [temperature, equipment_name, checked_by, remarks, status]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ???????????????????????????????????????????????????????????????????????????
//  AUDITS
// ???????????????????????????????????????????????????????????????????????????

router.get("/audits", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM compliance_audits ORDER BY audit_date DESC");
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post("/audits", async (req, res) => {
  try {
    const { audit_date, auditor_name, score_percentage, status, notes } = req.body;
    const { rows } = await db.query(
      `INSERT INTO compliance_audits (audit_date,auditor_name,score_percentage,status,notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [audit_date||null, auditor_name||null, score_percentage||null, status||"Draft", notes||null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Backward-compat alias
router.get("/temp", (req,res) => res.redirect("/api/compliance/temp-logs"));

module.exports = router;
