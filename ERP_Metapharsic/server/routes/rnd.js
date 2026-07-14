const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

/**
 * GET /api/rnd/formulations
 */
router.get('/formulations', verifyTokenMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM rnd_formulations ORDER BY created_at DESC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Failed to fetch formulations', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/rnd/formulations
 */
router.post('/formulations', verifyTokenMiddleware, async (req, res) => {
    try {
        const { productName, dosageForm, version, stage, start_date, ingredients, targetCost } = req.body;
        const result = await db.query(
            `INSERT INTO rnd_formulations (product_name, dosage_form, version, stage, start_date, ingredients, target_cost, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [productName, dosageForm, version || '1.0', stage || 'Ideation', start_date || new Date(), JSON.stringify(ingredients || []), targetCost || 0, req.user?.userId]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Failed to create formulation', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/rnd/experiments
 */
router.get('/experiments', verifyTokenMiddleware, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.*, f.product_name as formulation_name 
            FROM rnd_experiments e
            LEFT JOIN rnd_formulations f ON e.formulation_id = f.id
            ORDER BY e.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Failed to fetch experiments', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/rnd/experiments
 */
router.post('/experiments', verifyTokenMiddleware, async (req, res) => {
    try {
        const { formulation_id, test_name, start_date, end_date, assigned_to, status, result_data } = req.body;
        const result = await db.query(
            `INSERT INTO rnd_experiments (formulation_id, test_name, start_date, end_date, assigned_to, status, result_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [formulation_id, test_name, start_date || new Date(), end_date, assigned_to, status || 'Scheduled', result_data]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Failed to create experiment', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
