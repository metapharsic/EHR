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

module.exports = router;
