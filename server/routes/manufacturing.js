const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');

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
 * GET /api/manufacturing/boms
 * Fetch all Bill of Materials
 */
router.get('/boms', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, product_id as "productId", product_name as "productName", 
              batch_size as "batchSize", ingredients 
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

/**
 * POST /api/manufacturing/production-orders
 */
router.post('/production-orders', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { batchNumber, productId, productName, bomId, plannedQuantity, startDate } = req.body;
    const result = await db.query(
      `INSERT INTO production_orders (batch_number, product_id, product_name, bom_id, planned_quantity, start_date, status, current_stage, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'Planned', 'Pending', $7) RETURNING *`,
      [batchNumber, productId, productName, bomId, plannedQuantity, startDate, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Failed to create production order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
