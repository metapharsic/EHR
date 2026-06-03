const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');

// Verify authentication on all routes
router.use(verifyTokenMiddleware);

/**
 * GET /api/audit
 * Fetch all audit logs with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      module = 'ALL',
      page = 1,
      limit = 50,
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (search) {
      whereClause += ' AND (action ILIKE $' + (params.length + 1) + 
                     ' OR COALESCE(error_message, changes::text) ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    if (module !== 'ALL') {
      whereClause += ' AND module = $' + (params.length + 1);
      params.push(module);
    }

    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT 
        id,
        user_id as "user",
        action,
        module,
        COALESCE(error_message, changes::text) as details,
        ip_address as "ipAddress",
        created_at as timestamp
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/audit/dropdown
 */
router.get('/dropdown', async (req, res) => {
  try {
    const modulesQuery = 'SELECT DISTINCT module as label, module as value FROM audit_logs WHERE module IS NOT NULL';
    const modulesResult = await db.query(modulesQuery);

    res.json({
      success: true,
      data: {
        modules: [
          { value: 'ALL', label: 'All Modules' },
          ...modulesResult.rows
        ]
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
