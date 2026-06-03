const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

/**
 * GET /api/qc
 * Fetch all QC records
 */
router.get('/', verifyTokenMiddleware, async (req, res) => {
    try {
        const { search = '', status = 'ALL' } = req.query;
        
        let query = `
            SELECT 
                id,
                batch_number as "batchNumber",
                product_name as "productName",
                test_date as "testDate",
                final_status as "finalStatus",
                coa_generated as "coaGenerated",
                remarks
            FROM qc_records
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (batch_number ILIKE $${params.length} OR product_name ILIKE $${params.length})`;
        }

        if (status !== 'ALL') {
            params.push(status);
            query += ` AND final_status = $${params.length}`;
        }

        query += ` ORDER BY test_date DESC`;

        const result = await db.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Failed to fetch QC records', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/qc/dropdown
 */
router.get('/dropdown', verifyTokenMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                statuses: [
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'Approved', label: 'Approved' },
                    { value: 'Rejected', label: 'Rejected' },
                    { value: 'Pending', label: 'Pending' }
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/qc/:id
 */
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const recordResult = await db.query(`
            SELECT * FROM qc_records WHERE id = $1
        `, [id]);

        if (recordResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'QC Record not found' });
        }

        const paramsResult = await db.query(`
            SELECT 
                parameter,
                standard,
                result,
                status
            FROM qc_parameters 
            WHERE record_id = $1
        `, [id]);

        res.json({
            success: true,
            data: {
                ...recordResult.rows[0],
                parameters: paramsResult.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
