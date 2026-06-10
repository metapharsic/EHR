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
/**
 * POST /api/assets
 * Register a new asset
 */
router.post('/', verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), async (req, res) => {
    try {
        let { 
            name, asset_name, asset_code, category, category_id, purchase_date, 
            purchase_value, location, model_no, serial_no, 
            depreciation_method, depreciation_rate_percent,
            salvage_value, useful_life_years
        } = req.body;

        const final_asset_name = asset_name || name;

        if (!final_asset_name) {
            return res.status(400).json({ success: false, error: 'Asset name is required' });
        }

        // Map category (name) to category_id
        let final_category_id = category_id;
        if (!final_category_id && category) {
            try {
                const catResult = await db.query(
                    "SELECT id FROM asset_categories WHERE name ILIKE $1 OR name = $2 LIMIT 1",
                    [category, category]
                );
                if (catResult.rows.length > 0) {
                    final_category_id = catResult.rows[0].id;
                }
            } catch (catErr) {
                console.error('Error finding asset category:', catErr);
            }
        }

        // Find Fixed Assets account
        let accountId = '17a3f9a1-6927-4186-8642-46b7aae8b1f9'; // fallback default
        try {
            const accResult = await db.query(
                "SELECT id FROM chart_of_accounts WHERE account_name = 'Fixed Assets' OR account_code = 'AST-003' LIMIT 1"
            );
            if (accResult.rows.length > 0) {
                accountId = accResult.rows[0].id;
            }
        } catch (accErr) {
            console.error('Error finding chart_of_accounts entry for assets:', accErr);
        }

        const specs = {
            salvage_value: salvage_value || null,
            useful_life_years: useful_life_years || null
        };

        const { rows } = await db.query(
            `INSERT INTO fixed_assets 
             (asset_name, asset_code, category_id, purchase_date, purchase_value, 
              current_value, location, model_no, serial_no, depreciation_method, 
              depreciation_rate_percent, company_id, status, account_id, specs)
             VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, 'Active', $12, $13)
             RETURNING *`,
            [final_asset_name, asset_code, final_category_id, purchase_date, purchase_value, 
             location, model_no, serial_no, depreciation_method || 'Straight Line', 
             depreciation_rate_percent || 10, req.user.companyId || 1, accountId, JSON.stringify(specs)]
        );

        res.status(201).json({ success: true, data: rows[0], id: rows[0].id });
    } catch (error) {
        logger.error('Failed to create asset', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to create asset' });
    }
});

/**
 * GET /api/assets/register
 * Returns complete asset register list (same as GET /api/assets)
 */
