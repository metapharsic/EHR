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

/**
 * POST /api/vouchers/types
 * Create a new Voucher Type
 */
router.post('/types', async (req, res) => {
    try {
        const {
            name, alias, typeOfVoucher, abbreviation, methodOfVoucherNumbering,
            useEffectiveDates, makeOptionalByDefault, allowNarration,
            provideNarrationsForEachLedger, printAfterSaving, nameOfClass
        } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        const classStr = Array.isArray(nameOfClass) ? JSON.stringify(nameOfClass) : nameOfClass;

        const { rows } = await db.query(
            `INSERT INTO voucher_types 
            (name, alias, type_of_voucher, abbreviation, method_of_voucher_numbering, 
            use_effective_dates, make_optional_by_default, allow_narration, 
            provide_narrations_for_each_ledger, print_after_saving, name_of_class) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [name, alias, typeOfVoucher, abbreviation, methodOfVoucherNumbering,
            useEffectiveDates, makeOptionalByDefault, allowNarration,
            provideNarrationsForEachLedger, printAfterSaving, classStr]
        );

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Failed to create voucher type', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/vouchers/types/:id
 * Update an existing Voucher Type
 */
router.put('/types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, alias, typeOfVoucher, abbreviation, methodOfVoucherNumbering,
            useEffectiveDates, makeOptionalByDefault, allowNarration,
            provideNarrationsForEachLedger, printAfterSaving, nameOfClass, is_active
        } = req.body;

        const classStr = Array.isArray(nameOfClass) ? JSON.stringify(nameOfClass) : nameOfClass;

        const { rows } = await db.query(
            `UPDATE voucher_types SET 
            name = COALESCE($1, name),
            alias = COALESCE($2, alias),
            type_of_voucher = COALESCE($3, type_of_voucher),
            abbreviation = COALESCE($4, abbreviation),
            method_of_voucher_numbering = COALESCE($5, method_of_voucher_numbering),
            use_effective_dates = COALESCE($6, use_effective_dates),
            make_optional_by_default = COALESCE($7, make_optional_by_default),
            allow_narration = COALESCE($8, allow_narration),
            provide_narrations_for_each_ledger = COALESCE($9, provide_narrations_for_each_ledger),
            print_after_saving = COALESCE($10, print_after_saving),
            name_of_class = COALESCE($11, name_of_class),
            is_active = COALESCE($12, is_active),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 RETURNING *`,
            [name, alias, typeOfVoucher, abbreviation, methodOfVoucherNumbering,
            useEffectiveDates, makeOptionalByDefault, allowNarration,
            provideNarrationsForEachLedger, printAfterSaving, classStr, is_active, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Voucher type not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Failed to update voucher type', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
