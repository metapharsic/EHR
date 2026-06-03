/**
 * BACKEND API ENDPOINTS TEMPLATE
 * 
 * Location: /server/routes/inventory.js (or similar)
 * 
 * This template shows how to create all necessary API endpoints
 * to support the refactored frontend components.
 * 
 * Each module should have similar endpoints following REST conventions
 */

const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // Database connection pool
const { verifyTokenMiddleware } = require('../utils/jwt');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Verify authentication on all routes
router.use(verifyTokenMiddleware);

// ============================================================================
// GET ENDPOINTS (READ)
// ============================================================================

/**
 * GET /api/inventory
 * Fetch all inventory items with filters
 * 
 * Query Parameters:
 * - search: Search by name/generic/code
 * - status: ALL|LOW_STOCK|EXPIRING|EXPIRED
 * - source: ALL|PCD|OWN_MANUFACTURING|TRADING
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 20)
 * - sortBy: Field to sort (default: name)
 * - sortOrder: ASC|DESC (default: ASC)
 * 
 * Response:
 * {
 *   success: true,
 *   data: [{id, code, name, currentStock, ...}, ...],
 *   total: 125,
 *   page: 1,
 *   pageSize: 20,
 *   totalPages: 7
 * }
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      status = 'ALL',
      source = 'ALL',
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = req.query;

    const offset = (page - 1) * limit;
    const allowedSortFields = ['code', 'name', 'currentStock', 'expiryStatus'];
    const sort = allowedSortFields.includes(sortBy) ? sortBy : 'name';

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Search filter
    if (search) {
      whereClause += ' AND (p.name ILIKE $' + (params.length + 1) + ' OR p.generic_name ILIKE $' + (params.length + 1) + ' OR p.code ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    // Status filter
    if (status === 'LOW_STOCK') {
      whereClause += ' AND p.current_stock <= p.reorder_level';
    } else if (status === 'EXPIRING') {
      whereClause += ' AND p.expiry_status = $' + (params.length + 1);
      params.push('EXPIRING_SOON');
    } else if (status === 'EXPIRED') {
      whereClause += ' AND p.expiry_status = $' + (params.length + 1);
      params.push('EXPIRED');
    }

    // Source filter
    if (source !== 'ALL') {
      whereClause += ' AND p.source = $' + (params.length + 1);
      params.push(source);
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM products p ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Fetch paginated records
    const query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.generic_name as "genericName",
        p.current_stock as "currentStock",
        p.reorder_level as "reorderLevel",
        p.reorder_qty as "reorderQty",
        p.last_received_date as "lastReceivedDate",
        p.expiry_status as "expiryStatus",
        COALESCE(p.current_stock * p.mrp, 0) as "totalValue",
        (SELECT COUNT(*) FROM batches b WHERE b.product_id = p.id) as "batchCount"
      FROM products p
      ${whereClause}
      ORDER BY ${sort} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await pool.query(query, [...params, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/inventory/:id
 * Fetch single inventory item with all details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.generic_name,
        p.current_stock,
        p.reorder_level,
        p.mrp,
        p.ptr,
        p.pts,
        p.expiry_status,
        p.last_received_date,
        (SELECT json_agg(json_build_object(
          'id', b.id,
          'batchNo', b.batch_no,
          'quantity', b.quantity,
          'expiryDate', b.expiry_date,
          'mrp', b.mrp,
          'ptr', b.ptr,
          'status', b.status
        )) FROM batches b WHERE b.product_id = p.id) as batches
      FROM products p
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/inventory/:id/batches
 * Fetch all batches for a product
 */
