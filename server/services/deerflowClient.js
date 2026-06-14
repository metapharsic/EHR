import axios from 'axios';

const api = axios.create({
  baseURL: process.env.DEERFLOW_BASE_URL || 'http://localhost:8080/api',
  timeout: 5000,
});

/**
 * Trigger a Deerflow workflow
 * @param {Object} payload 
 * @returns {Promise<any>}
 */
export async function triggerWorkflow(payload) {
  const resp = await api.post('/workflows/trigger', payload);
  return resp.data;
}

/**
 * Get status of a workflow
 * @param {string} workflowId 
 * @returns {Promise<any>}
 */
export async function getWorkflowStatus(workflowId) {
  const resp = await api.get(`/workflows/${workflowId}/status`);
  return resp.data;
}
