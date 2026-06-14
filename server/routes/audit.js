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
      whereClause += ` AND (al.action ILIKE $${params.length + 1}
                       OR COALESCE(u.name, u.email, '') ILIKE $${params.length + 1}
                       OR COALESCE(al.error_message, al.details::text, al.changes::text) ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (module !== 'ALL') {
      // match either the stored module or the derived module (action prefix before first underscore)
      whereClause += ` AND (al.module = $${params.length + 1} OR (al.module IS NULL AND SPLIT_PART(al.action, '_', 1) = $${params.length + 1}))`;
      params.push(module);
    }

    const countQuery = `SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT
        al.id,
        COALESCE(u.name, u.email, 'System') AS "user",
        al.action,
        COALESCE(al.module, SPLIT_PART(al.action, '_', 1)) AS module,
        COALESCE(al.error_message, al.details::text, al.changes::text) AS details,
        al.ip_address AS "ipAddress",
        al.created_at AS timestamp,
        al.status
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at ${sortOrder}
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
