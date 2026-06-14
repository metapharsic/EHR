const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');

router.use(verifyTokenMiddleware);

/**
 * GET /api/deerflow/workflows
 * Returns recent Deerflow workflow executions from audit_logs
 */
router.get('/workflows', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const { rows } = await db.query(
      `SELECT
         al.id,
         al.action       AS "workflowId",
         al.module       AS "moduleId",
         COALESCE(al.status, 'COMPLETED') AS status,
         al.created_at   AS "createdAt",
         COALESCE(u.name, u.email, 'System') AS "triggeredBy",
         al.details
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.action IN (
         'EMPLOYEE_ONBOARDING_INITIATED','JOURNAL_VOUCHER_CREATED','LEAD_CONVERTED',
         'INVENTORY_SYNC','OMS_SLA_BREACH','PAYROLL_RUN','GST_FILING_TRIGGERED'
       )
       OR (al.details IS NOT NULL AND al.details->>'source' = 'deerflow')
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Deerflow workflows fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/deerflow/workflows/:workflowId/status
 * Returns the latest status of a specific workflow from audit_logs
 */
router.get('/workflows/:workflowId/status', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { rows } = await db.query(
      `SELECT
         id, action AS "workflowId", module AS "moduleId",
         COALESCE(status, 'COMPLETED') AS status,
         created_at AS "createdAt"
       FROM audit_logs
       WHERE id = $1 OR action = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [workflowId]
    );
    if (rows.length === 0) {
      return res.json({ success: true, status: 'UNKNOWN', message: 'No record found for this workflow' });
    }
    res.json({ success: true, ...rows[0] });
  } catch (error) {
    logger.error('Deerflow status fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/deerflow/workflows/trigger
 * Manually trigger a Deerflow workflow and log it
 */
router.post('/workflows/trigger', async (req, res) => {
  const { workflowId, moduleId, payload } = req.body;
  if (!workflowId || !moduleId) {
    return res.status(400).json({ success: false, error: 'workflowId and moduleId are required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details, ip_address, created_at)
       VALUES ($1, $2, $3, 'IN_PROGRESS', $4, $5, NOW())
       RETURNING id`,
      [req.user.userId, workflowId, moduleId, JSON.stringify({ source: 'deerflow', ...(payload || {}) }), req.ip]
    );
    res.json({ success: true, id: rows[0].id, status: 'IN_PROGRESS' });
  } catch (error) {
    logger.error('Deerflow trigger failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
