const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');

// Middleware
router.use(verifyTokenMiddleware);
router.use(verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'SALES_MANAGER']));

/**
 * GET /api/sales
 * Fetch all sales invoices (Wholesale)
 */
router.get('/', async (req, res) => {
  try {
    const { 
      search = '', 
      status = 'All', 
      page = 1, 
      limit = 20, 
      dateFrom = '', 
      dateTo = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT si.*,
             COALESCE(p.name, si.customer_name) as party_name,
             si.invoice_number as invoice_no,
             si.date as invoice_date,
             si.net_amount as net_payable,
             p.gstin as party_gstin,
             p.mobile as party_mobile,
             p.status as party_status,
             (SELECT COUNT(*) FROM sales_invoice_items WHERE invoice_id = si.id OR sales_invoice_id = si.id) as item_count
      FROM sales_invoices si
      LEFT JOIN parties p ON p.id = si.party_id
      WHERE (si.invoice_number LIKE 'PCD-%' OR si.invoice_number LIKE 'WHO-%')
    `;
    const params = [];

    if (search) {
      query += ` AND (si.invoice_number ILIKE $${params.length + 1}
                  OR si.customer_name ILIKE $${params.length + 1}
                  OR p.name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (status !== 'All') {
      query += ` AND si.status = $${params.length + 1}`;
      params.push(status);
    }

    if (dateFrom) {
      query += ` AND si.date >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND si.date <= $${params.length + 1}`;
      params.push(dateTo);
    }

    query += ` ORDER BY si.${sortBy} ${sortOrder}
              LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);

    // Get total count
    let countQuery = "SELECT COUNT(*) as count FROM sales_invoices si LEFT JOIN parties p ON p.id=si.party_id WHERE (si.invoice_number LIKE 'PCD-%' OR si.invoice_number LIKE 'WHO-%')";
    const countParams = [];
    if (search) {
      countQuery += ` AND (si.invoice_number ILIKE $${countParams.length + 1} OR si.customer_name ILIKE $${countParams.length + 1} OR p.name ILIKE $${countParams.length + 1})`;
      countParams.push(`%${search}%`);
    }
    if (status !== 'All') {
      countQuery += ` AND status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const { rows: countRows } = await db.query(countQuery, countParams);
    const total = parseInt(countRows[0].count);

    res.json({
      success: true,
      data: rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Failed to fetch sales', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales' });
  }
});

/**
 * GET /api/sales/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const totalQuery = "SELECT COUNT(*) FROM sales_invoices WHERE (invoice_number LIKE 'PCD-%' OR invoice_number LIKE 'WHO-%')";
    const revenueQuery = "SELECT SUM(net_amount) FROM sales_invoices WHERE (invoice_number LIKE 'PCD-%' OR invoice_number LIKE 'WHO-%')";
    const monthQuery = "SELECT SUM(net_amount) FROM sales_invoices WHERE date >= date_trunc('month', CURRENT_DATE) AND (invoice_number LIKE 'PCD-%' OR invoice_number LIKE 'WHO-%')";

    const [total, revenue, month] = await Promise.all([
      db.query(totalQuery),
      db.query(revenueQuery),
      db.query(monthQuery)
    ]);

    res.json({
      success: true,
      data: {
        totalInvoices: parseInt(total.rows[0].count),
        totalRevenue: parseFloat(revenue.rows[0].sum || 0),
        monthlyRevenue: parseFloat(month.rows[0].sum || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sales/dropdown
 */
router.get('/dropdown', async (req, res) => {
  try {
    const partiesQuery = "SELECT id as value, name as label FROM parties WHERE type = 'Debtor' AND status = 'Active' ORDER BY name";
    const partiesResult = await db.query(partiesQuery);

    res.json({
      success: true,
      data: {
        parties: partiesResult.rows,
        statuses: [
          { value: 'All', label: 'All Statuses' },
          { value: 'Completed', label: 'Completed' },
          { value: 'Pending', label: 'Pending' },
          { value: 'Cancelled', label: 'Cancelled' }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * GET /api/sales/products
 * Active products for wholesale invoice item selection
 */
router.get('/products', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name,
             COALESCE(ptr, selling_rate, 0) as "ptr",
             COALESCE(mrp, 0) as mrp,
             COALESCE(gst, 12) as gst,
             packing, uom
      FROM products
      WHERE is_active = true
      ORDER BY name
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Failed to fetch products for sales', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sales
 * Create a new wholesale invoice (ACID transaction, WHO- prefix)
 */
router.post('/', async (req, res) => {
  const {
    party_id, party_name, invoice_date, payment_mode = 'Credit', items,
    lr_no, lr_date, order_no, due_date, ewaybill_no, transport, weight
  } = req.body;

  if (!party_id) return res.status(400).json({ success: false, error: 'Distributor is required' });
  if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Add at least one item' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: seqRows } = await client.query(
      "SELECT COUNT(*)+1 AS seq FROM sales_invoices WHERE invoice_number LIKE $1",
      ['WHO-' + dateStr + '-%']
    );
    const seq = String(seqRows[0].seq).padStart(4, '0');
    const invoiceNumber = 'WHO-' + dateStr + '-' + seq;

    const sub_total = items.reduce((s, i) => {
      const qty = parseFloat(i.quantity)||0; const rate = parseFloat(i.rate)||0; const disc = parseFloat(i.discount_percent)||0;
      return s + qty * rate * (1 - disc/100);
    }, 0);
    const total_gst = items.reduce((s, i) => {
      const qty = parseFloat(i.quantity)||0; const rate = parseFloat(i.rate)||0; const disc = parseFloat(i.discount_percent)||0;
      const taxable = qty * rate * (1 - disc/100);
      return s + taxable * (parseFloat(i.gst_percent) || 12) / 100;
    }, 0);
    const net_before_round = sub_total + total_gst;
    const round_off = parseFloat((Math.round(net_before_round) - net_before_round).toFixed(2));
    const net_amount = Math.round(net_before_round);

    const { rows: [inv] } = await client.query(`
      INSERT INTO sales_invoices
        (invoice_number, party_id, customer_name, date, payment_mode,
         sub_total, taxable_value, total_gst, net_amount, round_off, status, created_by,
         lr_no, lr_date, order_no, due_date, ewaybill_no, transport, weight)
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, 'Completed', $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, invoice_number
    `, [invoiceNumber, party_id, party_name,
        invoice_date || new Date().toISOString().split('T')[0],
        payment_mode, sub_total, total_gst, net_amount, round_off,
        req.user ? req.user.id : null,
        lr_no||null, lr_date||null, order_no||null, due_date||null,
        ewaybill_no||null, transport||null, weight||null]);

    for (const item of items) {
      const qty   = parseFloat(item.quantity)||0;
      const rate  = parseFloat(item.rate)||0;
      const disc  = parseFloat(item.discount_percent)||0;
      const gst_pct = parseFloat(item.gst_percent)||12;
      const taxable = parseFloat((qty * rate * (1 - disc/100)).toFixed(2));
      const igst_amt = parseFloat((taxable * gst_pct / 100).toFixed(2));
      const total   = parseFloat((taxable + igst_amt).toFixed(2));
      const freeQty = parseInt(item.free_quantity)||0;

      await client.query(`
        INSERT INTO sales_invoice_items
          (invoice_id, sales_invoice_id, product_id, quantity, free_quantity, rate, selling_rate,
           mrp, old_mrp, gst_percent, discount_percent, taxable_value, igst_amount, total_amount,
           scheme_type, batch_no, hsn_code, manufacturer_code, expiry_date, pack)
        VALUES ($1,$1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      `, [inv.id, item.product_id||null, qty, freeQty, rate,
          parseFloat(item.mrp)||0, parseFloat(item.old_mrp)||0,
          gst_pct, disc, taxable, igst_amt, total,
          item.scheme_type||'none',
          item.batch_no||null, item.hsn_code||null,
          item.manufacturer_code||null,
          item.expiry_date||null,
          item.pack||null]);
    }

    await client.query('COMMIT');
    logger.info('Wholesale invoice created', { invoiceNumber, net_amount });
    res.status(201).json({ success: true, data: { id: inv.id, invoice_number: inv.invoice_number } });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to create wholesale invoice', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to create wholesale invoice' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/sales/analytics
 * Monthly revenue trend (last 6 months) + top products
 */
router.get('/analytics', async (req, res) => {
  try {
    const [trendRows, topRows] = await Promise.all([
      db.query(`
        SELECT to_char(date_trunc('month', date), 'Mon YY') AS month,
               SUM(net_amount) AS revenue,
               COUNT(*) AS invoices
        FROM sales_invoices
        WHERE date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
          AND status != 'Cancelled'
          AND (invoice_number LIKE 'WHO-%' OR invoice_number LIKE 'PCD-%')
        GROUP BY date_trunc('month', date)
        ORDER BY date_trunc('month', date)
      `),
      db.query(`
        SELECT p.category, COALESCE(SUM(sii.taxable_value),0) AS revenue
        FROM sales_invoice_items sii
        JOIN products p ON p.id = sii.product_id
        JOIN sales_invoices si ON si.id = sii.invoice_id
        WHERE si.status != 'Cancelled'
          AND si.date >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY p.category
        ORDER BY revenue DESC
        LIMIT 5
      `)
    ]);
    res.json({ success: true, data: { trend: trendRows.rows, topCategories: topRows.rows } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sales/:id
 * Invoice header + line items for print/detail view
 */
router.get('/:id', async (req, res) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT si.id, si.invoice_number as invoice_no, si.date as invoice_date,
              si.customer_name as party_name, si.party_id, si.payment_mode, si.status,
              si.sub_total, si.total_gst, si.net_amount as net_payable,
              si.lr_no, si.lr_date, si.order_no, si.due_date,
              si.ewaybill_no, si.transport, si.weight,
              p.gstin, p.address as party_address, p.mobile as party_phone
       FROM sales_invoices si
       LEFT JOIN parties p ON p.id = si.party_id
       WHERE si.id = $1`,
      [req.params.id]
    );
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const { rows: items } = await db.query(
      `SELECT sii.id, sii.product_id, prod.name as product_name, sii.quantity, sii.free_quantity,
              sii.rate as ptr, sii.mrp, sii.old_mrp, sii.gst_percent, sii.discount_percent,
              sii.scheme_type, sii.hsn_code, sii.pack, sii.manufacturer_code,
              sii.taxable_value, sii.total_amount,
              COALESCE(NULLIF(sii.batch_no, ''),
                (SELECT b.batch_number FROM batches b WHERE b.product_id = sii.product_id AND b.available_qty > 0 ORDER BY b.expiry_date LIMIT 1),
                ''
              ) as batch_no,
              COALESCE(sii.expiry_date::text,
                (SELECT b.expiry_date::text FROM batches b WHERE b.product_id = sii.product_id AND b.available_qty > 0 ORDER BY b.expiry_date LIMIT 1),
                ''
              ) as expiry
       FROM sales_invoice_items sii
       LEFT JOIN products prod ON prod.id = sii.product_id
       WHERE (sii.invoice_id = $1 OR sii.sales_invoice_id = $1)
       ORDER BY sii.id`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...inv, items } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/sales/:id
 * Edit a wholesale invoice — update header + replace line items (ACID transaction).
 * "Append" = client sends the full item list including the newly added lines.
 * invoice_number is immutable. Cancelled invoices cannot be edited.
 */
router.put('/:id', verifyRoleMiddleware(['ADMIN', 'SALES_MANAGER']), async (req, res) => {
  const { id } = req.params;
  const {
    party_id, party_name, invoice_date, payment_mode = 'Credit', items,
    lr_no, lr_date, order_no, due_date, ewaybill_no, transport, weight
  } = req.body;

  if (!party_id) return res.status(400).json({ success: false, error: 'Distributor is required' });
  if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Add at least one item' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row, confirm it exists and is editable
    const { rows: [existing] } = await client.query(
      "SELECT id, status, invoice_number FROM sales_invoices WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    if (existing.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Cancelled invoice cannot be edited' });
    }

    const sub_total = items.reduce((s, i) => {
      const qty = parseFloat(i.quantity)||0; const rate = parseFloat(i.rate)||0; const disc = parseFloat(i.discount_percent)||0;
      return s + qty * rate * (1 - disc/100);
    }, 0);
    const total_gst = items.reduce((s, i) => {
      const qty = parseFloat(i.quantity)||0; const rate = parseFloat(i.rate)||0; const disc = parseFloat(i.discount_percent)||0;
      const taxable = qty * rate * (1 - disc/100);
      return s + taxable * (parseFloat(i.gst_percent) || 12) / 100;
    }, 0);
    const net_before_round = sub_total + total_gst;
    const round_off = parseFloat((Math.round(net_before_round) - net_before_round).toFixed(2));
    const net_amount = Math.round(net_before_round);

    await client.query(`
      UPDATE sales_invoices SET
        party_id=$2, customer_name=$3, date=$4, payment_mode=$5,
        sub_total=$6, taxable_value=$6, total_gst=$7, net_amount=$8, round_off=$9,
        lr_no=$10, lr_date=$11, order_no=$12, due_date=$13,
        ewaybill_no=$14, transport=$15, weight=$16, updated_at=NOW()
      WHERE id=$1
    `, [id, party_id, party_name,
        invoice_date || new Date().toISOString().split('T')[0],
        payment_mode, sub_total, total_gst, net_amount, round_off,
        lr_no||null, lr_date||null, order_no||null, due_date||null,
        ewaybill_no||null, transport||null, weight||null]);

    // Replace line items wholesale (covers edits, removals, and appended lines)
    await client.query('DELETE FROM sales_invoice_items WHERE invoice_id=$1 OR sales_invoice_id=$1', [id]);

    for (const item of items) {
      const qty   = parseFloat(item.quantity)||0;
      const rate  = parseFloat(item.rate)||0;
      const disc  = parseFloat(item.discount_percent)||0;
      const gst_pct = parseFloat(item.gst_percent)||12;
      const taxable = parseFloat((qty * rate * (1 - disc/100)).toFixed(2));
      const igst_amt = parseFloat((taxable * gst_pct / 100).toFixed(2));
      const total   = parseFloat((taxable + igst_amt).toFixed(2));
      const freeQty = parseInt(item.free_quantity)||0;

      await client.query(`
        INSERT INTO sales_invoice_items
          (invoice_id, sales_invoice_id, product_id, quantity, free_quantity, rate, selling_rate,
           mrp, old_mrp, gst_percent, discount_percent, taxable_value, igst_amount, total_amount,
           scheme_type, batch_no, hsn_code, manufacturer_code, expiry_date, pack)
        VALUES ($1,$1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      `, [id, item.product_id||null, qty, freeQty, rate,
          parseFloat(item.mrp)||0, parseFloat(item.old_mrp)||0,
          gst_pct, disc, taxable, igst_amt, total,
          item.scheme_type||'none',
          item.batch_no||null, item.hsn_code||null,
          item.manufacturer_code||null,
          item.expiry_date||null,
          item.pack||null]);
    }

    await client.query('COMMIT');
    logger.info('Wholesale invoice updated', { id, invoiceNumber: existing.invoice_number, net_amount });
    res.json({ success: true, data: { id, invoice_number: existing.invoice_number, net_amount } });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to update wholesale invoice', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update wholesale invoice' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/sales/:id
 * Soft-cancel a wholesale invoice (status → Cancelled)
 */
router.delete('/:id', verifyRoleMiddleware(['ADMIN', 'SALES_MANAGER']), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE sales_invoices SET status='Cancelled', updated_at=NOW()
       WHERE id=$1 AND status != 'Cancelled' RETURNING id, invoice_number`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Invoice not found or already cancelled' });
    logger.info('Wholesale invoice cancelled', { id: req.params.id, invoiceNumber: rows[0].invoice_number });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error('Failed to cancel invoice', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
