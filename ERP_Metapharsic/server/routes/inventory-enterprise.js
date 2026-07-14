const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

/**
 * GET /api/inventory-enterprise/branches
 * Fetch all branches
 */
router.get('/branches', verifyTokenMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM branches ORDER BY is_hq DESC, name ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Failed to fetch branches', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/inventory-enterprise/global-summary
 * Consolidated stats across all branches
 */
router.get('/global-summary', verifyTokenMiddleware, async (req, res) => {
    try {
        const [branchCount, skuCount, totalStock, criticalLow] = await Promise.all([
            db.query('SELECT COUNT(*) FROM branches'),
            db.query('SELECT COUNT(*) FROM products WHERE deleted_at IS NULL'),
            db.query('SELECT COALESCE(SUM(stock), 0) as total FROM batches'),
            db.query(`SELECT COUNT(*) FROM products p
                      WHERE p.deleted_at IS NULL
                      AND (SELECT COALESCE(SUM(b.stock), 0) FROM batches b WHERE b.product_id = p.id)
                          <= COALESCE(p.reorder_level, 0)`)
        ]);

        res.json({
            success: true,
            data: {
                totalBranches: parseInt(branchCount.rows[0].count),
                totalSKUs: parseInt(skuCount.rows[0].count),
                totalUnits: parseInt(totalStock.rows[0].total || 0),
                criticallyLow: parseInt(criticalLow.rows[0].count)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
