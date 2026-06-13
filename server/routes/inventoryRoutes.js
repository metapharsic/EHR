// ============================================
// INVENTORY API ENDPOINTS - Phase 1
// Path: server/routes/inventoryRoutes.js
// Purpose: Godowns, Stock Ledger, Reconciliation, Returns
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Middleware imports
const { verifyTokenMiddleware, verify2FAMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const db = require('../db');

// GET: Single batch details
router.get('/batches/:id', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT * FROM batches WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ Error fetching batch:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch batch' });
    }
});

// ============================================
// 1. GODOWN MANAGEMENT ENDPOINTS
// ============================================

// GET: List all godowns
router.get('/godowns', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const result = await db.query(
            `SELECT id, company_id, name, address, manager_id, is_default, status, 
                    created_at, updated_at
             FROM godowns 
             WHERE company_id = $1 AND status != 'Deleted'
             ORDER BY is_default DESC, name ASC`,
            [companyId]
        );
        
        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error fetching godowns:', error);
        res.status(500).json({ error: 'Failed to fetch godowns' });
    }
});

// GET: Single godown details
router.get('/godowns/:id', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId || 1;
        
        const result = await db.query(
            `SELECT * FROM godowns WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Godown not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ Error fetching godown:', error);
        res.status(500).json({ error: 'Failed to fetch godown' });
    }
});

// POST: Create new godown
router.post('/godowns', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id, name, address, manager_id, is_default } = req.body;
        const companyId = req.user.companyId || 1;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Godown name is required' });
        }
        
        const godownId = id || uuidv4();
        const result = await db.query(
            `INSERT INTO godowns (id, company_id, name, address, manager_id, is_default, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'Active')
             RETURNING id, company_id, name, address, manager_id, is_default, status, created_at, updated_at`,
            [godownId, companyId, name, address || null, manager_id || null, is_default || false]
        );
        
        console.log('✅ Godown created:', result.rows[0]);
        res.status(201).json({ 
            success: true, 
            message: 'Godown created successfully',
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error creating godown:', error);
        res.status(500).json({ error: 'Failed to create godown' });
    }
});

// PUT: Update godown
router.put('/godowns/:id', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, manager_id, status } = req.body;
        const companyId = req.user.companyId || 1;
        
        const result = await db.query(
            `UPDATE godowns 
             SET name = COALESCE($1, name),
                 address = COALESCE($2, address),
                 manager_id = COALESCE($3, manager_id),
                 status = COALESCE($4, status),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 AND company_id = $6
             RETURNING id, company_id, name, address, manager_id, is_default, status, created_at, updated_at`,
            [name, address, manager_id, status, id, companyId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Godown not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Godown updated successfully',
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error updating godown:', error);
        res.status(500).json({ error: 'Failed to update godown' });
    }
});

// DELETE: Delete godown
router.delete('/godowns/:id', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId || 1;
        
        const result = await db.query(
            `UPDATE godowns 
             SET status = 'Deleted', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2
             RETURNING id`,
            [id, companyId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Godown not found' });
        }
        
        res.json({ success: true, message: 'Godown deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting godown:', error);
        res.status(500).json({ error: 'Failed to delete godown' });
    }
});

// ============================================
// 2. STOCK LEDGER ENDPOINTS
// ============================================

// GET: Stock ledger entries with filters
router.get('/stock-ledger', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { product_id, batch_id, godown_id, from_date, to_date, movement_type, page = 1, limit = 100 } = req.query;
        const companyId = req.user.companyId || 1;
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE sle.company_id = $1';
        let params = [companyId];
        let paramIndex = 2;
        
        if (product_id) {
            whereClause += ` AND sle.product_id = $${paramIndex}`;
            params.push(product_id);
            paramIndex++;
        }
        if (batch_id) {
            whereClause += ` AND sle.batch_id = $${paramIndex}`;
            params.push(batch_id);
            paramIndex++;
        }
        if (godown_id) {
            whereClause += ` AND sle.godown_id = $${paramIndex}`;
            params.push(godown_id);
            paramIndex++;
        }
        if (from_date) {
            whereClause += ` AND sle.movement_date >= $${paramIndex}`;
            params.push(from_date);
            paramIndex++;
        }
        if (to_date) {
            whereClause += ` AND sle.movement_date <= $${paramIndex}`;
            params.push(to_date);
            paramIndex++;
        }
        if (movement_type) {
            whereClause += ` AND sle.movement_type = $${paramIndex}`;
            params.push(movement_type);
            paramIndex++;
        }
        
        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM stock_ledger_entries sle ${whereClause}`,
            params
        );
        
        // Get paginated results
        const result = await db.query(
            `SELECT sle.id, sle.godown_id, sle.product_id, sle.batch_id,
                    sle.movement_type, sle.reference_type, sle.reference_number,
                    sle.in_qty, sle.out_qty, sle.running_balance,
                    sle.cost_per_unit, sle.total_cost, sle.movement_date,
                    sle.narration, sle.created_at,
                    p.name as product_name, b.batch_number,
                    g.name as godown_name
             FROM stock_ledger_entries sle
             LEFT JOIN products p ON sle.product_id = p.id
             LEFT JOIN batches b ON sle.batch_id = b.id
             LEFT JOIN godowns g ON sle.godown_id = g.id
             ${whereClause}
             ORDER BY sle.movement_date DESC, sle.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );
        
        res.json({
            success: true,
            total: parseInt(countResult.rows[0].total),
            count: result.rows.length,
            page: parseInt(page),
            limit: parseInt(limit),
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error fetching stock ledger:', error);
        res.status(500).json({ error: 'Failed to fetch stock ledger' });
    }
});

// POST: Create stock ledger entry (Internal - used by system)
const createStockLedgerEntry = async (entry) => {
    try {
        const {
            company_id = 1,
            godown_id,
            product_id,
            batch_id,
            movement_type,
            reference_type,
            reference_id,
            reference_number,
            in_qty = 0,
            out_qty = 0,
            cost_per_unit = 0,
            narration,
            created_by
        } = entry;
        
        const id = uuidv4();
        const total_cost = (in_qty + out_qty) * cost_per_unit;
        
        // Get current running balance
        const prevEntry = await db.query(
            `SELECT running_balance FROM stock_ledger_entries 
             WHERE product_id = $1 AND batch_id = $2 
             ORDER BY movement_date DESC, created_at DESC LIMIT 1`,
            [product_id, batch_id]
        );
        
        const prevBalance = prevEntry.rows[0]?.running_balance || 0;
        const running_balance = prevBalance + in_qty - out_qty;
        
        const result = await db.query(
            `INSERT INTO stock_ledger_entries 
             (id, company_id, godown_id, product_id, batch_id, movement_type, 
              reference_type, reference_id, reference_number, in_qty, out_qty,
              running_balance, cost_per_unit, total_cost, movement_date, narration, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_DATE, $15, $16)
             RETURNING *`,
            [id, company_id, godown_id, product_id, batch_id, movement_type,
             reference_type, reference_id, reference_number, in_qty, out_qty,
             running_balance, cost_per_unit, total_cost, narration, created_by]
        );
        
        console.log('✅ Stock ledger entry created:', result.rows[0]);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Error creating stock ledger entry:', error);
        throw error;
    }
};

// Export for internal use
router.post('/stock-ledger/internal', async (req, res) => {
    // This endpoint is for internal system use only, not exposed to UI
    try {
        const entry = await createStockLedgerEntry(req.body);
        res.status(201).json({ success: true, data: entry });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create stock ledger entry' });
    }
});

// ============================================
// 3. STOCK RECONCILIATION ENDPOINTS
// ============================================

// POST: Start stock reconciliation
router.post('/reconciliation/start', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { godown_id, reconciliation_period_from, reconciliation_period_to } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        if (!godown_id) {
            return res.status(400).json({ error: 'Godown is required' });
        }
        
        const id = uuidv4();
        const result = await db.query(
            `INSERT INTO stock_reconciliation 
             (id, company_id, godown_id, reconciliation_number, reconciliation_date,
              reconciliation_period_from, reconciliation_period_to, status, created_by)
             VALUES ($1, $2, $3, 'SR-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMM') || '-' || LPAD(CAST(nextval('reconciliation_seq') AS TEXT), 5, '0'),
                     CURRENT_DATE, $4, $5, 'Draft', $6)
             RETURNING id, reconciliation_number, status, created_at`,
            [id, companyId, godown_id, reconciliation_period_from || null, reconciliation_period_to || null, userId]
        );
        
        console.log('✅ Reconciliation started:', result.rows[0]);
        res.status(201).json({ 
            success: true, 
            message: 'Reconciliation created successfully',
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error starting reconciliation:', error);
        res.status(500).json({ error: 'Failed to start reconciliation' });
    }
});

// POST: Add reconciliation item (physical count entry)
router.post('/reconciliation/:id/entry', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { product_id, batch_id, physical_qty, variance_reason, notes } = req.body;
        const companyId = req.user.companyId || 1;
        
        if (!product_id || physical_qty === undefined) {
            return res.status(400).json({ error: 'Product and physical quantity are required' });
        }
        
        // Get system quantity from stock ledger
        const systemQtyResult = await db.query(
            `SELECT COALESCE(running_balance, 0) as system_qty 
             FROM stock_ledger_entries 
             WHERE product_id = $1 AND batch_id = $2
             ORDER BY movement_date DESC, created_at DESC LIMIT 1`,
            [product_id, batch_id]
        );
        
        const system_qty = systemQtyResult.rows[0]?.system_qty || 0;
        const variance_qty = physical_qty - system_qty;
        
        // Get batch cost for variance value
        const batchResult = await db.query(
            `SELECT purchase_rate FROM batches WHERE id = $1`,
            [batch_id]
        );
        
        const cost_per_unit = batchResult.rows[0]?.purchase_rate || 0;
        const variance_value = variance_qty * cost_per_unit;
        
        const itemId = uuidv4();
        const result = await db.query(
            `INSERT INTO stock_reconciliation_items 
             (id, reconciliation_id, product_id, batch_id, system_qty, physical_qty,
              variance_qty, variance_reason, variance_value, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, product_id, batch_id, system_qty, physical_qty, variance_qty, variance_reason, notes`,
            [itemId, id, product_id, batch_id, system_qty, physical_qty, variance_qty, variance_reason || null, variance_value, notes || null]
        );
        
        console.log('✅ Reconciliation item added:', result.rows[0]);
        res.status(201).json({ 
            success: true, 
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error adding reconciliation item:', error);
        res.status(500).json({ error: 'Failed to add reconciliation item' });
    }
});

// GET: Reconciliation details with all items
router.get('/reconciliation/:id', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId || 1;
        
        // Get header
        const headerResult = await db.query(
            `SELECT sr.id, sr.reconciliation_number, sr.reconciliation_date, sr.status,
                    sr.total_system_qty, sr.total_physical_qty, sr.total_variance_qty,
                    sr.total_variance_value, sr.rejection_reason, sr.created_at,
                    sr.verified_at, sr.approved_at,
                    g.name as godown_name,
                    cu.name as created_by_name, vu.name as verified_by_name, au.name as approved_by_name
             FROM stock_reconciliation sr
             LEFT JOIN godowns g ON sr.godown_id = g.id
             LEFT JOIN users cu ON sr.created_by = cu.id
             LEFT JOIN users vu ON sr.verified_by = vu.id
             LEFT JOIN users au ON sr.approved_by = au.id
             WHERE sr.id = $1 AND sr.company_id = $2`,
            [id, companyId]
        );
        
        if (headerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reconciliation not found' });
        }
        
        // Get items
        const itemsResult = await db.query(
            `SELECT sri.id, sri.product_id, sri.batch_id, sri.system_qty, sri.physical_qty,
                    sri.variance_qty, sri.variance_reason, sri.variance_value, sri.notes,
                    p.name as product_name, b.batch_number
             FROM stock_reconciliation_items sri
             LEFT JOIN products p ON sri.product_id = p.id
             LEFT JOIN batches b ON sri.batch_id = b.id
             WHERE sri.reconciliation_id = $1`,
            [id]
        );
        
        res.json({
            success: true,
            header: headerResult.rows[0],
            items: itemsResult.rows,
            itemCount: itemsResult.rows.length
        });
    } catch (error) {
        console.error('❌ Error fetching reconciliation:', error);
        res.status(500).json({ error: 'Failed to fetch reconciliation' });
    }
});

// PUT: Update reconciliation status (Mark as verified/approved)
router.put('/reconciliation/:id/status', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        if (!['InProgress', 'Completed', 'Approved', 'Rejected', 'Cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        // Calculate totals
        const totalsResult = await db.query(
            `SELECT 
                COALESCE(SUM(system_qty), 0) as total_system_qty,
                COALESCE(SUM(physical_qty), 0) as total_physical_qty,
                COALESCE(SUM(variance_qty), 0) as total_variance_qty,
                COALESCE(SUM(variance_value), 0) as total_variance_value
             FROM stock_reconciliation_items
             WHERE reconciliation_id = $1`,
            [id]
        );
        
        const totals = totalsResult.rows[0];
        
        let updateQuery = `UPDATE stock_reconciliation SET status = $1`;
        let params = [status, companyId, id];
        let paramIndex = 4;
        
        if (status === 'Completed') {
            updateQuery += `, verified_by = $3, verified_at = CURRENT_TIMESTAMP`;
            params.push(userId);
            paramIndex++;
        } else if (status === 'Approved') {
            updateQuery += `, approved_by = $${paramIndex}, approved_at = CURRENT_TIMESTAMP`;
            params.push(userId);
            paramIndex++;
        }
        
        updateQuery += `, total_system_qty = $${paramIndex}, total_physical_qty = $${paramIndex + 1},
                       total_variance_qty = $${paramIndex + 2}, total_variance_value = $${paramIndex + 3}`;
        params.push(totals.total_system_qty, totals.total_physical_qty, totals.total_variance_qty, totals.total_variance_value);
        
        updateQuery += ` WHERE id = $${paramIndex + 4} AND company_id = $${paramIndex + 5}
                        RETURNING id, status, total_variance_qty, total_variance_value`;
        params.push(id, companyId);
        
        const result = await db.query(updateQuery, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reconciliation not found' });
        }
        
        console.log('✅ Reconciliation status updated:', result.rows[0]);
        res.json({ 
            success: true, 
            message: `Reconciliation marked as ${status}`,
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error updating reconciliation status:', error);
        res.status(500).json({ error: 'Failed to update reconciliation' });
    }
});

// ============================================
// 4. RETURN NOTES ENDPOINTS
// ============================================

// POST: Create return note
router.post('/returns', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { note_type, party_id, reference_invoice, return_date, reason } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        if (!note_type || !party_id) {
            return res.status(400).json({ error: 'Return type and party are required' });
        }
        
        const id = uuidv4();
        const return_number = `RN-${Date.now()}`;
        
        const result = await db.query(
            `INSERT INTO return_notes 
             (id, company_id, return_number, note_type, party_id, reference_invoice,
              return_date, reason, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft', $9)
             RETURNING id, return_number, note_type, party_id, return_date, status, created_at`,
            [id, companyId, return_number, note_type, party_id, reference_invoice || null,
             return_date || new Date().toISOString().split('T')[0], reason || null, userId]
        );
        
        console.log('✅ Return note created:', result.rows[0]);
        res.status(201).json({ 
            success: true, 
            message: 'Return note created successfully',
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error creating return note:', error);
        res.status(500).json({ error: 'Failed to create return note' });
    }
});

// POST: Add item to return note
router.post('/returns/:id/items', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { product_id, batch_id, qty_returned, mrp, purchase_rate, return_reason, return_value } = req.body;
        
        if (!product_id || !qty_returned) {
            return res.status(400).json({ error: 'Product and quantity are required' });
        }
        
        const itemId = uuidv4();
        const result = await db.query(
            `INSERT INTO return_note_items 
             (id, return_id, product_id, batch_id, qty_returned, mrp, purchase_rate, 
              return_reason, return_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, product_id, batch_id, qty_returned, return_value, created_at`,
            [itemId, id, product_id, batch_id || null, qty_returned, mrp || null, 
             purchase_rate || null, return_reason || null, return_value || 0]
        );
        
        // Update return note total_qty
        await db.query(
            `UPDATE return_notes 
             SET total_qty = (SELECT COALESCE(SUM(qty_returned), 0) FROM return_note_items WHERE return_id = $1)
             WHERE id = $1`,
            [id]
        );
        
        console.log('✅ Return item added:', result.rows[0]);
        res.status(201).json({ 
            success: true, 
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error adding return item:', error);
        res.status(500).json({ error: 'Failed to add return item' });
    }
});

// GET: List return notes
router.get('/returns', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { note_type, status, page = 1, limit = 50 } = req.query;
        const companyId = req.user.companyId || 1;
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE rn.company_id = $1';
        let params = [companyId];
        let paramIndex = 2;
        
        if (note_type) {
            whereClause += ` AND rn.note_type = $${paramIndex}`;
            params.push(note_type);
            paramIndex++;
        }
        if (status) {
            whereClause += ` AND rn.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        const result = await db.query(
            `SELECT rn.id, rn.return_number, rn.note_type, rn.status, rn.return_date,
                    rn.total_qty, rn.total_value, rn.created_at,
                    p.name as party_name
             FROM return_notes rn
             LEFT JOIN parties p ON rn.party_id = p.id
             ${whereClause}
             ORDER BY rn.return_date DESC, rn.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );
        
        res.json({
            success: true,
            count: result.rows.length,
            page: parseInt(page),
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error fetching return notes:', error);
        res.status(500).json({ error: 'Failed to fetch return notes' });
    }
});

// PUT: Update return note status
router.put('/returns/:id/status', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        if (!['Draft', 'Submitted', 'Approved', 'Rejected', 'Received', 'Closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        let updateQuery = `UPDATE return_notes SET status = $1`;
        let params = [status, id, companyId];
        let paramIndex = 4;
        
        if (status === 'Approved') {
            updateQuery += `, approved_by = $${paramIndex}, approved_at = CURRENT_TIMESTAMP`;
            params.push(userId);
            paramIndex++;
        } else if (status === 'Received') {
            updateQuery += `, received_by = $${paramIndex}, received_at = CURRENT_TIMESTAMP`;
            params.push(userId);
            paramIndex++;
        }
        
        updateQuery += ` WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
                        RETURNING id, return_number, status, updated_at`;
        params.push(id, companyId);
        
        const result = await db.query(updateQuery, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Return note not found' });
        }
        
        console.log('✅ Return note status updated:', result.rows[0]);
        res.json({ 
            success: true, 
            message: `Return note marked as ${status}`,
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('❌ Error updating return status:', error);
        res.status(500).json({ error: 'Failed to update return status' });
    }
});

// ============================================
// STOCK SUMMARY REPORT
// ============================================
router.post('/stock-summary', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const { startDate, endDate, godownId } = req.body;
        const sDate = startDate || '2000-01-01';
        const eDate = endDate || new Date().toISOString().split('T')[0];
        const companyId = req.user.companyId || 1;

        let sql = `
            WITH OpeningStock AS (
                SELECT product_id, SUM(in_qty - out_qty) as opening_qty
                FROM stock_ledger_entries
                WHERE movement_date < $1 AND company_id = $2
                ${godownId ? 'AND godown_id = $3' : ''}
                GROUP BY product_id
            ),
            PeriodMovement AS (
                SELECT product_id, SUM(in_qty) as inward_qty, SUM(out_qty) as outward_qty
                FROM stock_ledger_entries
                WHERE movement_date BETWEEN $1 AND ${godownId ? '$4' : '$3'} AND company_id = $2
                ${godownId ? 'AND godown_id = $3' : ''}
                GROUP BY product_id
            )
            SELECT p.id, p.name, p.code as sku, p.category, p.uom as unit, p.purchase_rate as unit_price,
                   COALESCE(os.opening_qty, 0) as opening_qty,
                   COALESCE(pm.inward_qty, 0) as inward_qty,
                   COALESCE(pm.outward_qty, 0) as outward_qty,
                   (COALESCE(os.opening_qty, 0) + COALESCE(pm.inward_qty, 0) - COALESCE(pm.outward_qty, 0)) as closing_qty
            FROM products p
            LEFT JOIN OpeningStock os ON p.id = os.product_id
            LEFT JOIN PeriodMovement pm ON p.id = pm.product_id
            WHERE p.is_active = true
            ORDER BY p.name ASC`;
        
        const finalParams = godownId ? [sDate, companyId, godownId, eDate] : [sDate, companyId, eDate];

        const { rows } = await db.query(sql, finalParams);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Stock Summary Error:', error);
        res.status(500).json({ error: 'Failed to generate stock summary' });
    }
});

// GET: All Stock Journals
router.get('/stock-journals', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const result = await db.query(
            `SELECT sj.id, sj.journal_number as "no", sj.date, sj.narration, sj.status, sj.created_at
             FROM stock_journals sj
             WHERE sj.company_id = $1
             ORDER BY sj.date DESC, sj.created_at DESC`,
            [companyId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ Error fetching stock journals:', error);
        res.status(500).json({ error: 'Failed to fetch stock journals' });
    }
});

// GET: All Stock Transfers
router.get('/stock-transfers', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const result = await db.query(
            `SELECT st.id, st.transfer_number as "transferNo", st.date, st.narration, st.status, st.created_at,
                    st.source_branch_id as "sourceBranchId", st.dest_branch_id as "destBranchId",
                    b1.name as "sourceBranchName", b2.name as "destBranchName"
             FROM stock_transfers st
             LEFT JOIN branches b1 ON st.source_branch_id = b1.id
             LEFT JOIN branches b2 ON st.dest_branch_id = b2.id
             WHERE st.company_id = $1
             ORDER BY st.date DESC, st.created_at DESC`,
            [companyId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ Error fetching stock transfers:', error);
        res.status(500).json({ error: 'Failed to fetch stock transfers' });
    }
});

// GET: All Stock Reconciliations / Physical Stocks
router.get('/reconciliations', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const result = await db.query(
            `SELECT sr.id, sr.reconciliation_number as "no", sr.reconciliation_date as "date", sr.status, sr.created_at,
                    sr.total_system_qty as "totalSystemQty", sr.total_physical_qty as "totalPhysicalQty",
                    sr.total_variance_qty as "totalVarianceQty", sr.total_variance_value as "totalVarianceValue",
                    g.name as "godownName"
             FROM stock_reconciliation sr
             LEFT JOIN godowns g ON sr.godown_id = g.id
             WHERE sr.company_id = $1
             ORDER BY sr.reconciliation_date DESC, sr.created_at DESC`,
            [companyId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ Error fetching reconciliations:', error);
        res.status(500).json({ error: 'Failed to fetch reconciliations' });
    }
});

// POST: Save Direct Physical Stock Reconciliation
router.post('/reconciliations', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        const { date, srcGodown, items = [], placeOfSupply } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;

        await client.query('BEGIN');
        const { postToStockLedger } = require('../utils/ledgerHelper');

        const reconciliationId = req.body.id || uuidv4();
        const reconciliationNumber = `SR-${Date.now()}`;
        const godownId = srcGodown || placeOfSupply || null;

        // 1. Create Stock Reconciliation Record
        await client.query(
            `INSERT INTO stock_reconciliation 
             (id, company_id, godown_id, reconciliation_number, reconciliation_date, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Approved', $6)`,
            [reconciliationId, companyId, godownId, reconciliationNumber, date || new Date().toISOString().split('T')[0], userId]
        );

        let totalSystemQty = 0;
        let totalPhysicalQty = 0;
        let totalVarianceQty = 0;
        let totalVarianceValue = 0;

        // 2. Iterate items & Ledger
        for (const item of items) {
            const itemId = uuidv4();
            const productId = item.productId || null;
            const batchId = item.batchId || null;
            const physicalQty = Number(item.physicalQty || 0);

            // Get system quantity from stock ledger
            const systemQtyResult = await client.query(
                `SELECT COALESCE(running_balance, 0) as system_qty 
                 FROM stock_ledger_entries 
                 WHERE product_id = $1 AND batch_id = $2
                 ORDER BY movement_date DESC, created_at DESC LIMIT 1`,
                [productId, batchId]
            );
            const systemQty = systemQtyResult.rows[0]?.system_qty || 0;
            const varianceQty = physicalQty - systemQty;

            // Get batch cost
            const batchResult = await client.query(
                `SELECT purchase_rate FROM batches WHERE id = $1`,
                [batchId]
            );
            const costPerUnit = batchResult.rows[0]?.purchase_rate || 0;
            const varianceValue = varianceQty * costPerUnit;

            totalSystemQty += systemQty;
            totalPhysicalQty += physicalQty;
            totalVarianceQty += varianceQty;
            totalVarianceValue += varianceValue;

            await client.query(
                `INSERT INTO stock_reconciliation_items 
                 (id, reconciliation_id, product_id, batch_id, system_qty, physical_qty,
                  variance_qty, variance_reason, variance_value)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [itemId, reconciliationId, productId, batchId, systemQty, physicalQty, varianceQty, item.reason || null, varianceValue]
            );

            // If there's a difference, adjust the Stock Ledger
            if (varianceQty !== 0) {
                const movementType = varianceQty > 0 ? 'IN' : 'OUT';
                await postToStockLedger(client, {
                    companyId: companyId,
                    godownId: godownId,
                    productId: productId,
                    batchId: batchId,
                    movementType: movementType,
                    referenceType: 'Reconciliation',
                    referenceId: reconciliationId,
                    referenceNumber: reconciliationNumber,
                    quantity: Math.abs(varianceQty),
                    costPerUnit: costPerUnit,
                    movementDate: date || new Date(),
                    narration: 'Stock Reconciliation Adjustment',
                    createdBy: userId
                });
            }
        }

        // Update reconciliation header with totals
        await client.query(
            `UPDATE stock_reconciliation 
             SET total_system_qty = $1, total_physical_qty = $2, total_variance_qty = $3, total_variance_value = $4
             WHERE id = $5`,
            [totalSystemQty, totalPhysicalQty, totalVarianceQty, totalVarianceValue, reconciliationId]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: { id: reconciliationId, no: reconciliationNumber } });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Error saving direct physical stock:', error);
        res.status(500).json({ error: 'Failed to save physical stock' });
    } finally {
        if (client) client.release();
    }
});

// ============================================
// 5. STOCK JOURNALS & TRANSFERS ENDPOINTS
// ============================================

router.post('/stock-journals', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        const { date, narration, items = [] } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        await client.query('BEGIN');

        const { postToGeneralLedger, postToStockLedger, findAccount } = require('../utils/ledgerHelper');
        
        const journalId = req.body.id || uuidv4();
        const journalNumber = `SJ-${Date.now()}`;
        const inventoryAccountId = await findAccount(client, companyId, 'Inventory');
        const adjAccountId = await findAccount(client, companyId, 'Cost of Goods Sold'); // Using COGS as adjustment account
        
        // 1. Create Stock Journal Record
        const result = await client.query(
            `INSERT INTO stock_journals (id, company_id, journal_number, date, narration, status, created_by) 
             VALUES ($1, $2, $3, $4, $5, 'Approved', $6)
             RETURNING id, journal_number`,
            [journalId, companyId, journalNumber, date || new Date().toISOString().split('T')[0], narration || '', userId]
        );

        // 2. Iterate items & Ledger
        for (const item of items) {
            const itemId = uuidv4();
            await client.query(
                `INSERT INTO stock_journal_items (id, journal_id, product_id, godown_id, batch_id, qty, rate, amount) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [itemId, journalId, item.productId, item.godownId || null, item.batchId || null, item.qty, item.rate || 0, item.amount || 0]
            );

            const absoluteQty = Math.abs(item.qty);
            const movementType = item.qty < 0 ? 'OUT' : 'IN';
            const lineValue = absoluteQty * (item.rate || 0);

            // Stock Ledger Posting
            await postToStockLedger(client, {
                companyId: companyId,
                godownId: item.godownId || null,
                productId: item.productId,
                batchId: item.batchId || null,
                movementType: movementType,
                referenceType: 'Journal',
                referenceId: journalId,
                referenceNumber: journalNumber,
                quantity: absoluteQty,
                costPerUnit: item.rate || 0,
                movementDate: date || new Date(),
                narration: narration || 'Stock Journal Update',
                createdBy: userId
            });

            // General Ledger Posting (Stock Adjustment)
            if (inventoryAccountId && adjAccountId && lineValue > 0) {
                if (movementType === 'IN') {
                    await postToGeneralLedger(client, { accountId: inventoryAccountId, voucherId: journalId, voucherType: 'JV', transactionDate: date, debit: lineValue, narration: `Stock Journal In: ${journalNumber}` });
                    await postToGeneralLedger(client, { accountId: adjAccountId, voucherId: journalId, voucherType: 'JV', transactionDate: date, credit: lineValue, narration: `Stock Adjustment In: ${journalNumber}` });
                } else {
                    await postToGeneralLedger(client, { accountId: adjAccountId, voucherId: journalId, voucherType: 'JV', transactionDate: date, debit: lineValue, narration: `Stock Adjustment Out: ${journalNumber}` });
                    await postToGeneralLedger(client, { accountId: inventoryAccountId, voucherId: journalId, voucherType: 'JV', transactionDate: date, credit: lineValue, narration: `Stock Journal Out: ${journalNumber}` });
                }
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Error creating stock journal:', error);
        res.status(500).json({ error: 'Failed to create stock journal' });
    } finally {
        if (client) client.release();
    }
});

router.post('/stock-transfers', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        const { date, sourceBranchId, destBranchId, transferNo, narration, items = [] } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        await client.query('BEGIN');
        const { postToStockLedger } = require('../utils/ledgerHelper');

        const transferId = req.body.id || uuidv4();
        const transferNumber = transferNo || `ST-${Date.now()}`;
        
        // 1. Create Stock Transfer Record
        const result = await client.query(
            `INSERT INTO stock_transfers (id, company_id, transfer_number, date, source_branch_id, dest_branch_id, narration, status, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'In Transit', $8)
             RETURNING id, transfer_number`,
            [transferId, companyId, transferNumber, date || new Date().toISOString().split('T')[0], sourceBranchId || null, destBranchId || null, narration || '', userId]
        );

        // 2. Process Items and Deduct from Source
        for (const item of items) {
            const itemId = uuidv4();
            await client.query(
                `INSERT INTO stock_transfer_items (id, transfer_id, product_id, godown_id, batch_id, qty, rate, amount) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [itemId, transferId, item.productId, item.godownId || null, item.batchId || null, item.qty, item.rate || 0, item.amount || 0]
            );

            // Outward ledger entry
            await postToStockLedger(client, {
                companyId: companyId,
                godownId: item.godownId || null,
                productId: item.productId,
                batchId: item.batchId || null,
                movementType: 'OUT',
                referenceType: 'Transfer',
                referenceId: transferId,
                referenceNumber: transferNumber,
                quantity: item.qty || 0,
                costPerUnit: item.rate || 0,
                movementDate: date || new Date(),
                narration: narration || 'Stock Transfer Dispatch',
                createdBy: userId
            });
        }
        
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Error creating stock transfer:', error);
        res.status(500).json({ error: 'Failed to create stock transfer' });
    } finally {
        if (client) client.release();
    }
});

router.post('/purchases/direct', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        const { invoiceNo, party, supplierName, date, totalAmount, items = [] } = req.body;
        const companyId = req.user.companyId || 1;
        const userId = req.user.id;
        
        await client.query('BEGIN');
        const { postToGeneralLedger, postToStockLedger, findAccount } = require('../utils/ledgerHelper');
        
        // Find supplier UUID
        let supplierId = null;
        if (party || supplierName) {
            const supplierRes = await client.query(`SELECT id FROM parties WHERE name = $1`, [party || supplierName]);
            if (supplierRes.rows.length > 0) supplierId = supplierRes.rows[0].id;
        }

        const purchaseId = uuidv4();
        const purchaseNumber = invoiceNo || `PUR-${Date.now()}`;
        const inventoryAccountId = await findAccount(client, companyId, 'Inventory');
        const payablesAccountId = await findAccount(client, companyId, 'Payables');
        const stockLedgerExists = await client.query(`SELECT to_regclass('public.stock_ledger_entries') AS table_name`);
        
        // Insert direct purchase document
        await client.query(
            `INSERT INTO purchases (id, supplier_id, invoice_number, date, total_amount, status, payment_status) 
             VALUES ($1, $2, $3, $4, $5, 'Received', 'Unpaid')`,
            [purchaseId, supplierId, purchaseNumber, date || new Date().toISOString().split('T')[0], totalAmount || 0]
        );

        // General Ledger Posting
        if (inventoryAccountId && payablesAccountId && totalAmount > 0) {
            await postToGeneralLedger(client, { accountId: inventoryAccountId, voucherId: purchaseId, voucherType: 'Purchase', transactionDate: date, debit: totalAmount, narration: `Direct Purchase: ${purchaseNumber}` });
            await postToGeneralLedger(client, { accountId: payablesAccountId, voucherId: purchaseId, voucherType: 'Purchase', transactionDate: date, credit: totalAmount, narration: `Direct Purchase: ${purchaseNumber}` });
        }

        // Iterate items
        for (const item of items) {
            const itemId = uuidv4();
            const productId = item.productId || item.product_id || null;
            const quantity = Number(item.quantity || item.qty || 0);
            const purchaseRate = Number(item.purchaseRate || item.purchase_rate || item.rate || 0);
            const mrp = Number(item.mrp || item.rate || 0);
            const amount = Number(item.amount || (quantity * purchaseRate));
            const batchNo = item.batchNo || item.batch_number || item.batchNumber || purchaseNumber;
            const expiryDate = item.expiryDate || item.expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0];

            await client.query(
                `INSERT INTO purchase_items (
                    id, purchase_id, product_id, batch_number, expiry_date,
                    quantity, purchase_rate, mrp, gst_percent, amount
                 ) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [itemId, purchaseId, productId, batchNo, expiryDate, quantity, purchaseRate, mrp, Number(item.gst || item.gst_percent || 0), amount]
            );

            if (productId) {
                const batchRes = await client.query(
                    `SELECT id FROM batches WHERE product_id = $1 AND batch_no = $2 LIMIT 1`,
                    [productId, batchNo]
                );

                if (batchRes.rows.length > 0) {
                    await client.query(
                        `UPDATE batches
                         SET stock = COALESCE(stock, 0) + $1,
                             purchase_rate = $2,
                             mrp = $3,
                             selling_rate = GREATEST(COALESCE(selling_rate, 0), $3)
                         WHERE id = $4`,
                        [quantity, purchaseRate, mrp, batchRes.rows[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO batches (
                            product_id, batch_no, expiry_date, quantity, mrp,
                            purchase_rate, selling_rate, status
                         )
                         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')`,
                        [productId, batchNo, expiryDate, quantity, mrp, purchaseRate, mrp]
                    );
                }

                await client.query(
                    `UPDATE products
                     SET current_stock = COALESCE(current_stock, 0) + $1,
                         purchase_rate = $2,
                         mrp = GREATEST(COALESCE(mrp, 0), $3),
                         last_received_date = $4
                     WHERE id = $5`,
                    [quantity, purchaseRate, mrp, date || new Date().toISOString().split('T')[0], productId]
                );
            }

            if (stockLedgerExists.rows[0].table_name) {
                await postToStockLedger(client, {
                    companyId: companyId,
                    godownId: item.godownId || null,
                    productId,
                    batchId: item.batchId || null,
                    movementType: 'IN',
                    referenceType: 'Purchase',
                    referenceId: purchaseId,
                    referenceNumber: purchaseNumber,
                    quantity,
                    costPerUnit: purchaseRate,
                    movementDate: date || new Date(),
                    narration: 'Direct Purchase Receipt',
                    createdBy: userId
                });
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: { id: purchaseId } });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Error creating direct purchase:', error);
        res.status(500).json({ error: 'Failed to create direct purchase', details: error.message });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;
module.exports.createStockLedgerEntry = createStockLedgerEntry;
