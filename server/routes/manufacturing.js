const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');

/**
 * GET /bom and /boms
 * Fetch all Bill of Materials
 */
router.get(['/bom', '/boms'], verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, product_id as "productId", product_name as "productName", 
              batch_size as "batchSize", version, status, ingredients,
              bom_name as "bomName", std_cost as "stdCost"
       FROM boms 
       ORDER BY bom_name, product_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to fetch BOMs', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /bom and /boms
 * Create a new Bill of Materials
 */
router.post(['/bom', '/boms'], verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { 
      product_id, product_name, productId, productName, targetItem,
      batch_size, batchSize, batchYield,
      version, status, isActive,
      bom_name, bomName,
      std_cost, stdCost,
      ingredients, materials, items
    } = req.body;

    const finalProductName = product_name || productName || targetItem;
    if (!finalProductName) {
      return res.status(400).json({ success: false, error: 'Target product name (product_name or targetItem) is required' });
    }

    let finalProductId = product_id || productId;
    if (!finalProductId) {
      // Auto-resolve product_id by querying the products table
      const pResult = await db.query(
        `SELECT id FROM products WHERE name = $1 LIMIT 1`,
        [finalProductName]
      );
      if (pResult.rows.length > 0) {
        finalProductId = pResult.rows[0].id;
      }
    }

    const finalBatchSize = batch_size || batchSize || batchYield || 1000;
    const finalBomName = bom_name || bomName || `${finalProductName} Standard Recipe`;
    const finalStdCost = std_cost || stdCost || 0.00;
    const finalStatus = status || (isActive === false ? 'Inactive' : 'Active');
    const finalIngredients = ingredients || materials || items || [];

    const result = await db.query(
      `INSERT INTO boms (product_id, product_name, batch_size, version, status, ingredients, bom_name, std_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [finalProductId || null, finalProductName, finalBatchSize, version || '1.0', finalStatus, JSON.stringify(finalIngredients), finalBomName, finalStdCost]
    );

    // Format output with camelCase to match expected UI layout
    const created = result.rows[0];
    const responseData = {
      id: created.id,
      productId: created.product_id,
      productName: created.product_name,
      batchSize: created.batch_size,
      version: created.version,
      status: created.status,
      ingredients: created.ingredients,
      bomName: created.bom_name,
      stdCost: created.std_cost
    };

    res.status(201).json({ success: true, data: responseData, id: created.id });
  } catch (error) {
    logger.error('Failed to create BOM', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /bom/:id and /boms/:id
 * Update an existing Bill of Materials
 */
router.put(['/bom/:id', '/boms/:id'], verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      product_id, product_name, productId, productName, targetItem,
      batch_size, batchSize, batchYield,
      version, status, isActive,
      bom_name, bomName,
      std_cost, stdCost,
      ingredients, materials, items
    } = req.body;

    const finalProductName = product_name || productName || targetItem;
    let finalProductId = product_id || productId;

    if (!finalProductId && finalProductName) {
      const pResult = await db.query(
        `SELECT id FROM products WHERE name = $1 LIMIT 1`,
        [finalProductName]
      );
      if (pResult.rows.length > 0) {
        finalProductId = pResult.rows[0].id;
      }
    }

    const finalBatchSize = batch_size || batchSize || batchYield;
    const finalBomName = bom_name || bomName;
    const finalStdCost = std_cost || stdCost;
    const finalStatus = status || (isActive === false ? 'Inactive' : isActive === true ? 'Active' : undefined);
    const finalIngredients = ingredients || materials || items;

    const result = await db.query(
      `UPDATE boms
       SET product_id = COALESCE($1, product_id),
           product_name = COALESCE($2, product_name),
           batch_size = COALESCE($3, batch_size),
           version = COALESCE($4, version),
           status = COALESCE($5, status),
           bom_name = COALESCE($6, bom_name),
           std_cost = COALESCE($7, std_cost),
           ingredients = COALESCE($8, ingredients)
       WHERE id = $9
       RETURNING *`,
      [
        finalProductId || null,
        finalProductName || null,
        finalBatchSize !== undefined ? finalBatchSize : null,
        version || null,
        finalStatus || null,
        finalBomName || null,
        finalStdCost !== undefined ? finalStdCost : null,
        finalIngredients ? JSON.stringify(finalIngredients) : null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'BOM not found' });
    }

    const updated = result.rows[0];
    const responseData = {
      id: updated.id,
      productId: updated.product_id,
      productName: updated.product_name,
      batchSize: updated.batch_size,
      version: updated.version,
      status: updated.status,
      ingredients: updated.ingredients,
      bomName: updated.bom_name,
      stdCost: updated.std_cost
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    logger.error('Failed to update BOM', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /bom/:id and /boms/:id
 * Delete a Bill of Materials
 */
router.delete(['/bom/:id', '/boms/:id'], verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM boms WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'BOM not found' });
    }
    
    res.json({ success: true, message: 'BOM deleted successfully', id });
  } catch (error) {
    logger.error('Failed to delete BOM', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/manufacturing/production-orders
 * Fetch all production orders
 */
router.get('/production-orders', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await db.query(
`SELECT id, 
              COALESCE(batch_number, order_no) as "batchNumber",
              product_id as "productId",
              product_name as "productName",
              bom_id as "bomId",
              COALESCE(planned_quantity, quantity) as "plannedQuantity",
              start_date as "startDate",
              status,
              COALESCE(current_stage, 'Pending') as "currentStage"
       FROM production_orders
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to fetch production orders', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/manufacturing/production-orders
 * Accept both camelCase and snake_case field names
 */
router.post('/production-orders', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const {
      batchNumber, batch_number,
      productId, product_id,
      productName, product_name,
      bomId, bom_id,
      plannedQuantity, planned_qty, planned_quantity,
      startDate, planned_start, start_date,
      endDate, planned_end, end_date,
      status: orderStatus
    } = req.body;

    const finalBatchNumber = batch_number || batchNumber;
    const finalProductId = product_id || productId;
    const finalProductName = product_name || productName;
    const finalBomId = bom_id || bomId;
    const finalQty = planned_quantity || planned_qty || plannedQuantity;
    const finalStart = start_date || planned_start || startDate;

    if (!finalBomId && !finalProductId) {
      return res.status(400).json({ success: false, error: 'bom_id or product_id is required' });
    }

    const result = await db.query(
`INSERT INTO production_orders (order_no, batch_number, product_id, product_name, bom_id, quantity, planned_quantity, start_date, status, current_stage, created_by)
       VALUES ($1, $1, $2, $3, $4, $5, $5, $6, $7, 'Pending', $8) RETURNING *`,
      [finalBatchNumber, finalProductId, finalProductName, finalBomId, finalQty, finalStart, orderStatus || 'Planned', req.user.userId]
    );
    

    res.status(201).json({ success: true, data: result.rows[0], id: result.rows[0].id });
  } catch (error) {
    logger.error('Failed to create production order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/manufacturing/raw-materials
 * Fetch all raw materials
 */
router.get('/raw-materials', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, cas_number as "casNumber", current_stock as "currentStock", 
              uom, min_stock_level as "minStockLevel", cost_per_unit as "costPerUnit" 
       FROM raw_materials 
       ORDER BY name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to fetch raw materials', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
