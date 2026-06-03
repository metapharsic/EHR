const express = require('express');
const router = express.Router();
const db = require('../db');
const ledgerHelper = require('../utils/ledgerHelper');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');

router.use(verifyTokenMiddleware);

/**
 * POST /api/vouchers/receipt
 * Create a Receipt Voucher (Money received from Party)
 */
router.post('/receipt', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const {
            voucher_no,
            voucher_date,
            party_id,
            account_id, // The account receiving the money (Cash/Bank)
            amount,
            narration
        } = req.body;

        if (!voucher_no || !voucher_date || !party_id || !account_id || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Logic: Receipt increases Cash/Bank (Debit) and decreases Party Balance (Credit)
        const voucherId = await ledgerHelper.processVoucher(client, {
            companyId: req.user?.companyId || 1,
            voucherType: 'Receipt',
            voucherNo: voucher_no,
            voucherDate: voucher_date,
            partyId: party_id,
            drAccountId: account_id,  // Debit Cash/Bank
            crAccountId: await ledgerHelper.findAccount(client, 1, 'Sundry Debtors'), // This is symbolic if partyId is used in postToGeneralLedger
            amount: amount,
            narration: narration || `Receipt Voucher ${voucher_no}`,
            createdBy: req.user?.userId
        });

        await client.query('COMMIT');
        res.json({ success: true, voucherId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error('Failed to create receipt voucher', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/vouchers/payment
 * Create a Payment Voucher (Money paid to Party)
 */
router.post('/payment', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const {
            voucher_no,
            voucher_date,
            party_id,
            account_id, // The account from which money is paid (Cash/Bank)
            amount,
            narration
        } = req.body;

        if (!voucher_no || !voucher_date || !party_id || !account_id || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Logic: Payment decreases Party Balance (Debit) and decreases Cash/Bank (Credit)
        const voucherId = await ledgerHelper.processVoucher(client, {
            companyId: req.user?.companyId || 1,
            voucherType: 'Payment',
            voucherNo: voucher_no,
            voucherDate: voucher_date,
            partyId: party_id,
            drAccountId: await ledgerHelper.findAccount(client, 1, 'Sundry Creditors'),
            crAccountId: account_id, // Credit Cash/Bank
            amount: amount,
            narration: narration || `Payment Voucher ${voucher_no}`,
            createdBy: req.user?.userId
        });

        await client.query('COMMIT');
        res.json({ success: true, voucherId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error('Failed to create payment voucher', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/vouchers/contra
 * Create a Contra Voucher (Transfer between Cash and Bank)
 */
router.post('/contra', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const {
            voucher_no,
            voucher_date,
            from_account_id,
            to_account_id,
            amount,
            narration
        } = req.body;

        if (!voucher_no || !voucher_date || !from_account_id || !to_account_id || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Logic: Contra Dr ToAccount, Cr FromAccount
        const voucherId = await ledgerHelper.processVoucher(client, {
            companyId: req.user?.companyId || 1,
            voucherType: 'Contra',
            voucherNo: voucher_no,
            voucherDate: voucher_date,
            drAccountId: to_account_id,
            crAccountId: from_account_id,
            amount: amount,
            narration: narration || `Contra Voucher ${voucher_no}`,
            createdBy: req.user?.userId
        });

        await client.query('COMMIT');
        res.json({ success: true, voucherId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error('Failed to create contra voucher', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/vouchers/sales-return
 * Create a Sales Return (Credit Note)
 */
router.post('/sales-return', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const {
            voucher_no,
            voucher_date,
            party_id,
            items = [],
            narration,
            total_amount
        } = req.body;

        if (!voucher_no || !voucher_date || !party_id || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Voucher no, date, party, and items are required' });
        }

        await client.query('BEGIN');
        const companyId = req.user?.companyId || 1;

        // 1. Get Accounts
        const salesReturnAccountId = await ledgerHelper.findAccount(client, companyId, 'Sales Return');
        const sundryDebtorsAccountId = await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors');

        // 2. Process Voucher & GL
        // Sales Return: Dr. Sales Return (Expense/Income Reversal), Cr. Party (Debtor decrease)
        const voucherId = await ledgerHelper.processVoucher(client, {
            companyId,
            voucherType: 'Sales Return',
            voucherNo: voucher_no,
            voucherDate: voucher_date,
            partyId: party_id,
            drAccountId: salesReturnAccountId,
            crAccountId: sundryDebtorsAccountId,
            amount: total_amount,
            narration: narration || `Sales Return ${voucher_no}`,
            createdBy: req.user?.userId
        });

        // 3. Update Stock Ledger (Stock coming IN)
        for (const item of items) {
            await ledgerHelper.postToStockLedger(client, {
                companyId,
                productId: item.product_id,
                batchId: item.batch_id,
                movementType: 'IN',
                referenceType: 'Sales Return',
                referenceId: voucherId,
                referenceNumber: voucher_no,
                quantity: item.quantity,
                movementDate: voucher_date,
                narration: `Sales Return from Party`,
                createdBy: req.user?.userId
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, voucherId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error('Failed to create sales return', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/vouchers/purchase-return
 * Create a Purchase Return (Debit Note)
 */
router.post('/purchase-return', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const {
            voucher_no,
            voucher_date,
            party_id,
            items = [],
            narration,
            total_amount
        } = req.body;

        if (!voucher_no || !voucher_date || !party_id || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Voucher no, date, party, and items are required' });
        }

        await client.query('BEGIN');
        const companyId = req.user?.companyId || 1;

        // 1. Get Accounts
        const purchaseReturnAccountId = await ledgerHelper.findAccount(client, companyId, 'Purchase Return');
        const sundryCreditorsAccountId = await ledgerHelper.findAccount(client, companyId, 'Sundry Creditors');

        // 2. Process Voucher & GL
        // Purchase Return: Dr. Party (Creditor decrease), Cr. Purchase Return
        const voucherId = await ledgerHelper.processVoucher(client, {
            companyId,
            voucherType: 'Purchase Return',
            voucherNo: voucher_no,
            voucherDate: voucher_date,
            partyId: party_id,
            drAccountId: sundryCreditorsAccountId,
            crAccountId: purchaseReturnAccountId,
            amount: total_amount,
            narration: narration || `Purchase Return ${voucher_no}`,
            createdBy: req.user?.userId
        });

        // 3. Update Stock Ledger (Stock going OUT)
        for (const item of items) {
            await ledgerHelper.postToStockLedger(client, {
                companyId,
                productId: item.product_id,
                batchId: item.batch_id,
                movementType: 'OUT',
                referenceType: 'Purchase Return',
                referenceId: voucherId,
                referenceNumber: voucher_no,
                quantity: item.quantity,
                movementDate: voucher_date,
                narration: `Purchase Return to Supplier`,
                createdBy: req.user?.userId
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, voucherId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error('Failed to create purchase return', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;
