const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { verifyTokenMiddleware } = require("../utils/jwt");
const ledgerHelper = require("../utils/ledgerHelper");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

router.use(verifyTokenMiddleware);

// --- SYNC HELPER -----------------------------------------------------------

async function syncPartnerToParty(client, partnerId) {
  const pRes = await client.query("SELECT * FROM pcd_partners WHERE id=$1", [partnerId]);
  if (!pRes.rows.length) throw new Error("Partner not found");
  const p = pRes.rows[0];

  if (p.status !== 'ACTIVE' && p.status !== 'APPROVED') return null;

  let partyId = p.converted_party_id;

  if (partyId) {
    // Update existing Party
    await client.query(
      `UPDATE parties SET 
        name=$1, email=$2, mobile=$3, address=$4, city=$5, state=$6, 
        drug_license_no=$7, gstin=$8, credit_limit=$9, updated_at=NOW()
       WHERE id=$10`,
      [p.name, p.email, p.contact_number, p.address || p.territory, p.district, p.state, p.drug_license_no, p.gst_registration, p.credit_limit, partyId]
    );
  } else {
    // Create Party record
    const partyRes = await client.query(
      `INSERT INTO parties (name, type, email, mobile, address, city, state, drug_license_no, gstin, status, credit_limit, company_id)
       VALUES ($1, 'Debtor', $2, $3, $4, $5, $6, $7, $8, 'Active', $9, $10) RETURNING id`,
      [p.name, p.email, p.contact_number, p.address || p.territory, p.district, p.state, p.drug_license_no, p.gst_registration, p.credit_limit, p.company_id || 1]
    );
    partyId = partyRes.rows[0].id;
    await client.query("UPDATE pcd_partners SET converted_party_id=$1 WHERE id=$2", [partyId, partnerId]);
  }
  return partyId;
}

// --- PARTNERS ----------------------------------------------------------------

router.get("/partners", async (req, res) => {
  try {
    const { page=1, limit=20, search="", status="", grade="" } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const companyId = req.user?.companyId || 1;

    let where = "WHERE (p.company_id = $1 OR p.company_id IS NULL) AND p.is_active = true";
    const params = [companyId];

    if (search.trim()) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(p.name) ILIKE $${params.length} OR LOWER(p.territory) ILIKE $${params.length})`;
    }
    if (status.trim()) {
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }
    if (grade.trim()) {
      params.push(grade);
      where += ` AND p.partner_grade = $${params.length}`;
    }

    const total = (await db.query(`SELECT COUNT(*) FROM pcd_partners p ${where}`, params)).rows[0].count;
    
    params.push(limit, offset);
    const data = await db.query(
      `SELECT p.*, COALESCE(SUM(t.order_amount),0) AS total_business 
       FROM pcd_partners p 
       LEFT JOIN pcd_transactions t ON t.partner_id = p.id 
       ${where} 
       GROUP BY p.id 
       ORDER BY p.created_at DESC 
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: data.rows,
      total: parseInt(total),
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/partners/:id", async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM pcd_partners WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/partners", async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      name, territory, state, district, contact_person, contact_number, email,
      drug_license_no, drug_license_expiry, gst_registration, gstin_expiry, credit_limit,
      discount_percentage, status, partner_grade, join_date, monopoly_territory,
      assigned_mr_ids, address
    } = req.body;
    const companyId = req.user?.companyId || 1;

    if (!name || !territory) return res.status(400).json({ success: false, error: "Name and territory required" });

    await client.query('BEGIN');
    let r;
    try {
      r = await client.query(
        `INSERT INTO pcd_partners (
          name, territory, state, district, contact_person, contact_number, email,
          drug_license_no, drug_license_expiry, gst_registration, gstin_expiry, credit_limit,
          discount_percentage, status, partner_grade, join_date, monopoly_territory, company_id,
          address, assigned_mr_ids
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [
          name, territory, state, district, contact_person, contact_number, email,
          drug_license_no || null, drug_license_expiry || null,
          gst_registration || null, gstin_expiry || null,
          credit_limit || 100000, discount_percentage || 5,
          status || "APPLIED", partner_grade || "BRONZE",
          join_date || null, monopoly_territory || null, companyId,
          address || null, assigned_mr_ids || []
        ]
      );
    } catch(dbErr) {
      if (dbErr.code === '23505') {
        if (dbErr.constraint === 'pcd_partners_territory_key')
          return res.status(409).json({ success: false, error: `Territory "${territory}" already has an assigned partner.` });
        return res.status(409).json({ success: false, error: "Duplicate entry — check territory, drug license, and GST." });
      }
      throw dbErr;
    }

    const partnerId = r.rows[0].id;

    // Insert drug license document record
    if (drug_license_no) {
      await client.query(
        `INSERT INTO pcd_partner_documents (partner_id, document_type, document_name, expiry_date, status, created_by)
         VALUES ($1,'DRUG_LICENSE',$2,$3,'PENDING',$4)`,
        [partnerId, `Drug License - ${drug_license_no}`, drug_license_expiry || null, req.user?.id || null]
      );
    }

    // Insert GST document record
    if (gst_registration) {
      await client.query(
        `INSERT INTO pcd_partner_documents (partner_id, document_type, document_name, expiry_date, status, created_by)
         VALUES ($1,'GST_CERTIFICATE',$2,$3,'PENDING',$4)`,
        [partnerId, `GST Certificate - ${gst_registration}`, gstin_expiry || null, req.user?.id || null]
      );
    }

    // Auto-sync if status is ACTIVE
    if (status === 'ACTIVE' || status === 'APPROVED') {
      await syncPartnerToParty(client, partnerId);
    }

    const finalPartner = await client.query("SELECT * FROM pcd_partners WHERE id=$1", [partnerId]);

    await client.query(
      "INSERT INTO pcd_activity_log (actor_name, action_type, description, entity_type, entity_id, partner_id, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [req.user?.name || "System", "PARTNER_CREATED", `New partner ${name} onboarded in ${territory}`, "partner", partnerId, partnerId, companyId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: finalPartner.rows[0] });
  } catch(e) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    if (client) client.release();
  }
});

router.put("/partners/:id", async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      name, territory, state, district, contact_person, contact_number, email,
      drug_license_no, drug_license_expiry, gst_registration, gstin_expiry, credit_limit,
      discount_percentage, status, partner_grade, join_date, monopoly_territory,
      assigned_mr_ids, address
    } = req.body;

    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE pcd_partners SET
        name=$1, territory=$2, state=$3, district=$4, contact_person=$5,
        contact_number=$6, email=$7, drug_license_no=$8, drug_license_expiry=$9,
        gst_registration=$10, gstin_expiry=$11, credit_limit=$12, discount_percentage=$13,
        status=$14, partner_grade=$15, join_date=$16, monopoly_territory=$17,
        assigned_mr_ids=$18, address=$19,
        updated_at=NOW()
      WHERE id=$20 RETURNING *`,
      [
        name, territory, state, district, contact_person, contact_number, email,
        drug_license_no, drug_license_expiry || null, gst_registration, gstin_expiry || null,
        credit_limit, discount_percentage, status, partner_grade, join_date || null,
        monopoly_territory || null, assigned_mr_ids || [], address || null, req.params.id
      ]
    );

    if (!r.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: "Not found" });
    }

    // Auto-sync if status is ACTIVE/APPROVED
    if (status === 'ACTIVE' || status === 'APPROVED') {
      await syncPartnerToParty(client, req.params.id);
    }

    await client.query('COMMIT');
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    if (client) client.release();
  }
});