router.get('/register', async (req, res) => {
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
        logger.error('Failed to fetch asset register', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch asset register' });
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
 * GET /api/assets/history
 * Fetch global maintenance history
 */
router.get('/history', async (req, res) => {
    try {
        const maintenance = await db.query(`
            SELECT m.*, a.asset_name, a.asset_code
            FROM asset_maintenance_logs m
            LEFT JOIN fixed_assets a ON a.id = m.asset_id
            ORDER BY m.maintenance_date DESC LIMIT 100
        `);
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
 * POST /api/assets/maintenance
 * Log maintenance activity
 */
router.post('/maintenance', verifyRoleMiddleware(['ADMIN', 'MAINTENANCE_SUPERVISOR', 'ACCOUNTANT']), async (req, res) => {
    const client = await db.getClient();
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
 * GET /api/assets/:id
 * Retrieve a single asset details
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(
            `SELECT a.*, c.name as category_name, c.icon as category_icon
             FROM fixed_assets a
             LEFT JOIN asset_categories c ON a.category_id = c.id
             WHERE a.id = $1 AND a.company_id = $2`,
            [id, req.user.companyId || 1]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }
        res.json({ success: true, data: rows[0], ...rows[0] });
    } catch (error) {
        logger.error('Failed to fetch asset', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch asset' });
    }
});

/**
 * PUT /api/assets/:id
 * Update an asset
 */
router.put('/:id', verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), async (req, res) => {
    try {
        const { id } = req.params;
        const { location, status, name, asset_name, category_id, model_no, serial_no } = req.body;
        
        const final_asset_name = asset_name || name;

        const { rows } = await db.query(
            `UPDATE fixed_assets 
             SET location = COALESCE($1, location),
                 status = COALESCE($2, status),
                 asset_name = COALESCE($3, asset_name),
                 category_id = COALESCE($4, category_id),
                 model_no = COALESCE($5, model_no),
                 serial_no = COALESCE($6, serial_no)
             WHERE id = $7 AND company_id = $8
             RETURNING *`,
            [location, status, final_asset_name, category_id, model_no, serial_no, id, req.user.companyId || 1]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Failed to update asset', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to update asset' });
    }
});

/**
 * DELETE /api/assets/:id
 * Delete an asset
 */
router.delete('/:id', verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `DELETE FROM fixed_assets WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, req.user.companyId || 1]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }
        res.json({ success: true, message: 'Asset deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete asset', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to delete asset' });
    }
});

/**
 * POST /api/assets/:id/allocate
 * Allocate asset to employee
 */
router.post('/:id/allocate', verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { employee_id, allocation_date, notes } = req.body;
        const companyId = req.user.companyId || 1;

        const assetRes = await client.query(
            `SELECT a.*, c.name as category_name 
             FROM fixed_assets a 
             LEFT JOIN asset_categories c ON a.category_id = c.id
             WHERE a.id = $1 AND a.company_id = $2`,
            [id, companyId]
        );
        if (assetRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }
        const asset = assetRes.rows[0];

        let productId = null;
        let batchId = null;
        const prodRes = await client.query(`SELECT id FROM products LIMIT 1`);
        if (prodRes.rows.length > 0) {
            productId = prodRes.rows[0].id;
            const batchRes = await client.query(`SELECT id FROM batches WHERE product_id = $1 LIMIT 1`, [productId]);
            if (batchRes.rows.length > 0) {
                batchId = batchRes.rows[0].id;
            }
        }

        let godownId = null;
        const godownRes = await client.query(`SELECT id FROM godowns LIMIT 1`);
        if (godownRes.rows.length > 0) {
            godownId = godownRes.rows[0].id;
        }

        const allocResult = await client.query(
            `INSERT INTO hr_asset_allocations 
             (company_id, employee_id, product_id, asset_type, asset_name, serial_number, allocated_on, notes, inventory_decremented)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
            [companyId, employee_id, productId, asset.category_name || 'Fixed Asset', asset.asset_name, asset.serial_no, allocation_date || new Date(), notes || 'Asset allocation']
        );

        if (productId && godownId) {
            const prevEntry = await client.query(
                `SELECT running_balance FROM stock_ledger_entries 
                 WHERE product_id = $1::uuid AND (batch_id = $2::uuid OR ($2::text IS NULL AND batch_id IS NULL))
                 ORDER BY movement_date DESC, created_at DESC LIMIT 1`,
                [productId, batchId]
            );
            const prevBalance = prevEntry.rows[0]?.running_balance || 0;
            const running_balance = prevBalance - 1;

            await client.query(
                `INSERT INTO stock_ledger_entries 
                 (company_id, godown_id, product_id, batch_id, movement_type, 
                  reference_type, reference_id, reference_number, in_qty, out_qty,
                  running_balance, cost_per_unit, total_cost, movement_date, narration)
                 VALUES ($1, $2::uuid, $3::uuid, $4::uuid, 'Out', 'Asset Allocation', $5::uuid, $6, 0, 1, $7, 0, 0, $8, $9)`,
                [companyId, godownId, productId, batchId, allocResult.rows[0].id, asset.asset_code, running_balance, allocation_date || new Date(), notes || 'Asset allocation']
            );
        }

        await client.query(
            `UPDATE fixed_assets SET location = $1, status = 'Active' WHERE id = $2`,
            [`Allocated (Emp: ${employee_id})`, id]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: allocResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to allocate asset', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to allocate asset', details: error.message, stack: error.stack });
    } finally {
        client.release();
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
