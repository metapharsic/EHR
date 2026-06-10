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
                final_status as "overall_result",
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
 * POST /api/qc
 * Create a new QC test record
 */
router.post('/', verifyTokenMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const {
            product_id,
            product_name,
            batch_number,
            test_date,
            test_type,
            parameters,
            overall_result,
            final_status,
            analyst,
            remarks
        } = req.body;

        if (!batch_number) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'batch_number is required' });
        }

        // Resolve product_name from product_id if needed
        let finalProductName = product_name;
        if (!finalProductName && product_id) {
            try {
                const prodRes = await client.query('SELECT name FROM products WHERE id = $1 LIMIT 1', [product_id]);
                if (prodRes.rows.length > 0) finalProductName = prodRes.rows[0].name;
            } catch (e) {
                // ignore lookup failure
            }
        }
        finalProductName = finalProductName || 'Unknown Product';

        const status = final_status || overall_result || 'Pending';

        const { rows } = await client.query(
            `INSERT INTO qc_records 
             (batch_number, product_name, test_date, tested_by, final_status, remarks)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [batch_number, finalProductName, test_date || new Date(), analyst || 'E2E', status, remarks || test_type || null]
        );
        const record = rows[0];

        // Insert parameters if provided
        if (parameters && Array.isArray(parameters)) {
            for (const param of parameters) {
                await client.query(
                    `INSERT INTO qc_parameters (record_id, parameter, standard, result, status)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [record.id, param.name || param.parameter, param.unit || null, String(param.value ?? param.result ?? ''), param.result || 'PASS']
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({
            success: true,
            data: { ...record, overall_result: record.final_status },
            id: record.id
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to create QC record', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

/**
 * GET /api/qc/parameters
 * Return QC parameter definitions / dropdown
 */
router.get('/parameters', verifyTokenMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT DISTINCT parameter as name FROM qc_parameters ORDER BY parameter LIMIT 100`
        );
        const paramNames = result.rows.map(r => r.name);

        res.json({
            success: true,
            data: {
                parameters: paramNames.length > 0 ? paramNames : [
                    'Assay', 'pH', 'Moisture Content', 'Dissolution', 'Hardness', 'Friability', 'Disintegration'
                ],
                statuses: ['Pending', 'PASS', 'FAIL', 'Approved', 'Rejected'],
                testTypes: ['Raw Material', 'In-Process', 'Finished Goods', 'Stability']
            }
        });
    } catch (error) {
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
                    { value: 'PASS', label: 'PASS' },
                    { value: 'FAIL', label: 'FAIL' },
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
            SELECT *, final_status as overall_result FROM qc_records WHERE id = $1
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
