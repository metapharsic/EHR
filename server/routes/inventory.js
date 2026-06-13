/**
 * REAL WORKING INVENTORY API ENDPOINT
 * This is NOT a template - it's a functional endpoint you can use NOW
 * 
 * Location: /server/routes/inventory.js
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware, verify2FAMiddleware } = require('../utils/jwt');

// Apply middleware to all routes
router.use(verifyTokenMiddleware);
router.use(verify2FAMiddleware);

/**
 * GET /api/inventory
 * Fetch all inventory items with live database data
 * 
 * Query Parameters:
 * - search: Search by name
 * - status: Filter by stock status (ALL, LOW_STOCK, EXPIRING, EXPIRED)
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 20)
 */
router.get('/', async (req, res) => {
  try {
    const { search = '', status = 'ALL', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
    let params = [];

    // Search filter
    if (search && search.trim()) {
      params.push(`%${search.toLowerCase()}%`);
      whereClause += ` AND (LOWER(p.name) ILIKE $${params.length} OR LOWER(p.generic_name) ILIKE $${params.length})`;
    }

    // Status filter (based on stock levels)
    if (status === 'LOW_STOCK') {
      whereClause += ` AND p.current_stock <= p.reorder_level`;
    } else if (status === 'EXPIRING') {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM batches b 
        WHERE b.product_id = p.id 
        AND b.expiry_date BETWEEN NOW()::date AND (NOW() + interval '30 days')::date
      )`;
    } else if (status === 'EXPIRED') {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM batches b 
        WHERE b.product_id = p.id 
        AND b.expiry_date < NOW()::date
      )`;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM products p ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.generic_name as "genericName",
        p.manufacturer,
        COALESCE((SELECT SUM(b.stock) FROM batches b WHERE b.product_id = p.id), 0) as "currentStock",
        p.reorder_level as "reorderLevel",
        p.reorder_qty as "reorderQty",
        p.min_stock_level as "minStockLevel",
        p.last_received_date as "lastReceivedDate",
        p.mrp,
        p.ptr,
        p.pts,
        COALESCE((SELECT MAX(b.purchase_rate) FROM batches b WHERE b.product_id = p.id AND b.stock > 0), p.purchase_rate, 0) as "purchaseRate",
        p.selling_rate as "sellingRate",
        p.hsn as "hsnCode",
        p.gst as "taxRate",
        p.opening_stock as "openingStock",
        'N/A' as scheme,
        p.category,
        p.uom,
        p.maintain_batches as "maintainBatches",
        p.track_expiry as "trackExpiry",
        p.is_active as "isActive",
        p.branch_distribution as "branchDistribution",
        COALESCE(p.current_stock * p.mrp, 0) as "totalValue",
        (SELECT COUNT(*) FROM batches b WHERE b.product_id = p.id) as "batchCount",
        CASE
          WHEN NOT EXISTS (SELECT 1 FROM batches b WHERE b.product_id = p.id AND b.stock > 0) THEN 'OK'
          WHEN NOT EXISTS (SELECT 1 FROM batches b WHERE b.product_id = p.id AND b.stock > 0 AND b.expiry_date >= NOW()::date) THEN 'EXPIRED'
          WHEN EXISTS (SELECT 1 FROM batches b WHERE b.product_id = p.id AND b.stock > 0 AND b.expiry_date BETWEEN NOW()::date AND (NOW() + interval '30 days')::date) THEN 'EXPIRING_SOON'
          ELSE 'OK'
        END as "expiryStatus"
      FROM products p
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataResult = await db.query(dataQuery, [...params, limit, offset]);

    // Calculate Global Valuation for the header (Real-time Enterprise Asset Value)
    const valuationQuery = `
      WITH product_prices AS (
        SELECT 
          p.id,
          p.current_stock,
          COALESCE((SELECT MAX(b.purchase_rate) FROM batches b WHERE b.product_id = p.id AND b.stock > 0), p.purchase_rate, 0) as effective_purchase_rate,
          COALESCE((SELECT MAX(b.mrp) FROM batches b WHERE b.product_id = p.id AND b.stock > 0), p.mrp, 0) as effective_mrp
        FROM products p
        WHERE p.deleted_at IS NULL AND p.is_active = true
      )
      SELECT 
        COUNT(*) as total_skus,
        SUM(current_stock * effective_purchase_rate) as total_asset_value,
        SUM(current_stock * effective_mrp) as total_market_value
      FROM product_prices
    `;
    const valuationResult = await db.query(valuationQuery);

    logger.http('GET', '/api/inventory', 200, 0, req.ip, req.user.userId);

    return res.json({
      success: true,
      data: dataResult.rows,
      valuation: {
        totalAssetValue: parseFloat(valuationResult.rows[0].total_asset_value || 0),
        totalMarketValue: parseFloat(valuationResult.rows[0].total_market_value || 0),
        totalSkus: total
      },
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch inventory', { error: error.message, userId: req.user.userId });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch inventory data'
    });
  }
});

/**
 * GET /api/inventory/valuation
 * Fetch real-time enterprise valuation stats
 */
router.get('/valuation', async (req, res) => {
  try {
    const valuationQuery = `
      SELECT 
        COUNT(*) as total_skus,
        SUM(COALESCE(p.current_stock * COALESCE((SELECT MAX(b.purchase_rate) FROM batches b WHERE b.product_id = p.id AND b.stock > 0), p.purchase_rate, 0), 0)) as total_asset_value,
        SUM(COALESCE(p.current_stock * p.mrp, 0)) as total_market_value
      FROM products p
      WHERE p.deleted_at IS NULL AND p.is_active = true
    `;
    const result = await db.query(valuationQuery);
    const data = result.rows[0];

    return res.json({
      success: true,
      data: {
        totalAssetValue: parseFloat(data.total_asset_value || 0),
        totalMarketValue: parseFloat(data.total_market_value || 0),
        totalSkus: parseInt(data.total_skus || 0)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch inventory valuation', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/inventory/:id
 * Fetch single product with all batches
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(id)) {
      return next();
    }

    // Get product
    const productResult = await db.query(
      `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get batches
    const batchesResult = await db.query(
      `SELECT * FROM batches WHERE product_id = $1 ORDER BY expiry_date ASC`,
      [id]
    );

    logger.http('GET', `/api/inventory/${id}`, 200, 0, req.ip, req.user.userId);

    return res.json({
      success: true,
      data: {
        ...product,
        batches: batchesResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to fetch product', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/inventory/lists/dropdown
 * Get all dropdown data (products, statuses, sources)
 */
router.get('/lists/dropdown', async (req, res) => {
  try {
    // Get all products
    const productsResult = await db.query(`
      SELECT id as value, name as label 
      FROM products 
      WHERE deleted_at IS NULL AND is_active = true
      ORDER BY name
    `);

    return res.json({
      success: true,
      data: {
        products: productsResult.rows,
        statuses: [
          { value: 'ALL', label: 'All Items' },
          { value: 'LOW_STOCK', label: 'Low Stock' },
          { value: 'EXPIRING', label: 'Expiring Soon' },
          { value: 'EXPIRED', label: 'Expired' }
        ]
      }
    });
  } catch (error) {
    logger.error('Failed to fetch dropdown lists', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/inventory/:id/batches
 * Fetch all batches for a specific product
 */
router.get('/:id/batches', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(id)) {
      return next();
    }
    const result = await db.query(
      `SELECT id,
              batch_number as "batchNo",
              stock as quantity,
              stock,
              available_qty as "availableQty",
              expiry_date as "expiryDate",
              mrp,
              selling_rate as "sellingRate",
              selling_rate as ptr,
              purchase_rate as "purchaseRate",
              status
       FROM batches 
       WHERE product_id = $1 
       ORDER BY expiry_date ASC`,
      [id]
    );

    logger.http('GET', `/api/inventory/${id}/batches`, 200, 0, req.ip, req.user.userId);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch product batches', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/inventory
 * Create a new product
 */
router.post('/', verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER']), async (req, res) => {
  try {
    const { 
      id,
      name, genericName, code, manufacturer, category, 
      reorderLevel, reorderQty, mrp, ptr, pts, 
      purchaseRate, sellingRate, hsnCode, taxRate, 
      openingStock, scheme, uom, minStockLevel,
      maintainBatches, trackExpiry, branchDistribution
    } = req.body;

    console.log("POST INVENTORY CALLED WITH BODY:", req.body);

    // Strict validation based on DB constraints
    if (!name || !code || !genericName || !manufacturer) {
      return res.status(400).json({
        success: false,
        error: 'Product name, code, generic name, and manufacturer are required'
      });
    }

    // FIX: reject negative pricing values
    const numericFields = { mrp, purchaseRate, sellingRate, ptr, pts };
    for (const [field, val] of Object.entries(numericFields)) {
      if (val !== undefined && val !== null && Number(val) < 0) {
        return res.status(422).json({
          success: false,
          error: `${field} cannot be negative. Received: ${val}`
        });
      }
    }
    const parsedTaxRate = Number(taxRate);
    if (!isNaN(parsedTaxRate) && (parsedTaxRate < 0 || parsedTaxRate > 100)) {
      return res.status(422).json({ success: false, error: 'Tax rate must be between 0 and 100' });
    }
    const parsedOpeningStock = Number(openingStock);
    if (!isNaN(parsedOpeningStock) && parsedOpeningStock < 0) {
      return res.status(422).json({ success: false, error: 'Opening stock cannot be negative' });
    }

    const finalId = id || require('crypto').randomUUID();

    const result = await db.query(
      `INSERT INTO products (
        id, name, generic_name, code, manufacturer, category, 
        reorder_level, reorder_qty, mrp, ptr, pts, 
        purchase_rate, selling_rate, hsn, gst, 
        opening_stock, current_stock, uom, min_stock_level,
        maintain_batches, track_expiry, branch_distribution,
        created_by, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, $17, $18, $19, $20, $21, $22, NOW()) 
       RETURNING *`,
      [
        finalId, name, genericName, code, manufacturer, category, 
        reorderLevel || 100, reorderQty || 100, mrp || 0, ptr || 0, pts || 0,
        purchaseRate || 0, sellingRate || 0, hsnCode || '', taxRate || 12,
        openingStock || 0, uom || 'Strip', minStockLevel || 50,
        maintainBatches !== undefined ? maintainBatches : true,
        trackExpiry !== undefined ? trackExpiry : true,
        branchDistribution !== undefined ? Boolean(branchDistribution) : false,
        req.user.userId
      ]
    );

    logger.http('POST', '/api/inventory', 201, 0, req.ip, req.user.userId);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully'
    });
  } catch (error) {
    logger.error('Failed to create product', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/inventory/:id
 * Update an existing product
 */
router.put('/:id', verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, genericName, code, manufacturer, category, 
      reorderLevel, reorderQty, mrp, ptr, pts, 
      purchaseRate, sellingRate, hsnCode, taxRate, 
      openingStock, scheme, uom, minStockLevel,
      maintainBatches, trackExpiry, branchDistribution,
      isActive
    } = req.body;

    // First check if product exists
    const checkResult = await db.query('SELECT opening_stock, current_stock FROM products WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // FIX: reject negative pricing on update too
    const numericFields = { mrp, purchaseRate, sellingRate, ptr, pts };
    for (const [field, val] of Object.entries(numericFields)) {
      if (val !== undefined && val !== null && Number(val) < 0) {
        return res.status(422).json({ success: false, error: `${field} cannot be negative` });
      }
    }
    const parsedTaxRate = Number(taxRate);
    if (!isNaN(parsedTaxRate) && (parsedTaxRate < 0 || parsedTaxRate > 100)) {
      return res.status(422).json({ success: false, error: 'Tax rate must be between 0 and 100' });
    }

    const oldOpeningStock = checkResult.rows[0].opening_stock;
    const oldCurrentStock = checkResult.rows[0].current_stock;
    
    // Calculate new current_stock if opening_stock changed
    let newCurrentStock = oldCurrentStock;
    if (openingStock !== undefined && openingStock !== oldOpeningStock) {
      newCurrentStock = oldCurrentStock + (openingStock - oldOpeningStock);
    }

    const result = await db.query(
      `UPDATE products SET 
        name = COALESCE($1, name),
        generic_name = COALESCE($2, generic_name),
        code = COALESCE($3, code),
        manufacturer = COALESCE($4, manufacturer),
        category = COALESCE($5, category),
        reorder_level = COALESCE($6, reorder_level),
        reorder_qty = COALESCE($7, reorder_qty),
        mrp = COALESCE($8, mrp),
        ptr = COALESCE($9, ptr),
        pts = COALESCE($10, pts),
        purchase_rate = COALESCE($11, purchase_rate),
        selling_rate = COALESCE($12, selling_rate),
        hsn = COALESCE($13, hsn),
        gst = COALESCE($14, gst),
        opening_stock = COALESCE($15, opening_stock),
        current_stock = $16,
        uom = COALESCE($17, uom),
        min_stock_level = COALESCE($18, min_stock_level),
        maintain_batches = COALESCE($19, maintain_batches),
        track_expiry = COALESCE($20, track_expiry),
        branch_distribution = COALESCE($21, branch_distribution),
        is_active = COALESCE($22, is_active),
        updated_at = NOW()
       WHERE id = $23 RETURNING *`,
      [
        name, genericName, code, manufacturer, category, 
        reorderLevel, reorderQty, mrp, ptr, pts,
        purchaseRate, sellingRate, hsnCode, taxRate,
        openingStock, newCurrentStock, uom, minStockLevel,
        maintainBatches, trackExpiry, 
        branchDistribution !== undefined ? Boolean(branchDistribution) : null,
        isActive, id
      ]
    );

    logger.http('PUT', `/api/inventory/${id}`, 200, 0, req.ip, req.user.userId);

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Product updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update product', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/inventory/:id
 * Soft delete a product from Item/Stock Master while preserving historical records
 */
router.delete('/:id', verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE products
       SET deleted_at = NOW(), is_active = false, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found or already deleted' });
    }

    logger.http('DELETE', `/api/inventory/${id}`, 200, 0, req.ip, req.user.userId);

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Product deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete product', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete product' });
  }
});

/**
 * POST /api/inventory/batch
 * Add a new batch to a product
 */
router.post('/batch', verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER']), async (req, res) => {
  try {
    const { productId, batchNo, quantity, expiryDate, mrp, ptr, sellingRate, purchaseRate } = req.body;

    if (!productId || !batchNo || !quantity || !expiryDate) {
      return res.status(400).json({ success: false, error: 'Product ID, batch number, quantity, and expiry date are required' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert batch
      const batchResult = await client.query(
        `INSERT INTO batches (product_id, batch_number, stock, expiry_date, mrp, purchase_rate, selling_rate, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active') RETURNING *`,
        [productId, batchNo, quantity, expiryDate, mrp || 0, purchaseRate || 0, sellingRate || ptr || mrp || 0]
      );

      // Update product current_stock
      await client.query(
        `UPDATE products SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2`,
        [quantity, productId]
      );

      await client.query('COMMIT');

      logger.http('POST', '/api/inventory/batch', 201, 0, req.ip, req.user.userId);

      return res.status(201).json({
        success: true,
        data: batchResult.rows[0],
        message: 'Batch added successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to add batch', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/inventory/adjust
 * Adjust stock (add or remove)
 */
router.post('/adjust', verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER']), async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ success: false, error: 'Product ID and quantity required' });
    }

    // Update stock
    const result = await db.query(
      `UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [quantity, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    logger.http('POST', '/api/inventory/adjust', 201, 0, req.ip, req.user.userId);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Stock adjustment recorded'
    });
  } catch (error) {
    logger.error('Failed to adjust stock', { error: error.message, userId: req.user.userId });
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
