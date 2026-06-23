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
      SELECT si.*, si.customer_name as party_name,
             si.invoice_number as invoice_no,
             si.date as invoice_date,
             si.net_amount as net_payable,
             (SELECT COUNT(*) FROM sales_invoice_items WHERE invoice_id = si.id) as item_count
      FROM sales_invoices si
      WHERE (si.invoice_number LIKE 'PCD-%' OR si.invoice_number LIKE 'WHO-%')
    `;
    const params = [];

    if (search) {
      query += ` AND (si.invoice_number ILIKE $${params.length + 1} 
                  OR si.customer_name ILIKE $${params.length + 1})`;
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
    let countQuery = "SELECT COUNT(*) as count FROM sales_invoices WHERE (invoice_number LIKE 'PCD-%' OR invoice_number LIKE 'WHO-%')";
    const countParams = [];
    if (search) {
      countQuery += ` AND (invoice_number ILIKE $${countParams.length + 1} OR customer_name ILIKE $${countParams.length + 1})`;
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
    const partiesQuery = "SELECT id as value, name as label FROM parties WHERE type = 'Debtor' ORDER BY name";
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
  const { party_id, party_name, invoice_date, payment_mode = 'Credit', items } = req.body;

  if (!party_id) return res.status(400).json({ success: false, error: 'Distributor is required' });
  if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Add at least one item' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Deterministic invoice number: WHO-YYYYMMDD-SEQ
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: seqRows } = await client.query(
      "SELECT COUNT(*)+1 AS seq FROM sales_invoices WHERE invoice_number LIKE $1",
      ['WHO-' + dateStr + '-%']
    );
    const seq = String(seqRows[0].seq).padStart(4, '0');
    const invoiceNumber = 'WHO-' + dateStr + '-' + seq;

    const sub_total = items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.rate), 0);
    const total_gst = items.reduce((s, i) => {
      const taxable = parseFloat(i.quantity) * parseFloat(i.rate);
      return s + taxable * (parseFloat(i.gst_percent) || 12) / 100;
    }, 0);
    const net_amount = parseFloat((sub_total + total_gst).toFixed(2));

    const { rows: [inv] } = await client.query(`
      INSERT INTO sales_invoices
        (invoice_number, party_id, customer_name, date, payment_mode,
         sub_total, taxable_value, total_gst, net_amount, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, 'Completed', $9)
      RETURNING id, invoice_number
    `, [invoiceNumber, party_id, party_name,
        invoice_date || new Date().toISOString().split('T')[0],
        payment_mode, sub_total, total_gst, net_amount,
        req.user ? req.user.id : null]);

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const rate = parseFloat(item.rate);
      const gst_pct = parseFloat(item.gst_percent) || 12;
      const taxable = parseFloat((qty * rate).toFixed(2));
      const total = parseFloat((taxable * (1 + gst_pct / 100)).toFixed(2));

      const freeQty = item.scheme_type === '10+7' ? Math.round(qty * 7 / 10) : (parseInt(item.free_strips) || 0);
      await client.query(`
        INSERT INTO sales_invoice_items
          (invoice_id, sales_invoice_id, product_id, quantity, free_quantity, rate, selling_rate,
           mrp, gst_percent, taxable_value, total_amount, scheme_type)
        VALUES ($1, $1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10)
      `, [inv.id, item.product_id || null, qty, freeQty, rate,
          parseFloat(item.mrp) || 0, gst_pct, taxable, total, item.scheme_type || 'none']);
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

module.exports = router;