router.delete("/partners/:id", async (req, res) => {
  try {
    const r = await db.query("UPDATE pcd_partners SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id,name", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/partners/:id/sync", async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const pRes = await client.query("SELECT * FROM pcd_partners WHERE id=$1", [req.params.id]);
    if (!pRes.rows.length) throw new Error("Partner not found");
    const p = pRes.rows[0];

    // Create Party record
    const partyRes = await client.query(
      `INSERT INTO parties (name, type, email, mobile, address, city, state, drug_license_no, status, company_id)
       VALUES ($1, 'Debtor', $2, $3, $4, $5, $6, $7, 'Active', $8) RETURNING id`,
      [p.name, p.email, p.contact_number, p.territory, p.district, p.state, p.drug_license_no, p.company_id || 1]
    );
    const partyId = partyRes.rows[0].id;

    // Update PCD Partner with party reference
    await client.query("UPDATE pcd_partners SET converted_party_id=$1, status='ACTIVE' WHERE id=$2", [partyId, p.id]);

    await client.query('COMMIT');
    res.json({ success: true, partyId, message: "PCD Partner synchronized with ERP Parties (Debtors)" });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// --- MEDICAL REPRESENTATIVES ------------------------------------------------

/**
 * GET /pcd/mrs/stats
 * Aggregated performance stats for MR leaderboard KPI cards.
 * Must be declared BEFORE /mrs/:id to avoid route collision.
 */
router.get("/mrs/stats", async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const r = await db.query(`
      SELECT
        COUNT(*)::INT                                                        AS "totalEmployees",
        COUNT(*) FILTER (WHERE mr.status = 'Active')::INT                   AS "activeEmployees",
        COUNT(*) FILTER (
          WHERE mr.sales_target > 0
            AND COALESCE(tx.total_sales, 0) / mr.sales_target * 100 >= 100
        )::INT                                                               AS "starPerformers",
        COUNT(*) FILTER (
          WHERE mr.sales_target = 0
             OR COALESCE(tx.total_sales, 0) / NULLIF(mr.sales_target, 0) * 100 < 80
        )::INT                                                               AS "attentionNeeded",
        ROUND(
          COALESCE(
            AVG(
              CASE
                WHEN mr.sales_target > 0
                THEN LEAST(COALESCE(tx.total_sales, 0) / mr.sales_target * 100, 200)
                ELSE 0
              END
            ), 0
          )::NUMERIC, 2
        )::FLOAT                                                             AS "averageAchievement"
      FROM medical_representatives mr
      LEFT JOIN (
        SELECT mr_id, SUM(order_amount) AS total_sales
        FROM pcd_transactions
        WHERE order_status NOT IN ('CANCELLED','REJECTED')
        GROUP BY mr_id
      ) tx ON tx.mr_id = mr.id
      WHERE (mr.company_id = $1 OR mr.company_id IS NULL)
    `, [companyId]);
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /pcd/mrs
 * Returns all active MRs with computed total_sales and target_achievement
 * from pcd_transactions so the dashboard widgets show real numbers.
 */
router.get("/mrs", async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const r = await db.query(`
      SELECT
        mr.*,
        COALESCE(tx.total_sales, 0)                                         AS total_sales,
        CASE
          WHEN mr.sales_target > 0
          THEN ROUND(
                 (COALESCE(tx.total_sales, 0) / mr.sales_target * 100)::NUMERIC, 2
               )
          ELSE 0
        END                                                                  AS target_achievement
      FROM medical_representatives mr
      LEFT JOIN (
        SELECT mr_id, SUM(order_amount) AS total_sales
        FROM pcd_transactions
        WHERE order_status NOT IN ('CANCELLED','REJECTED')
        GROUP BY mr_id
      ) tx ON tx.mr_id = mr.id
      WHERE (mr.company_id = $1 OR mr.company_id IS NULL)
        AND mr.status != 'Inactive'
      ORDER BY target_achievement DESC, mr.name ASC
    `, [companyId]);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/mrs", async (req, res) => {
  try {
    const { name, contact, email, headquarters, assigned_area, base_salary, sales_target, join_date } = req.body;
    const companyId = req.user?.companyId || 1;

    if (!name || !contact) return res.status(400).json({ success: false, error: "Name and contact required" });

    const r = await db.query(
      `INSERT INTO medical_representatives (name, contact, email, headquarters, assigned_area, base_salary, sales_target, join_date, status, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',$9) RETURNING *`,
      [name, contact, email, headquarters, assigned_area, base_salary || 0, sales_target || 0, join_date || null, companyId]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- SCHEMES -----------------------------------------------------------------

router.get("/schemes", async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const r = await db.query("SELECT * FROM pcd_schemes WHERE company_id = $1 ORDER BY created_at DESC", [companyId]);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/schemes", async (req, res) => {
  try {
    const {
      name, description, scheme_type, validity_start, validity_end,
      minimum_order, discount_percentage, free_products_qty, free_product_name,
      bonus_cash, applicable_partner_grades, status, terms,
      bonus_incentives, target_products, scheme_code
    } = req.body;
    const companyId = req.user?.companyId || 1;

    if (!name) return res.status(400).json({ success: false, error: "Scheme name required" });

    const r = await db.query(
      `INSERT INTO pcd_schemes (
        name, description, scheme_type, validity_start, validity_end,
        minimum_order, discount_percentage, free_products_qty, free_product_name,
        bonus_cash, applicable_partner_grades, status, company_id,
        terms, bonus_incentives, target_products, scheme_code
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        name, description, scheme_type || "DISCOUNT", validity_start || null, validity_end || null,
        minimum_order || 0, discount_percentage || 0, free_products_qty || 0, free_product_name || null,
        bonus_cash || 0, applicable_partner_grades || null, status || "ACTIVE", companyId,
        terms || null, bonus_incentives || null, target_products || null, scheme_code || null
      ]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/schemes/:id", async (req, res) => {
  try {
    const {
      name, description, scheme_type, validity_start, validity_end,
      minimum_order, discount_percentage, free_products_qty, free_product_name,
      bonus_cash, applicable_partner_grades, status, terms,
      bonus_incentives, target_products, scheme_code
    } = req.body;

    const r = await db.query(
      `UPDATE pcd_schemes SET 
        name=$1, description=$2, scheme_type=$3, validity_start=$4, validity_end=$5,
        minimum_order=$6, discount_percentage=$7, free_products_qty=$8, 
        free_product_name=$9, bonus_cash=$10, applicable_partner_grades=$11, 
        status=$12, terms=$13, bonus_incentives=$14, target_products=$15, 
        scheme_code=$16, updated_at=NOW() 
      WHERE id=$17 RETURNING *`,
      [
        name, description, scheme_type, validity_start || null, validity_end || null,
        minimum_order, discount_percentage, free_products_qty, free_product_name,
        bonus_cash, applicable_partner_grades, status, terms, bonus_incentives,
        target_products, scheme_code, req.params.id
      ]
    );

    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/schemes/:id", async (req, res) => {
  try {
    const r = await db.query("DELETE FROM pcd_schemes WHERE id=$1 RETURNING id, name", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, message: `Scheme ${r.rows[0].name} deleted successfully` });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- TARGETS -----------------------------------------------------------------

router.get("/targets", async (req, res) => {
  try {
    const { partner_id } = req.query;
    const companyId = req.user?.companyId || 1;

    let q = "SELECT t.*, p.name AS partner_name, p.partner_grade FROM pcd_targets t LEFT JOIN pcd_partners p ON p.id = t.partner_id WHERE t.company_id = $1";
    const params = [companyId];

    if (partner_id) {
      params.push(partner_id);
      q += ` AND t.partner_id = $${params.length}`;
    }
    q += " ORDER BY t.created_at DESC";

    const r = await db.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/targets", async (req, res) => {
  try {
    const { partner_id, period, period_start, period_end, target_amount, incentive_percentage } = req.body;
    const companyId = req.user?.companyId || 1;

    if (!partner_id || !target_amount) return res.status(400).json({ success: false, error: "Partner and target amount required" });

    // Auto-derive period dates from period string if not provided
    const parsePeriodDates = (p) => {
      if (!p) return { start: null, end: null };
      const str = p.toString().toUpperCase().trim();
      const yearMatch = str.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      if (str.startsWith('Q1')) return { start: `${year}-01-01`, end: `${year}-03-31` };
      if (str.startsWith('Q2')) return { start: `${year}-04-01`, end: `${year}-06-30` };
      if (str.startsWith('Q3')) return { start: `${year}-07-01`, end: `${year}-09-30` };
      if (str.startsWith('Q4')) return { start: `${year}-10-01`, end: `${year}-12-31` };
      if (str.startsWith('H1')) return { start: `${year}-01-01`, end: `${year}-06-30` };
      if (str.startsWith('H2')) return { start: `${year}-07-01`, end: `${year}-12-31` };
      if (str.startsWith('FY')) return { start: `${year}-04-01`, end: `${year+1}-03-31` };
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    };
    const dates = parsePeriodDates(period);
    const pStart = period_start || dates.start || new Date().toISOString().split('T')[0];
    const pEnd   = period_end   || dates.end   || new Date(new Date().setMonth(new Date().getMonth()+3)).toISOString().split('T')[0];

    // Check for duplicate partner+period
    const existing = await db.query(
      "SELECT id FROM pcd_targets WHERE partner_id=$1 AND period=$2 AND company_id=$3",
      [partner_id, period, companyId]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, error: `Target for period "${period}" already exists for this partner` });
    }

    const r = await db.query(
      `INSERT INTO pcd_targets (partner_id, period, period_start, period_end, target_amount, incentive_percentage, status, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,'IN_PROGRESS',$7) RETURNING *`,
      [partner_id, period, pStart, pEnd, target_amount, incentive_percentage || 0, companyId]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/targets/:id", async (req, res) => {
  try {
    const { target_amount, achieved_amount, incentive_percentage, bonus_amount, status, period, period_start, period_end } = req.body;
    const existing = await db.query("SELECT * FROM pcd_targets WHERE id=$1", [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, error: "Not found" });

    const parsePeriodDates = (p) => {
      if (!p) return { start: null, end: null };
      const str = p.toString().toUpperCase().trim();
      const yearMatch = str.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      if (str.startsWith('Q1')) return { start: `${year}-01-01`, end: `${year}-03-31` };
      if (str.startsWith('Q2')) return { start: `${year}-04-01`, end: `${year}-06-30` };
      if (str.startsWith('Q3')) return { start: `${year}-07-01`, end: `${year}-09-30` };
      if (str.startsWith('Q4')) return { start: `${year}-10-01`, end: `${year}-12-31` };
      if (str.startsWith('H1')) return { start: `${year}-01-01`, end: `${year}-06-30` };
      if (str.startsWith('H2')) return { start: `${year}-07-01`, end: `${year}-12-31` };
      if (str.startsWith('FY')) return { start: `${year}-04-01`, end: `${year+1}-03-31` };
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    };
    const existRow = existing.rows[0];
    const dates = parsePeriodDates(period || existRow.period);
    const pStart = period_start || dates.start || existRow.period_start;
    const pEnd   = period_end   || dates.end   || existRow.period_end;

    const newAchieved = achieved_amount !== undefined ? achieved_amount : existRow.achieved_amount;
    const newTarget   = target_amount   !== undefined ? target_amount   : existRow.target_amount;
    const newStatus   = status || (parseFloat(newAchieved) >= parseFloat(newTarget) * 1.1 ? 'EXCEEDED'
      : parseFloat(newAchieved) >= parseFloat(newTarget) ? 'ACHIEVED'
      : parseFloat(newAchieved) > 0 ? 'IN_PROGRESS' : existRow.status);

    const r = await db.query(
      `UPDATE pcd_targets SET
        target_amount=$1, achieved_amount=$2, incentive_percentage=$3, bonus_amount=$4,
        status=$5, period=$6, period_start=$7, period_end=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [newTarget, newAchieved, incentive_percentage ?? existRow.incentive_percentage,
       bonus_amount ?? existRow.bonus_amount, newStatus,
       period || existRow.period, pStart, pEnd, req.params.id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- TRANSACTIONS ------------------------------------------------------------

router.get("/transactions", async (req, res) => {
  try {
    const { partner_id, payment_status, from, to } = req.query;
    const companyId = req.user?.companyId || 1;

    let q = "SELECT t.*, p.name AS partner_name FROM pcd_transactions t LEFT JOIN pcd_partners p ON p.id = t.partner_id WHERE t.company_id = $1";
    const params = [companyId];

    if (partner_id) { params.push(partner_id); q += ` AND t.partner_id = $${params.length}`; }
    if (payment_status) { params.push(payment_status); q += ` AND t.payment_status = $${params.length}`; }
    if (from) { params.push(from); q += ` AND t.order_date >= $${params.length}`; }
    if (to) { params.push(to); q += ` AND t.order_date <= $${params.length}`; }
    
    q += " ORDER BY t.order_date DESC";
    const r = await db.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/transactions", async (req, res) => {
  const client = await db.getClient();
  try {
    const { 
      partner_id, mr_id, order_date, order_amount, product_name, 
      quantity, order_status, payment_status, discount_given, notes, 
      scheme_applied_id, product_id, batch_id 
    } = req.body;
    const companyId = req.user?.companyId || 1;
    const userId = req.user?.id;

    if (!partner_id || !order_amount) return res.status(400).json({ success: false, error: "Partner and amount required" });

    await client.query('BEGIN');

    // 1. Insert PCD Transaction record
    const r = await client.query(
      `INSERT INTO pcd_transactions (
        partner_id, mr_id, order_date, order_amount, product_name, 
        quantity, order_status, payment_status, discount_given, notes, 
        scheme_applied_id, company_id, product_id, batch_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        partner_id, mr_id || null, order_date || new Date(), order_amount, 
        product_name, quantity || 1, order_status || "VERIFIED", 
        payment_status || "UNPAID", discount_given || 0, notes || null, 
        scheme_applied_id || null, companyId, product_id || null, batch_id || null
      ]
    );
    const pcdTxId = r.rows[0].id;

    // 2. Auto-update target achieved amount
    await client.query(
      `UPDATE pcd_targets SET 
        achieved_amount = achieved_amount + $1, 
        updated_at = NOW() 
      WHERE partner_id = $2 
        AND company_id = $3
        AND (period_start IS NULL OR period_start <= $4) 
        AND (period_end IS NULL OR period_end >= $4) 
        AND status != 'EXCEEDED'`,
      [order_amount, partner_id, companyId, order_date || new Date()]
    );

    // 3. Auto-update target status
    await client.query(
      `UPDATE pcd_targets SET
        status = CASE
          WHEN achieved_amount >= target_amount * 1.1 THEN 'EXCEEDED'
          WHEN achieved_amount >= target_amount THEN 'ACHIEVED'
          WHEN achieved_amount > 0 THEN 'IN_PROGRESS'
          ELSE status
        END,
        updated_at = NOW()
      WHERE partner_id = $1
        AND company_id = $2
        AND status != 'EXCEEDED'`,
      [partner_id, companyId]
    );

    // 4. INTEGRATION: Create Sales Invoice if VERIFIED/DELIVERED
    if (order_status === 'VERIFIED' || order_status === 'DELIVERED') {
      const partnerRes = await client.query("SELECT * FROM pcd_partners WHERE id=$1", [partner_id]);
      const p = partnerRes.rows[0];
      
      if (p.converted_party_id) {
        let subTotal = parseFloat(order_amount);
        let discountAmt = 0;
        let finalNetAmount = subTotal;

        // Apply Scheme if present
        if (scheme_applied_id) {
          const schemeRes = await client.query("SELECT * FROM pcd_schemes WHERE id=$1", [scheme_applied_id]);
          const scheme = schemeRes.rows[0];
          if (scheme && subTotal >= parseFloat(scheme.minimum_order || 0)) {
            const discPercent = parseFloat(scheme.discount_percentage || 0);
            if (discPercent > 0) {
              discountAmt = (subTotal * discPercent) / 100;
              finalNetAmount = subTotal - discountAmt;
            }
          }
        }

        const invNo = "PCD-" + Date.now().toString().slice(-6);

        // Compute GST from product rate (MRP-inclusive pricing: back-calculate taxable value)
        let gstPercent = 0;
        if (product_id) {
          const gstRes = await client.query("SELECT gst FROM products WHERE id=$1", [product_id]);
          gstPercent = parseFloat(gstRes.rows[0]?.gst || 0);
        }
        const gstFactor = 1 + (gstPercent / 100);
        const taxableValue = parseFloat((finalNetAmount / gstFactor).toFixed(2));
        const gstAmount = parseFloat((finalNetAmount - taxableValue).toFixed(2));

        const invResult = await client.query(
          `INSERT INTO sales_invoices (
            invoice_number, date, customer_name, customer_mobile,
            payment_mode, sub_total, taxable_value, total_gst, total_discount, net_amount, status, created_by, party_id, company_id, source_type
          ) VALUES ($1, $2, $3, $4, 'Credit', $5, $6, $7, $8, $9, 'Completed', $10, $11, $12, 'PCD')
          RETURNING id`,
          [invNo, order_date || new Date(), p.name, p.contact_number, subTotal, taxableValue, gstAmount, discountAmt, finalNetAmount, userId, p.converted_party_id, companyId]
        );
        const invoiceId = invResult.rows[0].id;

        // Update PCD Transaction with invoice reference
        await client.query("UPDATE pcd_transactions SET sales_invoice_id=$1, discount_given=$2 WHERE id=$3", [invoiceId, discountAmt, pcdTxId]);

        // Add item if product_id is present
        if (product_id) {
          const batchRes = await client.query("SELECT mrp FROM batches WHERE id=$1", [batch_id]);
          const mrp = batchRes.rows[0]?.mrp || (subTotal / (quantity || 1));

          await client.query(
            `INSERT INTO sales_invoice_items (
              invoice_id, product_id, batch_id, quantity, mrp, rate, total_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [invoiceId, product_id, batch_id, quantity || 1, mrp, subTotal / (quantity || 1), subTotal]
          );

          // Update Stock Ledger
          await ledgerHelper.postToStockLedger(client, {
            companyId,
            productId: product_id,
            batchId: batch_id,
            movementType: 'OUT',
            referenceType: 'Sale',
            referenceId: invoiceId,
            referenceNumber: invNo,
            quantity: quantity || 1,
            movementDate: order_date || new Date(),
            narration: `PCD Order: ${product_name}`,
            createdBy: userId
          });
        }

        // Post to General Ledger (Sales & Debtor)
        const salesAcct = await ledgerHelper.findAccount(client, companyId, 'Sales');
        const debtorAcct = await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors');
        
        if (salesAcct && debtorAcct) {
          const voucherId = uuidv4();
          await client.query(
            `INSERT INTO journal_vouchers (id, company_id, party_id, voucher_type, voucher_no, voucher_date, narration, total_debit, total_credit, status, created_by)
             VALUES ($1, $2, $3, 'Sales', $4, $5, $6, $7, $7, 'Posted', $8)`,
            [voucherId, companyId, p.converted_party_id, invNo, order_date || new Date(), `PCD Order ${invNo}`, finalNetAmount, userId]
          );

          await ledgerHelper.postToGeneralLedger(client, {
            accountId: debtorAcct,
            partyId: p.converted_party_id,
            voucherId: voucherId,
            voucherType: 'Sales',
            transactionDate: order_date || new Date(),
            debit: finalNetAmount,
            credit: 0,
            narration: `Invoice ${invNo}`
          });

          await ledgerHelper.postToGeneralLedger(client, {
            accountId: salesAcct,
            voucherId: voucherId,
            voucherType: 'Sales',
            transactionDate: order_date || new Date(),
            debit: 0,
            credit: finalNetAmount,
            narration: `Taxable Sales: ${invNo}`
          });
        }
      }
    }

    await client.query(
      "INSERT INTO pcd_activity_log (actor_name, action_type, description, entity_type, entity_id, partner_id, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [req.user?.name || "System", "ORDER_PLACED", `Order ₹${order_amount} for ${product_name}`, "transaction", pcdTxId, partner_id, companyId]
    );

    const finalTx = await client.query("SELECT * FROM pcd_transactions WHERE id=$1", [pcdTxId]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: finalTx.rows[0] });
  } catch(e) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    if (client) client.release();
  }
});

// --- DASHBOARD ---------------------------------------------------------------

router.get("/dashboard/summary", async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const [partners, revenue, schemes, approvals, targets, receivables, aging] = await Promise.all([
      db.query("SELECT COUNT(*) FROM pcd_partners WHERE company_id = $1 AND status='ACTIVE'", [companyId]),
      db.query("SELECT COALESCE(SUM(order_amount),0) AS total FROM pcd_transactions WHERE company_id = $1", [companyId]),
      db.query("SELECT COUNT(*) FROM pcd_schemes WHERE company_id = $1 AND status='ACTIVE'", [companyId]),
      db.query("SELECT COUNT(*) FROM pcd_partner_documents pd JOIN pcd_partners pp ON pp.id = pd.partner_id WHERE pd.status='PENDING' AND pp.company_id = $1", [companyId]),
      db.query("SELECT COALESCE(AVG(CASE WHEN target_amount>0 THEN achieved_amount/target_amount*100 ELSE 0 END),0) AS avg_achievement FROM pcd_targets WHERE company_id = $1 AND status IN ('IN_PROGRESS','ACHIEVED','EXCEEDED')", [companyId]),
      db.query("SELECT COALESCE(SUM(outstanding_amount),0) AS total FROM pcd_receivables WHERE company_id = $1 AND status != 'CLOSED'", [companyId]),
      db.query(`SELECT
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN outstanding_amount ELSE 0 END),0) AS bucket_0_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN outstanding_amount ELSE 0 END),0) AS bucket_31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date > 60 THEN outstanding_amount ELSE 0 END),0) AS bucket_61_plus
        FROM pcd_receivables WHERE company_id=$1 AND status NOT IN ('CLOSED','CLEARED') AND due_date < CURRENT_DATE`, [companyId]),
    ]);

    const ag = aging.rows[0];
    res.json({
      success: true,
      data: {
        totalPartners: parseInt(partners.rows[0].count),
        totalRevenue: parseFloat(revenue.rows[0].total),
        activeSchemes: parseInt(schemes.rows[0].count),
        pendingApprovals: parseInt(approvals.rows[0].count),
        avgTargetAchievement: parseFloat(parseFloat(targets.rows[0].avg_achievement).toFixed(1)),
        outstandingReceivables: parseFloat(receivables.rows[0].total),
        agingBuckets: {
          bucket_0_30: parseFloat(ag.bucket_0_30),
          bucket_31_60: parseFloat(ag.bucket_31_60),
          bucket_61_plus: parseFloat(ag.bucket_61_plus),
        },
      }
    });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// --- TARGETS: DELETE --------------------------------------------------------

router.delete("/targets/:id", async (req, res) => {
  try {
    const r = await db.query("DELETE FROM pcd_targets WHERE id=$1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- COMMISSIONS ------------------------------------------------------------

router.get("/commissions", async (req, res) => {
  try {
    const { partner_id, payment_status, period } = req.query;
    const companyId = req.user?.companyId || 1;
    let q = `SELECT c.*, p.name AS partner_name, p.partner_grade
             FROM pcd_commissions c
             LEFT JOIN pcd_partners p ON p.id = c.partner_id
             WHERE c.company_id = $1`;
    const params = [companyId];
    if (partner_id) { params.push(partner_id); q += ` AND c.partner_id = $${params.length}`; }
    if (payment_status) { params.push(payment_status); q += ` AND c.payment_status = $${params.length}`; }
    if (period) { params.push(period); q += ` AND c.period = $${params.length}`; }
    q += " ORDER BY c.created_at DESC";
    const r = await db.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/commissions/generate", async (req, res) => {
  const client = await db.getClient();
  try {
    const { period } = req.body;
    const companyId = req.user?.companyId || 1;
    const userId = req.user?.id;
    if (!period) return res.status(400).json({ success: false, error: "Period required (e.g. Q1-2026)" });

    await client.query('BEGIN');

    const gradeRates = { PLATINUM: 0.10, GOLD: 0.085, SILVER: 0.07, BRONZE: 0.05 };

    const targets = await client.query(
      `SELECT t.*, p.name AS partner_name, p.partner_grade, p.converted_party_id
       FROM pcd_targets t
       JOIN pcd_partners p ON p.id = t.partner_id
       WHERE t.company_id = $1 AND t.status != 'PENDING'`,
      [companyId]
    );

    // Get or Create PCD Commission Expense Account
    let expenseAcct = await ledgerHelper.findAccount(client, companyId, 'PCD Commission Expense');
    if (!expenseAcct) {
      const accId = uuidv4();
      const accCode = 'EXP-PCD-' + Date.now().toString().slice(-4);
      await client.query(
        `INSERT INTO chart_of_accounts (id, account_code, account_name, account_type, account_group, company_id, status)
         VALUES ($1, $2, $3, 'Expense', 'Indirect Expenses', $4, 'Active')`,
        [accId, accCode, 'PCD Commission Expense', companyId]
      );
      expenseAcct = accId;
    }

    const results = [];
    for (const t of targets.rows) {
      const rate     = gradeRates[t.partner_grade] || 0.05;
      const achieved = parseFloat(t.achieved_amount || 0);
      const base     = parseFloat((achieved * rate).toFixed(2));
      const bonus    = achieved >= 500000 ? parseFloat((achieved * 0.01).toFixed(2)) : 0;
      const net      = parseFloat((base + bonus).toFixed(2));

      if (net <= 0) continue;

      const existing = await client.query(
        "SELECT id FROM pcd_commissions WHERE partner_id=$1 AND period=$2 AND company_id=$3",
        [t.partner_id, period, companyId]
      );
      
      let commId;
      if (existing.rows.length) {
        commId = existing.rows[0].id;
        await client.query(
          "UPDATE pcd_commissions SET base_commission=$1, scheme_bonus=$2, net_commission=$3 WHERE id=$4",
          [base, bonus, net, commId]
        );
        results.push({ partner: t.partner_name, action: "updated" });
      } else {
        const ins = await client.query(
          `INSERT INTO pcd_commissions (partner_id, period, base_commission, scheme_bonus, deductions, net_commission, payment_status, company_id)
           VALUES ($1,$2,$3,$4,0,$5,'PENDING',$6) RETURNING id`,
          [t.partner_id, period, base, bonus, net, companyId]
        );
        commId = ins.rows[0].id;
        results.push({ partner: t.partner_name, action: "created" });
      }

      // INTEGRATION: Create Journal Voucher if Partner is synced to Parties
      if (t.converted_party_id) {
        const vNo = `COMM-${period}-${t.partner_name.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const voucherId = await ledgerHelper.processVoucher(client, {
          companyId,
          voucherType: 'Journal',
          voucherNo: vNo,
          voucherDate: new Date(),
          partyId: t.converted_party_id,
          drAccountId: expenseAcct,
          crAccountId: await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors'), // Or a liability acct
          amount: net,
          narration: `PCD Commission for ${period}: ${t.partner_name}`,
          createdBy: userId
        });
        
        await client.query("UPDATE pcd_commissions SET journal_voucher_id=$1 WHERE id=$2", [voucherId, commId]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, generated: results.length, data: results });
  } catch(e) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    if (client) client.release();
  }
});

router.put("/commissions/:id", async (req, res) => {
  try {
    const { payment_status, paid_on, notes, deductions } = req.body;
    const existing = await db.query("SELECT * FROM pcd_commissions WHERE id=$1", [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    const c = existing.rows[0];
    const newDeductions = deductions !== undefined ? parseFloat(deductions) : parseFloat(c.deductions || 0);
    const newNet = parseFloat((parseFloat(c.base_commission) + parseFloat(c.scheme_bonus || 0) - newDeductions).toFixed(2));
    const r = await db.query(
      `UPDATE pcd_commissions SET
        payment_status = COALESCE($1, payment_status),
        paid_on        = COALESCE($2, paid_on),
        notes          = COALESCE($3, notes),
        deductions     = $4,
        net_commission = $5
      WHERE id=$6 RETURNING *`,
      [payment_status || null, paid_on || null, notes || null, newDeductions, newNet, req.params.id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- RECEIVABLES ------------------------------------------------------------

router.get("/receivables", async (req, res) => {
  try {
    const { partner_id, status } = req.query;
    const companyId = req.user?.companyId || 1;
    let q = `SELECT
               r.id, r.partner_id, r.invoice_id, r.invoice_date, r.invoice_amount,
               r.paid_amount, r.outstanding_amount, r.due_date, r.status,
               r.created_at, r.updated_at, r.company_id,
               GREATEST(0, (CURRENT_DATE - r.due_date)::int) AS days_overdue,
               CASE WHEN r.outstanding_amount > COALESCE(p.credit_limit, 100000) THEN true ELSE false END AS credit_limit_exceeded,
               p.name AS partner_name
             FROM pcd_receivables r
             LEFT JOIN pcd_partners p ON p.id = r.partner_id
             WHERE r.company_id = $1`;
    const params = [companyId];
    if (partner_id) { params.push(partner_id); q += ` AND r.partner_id = $${params.length}`; }
    if (status) { params.push(status); q += ` AND r.status = $${params.length}`; }
    q += " ORDER BY r.due_date ASC";
    const r = await db.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/receivables", async (req, res) => {
  try {
    const { partner_id, invoice_id, invoice_date, invoice_amount, due_date } = req.body;
    const companyId = req.user?.companyId || 1;
    if (!partner_id || !invoice_amount) return res.status(400).json({ success: false, error: "Partner and invoice amount required" });
    const amt = parseFloat(invoice_amount);
    const invId = invoice_id || ("INV-" + Date.now());
    const r = await db.query(
      `INSERT INTO pcd_receivables (partner_id, invoice_id, invoice_date, invoice_amount, paid_amount, outstanding_amount, due_date, status, company_id)
       VALUES ($1,$2,$3,$4,0,$4,$5,'OPEN',$6) RETURNING *`,
      [partner_id, invId, invoice_date || new Date(), amt, due_date || null, companyId]
    );
    await db.query(
      "INSERT INTO pcd_activity_log (actor_name, action_type, description, entity_type, entity_id, partner_id, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [req.user?.name || "System", "INVOICE_RAISED", "Invoice " + invId + " raised for \u20b9" + amt, "receivable", r.rows[0].id, partner_id, companyId]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/receivables/:id", async (req, res) => {
  try {
    const { paid_amount } = req.body;
    const existing = await db.query("SELECT * FROM pcd_receivables WHERE id=$1", [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    const rec = existing.rows[0];
    const newPaid = parseFloat(rec.paid_amount || 0) + parseFloat(paid_amount || 0);
    const outstanding = Math.max(0, parseFloat(rec.invoice_amount) - newPaid);
    const newStatus = outstanding <= 0 ? "CLEARED" : newPaid > 0 ? "PARTIAL" : "OPEN";
    const r = await db.query(
      "UPDATE pcd_receivables SET paid_amount=$1, outstanding_amount=$2, status=$3, updated_at=NOW() WHERE id=$4 RETURNING *",
      [newPaid, outstanding, newStatus, req.params.id]
    );
    // Sync pcd_transactions.payment_status when fully cleared
    if (outstanding <= 0 && rec.invoice_id) {
      await db.query(
        "UPDATE pcd_transactions SET payment_status='PAID' WHERE sales_invoice_id=$1",
        [rec.invoice_id]
      );
    }
    await db.query(
      "INSERT INTO pcd_activity_log (actor_name, action_type, description, entity_type, entity_id, partner_id, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [req.user?.name || "System", "PAYMENT_RECEIVED", "Payment \u20b9" + paid_amount + " recorded for invoice " + rec.invoice_id, "receivable", rec.id, rec.partner_id, rec.company_id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/receivables/:id", async (req, res) => {
  try {
    const r = await db.query("DELETE FROM pcd_receivables WHERE id=$1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- BROADCASTS -------------------------------------------------------------

router.get("/broadcasts", async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM pcd_broadcast_messages ORDER BY created_at DESC LIMIT 100");
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/broadcasts", async (req, res) => {
  try {
    const { title, message, channel, target_grades, target_states, recipient_count } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, error: "Title and message required" });
    const r = await db.query(
      "INSERT INTO pcd_broadcast_messages (title, message, channel, target_grades, target_states, sent_by, status, recipient_count) VALUES ($1,$2,$3,$4,$5,$6,'SENT',$7) RETURNING *",
      [title, message, channel || "EMAIL", target_grades || null, target_states || null, req.user?.id || null, recipient_count || 0]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- ACTIVITY LOG -----------------------------------------------------------

router.get("/activity-log", async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const lim = parseInt(req.query.limit) || 50;
    const partner_id = req.query.partner_id;
    let q = `SELECT a.*, p.name AS partner_name
             FROM pcd_activity_log a
             LEFT JOIN pcd_partners p ON p.id = a.partner_id
             WHERE a.company_id = $1`;
    const params = [companyId];
    if (partner_id) { params.push(partner_id); q += ` AND a.partner_id = $${params.length}`; }
    params.push(lim);
    q += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;
    const r = await db.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// --- MR ASSIGNMENT (dedicated, minimal update) --------------------------------

router.put("/partners/:id/assign-mr", async (req, res) => {
  try {
    const { mr_id } = req.body;
    if (!mr_id) return res.status(400).json({ success: false, error: "mr_id required" });

    // Verify MR exists
    const mrCheck = await db.query("SELECT id, name FROM medical_representatives WHERE id=$1", [mr_id]);
    if (!mrCheck.rows.length) return res.status(404).json({ success: false, error: "MR not found" });

    // Append mr_id to array (avoid duplicates)
    const r = await db.query(
      `UPDATE pcd_partners
       SET assigned_mr_ids = ARRAY(
         SELECT DISTINCT unnest(array_append(COALESCE(assigned_mr_ids, '{}'), $1::uuid))
       ),
       updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, assigned_mr_ids`,
      [mr_id, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Partner not found" });

    await db.query(
      "INSERT INTO pcd_activity_log (actor_name, action_type, description, entity_type, entity_id, partner_id, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [req.user?.name || "System", "MR_ASSIGNED", `MR ${mrCheck.rows[0].name} assigned to partner`, "partner", req.params.id, req.params.id, req.user?.companyId || 1]
    );

    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/partners/:id/assign-mr/:mr_id", async (req, res) => {
  try {
    const r = await db.query(
      `UPDATE pcd_partners
       SET assigned_mr_ids = array_remove(COALESCE(assigned_mr_ids, '{}'), $1::uuid),
       updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, assigned_mr_ids`,
      [req.params.mr_id, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Partner not found" });
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- PARTNER DOCUMENTS -------------------------------------------------------

router.get("/partner-documents", async (req, res) => {
  try {
    const { partner_id } = req.query;
    let q = `SELECT d.*, p.name AS partner_name
             FROM pcd_partner_documents d
             LEFT JOIN pcd_partners p ON p.id = d.partner_id`;
    const params = [];
    if (partner_id) { params.push(partner_id); q += ` WHERE d.partner_id = $1`; }
    q += " ORDER BY d.created_at DESC";
    const r = await db.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/partner-documents/:id/verify", async (req, res) => {
  try {
    const { status } = req.body; // VERIFIED or REJECTED
    if (!['VERIFIED','REJECTED'].includes(status))
      return res.status(400).json({ success: false, error: "Status must be VERIFIED or REJECTED" });
    const r = await db.query(
      `UPDATE pcd_partner_documents SET status=$1, verified_by=$2, approved_at=NOW() WHERE id=$3 RETURNING *`,
      [status, req.user?.id || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- ONBOARDING: GET all applications with document status -------------------

router.get("/onboarding/applications", async (req, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const r = await db.query(
      `SELECT p.*,
         COUNT(d.id) AS total_docs,
         COUNT(CASE WHEN d.status='VERIFIED' THEN 1 END) AS verified_docs,
         COUNT(CASE WHEN d.status='PENDING' THEN 1 END) AS pending_docs,
         COUNT(CASE WHEN d.status='REJECTED' THEN 1 END) AS rejected_docs
       FROM pcd_partners p
       LEFT JOIN pcd_partner_documents d ON d.partner_id = p.id
       WHERE p.company_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [companyId]
    );
    res.json({ success: true, data: r.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