router.get('/:id/batches', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        batch_no as "batchNo",
        quantity,
        expiry_date as "expiryDate",
        mrp,
        ptr,
        status
      FROM batches
      WHERE product_id = $1
      ORDER BY expiry_date ASC
    `;

    const result = await pool.query(query, [id]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/inventory/lists/dropdown
 * Get formatted lists for all dropdowns
 */
router.get('/lists/dropdown', async (req, res) => {
  try {
    // Fetch products for dropdown
    const productsQuery = 'SELECT id, name as label, code as value FROM products ORDER BY name';
    const productsResult = await pool.query(productsQuery);

    // Fetch sources for dropdown
    const sourcesQuery = "SELECT DISTINCT source as label, source as value FROM products";
    const sourcesResult = await pool.query(sourcesQuery);

    res.json({
      success: true,
      data: {
        products: productsResult.rows,
        sources: sourcesResult.rows,
        statuses: [
          { value: 'ALL', label: 'All Items' },
          { value: 'LOW_STOCK', label: 'Low Stock' },
          { value: 'EXPIRING', label: 'Expiring Soon' },
          { value: 'EXPIRED', label: 'Expired' },
        ],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST ENDPOINTS (CREATE)
// ============================================================================

/**
 * POST /api/inventory
 * Create new product
 * 
 * Request Body:
 * {
 *   code: string,
 *   name: string,
 *   genericName: string,
 *   mrp: number,
 *   ptr: number,
 *   pts: number,
 *   reorderLevel: number,
 *   reorderQty: number,
 *   source: string
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { code, name, genericName, mrp, ptr, pts, reorderLevel, reorderQty, source } = req.body;

    // Validation
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Code and Name are required' });
    }

    const query = `
      INSERT INTO products (code, name, generic_name, mrp, ptr, pts, reorder_level, reorder_qty, source, current_stock)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
      RETURNING id, code, name
    `;

    const result = await pool.query(query, [
      code,
      name,
      genericName || '',
      mrp || 0,
      ptr || 0,
      pts || 0,
      reorderLevel || 0,
      reorderQty || 0,
      source || 'TRADING',
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully',
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/inventory/batch
 * Add new batch for a product
 */
router.post('/batch', async (req, res) => {
  try {
    const { productId, batchNo, quantity, expiryDate, mrp, ptr, supplierRef } = req.body;

    const query = `
      INSERT INTO batches (product_id, batch_no, quantity, expiry_date, mrp, ptr, supplier_ref, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
      RETURNING id, batch_no as "batchNo"
    `;

    const result = await pool.query(query, [
      productId,
      batchNo,
      quantity,
      expiryDate,
      mrp,
      ptr,
      supplierRef || null,
    ]);

    // Update product current_stock
    await pool.query(
      'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
      [quantity, productId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Batch added successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/inventory/adjust
 * Adjust stock (add/remove)
 */
router.post('/adjust', async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

    // Record adjustment
    const adjustmentQuery = `
      INSERT INTO inventory_adjustments (product_id, quantity, reason, notes, adjusted_by, adjusted_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `;

    const adjustmentResult = await pool.query(adjustmentQuery, [
      productId,
      quantity,
      reason,
      notes,
      req.user.id, // From auth middleware
    ]);

    // Update product stock
    await pool.query(
      'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
      [quantity, productId]
    );

    res.status(201).json({
      success: true,
      data: adjustmentResult.rows[0],
      message: 'Stock adjustment recorded',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PUT ENDPOINTS (UPDATE)
// ============================================================================

/**
 * PUT /api/inventory/:id
 * Update product details
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, genericName, mrp, ptr, pts, reorderLevel, reorderQty } = req.body;

    const query = `
      UPDATE products
      SET 
        name = COALESCE($1, name),
        generic_name = COALESCE($2, generic_name),
        mrp = COALESCE($3, mrp),
        ptr = COALESCE($4, ptr),
        pts = COALESCE($5, pts),
        reorder_level = COALESCE($6, reorder_level),
        reorder_qty = COALESCE($7, reorder_qty),
        updated_at = NOW()
      WHERE id = $8
      RETURNING id, name, code
    `;

    const result = await pool.query(query, [
      name || null,
      genericName || null,
      mrp || null,
      ptr || null,
      pts || null,
      reorderLevel || null,
      reorderQty || null,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

/**
 * DELETE /api/inventory/:id
 * Delete product (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete
    const query = `
      UPDATE products
      SET is_active = false, deleted_at = NOW()
      WHERE id = $1
      RETURNING id, name
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

router.use((err, req, res, next) => {
  console.error('Route error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

module.exports = router;
