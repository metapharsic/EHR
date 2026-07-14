/**
 * server/routes/omsPortal.js
 * Distributor self-service portal — read-only access to own orders.
 *
 * Authentication: SHA-256 hashed passwords stored in parties table.
 * Portal JWT is separate from internal JWT (different secret suffix + payload).
 * All routes are public-facing (no verifyTokenMiddleware from internal JWT).
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { createHash } = require('crypto');
const jwt = require('jsonwebtoken');

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PORTAL_JWT_SECRET = (process.env.JWT_SECRET || 'metapharsic_secret') + '_portal';
const PORTAL_TOKEN_EXPIRY = '8h';

// ============================================================
// HELPER: Hash a password with SHA-256
// ============================================================
function hashPassword(password) {
    return createHash('sha256').update(password).digest('hex');
}

// ============================================================
// MIDDLEWARE: Verify distributor portal JWT
// ============================================================
const verifyPortalToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Portal authentication required' });
    }
    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, PORTAL_JWT_SECRET);
        if (payload.type !== 'distributor_portal') {
            return res.status(401).json({ success: false, error: 'Invalid portal token type' });
        }
        req.portal = payload; // { distId, distName, type }
        next();
    } catch (err) {
        logger.warn('OMS Portal: Invalid token', { error: err.message });
        return res.status(401).json({ success: false, error: 'Invalid or expired portal token' });
    }
};

// ============================================================
// POST /portal/auth/login
// Body: { username, password }
// ============================================================
router.post('/auth/login', asyncRoute(async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        const result = await db.query(
            `SELECT id, name, portal_username, portal_password_hash, portal_enabled
             FROM parties
             WHERE portal_username = $1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            logger.warn('OMS Portal: Login attempt with unknown username', { username });
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const party = result.rows[0];

        if (!party.portal_enabled) {
            return res.status(403).json({ success: false, error: 'Portal access is not enabled for this account' });
        }

        const hash = hashPassword(password);
        if (hash !== party.portal_password_hash) {
            logger.warn('OMS Portal: Invalid password attempt', { username });
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Issue portal JWT
        const payload = {
            distId: party.id,
            distName: party.name,
            type: 'distributor_portal'
        };
        const token = jwt.sign(payload, PORTAL_JWT_SECRET, { expiresIn: PORTAL_TOKEN_EXPIRY });

        // Update last login timestamp
        await db.query(
            `UPDATE parties SET last_portal_login = NOW() WHERE id = $1`,
            [party.id]
        );

        logger.info('OMS Portal: Distributor logged in', { distId: party.id, distName: party.name });

        res.json({
            success: true,
            token,
            distributor: { id: party.id, name: party.name },
            expiresIn: PORTAL_TOKEN_EXPIRY
        });
    } catch (error) {
        logger.error('OMS Portal: Login failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================================
// GET /portal/my-orders
// Returns paginated list of orders for the authenticated distributor
// ============================================================
router.get('/my-orders', verifyPortalToken, asyncRoute(async (req, res) => {
    try {
        const { distId } = req.portal;
        const { status = 'ALL', page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let where = 'WHERE o.distributor_id = $1';
        const params = [distId];

        if (status && status !== 'ALL') {
            params.push(status);
            where += ` AND o.status = $${params.length}`;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) FROM orders o ${where}`,
            params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const listParams = [...params, Number(limit), offset];
        const result = await db.query(
            `SELECT
                o.id,
                o.order_number     AS "orderNumber",
                o.order_date       AS "orderDate",
                o.status,
                o.priority,
                o.total_amount     AS "totalAmount",
                o.fulfillment_status AS "fulfillmentStatus",
                o.expected_delivery_date AS "expectedDeliveryDate",
                o.shipped_at       AS "shippedAt",
                o.delivered_at     AS "deliveredAt",
                (SELECT COUNT(*) FROM order_items WHERE order_id = o.id)::int AS "itemCount"
             FROM orders o
             ${where}
             ORDER BY o.order_date DESC, o.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        );

        res.json({
            success: true,
            data: result.rows,
            total,
            page: Number(page),
            pageSize: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        logger.error('OMS Portal: my-orders failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================================
// GET /portal/my-orders/:id
// Returns a single order's detail (only if it belongs to this distributor)
// ============================================================
router.get('/my-orders/:id', verifyPortalToken, asyncRoute(async (req, res) => {
    try {
        const { distId } = req.portal;
        const { id } = req.params;

        const orderResult = await db.query(
            `SELECT * FROM orders WHERE id = $1 AND distributor_id = $2`,
            [id, distId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const items = await db.query(
            `SELECT
                oi.product_name,
                oi.quantity,
                oi.approved_quantity,
                oi.shipped_quantity,
                oi.rate,
                oi.amount,
                oi.gst_percent
             FROM order_items oi
             WHERE oi.order_id = $1
             ORDER BY oi.created_at ASC`,
            [id]
        );

        const shipments = await db.query(
            `SELECT
                carrier,
                tracking_number,
                status,
                dispatched_at,
                delivered_at,
                shipment_number
             FROM order_shipments
             WHERE order_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        const history = await db.query(
            `SELECT from_status, to_status, note, changed_at
             FROM order_status_history
             WHERE order_id = $1
             ORDER BY changed_at ASC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ...orderResult.rows[0],
                items: items.rows,
                shipments: shipments.rows,
                statusHistory: history.rows
            }
        });
    } catch (error) {
        logger.error('OMS Portal: my-orders detail failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================================
// GET /portal/my-statement
// AR statement: all invoiced orders + outstanding total for the distributor
// ============================================================
router.get('/my-statement', verifyPortalToken, asyncRoute(async (req, res) => {
    try {
        const { distId } = req.portal;

        // Distributor profile
        const distResult = await db.query(
            `SELECT id, name, credit_limit, current_balance, portal_username, last_portal_login
             FROM parties WHERE id = $1`,
            [distId]
        );
        if (distResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Distributor not found' });
        }
        const distributor = distResult.rows[0];

        // All invoiced orders for AR aging
        const ordersResult = await db.query(
            `SELECT
                id,
                order_number,
                order_date,
                total_amount,
                status,
                sales_invoice_id,
                (CURRENT_DATE - order_date)::int AS days_old
             FROM orders
             WHERE distributor_id = $1
               AND status = 'Invoiced'
             ORDER BY order_date DESC`,
            [distId]
        );

        const orders = ordersResult.rows;
        const totalOutstanding = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

        // Aging buckets
        const aging = {
            current: orders.filter(o => o.days_old <= 30).reduce((s, o) => s + Number(o.total_amount), 0),
            days31_60: orders.filter(o => o.days_old > 30 && o.days_old <= 60).reduce((s, o) => s + Number(o.total_amount), 0),
            days61_90: orders.filter(o => o.days_old > 60 && o.days_old <= 90).reduce((s, o) => s + Number(o.total_amount), 0),
            days91plus: orders.filter(o => o.days_old > 90).reduce((s, o) => s + Number(o.total_amount), 0)
        };

        res.json({
            success: true,
            data: {
                distributor: {
                    id: distributor.id,
                    name: distributor.name,
                    creditLimit: Number(distributor.credit_limit || 0),
                    currentBalance: Number(distributor.current_balance || 0),
                    lastLogin: distributor.last_portal_login
                },
                orders,
                totalOutstanding,
                aging
            }
        });
    } catch (error) {
        logger.error('OMS Portal: my-statement failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

module.exports = router;
