/**
 * server/routes/oms.js
 * AI-era Order Management System (OMS) — B2B distributor order lifecycle.
 *
 * Lifecycle: Pending Approval -> Approved (reserve stock) -> Processing
 *            -> Shipped (decrement stock, release reservation) -> Delivered -> Invoiced
 * Side states: Rejected, Cancelled, Hold.
 *
 * Integrates with Inventory (reserved_stock / batches via ledgerHelper) and
 * Accounts/Billing (sales_invoices + JV/GL) and the Gemini AI agent (aiOmsAgent).
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const ledgerHelper = require('../utils/ledgerHelper');
const aiAgent = require('../services/aiOmsAgent');

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ORDER_TYPE = 'SO';
const TERMINAL = ['Delivered', 'Invoiced', 'Rejected', 'Cancelled'];

// Allowed status transitions (state machine)
const TRANSITIONS = {
    'Pending Approval': ['Approved', 'Rejected', 'Cancelled', 'Hold'],
    'Approved': ['Processing', 'Shipped', 'Hold', 'Cancelled'],
    'Processing': ['Shipped', 'Hold', 'Cancelled'],
    'Shipped': ['Delivered'],
    'Delivered': ['Invoiced'],
    'Hold': ['Approved', 'Processing', 'Cancelled'],
    'Rejected': [],
    'Cancelled': [],
    'Invoiced': []
};

// ============================================
// INTERNAL HELPERS (all operate on a transaction client)
// ============================================

async function logStatus(client, orderId, fromStatus, toStatus, note, userId) {
    await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, fromStatus, toStatus, note || null, userId || null]
    );
}

/**
 * Reserve stock for an order's items (FIFO across batches by expiry), updating
 * reserved_stock + batches.reserved_qty. Returns a per-item reservation summary.
 */
async function reserveOrderStock(client, order, items) {
    const summary = [];
    for (const item of items) {
        if (!item.product_id) { summary.push({ productId: null, requested: item.quantity, reserved: 0 }); continue; }
        let toReserve = Number(item.approved_quantity ?? item.quantity ?? 0);
        let reserved = 0;
        let firstBatchId = null;

        const { rows: batches } = await client.query(
            `SELECT id, available_qty FROM batches
             WHERE product_id = $1 AND available_qty > 0
             ORDER BY expiry_date ASC, created_at ASC`,
            [item.product_id]
        );

        for (const batch of batches) {
            if (toReserve <= 0) break;
            const alloc = Math.min(toReserve, Number(batch.available_qty));
            if (alloc <= 0) continue;
            if (!firstBatchId) firstBatchId = batch.id;

            await client.query(
                `INSERT INTO reserved_stock (company_id, batch_id, order_id, order_type, order_number, qty_reserved)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (batch_id, order_id, order_type)
                 DO UPDATE SET qty_reserved = reserved_stock.qty_reserved + EXCLUDED.qty_reserved`,
                [order.company_id || 1, batch.id, order.id, ORDER_TYPE, order.order_number, alloc]
            );
            await client.query(
                `UPDATE batches SET reserved_qty = COALESCE(reserved_qty, 0) + $1 WHERE id = $2`,
                [alloc, batch.id]
            );
            toReserve -= alloc;
            reserved += alloc;
        }

        if (firstBatchId) {
            await client.query(`UPDATE order_items SET batch_id = $1 WHERE id = $2`, [firstBatchId, item.id]);
        }
        summary.push({ productId: item.product_id, requested: Number(item.approved_quantity ?? item.quantity ?? 0), reserved });
    }
    return summary;
}

/**
 * Release all reservations for an order (e.g. on cancel/reject before shipping).
 */
async function releaseOrderReservations(client, orderId) {
    const { rows } = await client.query(
        `SELECT batch_id, qty_reserved FROM reserved_stock WHERE order_id = $1 AND order_type = $2`,
        [orderId, ORDER_TYPE]
    );
    for (const r of rows) {
        await client.query(
            `UPDATE batches SET reserved_qty = GREATEST(COALESCE(reserved_qty, 0) - $1, 0) WHERE id = $2`,
            [r.qty_reserved, r.batch_id]
        );
    }
    await client.query(`DELETE FROM reserved_stock WHERE order_id = $1 AND order_type = $2`, [orderId, ORDER_TYPE]);
}

/**
 * Ship an order: convert reservations into physical stock-OUT movements.
 * Decrements batches.stock via ledgerHelper, releases reserved_qty, and records shipped qty.
 * Falls back to FIFO allocation if no reservation exists.
 */
