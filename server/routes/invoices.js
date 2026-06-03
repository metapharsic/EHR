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
        const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
        const offset = (parseInt(req.query.page) || 0) * limit;

        const { rows } = await db.query(
            'SELECT * FROM sales_invoices ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        res.json(rows);
    } catch (error) {
        logger.error('Failed to fetch invoices', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
}));

router.post('/', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'CASHIER']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { invoiceNumber, date, customerName, doctorName, paymentMode, items, netAmount } = req.body;

        if (!invoiceNumber || !date || !items || items.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Missing required invoice fields' });
        }

        const { rows: invoiceRows } = await client.query(
            `INSERT INTO sales_invoices (invoice_number, date, customer_name, doctor_name, payment_mode, net_amount, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [invoiceNumber, date, customerName, doctorName, paymentMode || 'Cash', netAmount, req.user.userId]
        );
        const invoiceId = invoiceRows[0].id;
        const companyId = req.user.companyId || 1;

        // --- ACCOUNTING INTEGRATION ---
        const { postToGeneralLedger, postToStockLedger, findAccount } = require('../utils/ledgerHelper');

        // 1. Determine Payment Account (Cash or Bank)
        const paymentAccountName = (paymentMode === 'Credit Card' || paymentMode === 'UPI' || paymentMode === 'Bank') ? 'Bank Account' : 'Cash';
        const paymentAccountId = await findAccount(client, companyId, paymentAccountName);
        const salesAccountId = await findAccount(client, companyId, 'Sales Revenue');

        // 2. Post Sales Transaction
        if (paymentAccountId && salesAccountId) {
            // Debit: Cash/Bank
            await postToGeneralLedger(client, {
                accountId: paymentAccountId,
                voucherId: invoiceId,
                voucherType: 'Sales',
                transactionDate: date,
                debit: netAmount,
                narration: `POS Sale: ${invoiceNumber}`
            });

            // Credit: Sales Revenue
            await postToGeneralLedger(client, {
                accountId: salesAccountId,
                voucherId: invoiceId,
                voucherType: 'Sales',
                transactionDate: date,
                credit: netAmount,
                narration: `POS Sale: ${invoiceNumber}`
            });
        }

        // 3. Process Items & Stock Ledger
        for (const item of items) {
            await client.query(
                `INSERT INTO sales_invoice_items (invoice_id, product_id, batch_id, quantity, mrp, rate, total_amount)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [invoiceId, item.productId, item.batchId, item.quantity, item.mrp, item.rate, item.totalAmount]
            );

            // Fetch batch for cost calculation
            const batchResult = await client.query('SELECT purchase_rate, godown_id FROM batches WHERE id = $1', [item.batchId]);
            const purchaseRate = batchResult.rows[0]?.purchase_rate || 0;
            const godownId = batchResult.rows[0]?.godown_id || null;

            // Update Stock
            await client.query(
                `UPDATE batches SET quantity = quantity - $1 WHERE id = $2`,
                [item.quantity, item.batchId]
            );

            // Post to Stock Ledger
            await postToStockLedger(client, {
                companyId: companyId,
                godownId: godownId,
                productId: item.productId,
                batchId: item.batchId,
                movementType: 'OUT',
                referenceType: 'Sale',
                referenceId: invoiceId,
                referenceNumber: invoiceNumber,
                quantity: item.quantity,
                costPerUnit: purchaseRate,
                movementDate: date,
                narration: 'POS Sale',
                createdBy: req.user.userId
            });
        }

        await client.query('COMMIT');
        res.status(201).json({ id: invoiceId, status: 'success' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to create invoice', { error: error.message });
        res.status(500).json({ error: 'Failed to create invoice' });
    } finally {
        client.release();
    }
}));

module.exports = router;
