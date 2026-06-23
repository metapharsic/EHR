const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Middleware
router.use(verifyTokenMiddleware);
router.use(verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'PURCHASE_MANAGER']));

/**
 * GET /api/purchase
 * Fetch all purchase orders with pagination, filters, and Trend Analytics
 */
router.get('/', async (req, res) => {
  try {
    const { search = '', status = 'All', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT po.id, po.company_id, po.supplier_id, po.po_number as invoice_no, po.date as order_date,
             COALESCE(NULLIF(SUM(poi.total_amount)::numeric, 0), po.total_amount, 0) as total_amount,
             po.status, po.created_by, po.created_at, po.updated_at,
             s.name as supplier_name, NULL as supplier_code,
             COUNT(poi.id)::int as item_count
      FROM purchase_orders po
      LEFT JOIN parties s ON po.supplier_id = s.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (po.po_number ILIKE $${params.length + 1} 
                  OR s.name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (status !== 'All') {
      query += ` AND po.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` GROUP BY po.id, s.name
              ORDER BY po.created_at DESC
              LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);

    // Calculate Trend: This Month vs Last Month (use po.total_amount — items may be unlinked)
    const { rows: trendData } = await db.query(`
      SELECT
        date_trunc('month', created_at) as month,
        SUM(total_amount) as spent
      FROM purchase_orders
      WHERE created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
      GROUP BY 1
      ORDER BY 1 DESC
    `);

    let trend = 0;
    if (trendData.length >= 2) {
      const current = parseFloat(trendData[0].spent);
      const previous = parseFloat(trendData[1].spent);
      if (previous > 0) {
        trend = ((current - previous) / previous) * 100;
      }
    }

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM purchase_orders po LEFT JOIN parties s ON po.supplier_id = s.id WHERE 1=1';
    const countParams = [];
    if (search) {
      countQuery += ` AND (po.po_number ILIKE $1 OR s.name ILIKE $1)`;
      countParams.push(`%${search}%`);
    }
    if (status !== 'All') {
      countQuery += ` AND po.status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const { rows: countRows } = await db.query(countQuery, countParams);
    const totalCount = parseInt(countRows[0].count);

    res.json({
      success: true,
      data: rows,
      trend: trend.toFixed(1),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

    logger.http('GET', '/api/purchase', 200, rows.length, req.ip, req.user.userId);
  } catch (error) {
    logger.error('Failed to fetch purchases', { error: error.message, userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to fetch purchases' });
  }
});


/**
 * GET /api/purchase/lists/dropdown
 * Fetch dropdown data (suppliers, status options, etc.)
 */
router.get('/lists/dropdown', async (req, res) => {
  try {
    const { rows: suppliers } = await db.query(
      "SELECT id, name, NULL as code FROM parties WHERE type = 'Creditor' AND status = 'Active' ORDER BY name"
    );

    const { rows: products } = await db.query(
      'SELECT id, name, code FROM products WHERE is_active IS NOT FALSE ORDER BY name'
    );

    res.json({
      success: true,
      data: {
        suppliers,
        products,
        statusOptions: ['Draft', 'Ordered', 'Received', 'Partial', 'Cancelled', 'Returned'],
        paymentTerms: ['Immediate', '7 Days', '15 Days', '30 Days', '45 Days', '60 Days', '90 Days'],
        deliveryModes: ['Own Transport', 'Courier', 'Air', 'Rail', 'Truck']
      }
    });
  } catch (error) {
    logger.error('Failed to fetch dropdown lists', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch data' });
  }
});

/**
 * POST /api/purchase
 * Create new purchase order with Budget Control
 */
router.post('/', async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      invoice_no,
      supplier_id,
      order_date,
      category_id = 'GENERAL',
      items = []
    } = req.body;

    if (!invoice_no || !supplier_id || !order_date) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    await client.query('BEGIN');

    // 1. Calculate Total Amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.purchase_rate), 0);

    // 2. BUDGET CONTROL CHECK
    const { rows: budget } = await client.query(
      'SELECT * FROM purchase_budgets WHERE category_id = $1 AND status != $2',
      [category_id, 'Over']
    );

    if (budget.length > 0) {
      const b = budget[0];
      if ((parseFloat(b.spent_amount) + parseFloat(b.committed_amount) + totalAmount) > parseFloat(b.budgeted_amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: `Budget Exceeded for ${category_id}. Remaining: ${parseFloat(b.budgeted_amount) - (parseFloat(b.spent_amount) + parseFloat(b.committed_amount))}` 
        });
      }
      
      // Update committed amount
      await client.query(
        'UPDATE purchase_budgets SET committed_amount = committed_amount + $1 WHERE id = $2',
        [totalAmount, b.id]
      );
    }

    // 3. Insert purchase order
    const { rows: poResult } = await client.query(
      `INSERT INTO purchase_orders 
       (po_number, supplier_id, date, status, created_by)
       VALUES ($1, $2, $3, 'Draft', $4)
       RETURNING id`,
      [invoice_no, supplier_id, order_date, req.user.userId]
    );

    const poId = poResult[0].id;

    // 4. Insert line items
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items 
         (po_id, product_id, quantity, unit_price, total_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [poId, item.product_id, item.quantity, item.purchase_rate, (item.quantity * item.purchase_rate)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, id: poId });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create purchase order', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/purchase/3-way-match
 * Fetch 3-Way matching status for all POs with detailed analysis
 */
router.get('/3-way-match', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        po.id as "poId", 
        po.po_number as "poNumber",
        grn.grn_number as "grnNumber",
        si.invoice_number as "invoiceNumber",
        s.name as "supplierName",
        COALESCE((SELECT SUM(quantity * unit_price) FROM purchase_order_items WHERE po_id = po.id), 0) as "poAmount",
        COALESCE((SELECT SUM(accepted_qty * unit_price) FROM grn_items gi JOIN goods_received_notes g ON gi.grn_id = g.id WHERE g.purchase_order_id = po.id), 0) as "grnAmount",
        COALESCE(si.total_amount, 0) as "invoiceAmount",
        COALESCE(twm.match_status, 'Pending') as "status",
        COALESCE(twm.variance_amount, 0) as "variance",
        twm.id as "id"
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN goods_received_notes grn ON po.id = grn.purchase_order_id
      LEFT JOIN supplier_invoices si ON po.supplier_id = si.supplier_id
      LEFT JOIN three_way_matches twm ON po.id = twm.purchase_order_id
      ORDER BY po.created_at DESC
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/purchase/3-way-match/:id
 */
router.put('/3-way-match/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { match_status, variance_amount, remarks } = req.body;
    const { rows } = await db.query(
      `UPDATE three_way_matches 
       SET match_status = COALESCE($1, match_status),
           variance_amount = COALESCE($2, variance_amount),
           remarks = COALESCE($3, remarks),
           verified_at = NOW(),
           verified_by = $4
       WHERE id = $5 OR purchase_order_id = $5
       RETURNING *`,
      [match_status, variance_amount, remarks, req.user.userId, id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/purchase/vendor-ratings
 */
router.get('/vendor-ratings', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT vr.*, s.name as "supplierName"
      FROM vendor_ratings vr
      JOIN suppliers s ON vr.supplier_id = s.id
      ORDER BY vr.overall_rating DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/purchase/vendor-ratings/:id
 */
router.put('/vendor-ratings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quality_score, delivery_score, price_score, overall_rating } = req.body;
    const { rows } = await db.query(
      `UPDATE vendor_ratings 
       SET quality_score = COALESCE($1, quality_score),
           delivery_score = COALESCE($2, delivery_score),
           price_score = COALESCE($3, price_score),
           overall_rating = COALESCE($4, overall_rating),
           last_evaluated_at = NOW()
       WHERE id = $5 OR supplier_id = $5
       RETURNING *`,
      [quality_score, delivery_score, price_score, overall_rating, id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/purchase/reorder-alerts
 * Advanced Reorder Intelligence
 */
router.get('/reorder-alerts', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        p.id as "productId",
        p.name as "productName",
        COALESCE(p.min_stock_level, 5) as "reorderPoint",
        COALESCE((SELECT SUM(stock) FROM batches WHERE product_id = p.id AND status != 'Expired'), 0) as "currentStock",
        COALESCE(p.manufacturer, 'N/A') as "supplierName"
      FROM products p
      WHERE COALESCE(p.is_active, true) = true
      AND COALESCE((SELECT SUM(stock) FROM batches WHERE product_id = p.id AND status != 'Expired'), 0)
          <= COALESCE(p.min_stock_level, 5)
      ORDER BY (COALESCE(p.min_stock_level, 5) - COALESCE((SELECT SUM(stock) FROM batches WHERE product_id = p.id AND status != 'Expired'), 0)) DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/purchase/budgets
 * Specialized procurement budget control
 */
router.get('/budgets', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM purchase_budgets 
      ORDER BY period_name DESC, category_id ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/purchase/budgets/:id
 */
router.put('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { budgeted_amount, spent_amount, committed_amount, status } = req.body;

    const { rows } = await db.query(
      `UPDATE purchase_budgets 
       SET budgeted_amount = COALESCE($1, budgeted_amount),
           spent_amount = COALESCE($2, spent_amount),
           committed_amount = COALESCE($3, committed_amount),
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [budgeted_amount, spent_amount, committed_amount, status, id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Budget updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * GET /api/purchase/approvals
 * Fetch pending approval tasks for the user
 */
router.get('/approvals', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        aw.*,
        po.po_number as "documentNo",
        COALESCE((SELECT SUM(quantity * unit_price) FROM purchase_order_items WHERE po_id = po.id), 0) as "amount",
        COALESCE(u.name, 'System') as "requestedBy"
      FROM approval_workflows aw
      JOIN purchase_orders po ON aw.document_id = po.id AND aw.document_type = 'PO'
      LEFT JOIN users u ON po.created_by = u.id
      WHERE aw.status = 'Pending'
      ORDER BY aw.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/purchase/approvals/:id
 * Update approval status
 */
router.put('/approvals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, current_level } = req.body;

    const { rows } = await db.query(
      `UPDATE approval_workflows 
       SET status = COALESCE($1, status),
           current_level = COALESCE($2, current_level),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, current_level, id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Approval updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/purchase/:id
 * Fetch single purchase order with all items
 * IMPORTANT: This MUST be after all named routes (/3-way-match, /vendor-ratings, etc.)
 * otherwise Express treats those paths as :id parameters
 */
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (!isUUID(id)) {
    return next();
  }
  try {
    const { rows: purchase } = await db.query(
      `SELECT po.id, po.company_id, po.supplier_id, po.po_number as invoice_no, po.date as order_date, po.total_amount, po.status, po.created_by, po.created_at, po.updated_at,
              s.name as supplier_name, NULL as supplier_code, s.gstin, s.mobile, s.email, s.address, s.city
       FROM purchase_orders po
       LEFT JOIN parties s ON po.supplier_id = s.id
       WHERE po.id = $1`,
      [id]
    );

    if (!purchase.length) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const { rows: items } = await db.query(
      `SELECT poi.id, poi.po_id, poi.product_id, poi.quantity, poi.unit_price as purchase_rate, poi.total_amount, poi.created_at,
              p.name as product_name, p.code as product_code
       FROM purchase_order_items poi
       LEFT JOIN products p ON poi.product_id = p.id
       WHERE poi.po_id = $1
       ORDER BY poi.created_at`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...purchase[0],
        items
      }
    });

    logger.http('GET', `/api/purchase/${id}`, 200, 1, req.ip, req.user.userId);
  } catch (error) {
    logger.error(`Failed to fetch purchase ${id}`, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch purchase' });
  }
});

/**
 * PUT /api/purchase/:id
 * Update purchase order and its items
 */
router.put('/:id', async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { 
      invoice_no, 
      supplier_id, 
      order_date, 
      expected_delivery_date, 
      payment_terms, 
      delivery_mode, 
      notes, 
      status,
      items = [] 
    } = req.body;

    await client.query('BEGIN');

    // 1. Update purchase order header
    const { rows } = await client.query(
      `UPDATE purchase_orders 
       SET po_number = COALESCE($1, po_number),
           supplier_id = COALESCE($2, supplier_id),
           date = COALESCE($3, date),
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        invoice_no, 
        supplier_id, 
        order_date, 
        status, 
        id
      ]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    // 2. Handle Items Update if items are provided
    if (items && items.length > 0) {
      // For simplicity, we'll replace existing items. 
      // In a production app, you might want to reconcile (update/insert/delete)
      await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [id]);
      
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items 
           (po_id, product_id, quantity, unit_price, total_amount)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id, 
            item.product_id, 
            item.quantity, 
            item.purchase_rate,
            (item.quantity * item.purchase_rate)
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: rows[0],
      message: 'Purchase order and items updated successfully'
    });

    logger.http('PUT', `/api/purchase/${id}`, 200, 1, req.ip, req.user.userId);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    logger.error(`Failed to update purchase ${id}`, { error: error.message });
    res.status(500).json({ success: false, error: error.message || 'Failed to update purchase order' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/purchase/:id/receive
 * Mark items as received
 */
router.post('/:id/receive', async (req, res) => {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    const { items = [] } = req.body;
    const companyId = req.user.companyId || 1;
    const userId = req.user.userId;

    const { postToGeneralLedger, postToStockLedger, findAccount } = require('../utils/ledgerHelper');

    await client.query('BEGIN');

    // Fetch PO details for reference
    const { rows: poRows } = await client.query('SELECT po_number, supplier_id FROM purchase_orders WHERE id = $1', [id]);
    if (poRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    const { po_number: poNumber } = poRows[0];

    let totalReceivedValue = 0;

    // 1. Process items and Stock Ledger
    for (const item of items) {
      const lineValue = parseFloat(item.received_qty) * parseFloat(item.cost || 0);
      totalReceivedValue += lineValue;

      await client.query(
        `UPDATE purchase_order_items 
         SET received_quantity = received_quantity + $1,
             received_date = NOW()
         WHERE id = $2`,
        [item.received_qty, item.item_id]
      );

      // Fetch product default rates for Not-Null enforcement if missing from payload
      const { rows: prodRows } = await client.query('SELECT mrp, selling_rate FROM products WHERE id = $1', [item.product_id]);
      const productDefaults = prodRows[0] || { mrp: 0, selling_rate: 0 };
      
      const batchMrp = item.mrp || productDefaults.mrp || 0;
      const batchSellingRate = item.selling_rate || productDefaults.selling_rate || 0;

      // Add to/Update batches using canonical column names (batch_number and stock)
      const { rows: batchRows } = await client.query(
        `INSERT INTO batches (id, product_id, batch_number, expiry_date, purchase_rate, stock, mrp, selling_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (product_id, batch_number) 
         DO UPDATE SET stock = batches.stock + EXCLUDED.stock
         RETURNING id, godown_id`,
        [uuidv4(), item.product_id, item.batch_no, item.expiry_date, item.cost, item.received_qty, batchMrp, batchSellingRate]
      );
      
      const batchId = batchRows[0].id;
      const godownId = batchRows[0].godown_id || null;

      // Post to Stock Ledger (Inward)
      await postToStockLedger(client, {
        companyId: companyId,
        godownId: godownId,
        productId: item.product_id,
        batchId: batchId,
        movementType: 'IN',
        referenceType: 'Purchase',
        referenceId: id,
        referenceNumber: poNumber,
        quantity: item.received_qty,
        costPerUnit: item.cost,
        movementDate: new Date(),
        narration: `Received against PO: ${poNumber}`,
        createdBy: userId
      });
    }

    // 2. Post to General Ledger
    const inventoryAccountId = await findAccount(client, companyId, 'Inventory');
    const payablesAccountId = await findAccount(client, companyId, 'Payables');

    if (inventoryAccountId && payablesAccountId && totalReceivedValue > 0) {
      // Debit: Inventory
      await postToGeneralLedger(client, {
        accountId: inventoryAccountId,
        voucherId: id,
        voucherType: 'Purchase',
        transactionDate: new Date(),
        debit: totalReceivedValue,
        narration: `Purchase Receipt: ${poNumber}`
      });

      // Credit: Payables
      await postToGeneralLedger(client, {
        accountId: payablesAccountId,
        voucherId: id,
        voucherType: 'Purchase',
        transactionDate: new Date(),
        credit: totalReceivedValue,
        narration: `Purchase Receipt: ${poNumber}`
      });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Items received and ledger updated' });
    logger.http('POST', `/api/purchase/${id}/receive`, 200, items.length, req.ip, userId);
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error(`Failed to receive items for purchase ${id}`, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to receive items' });
  } finally {
    if (client) client.release();
  }
});

/**
 * DELETE /api/purchase/3-way-match/:id
 */
router.delete('/3-way-match/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM three_way_matches WHERE id = $1 OR purchase_order_id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, message: '3-Way Match record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/purchase/vendor-ratings/:id
 */
router.delete('/vendor-ratings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM vendor_ratings WHERE id = $1 OR supplier_id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Vendor rating not found' });
    res.json({ success: true, message: 'Vendor rating deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/purchase/budgets/:id
 */
router.delete('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM purchase_budgets WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Budget record not found' });
    res.json({ success: true, message: 'Budget record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/purchase/approvals/:id
 */
router.delete('/approvals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM approval_workflows WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Approval record not found' });
    res.json({ success: true, message: 'Approval workflow deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/purchase/:id
 * Delete purchase order and its items
 */
router.delete('/:id', async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // 1. Delete items first (FK constraint)
    await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [id]);
    
    // 2. Delete the PO
    const { rowCount } = await client.query('DELETE FROM purchase_orders WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Purchase order deleted successfully' });
    logger.http('DELETE', `/api/purchase/${id}`, 200, 1, req.ip, req.user.userId);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to delete purchase ${id}`, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete purchase order' });
  } finally {
    client.release();
  }
});

module.exports = router;