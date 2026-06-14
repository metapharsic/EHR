const axios = require('axios');
const db = require('../db');

const api = axios.create({
  baseURL: process.env.DEERFLOW_BASE_URL || 'http://localhost:8080/api',
  timeout: 5000,
});

/**
 * Trigger a Deerflow workflow. Always logs to audit_logs; fires external service if configured.
 */
async function triggerWorkflow(payload) {
  const { workflowId, moduleId, userId, triggeredBy } = payload;

  // Always log the trigger so the dashboard has real data
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details, created_at)
       VALUES ($1, $2, $3, 'IN_PROGRESS', $4, NOW())`,
      [
        userId || null,
        workflowId,
        moduleId,
        JSON.stringify({ source: 'deerflow', triggeredBy: triggeredBy || 'system' })
      ]
    );
  } catch (dbErr) {
    console.warn('[Deerflow] Could not log trigger to audit_logs:', dbErr.message);
  }

  // Fire external Deerflow only if configured
  if (!process.env.DEERFLOW_BASE_URL) return { status: 'IN_PROGRESS', logged: true };

  try {
    const resp = await api.post('/workflows/trigger', payload);
    return resp.data;
  } catch (err) {
    console.warn('[Deerflow] External service unavailable:', err.message);
    return { status: 'IN_PROGRESS', logged: true };
  }
}

/**
 * Get workflow status — from audit_logs if external service not configured.
 */
async function getWorkflowStatus(workflowId) {
  if (!process.env.DEERFLOW_BASE_URL) {
    const { rows } = await db.query(
      `SELECT COALESCE(status, 'COMPLETED') AS status, created_at AS "createdAt"
       FROM audit_logs WHERE action = $1 ORDER BY created_at DESC LIMIT 1`,
      [workflowId]
    );
    return rows[0] || { status: 'UNKNOWN' };
  }
  const resp = await api.get(`/workflows/${workflowId}/status`);
  return resp.data;
}

module.exports = { triggerWorkflow, getWorkflowStatus };
