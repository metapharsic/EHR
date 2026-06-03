const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');

// Middleware
router.use(verifyTokenMiddleware);

/**
 * GET /api/assets
 * Fetch all assets with category and maintenance info
 */
router.get('/', async (req, res) => {
    try {
        const { category, status, search } = req.query;
        let query = `
            SELECT a.*, c.name as category_name, c.icon as category_icon,
                   (SELECT COUNT(*) FROM asset_maintenance_logs WHERE asset_id = a.id) as maintenance_count,
                   (SELECT SUM(cost) FROM asset_maintenance_logs WHERE asset_id = a.id) as total_maintenance_cost
            FROM fixed_assets a
            LEFT JOIN asset_categories c ON a.category_id = c.id
            WHERE a.company_id = $1
        `;
        const params = [req.user.companyId || 1];

        if (category && category !== 'All') {
            query += ` AND c.name = $${params.length + 1}`;
            params.push(category);
        }

        if (status && status !== 'All') {
            query += ` AND a.status = $${params.length + 1}`;
            params.push(status);
        }

        if (search) {
            query += ` AND (a.asset_name ILIKE $${params.length + 1} OR a.asset_code ILIKE $${params.length + 1} OR a.serial_no ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY a.created_at DESC`;

        const { rows } = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Failed to fetch assets', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch assets' });
    }
});

/**
 * POST /api/assets
 * Register a new asset
 */
router.post('/', verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), async (req, res) => {
    try {
        const { 
            asset_name, asset_code, category_id, purchase_date, 
            purchase_value, location, model_no, serial_no, 
            depreciation_method, depreciation_rate_percent 
        } = req.body;

        const { rows } = await db.query(
            `INSERT INTO fixed_assets 
             (asset_name, asset_code, category_id, purchase_date, purchase_value, 
              current_value, location, model_no, serial_no, depreciation_method, 
              depreciation_rate_percent, company_id, status)
             VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, 'Active')
             RETURNING *`,
            [asset_name, asset_code, category_id, purchase_date, purchase_value, 
             location, model_no, serial_no, depreciation_method || 'Straight Line', 
             depreciation_rate_percent || 10, req.user.companyId || 1]
        );

        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Failed to create asset', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to create asset' });
    }
});

/**
 * GET /api/assets/categories
 * Fetch all categories
 */
router.get('/categories', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM asset_categories ORDER BY name');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
});

/**
 * POST /api/assets/maintenance
 * Log maintenance activity
 */
router.post('/maintenance', verifyRoleMiddleware(['ADMIN', 'MAINTENANCE_SUPERVISOR', 'ACCOUNTANT']), async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { asset_id, maintenance_date, type, description, cost, performed_by } = req.body;

        const { rows } = await client.query(
            `INSERT INTO asset_maintenance_logs (asset_id, maintenance_date, type, description, cost, performed_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [asset_id, maintenance_date, type, description, cost, performed_by]
        );

        // Update asset's last maintenance date
        await client.query(
            `UPDATE fixed_assets SET last_maintenance_date = $1 WHERE id = $2`,
            [maintenance_date, asset_id]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to log maintenance', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to log maintenance' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/assets/history
 * Fetch global maintenance history
 */
router.get('/history', async (req, res) => {
    try {
        const maintenance = await db.query('SELECT * FROM asset_maintenance_logs ORDER BY maintenance_date DESC LIMIT 100');
        res.json({
            success: true,
            data: {
                maintenance: maintenance.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch global history' });
    }
});

/**
 * GET /api/assets/:id/history
 * Fetch full history of an asset (maintenance, transfers, insurance)
 */
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        
        const maintenance = await db.query('SELECT * FROM asset_maintenance_logs WHERE asset_id = $1 ORDER BY maintenance_date DESC', [id]);
        const transfers = await db.query('SELECT * FROM asset_transfers WHERE asset_id = $1 ORDER BY transfer_date DESC', [id]);
        const insurance = await db.query('SELECT * FROM asset_insurance_policies WHERE asset_id = $1 ORDER BY expiry_date DESC', [id]);

        res.json({
            success: true,
            data: {
                maintenance: maintenance.rows,
                transfers: transfers.rows,
                insurance: insurance.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch asset history' });
    }
});

module.exports = router;
