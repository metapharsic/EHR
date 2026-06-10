const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');

/**
 * GET /api/manufacturing/bom  (alias for /boms)
 * GET /api/manufacturing/boms
 * Fetch all Bill of Materials
 */
router.get('/bom', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, product_id as "productId", product_name as "productName", 
              batch_size as "batchSize", version, status, ingredients 
       FROM boms 
       ORDER BY product_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to fetch BOMs', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/boms', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, product_id as "productId", product_name as "productName", 
              batch_size as "batchSize", version, status, ingredients 
       FROM boms 
       ORDER BY product_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to fetch BOMs', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/manufacturing/bom
 * Create a new Bill of Materials
 */
router.post('/bom', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { product_id, product_name, batch_size, version, status, items } = req.body;

    if (!product_id || !product_name) {
      return res.status(400).json({ success: false, error: 'product_id and product_name are required' });
    }

    const result = await db.query(
      `INSERT INTO boms (product_id, product_name, batch_size, version, status, ingredients)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [product_id, product_name, batch_size || 1000, version || '1.0', status || 'Active', JSON.stringify(items || [])]
    );
    res.status(201).json({ success: true, data: result.rows[0], id: result.rows[0].id });
  } catch (error) {
    logger.error('Failed to create BOM', { error: error.message });
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
      `SELECT id, batch_number as "batchNumber", product_id as "productId", 
              product_name as "productName", bom_id as "bomId", 
              planned_quantity as "plannedQuantity", start_date as "startDate", 
              status, current_stage as "currentStage" 
       FROM production_orders 
       ORDER BY start_date DESC`
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
      `INSERT INTO production_orders (batch_number, product_id, product_name, bom_id, planned_quantity, start_date, status, current_stage, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8) RETURNING *`,
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
