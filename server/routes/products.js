const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware, verify2FAMiddleware } = require('../utils/jwt');

// Helper to wrap async routes
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name');
        
        const products = await Promise.all(rows.map(async (p) => {
            const { rows: batches } = await db.query(
                'SELECT * FROM batches WHERE product_id = $1 ORDER BY expiry_date',
                [p.id]
            );

            // Map product to camelCase
            const mappedProduct = {
                id: p.id,
                name: p.name,
                genericName: p.generic_name,
                manufacturer: p.manufacturer,
                source: p.source,
                therapeuticCategory: p.therapeutic_category,
                packing: p.packing,
                uom: p.uom,
                hsn: p.hsn,
                gst: parseFloat(p.gst || 12),
                minStockLevel: p.min_stock_level,
                reorderLevel: p.reorder_level,
                rack: p.rack,
                scheduleType: p.schedule_type,
                totalStock: parseInt(p.current_stock || 0),
                batches: batches.map(b => ({
                    id: b.id,
                    batchNumber: b.batch_number || b.batch_no,
                    expiryDate: b.expiry_date,
                    manufacturingDate: b.manufacturing_date,
                    stock: parseInt(b.stock || b.available_qty || b.quantity || 0),
                    mrp: parseFloat(b.mrp || 0),
                    purchaseRate: parseFloat(b.purchase_rate || 0),
                    sellingRate: parseFloat(b.selling_rate || 0),
                    location: b.location || b.shelf_location || ''
                }))
            };
            return mappedProduct;
        }));

        res.json(products);
    } catch (error) {
        logger.error('Failed to fetch products', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch products' });
    }
}));

router.post('/', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PHARMACIST']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { name, genericName, manufacturer, packing, uom, hsn, gst, minStockLevel, reorderLevel, rack, scheduleType, source } = req.body;

        if (!name || !genericName || !manufacturer) {
            return res.status(400).json({ error: 'Name, generic name, and manufacturer are required' });
        }

        const { rows } = await db.query(
            `INSERT INTO products (name, generic_name, manufacturer, packing, uom, hsn, gst, min_stock_level, reorder_level, rack, schedule_type, source, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [name, genericName, manufacturer, packing, uom, hsn, gst || 12, minStockLevel || 50, reorderLevel || 100, rack, scheduleType || 'OTC', source || 'TRADING', req.user.userId]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error('Failed to create product', { error: error.message });
        res.status(500).json({ error: 'Failed to create product' });
    }
}));

router.delete('/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PHARMACIST']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete product', { error: error.message });
        res.status(500).json({ error: 'Failed to delete product' });
    }
}));

module.exports = router;