async function shipOrderStock(client, order, items, userId) {
    const { rows: reserved } = await client.query(
        `SELECT rs.batch_id, rs.qty_reserved, b.product_id
         FROM reserved_stock rs JOIN batches b ON b.id = rs.batch_id
         WHERE rs.order_id = $1 AND rs.order_type = $2`,
        [order.id, ORDER_TYPE]
    );

    const shippedByProduct = {};

    const moveOut = async (batchId, productId, qty) => {
        await ledgerHelper.postToStockLedger(client, {
            companyId: order.company_id || 1,
            godownId: order.godown_id || null,
            productId,
            batchId,
            movementType: 'OUT',
            referenceType: 'Order Shipment',
            referenceId: order.id,
            referenceNumber: order.order_number,
            quantity: qty,
            movementDate: new Date().toISOString().slice(0, 10),
            narration: `OMS dispatch: ${order.order_number}`,
            createdBy: userId || null
        });
        shippedByProduct[productId] = (shippedByProduct[productId] || 0) + qty;
    };

    if (reserved.length > 0) {
        for (const r of reserved) {
            await moveOut(r.batch_id, r.product_id, Number(r.qty_reserved));
            // Release the reservation now that the units have physically left
            await client.query(
                `UPDATE batches SET reserved_qty = GREATEST(COALESCE(reserved_qty, 0) - $1, 0) WHERE id = $2`,
                [r.qty_reserved, r.batch_id]
            );
        }
        await client.query(`DELETE FROM reserved_stock WHERE order_id = $1 AND order_type = $2`, [order.id, ORDER_TYPE]);
    } else {
        // No reservation — allocate FIFO from physical stock at ship time
        for (const item of items) {
            if (!item.product_id) continue;
            let toShip = Number(item.approved_quantity ?? item.quantity ?? 0);
            const { rows: batches } = await client.query(
                `SELECT id, stock FROM batches WHERE product_id = $1 AND stock > 0 ORDER BY expiry_date ASC, created_at ASC`,
                [item.product_id]
            );
            for (const batch of batches) {
                if (toShip <= 0) break;
                const alloc = Math.min(toShip, Number(batch.stock));
                if (alloc <= 0) continue;
                await moveOut(batch.id, item.product_id, alloc);
                toShip -= alloc;
            }
        }
    }

    // Persist shipped quantity per product line
    for (const [productId, qty] of Object.entries(shippedByProduct)) {
        await client.query(
            `UPDATE order_items SET shipped_quantity = $1 WHERE order_id = $2 AND product_id = $3`,
            [qty, order.id, productId]
        );
    }
}

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/stats', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const { rows } = await db.query(`
            SELECT
                COUNT(*)::int AS total_orders,
                COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending_orders,
                COUNT(*) FILTER (WHERE status IN ('Approved','Processing'))::int AS active_orders,
                COUNT(*) FILTER (WHERE status = 'Shipped')::int AS shipped_orders,
                COUNT(*) FILTER (WHERE status = 'Delivered')::int AS delivered_orders,
                COUNT(*) FILTER (WHERE status = 'Invoiced')::int AS invoiced_orders,
                COUNT(*) FILTER (WHERE ai_risk_level = 'High')::int AS at_risk_orders,
                COALESCE(SUM(total_amount), 0) AS total_value,
                COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('Rejected','Cancelled')), 0) AS open_value
            FROM orders WHERE company_id = $1
        `, [companyId]);
        const s = rows[0];
        const fulfilled = (s.delivered_orders || 0) + (s.invoiced_orders || 0);
        s.fulfillment_rate = s.total_orders > 0 ? Number(((fulfilled / s.total_orders) * 100).toFixed(1)) : 0;
        res.json({ success: true, data: s });
    } catch (error) {
        logger.error('OMS stats failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// DROPDOWN DATA
// ============================================
router.get('/dropdown', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const distributors = await db.query(
            `SELECT id, name, id AS value, name AS label, credit_limit, current_balance
             FROM parties WHERE type = 'Debtor' ORDER BY name`
        );
        const godowns = await db.query(
            `SELECT id, name, id AS value, name AS label FROM godowns WHERE COALESCE(status,'Active') <> 'Inactive' ORDER BY name`
        ).catch(() => ({ rows: [] }));

        const statuses = [
            { value: 'ALL', label: 'All Statuses' },
            { value: 'Pending Approval', label: 'Pending Approval' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Processing', label: 'Processing' },
            { value: 'Shipped', label: 'Shipped' },
            { value: 'Delivered', label: 'Delivered' },
            { value: 'Invoiced', label: 'Invoiced' },
            { value: 'Hold', label: 'Hold' },
            { value: 'Rejected', label: 'Rejected' },
            { value: 'Cancelled', label: 'Cancelled' }
        ];

        const priorities = [
            { value: 'Normal', label: 'Normal' },
            { value: 'High', label: 'High' },
            { value: 'Urgent', label: 'Urgent' }
        ];

        res.json({
            success: true,
            distributors: distributors.rows,
            godowns: godowns.rows,
            statuses,
            priorities,
            data: {
                distributors: distributors.rows,
                godowns: godowns.rows,
                statuses,
                priorities
            }
        });
    } catch (error) {
        logger.error('OMS dropdown failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// LIST ORDERS (filters + pagination)
// ============================================
router.get('/', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { search = '', status = 'ALL', priority = 'ALL', page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            where += ` AND (o.distributor_name ILIKE $${params.length} OR o.order_number ILIKE $${params.length})`;
        }
        if (status && status !== 'ALL') {
            params.push(status);
            where += ` AND o.status = $${params.length}`;
        }
        if (priority && priority !== 'ALL') {
            params.push(priority);
            where += ` AND o.priority = $${params.length}`;
        }

        const countResult = await db.query(`SELECT COUNT(*) FROM orders o ${where}`, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const listParams = [...params, limit, offset];
        const result = await db.query(`
            SELECT
                o.id,
                o.order_number AS "orderNumber",
                o.distributor_id AS "distributorId",
                o.distributor_name AS "distributorName",
                o.order_date AS "date",
                o.expected_delivery_date AS "expectedDeliveryDate",
                o.total_amount AS "totalAmount",
                o.status,
                o.priority,
                o.credit_status AS "creditStatus",
                o.fulfillment_status AS "fulfillmentStatus",
                o.ai_risk_score AS "aiRiskScore",
                o.ai_risk_level AS "aiRiskLevel",
                o.ai_recommendation AS "aiRecommendation",
                o.sales_invoice_id AS "salesInvoiceId",
                (SELECT COUNT(*) FROM order_items WHERE order_id = o.id)::int AS "itemCount"
            FROM orders o
            ${where}
            ORDER BY o.order_date DESC, o.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, listParams);

        res.json({
            success: true,
            orders: result.rows,
            data: result.rows,
            total,
            page: parseInt(page, 10),
            pageSize: parseInt(limit, 10),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        logger.error('OMS list failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// ORDER DETAIL (items + history + shipments)
// ============================================
router.get('/:id', verifyTokenMiddleware, asyncRoute(async (req, res, next) => {
    try {
        const { id } = req.params;
        const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        if (!isUUID(id)) {
            return next();
        }
        const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const items = await db.query(`
            SELECT oi.*,
                   COALESCE((SELECT SUM(available_qty) FROM batches WHERE product_id = oi.product_id), 0)::int AS available
            FROM order_items oi WHERE oi.order_id = $1 ORDER BY oi.created_at ASC`, [id]);

        const history = await db.query(
            `SELECT h.*, u.name AS changed_by_name
             FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by
             WHERE h.order_id = $1 ORDER BY h.changed_at ASC`, [id]
        );

        const shipments = await db.query(
            'SELECT * FROM order_shipments WHERE order_id = $1 ORDER BY created_at DESC', [id]
        );

        res.json({
            success: true,
            data: {
                ...orderResult.rows[0],
                order: orderResult.rows[0],
                items: items.rows,
                statusHistory: history.rows,
                shipments: shipments.rows
            }
        });
    } catch (error) {
        logger.error('OMS detail failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// CREATE ORDER
// ============================================
router.post('/', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const {
            distributorId, distributorName, items = [],
            packingSpecs, labelingSpecs, priority, remarks,
            godownId, expectedDeliveryDate, discountAmount = 0
        } = req.body;

        if (!distributorId || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Distributor and at least one item are required' });
        }

        await client.query('BEGIN');

        let subtotal = 0, taxAmount = 0;
        for (const item of items) {
            const amount = Number(item.quantity) * Number(item.rate);
            subtotal += amount;
            taxAmount += amount * (Number(item.gstPercent || 0) / 100);
        }
        const totalAmount = subtotal + taxAmount - Number(discountAmount || 0);

        const orderResult = await client.query(
            `INSERT INTO orders (
                distributor_id, distributor_name, subtotal, tax_amount, discount_amount, total_amount,
                packing_specs, labeling_specs, priority, remarks, godown_id, expected_delivery_date,
                company_id, created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING id, order_number`,
            [
                distributorId, distributorName, subtotal, taxAmount, Number(discountAmount || 0), totalAmount,
                packingSpecs, labelingSpecs, priority || 'Normal', remarks, godownId || null,
                expectedDeliveryDate || null, req.user.companyId || 1, req.user.userId || null
            ]
        );
        const order = orderResult.rows[0];

        for (const item of items) {
            const amount = Number(item.quantity) * Number(item.rate);
            await client.query(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, approved_quantity, rate, amount, gst_percent)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [order.id, item.productId, item.productName, item.quantity, item.quantity, item.rate, amount, item.gstPercent || 0]
            );
        }

        await logStatus(client, order.id, null, 'Pending Approval', 'Order created', req.user.userId);
        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: { id: order.id, orderNumber: order.order_number },
            message: `Order ${order.order_number} placed successfully`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS create failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// APPROVE ORDER (set approved quantities + reserve stock)
// ============================================
router.put('/:id/approve', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        const { approvals = [], note } = req.body; // approvals: [{ itemId, approvedQuantity }]

        await client.query('BEGIN');

        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        if (!TRANSITIONS[order.status]?.includes('Approved')) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `Cannot approve an order in '${order.status}' state` });
        }

        // Apply any per-item approved quantity overrides
        for (const a of approvals) {
            if (a.itemId != null) {
                await client.query(
                    'UPDATE order_items SET approved_quantity = $1 WHERE id = $2 AND order_id = $3',
                    [a.approvedQuantity, a.itemId, id]
                );
            }
        }

        const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        const reservation = await reserveOrderStock(client, order, itemsRes.rows);

        await client.query(
            `UPDATE orders SET status = 'Approved', approved_at = CURRENT_TIMESTAMP,
                    fulfillment_status = 'Reserved', updated_by = $2 WHERE id = $1`,
            [id, req.user.userId || null]
        );
        await logStatus(client, id, order.status, 'Approved', note || 'Approved & stock reserved', req.user.userId);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Order approved and stock reserved', reservation });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS approve failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// STATUS TRANSITION (Processing / Shipped / Delivered / Hold / Rejected / Cancelled)
// ============================================
router.put('/:id/status', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        const { status: target, note, carrier, trackingNumber } = req.body;

        await client.query('BEGIN');
        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        const allowed = TRANSITIONS[order.status] || [];
        if (!allowed.includes(target)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `Invalid transition: ${order.status} -> ${target}` });
        }

        const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);

        if (target === 'Approved') {
            await reserveOrderStock(client, order, itemsRes.rows);
            await client.query(
                `UPDATE orders SET status = $2, approved_at = CURRENT_TIMESTAMP, fulfillment_status = 'Reserved', updated_by = $3 WHERE id = $1`,
                [id, target, req.user.userId || null]
            );
        } else if (target === 'Shipped') {
            await shipOrderStock(client, order, itemsRes.rows, req.user.userId);
            await client.query(
                `UPDATE orders SET status = 'Shipped', shipped_at = CURRENT_TIMESTAMP, fulfillment_status = 'Fulfilled', updated_by = $2 WHERE id = $1`,
                [id, req.user.userId || null]
            );
            await client.query(
                `INSERT INTO order_shipments (order_id, carrier, tracking_number, status, created_by)
                 VALUES ($1, $2, $3, 'Dispatched', $4)`,
                [id, carrier || 'Standard Logistics', trackingNumber || null, req.user.userId || null]
            );
        } else if (target === 'Delivered') {
            await client.query(
                `UPDATE orders SET status = 'Delivered', delivered_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE id = $1`,
                [id, req.user.userId || null]
            );
            await client.query(
                `UPDATE order_shipments SET status = 'Delivered', delivered_at = CURRENT_TIMESTAMP
                 WHERE order_id = $1 AND status <> 'Delivered'`, [id]
            );
        } else if (target === 'Rejected' || target === 'Cancelled') {
            // Release any reservations that were taken at approval
            await releaseOrderReservations(client, id);
            await client.query(
                `UPDATE orders SET status = $2, fulfillment_status = 'Unfulfilled', updated_by = $3 WHERE id = $1`,
                [id, target, req.user.userId || null]
            );
        } else {
            // Processing / Hold — simple status move
            await client.query(`UPDATE orders SET status = $2, updated_by = $3 WHERE id = $1`,
                [id, target, req.user.userId || null]);
        }

        await logStatus(client, id, order.status, target, note, req.user.userId);
        await client.query('COMMIT');
        res.json({ success: true, message: `Order moved to '${target}'` });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS status transition failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// AI: ORDER RISK SCORING
// ============================================
router.post('/:id/ai-risk', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { id } = req.params;
        const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });
        const order = orderRes.rows[0];

        const itemsRes = await db.query(`
            SELECT oi.*, COALESCE((SELECT SUM(available_qty) FROM batches WHERE product_id = oi.product_id), 0)::int AS available
            FROM order_items oi WHERE oi.order_id = $1`, [id]);
        const distRes = await db.query('SELECT * FROM parties WHERE id = $1', [order.distributor_id]);

        const stockSummary = itemsRes.rows.map(i => ({
            productName: i.product_name,
            required: Number(i.approved_quantity ?? i.quantity),
            available: Number(i.available)
        }));

        const ai = await aiAgent.analyzeOrderRisk(order, itemsRes.rows, distRes.rows[0] || {}, stockSummary);

        const updated = await db.query(
            `UPDATE orders SET ai_risk_score = $1, ai_risk_level = $2, ai_recommendation = $3, ai_insight = $4
             WHERE id = $5 RETURNING ai_risk_score, ai_risk_level, ai_recommendation, ai_insight`,
            [ai.riskScore, ai.riskLevel, ai.recommendation, ai.reason, id]
        );

        res.json({ success: true, ai, order: updated.rows[0] });
    } catch (error) {
        logger.error('OMS AI risk failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// AI: FULFILLMENT FEASIBILITY
// ============================================
router.get('/:id/ai-fulfillment', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { id } = req.params;
        const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

        const itemsRes = await db.query(`
            SELECT oi.*, COALESCE((SELECT SUM(available_qty) FROM batches WHERE product_id = oi.product_id), 0)::int AS available
            FROM order_items oi WHERE oi.order_id = $1`, [id]);

        const stockLevels = itemsRes.rows.map(i => ({
            productId: i.product_id,
            productName: i.product_name,
            required: Number(i.approved_quantity ?? i.quantity),
            available: Number(i.available)
        }));

        const ai = await aiAgent.forecastFulfillment(orderRes.rows[0], itemsRes.rows, stockLevels);
        res.json({ success: true, data: ai });
    } catch (error) {
        logger.error('OMS AI fulfillment failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// AI: CONFIRMATION DRAFT
// ============================================
router.get('/:id/ai-confirmation', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { id } = req.params;
        const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

        const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        const distRes = await db.query('SELECT * FROM parties WHERE id = $1', [orderRes.rows[0].distributor_id]);

        const draft = await aiAgent.draftOrderConfirmation(orderRes.rows[0], itemsRes.rows, distRes.rows[0] || {});
        res.json({ success: true, data: { draft } });
    } catch (error) {
        logger.error('OMS AI confirmation failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// AI: PORTFOLIO INSIGHTS
// ============================================
router.post('/ai/insights', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const orders = await db.query(`
            SELECT id, order_number, distributor_name, status, priority, total_amount, ai_risk_level
            FROM orders WHERE status NOT IN ('Rejected','Cancelled') ORDER BY order_date DESC LIMIT 100`);
        const distributors = await db.query(
            `SELECT id, name, credit_limit, current_balance FROM parties WHERE type = 'Debtor' LIMIT 100`);
        let demand = { rows: [] };
        try { demand = await db.query('SELECT * FROM regional_pharmaceutical_demand LIMIT 50'); } catch (_) { /* optional table */ }

        const insights = await aiAgent.generatePortfolioInsights(orders.rows, distributors.rows, demand.rows);
        res.json({ success: true, data: insights });
    } catch (error) {
        logger.error('OMS AI insights failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// CONVERT DELIVERED ORDER -> SALES INVOICE (Order-to-Cash)
// ============================================
router.post('/:id/convert-to-invoice', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        const companyId = req.user.companyId || 1;
        const userId = req.user.userId || null;

        await client.query('BEGIN');
        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        if (order.status !== 'Delivered') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Only Delivered orders can be converted to an invoice' });
        }
        if (order.sales_invoice_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Order already invoiced' });
        }

        const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        const items = itemsRes.rows;

        const subTotal = Number(order.subtotal) || items.reduce((s, i) => s + Number(i.amount), 0);
        const totalGst = Number(order.tax_amount) || 0;
        const totalDiscount = Number(order.discount_amount) || 0;
        const netAmount = Number(order.total_amount);
        const invoiceNumber = `INV-${order.order_number}`;
        const today = new Date().toISOString().slice(0, 10);

        // 1. Sales Invoice header
        const invRes = await client.query(
            `INSERT INTO sales_invoices (
                company_id, party_id, invoice_number, date, customer_name, payment_mode,
                sub_total, taxable_value, total_gst, total_discount, round_off, net_amount, status, created_by, source_type
            ) VALUES ($1,$2,$3,$4,$5,'Credit',$6,$7,$8,$9,0,$10,'Completed',$11,'OMS')
            RETURNING id`,
            [companyId, order.distributor_id, invoiceNumber, today, order.distributor_name,
             subTotal, subTotal, totalGst, totalDiscount, netAmount, userId]
        );
        const invoiceId = invRes.rows[0].id;

        // 2. Invoice items (NO stock movement — already decremented at Ship)
        for (const item of items) {
            const qty = Number(item.shipped_quantity || item.approved_quantity || item.quantity);
            await client.query(
                `INSERT INTO sales_invoice_items (
                    invoice_id, product_id, batch_id, quantity, mrp, rate,
                    discount_percent, discount_amount, taxable_value, gst_percent, total_amount
                ) VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9)`,
                [invoiceId, item.product_id, item.batch_id || null, qty, item.rate, item.rate,
                 Number(item.amount), Number(item.gst_percent || 0), Number(item.amount)]
            );
        }

        // 3. Sales Journal Voucher + GL postings (best-effort — skipped if COA not seeded)
        const salesAcct = await ledgerHelper.findAccount(client, companyId, 'Sales');
        const debtorAcct = await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors');
        const taxAcct = await ledgerHelper.findAccount(client, companyId, 'GST Payable');

        if (salesAcct && debtorAcct) {
            const jvRes = await client.query(
                `INSERT INTO journal_vouchers (
                    company_id, party_id, voucher_type, voucher_no, voucher_date,
                    narration, total_debit, total_credit, status, created_by
                ) VALUES ($1,$2,'Sales',$3,$4,$5,$6,$6,'Posted',$7) RETURNING id`,
                [companyId, order.distributor_id, invoiceNumber, today,
                 `OMS Sales Invoice ${invoiceNumber}`, netAmount, userId]
            );
            const voucherId = jvRes.rows[0].id;

            await ledgerHelper.postToGeneralLedger(client, {
                accountId: debtorAcct, partyId: order.distributor_id, voucherId, voucherType: 'Sales',
                transactionDate: today, debit: netAmount, credit: 0, narration: `Invoice ${invoiceNumber}`
            });
            await ledgerHelper.postToGeneralLedger(client, {
                accountId: salesAcct, voucherId, voucherType: 'Sales',
                transactionDate: today, debit: 0, credit: subTotal, narration: `Taxable Sales: ${invoiceNumber}`
            });
            if (totalGst > 0 && taxAcct) {
                await ledgerHelper.postToGeneralLedger(client, {
                    accountId: taxAcct, voucherId, voucherType: 'Sales',
                    transactionDate: today, debit: 0, credit: totalGst, narration: `GST on Sales: ${invoiceNumber}`
                });
            }
            await client.query('UPDATE sales_invoices SET voucher_id = $1 WHERE id = $2', [voucherId, invoiceId]);
        } else {
            logger.warn('OMS convert-to-invoice: COA accounts missing, skipped GL posting', { order: order.order_number });
        }

        // 4. Link order -> invoice and mark Invoiced
        await client.query(
            `UPDATE orders SET status = 'Invoiced', fulfillment_status = 'Invoiced',
                    sales_invoice_id = $2, updated_by = $3 WHERE id = $1`,
            [id, invoiceId, userId]
        );
        await logStatus(client, id, order.status, 'Invoiced', `Invoice ${invoiceNumber} generated`, userId);

        await client.query('COMMIT');
        res.json({ success: true, data: { invoiceId, invoiceNumber }, message: `Invoice ${invoiceNumber} generated` });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS convert-to-invoice failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// CANCEL ORDER (release reservations)
// ============================================
router.delete('/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'MANAGER']), asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        if (['Shipped', 'Delivered', 'Invoiced'].includes(order.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `Cannot cancel an order already '${order.status}'` });
        }

        await releaseOrderReservations(client, id);
        await client.query(
            `UPDATE orders SET status = 'Cancelled', fulfillment_status = 'Unfulfilled', updated_by = $2 WHERE id = $1`,
            [id, req.user.userId || null]
        );
        await logStatus(client, id, order.status, 'Cancelled', 'Order cancelled', req.user.userId);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Order cancelled' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS cancel failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// ANALYTICS: AGGREGATE STATS (real-time SQL, not mat views)
// ============================================
router.get('/analytics', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const monthlyTrendRes = await db.query(`
            SELECT
                to_char(date_trunc('month', order_date), 'YYYY-MM') AS month,
                COUNT(*)::int                                          AS total_orders,
                COALESCE(SUM(total_amount), 0)                         AS total_amount,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'Invoiced'), 0) AS invoiced_amount
            FROM orders
            WHERE order_date >= date_trunc('month', NOW() - INTERVAL '11 months')
            GROUP BY date_trunc('month', order_date)
            ORDER BY date_trunc('month', order_date) ASC
        `);

        const distPerfRes = await db.query(`
            SELECT
                distributor_id,
                distributor_name,
                COUNT(*)::int                        AS total_orders,
                COALESCE(SUM(total_amount), 0)        AS total_value,
                COUNT(*) FILTER (WHERE status IN ('Delivered','Invoiced'))::int AS completed_count,
                COUNT(*) FILTER (WHERE status = 'Cancelled')::int               AS cancelled_count
            FROM orders
            GROUP BY distributor_id, distributor_name
            ORDER BY total_value DESC
            LIMIT 10
        `);

        const statusRes = await db.query(`
            SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total_value
            FROM orders
            GROUP BY status
            ORDER BY count DESC
        `);

        res.json({
            success: true,
            data: {
                monthlyTrend: monthlyTrendRes.rows,
                distributorPerformance: distPerfRes.rows,
                statusBreakdown: statusRes.rows
            }
        });
    } catch (error) {
        logger.error('OMS analytics failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// ANALYTICS: SLA BREACH LIST
// ============================================
router.get('/analytics/sla', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                id,
                order_number,
                distributor_name,
                status,
                priority,
                order_date,
                (CURRENT_DATE - order_date)::int AS days_open,
                total_amount
            FROM orders
            WHERE status NOT IN ('Delivered', 'Invoiced', 'Rejected', 'Cancelled')
              AND order_date < CURRENT_DATE - INTERVAL '7 days'
            ORDER BY (CURRENT_DATE - order_date) DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('OMS analytics SLA failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// ANALYTICS: CSV EXPORT
// ============================================
router.get('/analytics/export', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                o.order_number,
                o.distributor_name,
                o.order_date,
                o.status,
                o.priority,
                o.subtotal,
                o.tax_amount,
                o.discount_amount,
                o.total_amount,
                o.fulfillment_status,
                o.ai_risk_score,
                o.ai_risk_level,
                o.ai_recommendation,
                o.expected_delivery_date,
                o.approved_at,
                o.shipped_at,
                o.delivered_at,
                o.created_at
            FROM orders o
            ORDER BY o.order_date DESC, o.created_at DESC
        `);

        const today = new Date().toISOString().slice(0, 10);
        const headers = [
            'order_number', 'distributor_name', 'order_date', 'status', 'priority',
            'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'fulfillment_status',
            'ai_risk_score', 'ai_risk_level', 'ai_recommendation', 'expected_delivery_date',
            'approved_at', 'shipped_at', 'delivered_at', 'created_at'
        ];

        const escape = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const csvLines = [
            headers.join(','),
            ...result.rows.map(row => headers.map(h => escape(row[h])).join(','))
        ];
        const csv = csvLines.join('\r\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="oms-export-${today}.csv"`);
        res.send(csv);
    } catch (error) {
        logger.error('OMS analytics export failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// RETURNS: LIST ALL RETURNS (before /:id to avoid route conflicts)
// ============================================
router.get('/returns', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                r.id,
                r.return_number,
                r.order_id,
                o.order_number,
                r.return_date,
                r.reason,
                r.status,
                r.credit_note_id,
                r.created_at,
                p.name AS distributor_name,
                (SELECT COUNT(*) FROM order_return_items WHERE return_id = r.id)::int AS items_count
            FROM order_returns r
            JOIN orders o ON o.id = r.order_id
            LEFT JOIN parties p ON p.id = o.distributor_id
            ORDER BY r.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('OMS returns list failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// RETURNS: APPROVE A RETURN (restock + credit note)
// ============================================
router.put('/returns/:returnId/approve', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { returnId } = req.params;
        const userId = req.user.userId || null;

        await client.query('BEGIN');

        // Lock the return record
        const retRes = await client.query(
            `SELECT r.*, o.distributor_id, o.distributor_name, o.company_id, o.order_number, o.id AS order_id_val
             FROM order_returns r
             JOIN orders o ON o.id = r.order_id
             WHERE r.id = $1 FOR UPDATE`,
            [returnId]
        );
        if (retRes.rows.length === 0) throw new Error('Return not found');
        const ret = retRes.rows[0];

        if (ret.status !== 'Pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `Return is already in '${ret.status}' state` });
        }

        // Load return items — JOIN order_items to pull gst_percent
        const itemsRes = await client.query(
            `SELECT ori.*, COALESCE(oi.gst_percent, 0) AS gst_percent
             FROM order_return_items ori
             LEFT JOIN order_items oi ON oi.id = ori.order_item_id
             WHERE ori.return_id = $1`,
            [returnId]
        );
        const items = itemsRes.rows;

        let totalCreditTaxable = 0;
        let totalCreditGst = 0;

        // Process stock-IN for restockable items
        for (const item of items) {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            const gstPct = Number(item.gst_percent || 0);
            const taxable = qty * rate;
            totalCreditTaxable += taxable;
            totalCreditGst += parseFloat((taxable * gstPct / 100).toFixed(2));

            if (item.restock && item.product_id && qty > 0) {
                const batchId = item.batch_id;
                // Use the first available batch for this product if no specific batch
                let targetBatchId = batchId;
                if (!targetBatchId) {
                    const batchRes = await client.query(
                        `SELECT id FROM batches WHERE product_id = $1 ORDER BY expiry_date ASC LIMIT 1`,
                        [item.product_id]
                    );
                    if (batchRes.rows.length > 0) targetBatchId = batchRes.rows[0].id;
                }

                if (targetBatchId) {
                    await ledgerHelper.postToStockLedger(client, {
                        companyId: ret.company_id || 1,
                        godownId: null,
                        productId: item.product_id,
                        batchId: targetBatchId,
                        movementType: 'IN',
                        referenceType: 'Order Return',
                        referenceId: ret.order_id,
                        referenceNumber: ret.return_number,
                        quantity: qty,
                        movementDate: new Date().toISOString().slice(0, 10),
                        narration: `Return restock: ${ret.return_number}`,
                        createdBy: userId
                    });
                }
            }
        }

        const totalCreditAmount = totalCreditTaxable + totalCreditGst;

        // Create Credit Note in sales_invoices
        const cnNumber = `CN-${ret.return_number}`;
        const today = new Date().toISOString().slice(0, 10);
        const cnRes = await client.query(
            `INSERT INTO sales_invoices (
                company_id, party_id, invoice_number, date, customer_name, payment_mode,
                sub_total, taxable_value, total_gst, total_discount, round_off,
                net_amount, status, created_by, source_type
             ) VALUES ($1, $2, $3, $4, $5, 'Credit', $6, $6, $7, 0, 0, $8, 'Completed', $9, 'OMS')
             RETURNING id`,
            [
                ret.company_id || 1,
                ret.distributor_id,
                cnNumber,
                today,
                ret.distributor_name,
                totalCreditTaxable,
                totalCreditGst,
                totalCreditAmount,
                userId
            ]
        );
        const creditNoteId = cnRes.rows[0].id;

        // Insert credit note items with correct gst_percent from original order items
        for (const item of items) {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            const taxable = qty * rate;
            const gstPct = Number(item.gst_percent || 0);
            await client.query(
                `INSERT INTO sales_invoice_items (
                    invoice_id, product_id, batch_id, quantity, mrp, rate,
                    discount_percent, discount_amount, taxable_value, gst_percent, total_amount
                 ) VALUES ($1, $2, $3, $4, $5, $5, 0, 0, $6, $7, $6)`,
                [creditNoteId, item.product_id, item.batch_id || null, qty, rate, taxable, gstPct]
            );
        }

        // Determine final status
        const hasRestock = items.some(i => i.restock);
        const finalStatus = hasRestock ? 'Restocked' : 'Credit Issued';

        // Update order_returns
        await client.query(
            `UPDATE order_returns SET status = $1, credit_note_id = $2, updated_at = NOW() WHERE id = $3`,
            [finalStatus, creditNoteId, returnId]
        );

        // Log to audit_logs
        try {
            await client.query(
                `INSERT INTO audit_logs (action, table_name, record_id, changes, user_id, created_at)
                 VALUES ('OMS_RETURN_APPROVED', 'order_returns', $1, $2, $3, NOW())`,
                [returnId, JSON.stringify({ returnNumber: ret.return_number, creditNoteId, creditAmount: totalCreditAmount, status: finalStatus }), userId]
            );
        } catch (_) { /* audit_logs column mismatch — non-fatal */ }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Return approved. Credit Note ${cnNumber} issued for ₹${totalCreditAmount.toFixed(2)}`,
            data: { creditNoteId, cnNumber, creditAmount: totalCreditAmount, status: finalStatus }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS return approve failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// OUTSTANDING: AR AGING PER DISTRIBUTOR
// ============================================
router.get('/outstanding', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                o.distributor_id,
                o.distributor_name,
                COALESCE(p.current_balance, 0)                                            AS current_balance,
                COALESCE(SUM(o.total_amount) FILTER (WHERE CURRENT_DATE - o.order_date <= 30), 0)  AS orders_0_30,
                COALESCE(SUM(o.total_amount) FILTER (WHERE CURRENT_DATE - o.order_date BETWEEN 31 AND 60), 0) AS orders_31_60,
                COALESCE(SUM(o.total_amount) FILTER (WHERE CURRENT_DATE - o.order_date BETWEEN 61 AND 90), 0) AS orders_61_90,
                COALESCE(SUM(o.total_amount) FILTER (WHERE CURRENT_DATE - o.order_date > 90), 0)   AS orders_91plus,
                COALESCE(SUM(o.total_amount), 0)                                          AS total_invoiced_unpaid
            FROM orders o
            LEFT JOIN parties p ON p.id = o.distributor_id
            WHERE o.status = 'Invoiced'
            GROUP BY o.distributor_id, o.distributor_name, p.current_balance
            ORDER BY total_invoiced_unpaid DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('OMS outstanding failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// OUTSTANDING: DISTRIBUTOR STATEMENT (before /:id/... routes)
// ============================================
router.get('/outstanding/:distId/statement', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { distId } = req.params;

        const distResult = await db.query(
            `SELECT id, name, credit_limit, current_balance FROM parties WHERE id = $1`,
            [distId]
        );
        if (distResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Distributor not found' });
        }
        const distributor = distResult.rows[0];

        const ordersResult = await db.query(
            `SELECT
                id, order_number, order_date, total_amount, status,
                fulfillment_status, sales_invoice_id,
                (CURRENT_DATE - order_date)::int AS days_old
             FROM orders
             WHERE distributor_id = $1
             ORDER BY order_date DESC`,
            [distId]
        );

        const invoicedOrders = ordersResult.rows.filter(o => o.status === 'Invoiced');
        const totalOutstanding = invoicedOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

        res.json({
            success: true,
            data: {
                distributor,
                orders: ordersResult.rows,
                totalOutstanding,
                creditLimit: Number(distributor.credit_limit || 0)
            }
        });
    } catch (error) {
        logger.error('OMS outstanding statement failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// AI: PREDICT NEXT ORDERS
// ============================================
router.post('/ai/predict-orders', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        // Fetch last 90 days completed/invoiced orders with items
        const ordersRes = await db.query(`
            SELECT
                o.id, o.order_number, o.distributor_id, o.distributor_name,
                o.order_date, o.total_amount, o.status
            FROM orders o
            WHERE o.status IN ('Invoiced', 'Delivered')
              AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'
            ORDER BY o.order_date DESC
        `);

        // Enrich with items
        const orders = [];
        for (const order of ordersRes.rows) {
            const itemsRes = await db.query(
                `SELECT product_id, product_name, quantity, approved_quantity FROM order_items WHERE order_id = $1`,
                [order.id]
            );
            orders.push({ ...order, items: itemsRes.rows });
        }

        const distributorsRes = await db.query(
            `SELECT id, name FROM parties WHERE type = 'Debtor' ORDER BY name`
        );

        const result = await aiAgent.predictNextOrders(orders, distributorsRes.rows);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('OMS AI predict-orders failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// AI: AUTO-REORDER SUGGESTIONS
// ============================================
router.post('/ai/auto-reorder', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        // Fetch open orders (not terminal) with items
        const openOrdersRes = await db.query(`
            SELECT id, order_number, distributor_id, distributor_name, status
            FROM orders
            WHERE status NOT IN ('Delivered', 'Invoiced', 'Rejected', 'Cancelled')
        `);

        const openOrders = [];
        for (const order of openOrdersRes.rows) {
            const itemsRes = await db.query(
                `SELECT product_id, product_name, quantity, approved_quantity FROM order_items WHERE order_id = $1`,
                [order.id]
            );
            openOrders.push({
                ...order,
                items: itemsRes.rows.map(i => ({
                    productId: i.product_id,
                    productName: i.product_name,
                    quantity: Number(i.approved_quantity || i.quantity || 0)
                }))
            });
        }

        // Current inventory: products with batch stock + reorder_level
        const inventoryRes = await db.query(`
            SELECT
                p.id          AS "productId",
                p.name        AS "productName",
                COALESCE(SUM(b.available_qty), 0)::int AS "availableQty",
                COALESCE(p.reorder_level, 0)::int      AS "reorderLevel"
            FROM products p
            LEFT JOIN batches b ON b.product_id = p.id
            WHERE p.deleted_at IS NULL AND (p.is_active = TRUE OR p.is_active IS NULL)
            GROUP BY p.id, p.name, p.reorder_level
        `);

        const result = await aiAgent.suggestAutoReorder(openOrders, inventoryRes.rows);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('OMS AI auto-reorder failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// SLA BREACHES: CURRENT VIOLATIONS
// ============================================
router.get('/sla-breaches', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                o.id                                                          AS "orderId",
                o.order_number                                                AS "orderNumber",
                o.distributor_name                                            AS "distributorName",
                o.status,
                o.priority,
                ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600, 1)  AS "hoursOpen",
                sla.max_hours                                                 AS "maxHours",
                sla.severity,
                sla.escalate_to_role                                          AS "escalateToRole",
                sla.notification_message                                      AS "message"
            FROM orders o
            JOIN oms_sla_rules sla ON sla.status = o.status AND sla.is_active = TRUE
            WHERE o.status NOT IN ('Delivered', 'Invoiced', 'Rejected', 'Cancelled')
              AND EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 > sla.max_hours
            ORDER BY "hoursOpen" DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('OMS SLA breaches query failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// PORTAL ACCESS: ENABLE / DISABLE (admin only, uses internal JWT)
// ============================================
router.put('/distributors/:distId/portal-access', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { distId } = req.params;
        const { enabled, username, password } = req.body;

        await client.query('BEGIN');

        const distRes = await client.query(
            `SELECT id, name, type FROM parties WHERE id = $1 FOR UPDATE`,
            [distId]
        );
        if (distRes.rows.length === 0) throw new Error('Distributor not found');

        if (enabled) {
            if (!username || !password) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'username and password are required to enable portal access' });
            }

            // SHA-256 hash the portal password
            const { createHash } = require('crypto');
            const passwordHash = createHash('sha256').update(password).digest('hex');

            await client.query(
                `UPDATE parties
                 SET portal_username = $1,
                     portal_password_hash = $2,
                     portal_enabled = TRUE
                 WHERE id = $3`,
                [username.trim(), passwordHash, distId]
            );

            await client.query('COMMIT');
            res.json({ success: true, message: `Portal access enabled for distributor. Username: ${username}` });
        } else {
            await client.query(
                `UPDATE parties SET portal_enabled = FALSE WHERE id = $1`,
                [distId]
            );
            await client.query('COMMIT');
            res.json({ success: true, message: 'Portal access disabled for distributor' });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS portal access update failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// CREATE RETURN FOR AN INVOICED ORDER
// Must come AFTER /returns and BEFORE /:id catch-all
// ============================================
router.post('/:id/return', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        const { items = [], reason } = req.body;
        const userId = req.user.userId || null;
        console.log('--- OMS CREATE RETURN CALLED ---', { id, itemsCount: items.length, items });

        if (items.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one return item is required' });
        }

        await client.query('BEGIN');

        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        if (order.status !== 'Invoiced') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Returns can only be created for Invoiced orders' });
        }

        // Validate return quantities against shipped quantities
        for (const item of items) {
            if (item.orderItemId) {
                const origRes = await client.query(
                    `SELECT shipped_quantity, quantity FROM order_items WHERE id = $1 AND order_id = $2`,
                    [item.orderItemId, id]
                );
                if (origRes.rows.length > 0) {
                    const maxReturnable = Number(origRes.rows[0].shipped_quantity || origRes.rows[0].quantity || 0);
                    if (Number(item.quantity) > maxReturnable) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            success: false,
                            error: `Return quantity ${item.quantity} exceeds shipped quantity ${maxReturnable} for item ${item.productName}`
                        });
                    }
                }
            }
        }

        // Create the return header
        const retRes = await client.query(
            `INSERT INTO order_returns (order_id, reason, created_by)
             VALUES ($1, $2, $3) RETURNING id, return_number`,
            [id, reason || null, userId]
        );
        const returnId = retRes.rows[0].id;
        const returnNumber = retRes.rows[0].return_number;

        // Insert return items
        for (const item of items) {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            const amount = qty * rate;
            await client.query(
                `INSERT INTO order_return_items (
                    return_id, order_item_id, product_id, product_name,
                    quantity, rate, amount, reason, condition, restock, batch_id
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [
                    returnId,
                    item.orderItemId || null,
                    item.productId || null,
                    item.productName || null,
                    qty,
                    rate,
                    amount,
                    item.reason || null,
                    item.condition || 'Good',
                    item.restock !== false,
                    item.batchId || null
                ]
            );
        }

        // Log status action
        try {
            await client.query(
                `INSERT INTO audit_logs (action, table_name, record_id, changes, user_id, created_at)
                 VALUES ('OMS_RETURN_CREATED', 'orders', $1, $2, $3, NOW())`,
                [id, JSON.stringify({ returnId, returnNumber, itemCount: items.length }), userId]
            );
        } catch (_) { /* non-fatal */ }

        await client.query('COMMIT');
        res.status(201).json({
            success: true,
            data: { id: returnId, returnId, returnNumber },
            message: `Return ${returnNumber} created successfully`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS create return failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

// ============================================
// GET RETURNS FOR A SPECIFIC ORDER
// ============================================
router.get('/:id/returns', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { id } = req.params;
        const returnsRes = await db.query(
            `SELECT r.*, COUNT(ri.id)::int AS items_count
             FROM order_returns r
             LEFT JOIN order_return_items ri ON ri.return_id = r.id
             WHERE r.order_id = $1
             GROUP BY r.id
             ORDER BY r.created_at DESC`,
            [id]
        );
        res.json({ success: true, data: returnsRes.rows });
    } catch (error) {
        logger.error('OMS order returns fetch failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// PARTIAL DISPATCH: POST /:id/dispatch
// ============================================
router.post('/:id/dispatch', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        const { items = [], carrier, trackingNumber, notes } = req.body;
        const userId = req.user.userId || null;

        if (items.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one dispatch item is required' });
        }

        await client.query('BEGIN');

        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        if (!['Approved', 'Processing', 'Partially Shipped'].includes(order.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot dispatch an order in '${order.status}' state`
            });
        }

        // Validate quantities and ship stock for each dispatched item
        let shipmentTotalValue = 0;
        const dispatchedItems = [];

        for (const item of items) {
            const qty = Number(item.quantity || 0);
            if (qty <= 0) continue;

            // Validate against remaining (approved - already shipped)
            if (item.orderItemId) {
                const origRes = await client.query(
                    `SELECT id, product_id, approved_quantity, shipped_quantity, rate
                     FROM order_items WHERE id = $1 AND order_id = $2`,
                    [item.orderItemId, id]
                );
                if (origRes.rows.length === 0) continue;
                const orig = origRes.rows[0];
                const remaining = Number(orig.approved_quantity || 0) - Number(orig.shipped_quantity || 0);
                if (qty > remaining) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        error: `Dispatch quantity ${qty} exceeds remaining quantity ${remaining} for ${item.productName}`
                    });
                }

                // Move stock OUT for this specific item/batch/qty
                const batchId = item.batchId || orig.batch_id || null;
                if (batchId && orig.product_id) {
                    await ledgerHelper.postToStockLedger(client, {
                        companyId: order.company_id || 1,
                        godownId: order.godown_id || null,
                        productId: orig.product_id || item.productId,
                        batchId,
                        movementType: 'OUT',
                        referenceType: 'Order Shipment',
                        referenceId: order.id,
                        referenceNumber: order.order_number,
                        quantity: qty,
                        movementDate: new Date().toISOString().slice(0, 10),
                        narration: `Partial dispatch: ${order.order_number}`,
                        createdBy: userId
                    });

                    // Release corresponding reservation
                    const reservedRes = await client.query(
                        `SELECT id, qty_reserved FROM reserved_stock
                         WHERE batch_id = $1 AND order_id = $2 AND order_type = 'SO'`,
                        [batchId, order.id]
                    );
                    if (reservedRes.rows.length > 0) {
                        const r = reservedRes.rows[0];
                        const releaseQty = Math.min(qty, Number(r.qty_reserved));
                        if (releaseQty > 0) {
                            await client.query(
                                `UPDATE reserved_stock SET qty_reserved = qty_reserved - $1 WHERE id = $2`,
                                [releaseQty, r.id]
                            );
                            await client.query(
                                `UPDATE batches SET reserved_qty = GREATEST(COALESCE(reserved_qty, 0) - $1, 0) WHERE id = $2`,
                                [releaseQty, batchId]
                            );
                        }
                        // Delete reservation if fully released
                        await client.query(
                            `DELETE FROM reserved_stock WHERE id = $1 AND qty_reserved <= 0`,
                            [r.id]
                        );
                    }
                }

                // Update order_items.shipped_quantity
                await client.query(
                    `UPDATE order_items SET shipped_quantity = COALESCE(shipped_quantity, 0) + $1 WHERE id = $2`,
                    [qty, item.orderItemId]
                );

                shipmentTotalValue += qty * Number(orig.rate || 0);
                dispatchedItems.push({
                    orderItemId: item.orderItemId,
                    productId: orig.product_id || item.productId,
                    productName: item.productName,
                    batchId: batchId,
                    quantityShipped: qty
                });
            }
        }

        // Create order_shipments record
        const shipmentRes = await client.query(
            `INSERT INTO order_shipments (order_id, carrier, tracking_number, status, total_value, remarks, created_by)
             VALUES ($1, $2, $3, 'Dispatched', $4, $5, $6) RETURNING id, shipment_number`,
            [id, carrier || 'Standard Logistics', trackingNumber || null, shipmentTotalValue, notes || null, userId]
        );
        const shipmentId = shipmentRes.rows[0].id;
        const shipmentNumber = shipmentRes.rows[0].shipment_number;

        // Insert order_shipment_items
        for (const di of dispatchedItems) {
            await client.query(
                `INSERT INTO order_shipment_items (shipment_id, order_item_id, product_id, product_name, batch_id, quantity_shipped)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [shipmentId, di.orderItemId, di.productId, di.productName, di.batchId, di.quantityShipped]
            );
        }

        // Update orders.total_shipped_value
        await client.query(
            `UPDATE orders SET total_shipped_value = COALESCE(total_shipped_value, 0) + $1 WHERE id = $2`,
            [shipmentTotalValue, id]
        );

        // Determine new order status: fully shipped vs partially shipped
        const allItemsRes = await client.query(
            `SELECT approved_quantity, shipped_quantity FROM order_items WHERE order_id = $1`,
            [id]
        );
        const allShipped = allItemsRes.rows.every(
            i => Number(i.shipped_quantity || 0) >= Number(i.approved_quantity || 0)
        );
        const anyShipped = allItemsRes.rows.some(i => Number(i.shipped_quantity || 0) > 0);

        let newStatus = order.status;
        if (allShipped) {
            newStatus = 'Shipped';
            await client.query(
                `UPDATE orders SET status = 'Shipped', shipped_at = NOW(), fulfillment_status = 'Fulfilled', updated_by = $2 WHERE id = $1`,
                [id, userId]
            );
        } else if (anyShipped) {
            newStatus = 'Partially Shipped';
            await client.query(
                `UPDATE orders SET status = 'Partially Shipped', updated_by = $2 WHERE id = $1`,
                [id, userId]
            );
        }

        // Log status transition
        if (newStatus !== order.status) {
            await logStatus(client, id, order.status, newStatus, `Dispatched via ${shipmentNumber}`, userId);
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Dispatch ${shipmentNumber} recorded. Order is now '${newStatus}'`,
            data: { shipmentId, shipmentNumber, newStatus, totalValue: shipmentTotalValue }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('OMS partial dispatch failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

module.exports = router;
