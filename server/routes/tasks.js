const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

// Apply middleware
router.use(verifyTokenMiddleware);

// GET /api/tasks
router.get('/', async (req, res) => {
  console.log('GET /api/tasks HIT - User:', req.user?.userId);
  try {
    const { rows } = await db.query(
      'SELECT * FROM erp_tasks WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC',
      [req.user.userId]
    );
    console.log('GET /api/tasks SUCCESS - Count:', rows.length);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Failed to fetch tasks', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, due_date, completed } = req.body;
    const { rows } = await db.query(
      `INSERT INTO erp_tasks (title, description, priority, due_date, completed, user_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, priority || 'Medium', due_date || null, completed || false, req.user.userId, req.user.companyId || 1]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Failed to create task', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, due_date, completed } = req.body;
    const { rows } = await db.query(
      `UPDATE erp_tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           priority = COALESCE($3, priority),
           due_date = COALESCE($4, due_date),
           completed = COALESCE($5, completed),
           updated_at = NOW()
       WHERE id = $6 AND (user_id = $7 OR user_id IS NULL)
       RETURNING *`,
      [title, description, priority, due_date, completed, id, req.user.userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Failed to update task', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      'DELETE FROM erp_tasks WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [id, req.user.userId]
    );
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    logger.error('Failed to delete task', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

module.exports = router;
