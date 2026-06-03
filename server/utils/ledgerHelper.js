const db = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Unified Ledger Helper for Metapharsic ERP
 * Handles all background ledger postings for Sales, Purchases, and Inventory.
 */

/**
 * Records a transaction in the General Ledger
 * @param {Object} client - DB Client (for transaction support)
 * @param {Object} params - Entry details
 */
async function postToGeneralLedger(client, {
    accountId,      // UUID of the account
    partyId = null, // Optional: UUID of the party
    voucherId,      // UUID of source document
    voucherType,    // 'Sales', 'Purchase', 'JV', 'Payment', etc.
    transactionDate,// Date of transaction
    debit = 0,
    credit = 0,
    narration = ''
}) {
    try {
        if (!accountId) throw new Error('Account ID is required for GL posting');

        // 1. Calculate running balance for this account
        const balanceResult = await client.query(
            'SELECT COALESCE(SUM(debit - credit), 0) as balance FROM general_ledger WHERE account_id = $1',     
            [accountId]
        );
        const prevBalance = parseFloat(balanceResult.rows[0]?.balance || 0);
        const runningBalance = prevBalance + parseFloat(debit) - parseFloat(credit);

        // 2. Insert GL Entry
        await client.query(
            `INSERT INTO general_ledger (
                id, account_id, party_id, voucher_id, voucher_type, transaction_date,
                debit, credit, running_balance, is_reconciled, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, clock_timestamp())`,
            [
                uuidv4(), accountId, partyId, voucherId, voucherType, transactionDate,
                debit, credit, runningBalance
            ]
        );

        // 3. Update Party Balance if applicable
        if (partyId) {
            await client.query(
                `UPDATE parties SET current_balance = current_balance + ($1::numeric - $2::numeric) WHERE id = $3`,
                [debit, credit, partyId]
            );
        }

        return true;
    } catch (error) {
        console.error(' GL Posting Error:', error);
        throw error;
    }
}

/**
 * Records a stock movement in the Stock Ledger
 * @param {Object} client - DB Client
 * @param {Object} params - Movement details
 */
async function postToStockLedger(client, {
    companyId,
    godownId = null,
    productId,
    batchId = null,
    movementType,       // 'IN', 'OUT'
    referenceType,      // 'Sale', 'Purchase', 'Transfer', etc.
    referenceId,
    referenceNumber,
    quantity,
    costPerUnit = 0,
    movementDate,
    narration = '',
    createdBy = null
}) {
    try {
        const in_qty = movementType === 'IN' ? quantity : 0;
        const out_qty = movementType === 'OUT' ? quantity : 0;

        // 1. Get current running balance for this product/batch
        const prevEntry = await client.query(
            `SELECT running_balance FROM stock_ledger_entries
             WHERE product_id = $1 AND (batch_id = $2 OR $2 IS NULL)
             ORDER BY movement_date DESC, created_at DESC, id DESC LIMIT 1`,
            [productId, batchId]
        );

        const prevBalance = parseFloat(prevEntry.rows[0]?.running_balance || 0);
        const runningBalance = prevBalance + in_qty - out_qty;
        const totalCost = quantity * costPerUnit;

        // 2. Insert Stock Ledger Entry
        await client.query(
            `INSERT INTO stock_ledger_entries (
                id, company_id, godown_id, product_id, batch_id, movement_type,
                reference_type, reference_id, reference_number, in_qty, out_qty,
                running_balance, cost_per_unit, total_cost, movement_date, narration, created_by, created_at    
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, clock_timestamp())`,
            [
                uuidv4(), companyId, godownId, productId, batchId, movementType,
                referenceType, referenceId, referenceNumber, in_qty, out_qty,
                runningBalance, costPerUnit, totalCost, movementDate, narration, createdBy
            ]
        );

        // 3. Update batches table
        if (batchId) {
            const updateQuery = movementType === 'IN'
                ? 'UPDATE batches SET stock = stock + $1 WHERE id = $2'
                : 'UPDATE batches SET stock = stock - $1 WHERE id = $2 AND stock >= $1';

            const batchRes = await client.query(updateQuery, [quantity, batchId]);

            // Ensure atomicity: fail fast if subtracting more than available stock
            if (movementType === 'OUT' && batchRes.rowCount === 0) {
                throw new Error(`Insufficient stock in batch ${batchId} for required quantity of ${quantity}`);       
            }
        }

        return true;
    } catch (error) {
        console.error(' Stock Ledger Error:', error);
        throw error;
    }
}

/**
 * Finds a ledger account by typical search criteria
 * Useful for finding "Sales Account", "Purchase Account", etc.
 */
async function findAccount(client, companyId, search) {
    // 1. Try exact name match
    const exactMatch = await client.query(
        `SELECT id FROM chart_of_accounts
         WHERE company_id = $1 AND account_name = $2
         LIMIT 1`,
        [companyId, search]
    );
    if (exactMatch.rows.length > 0) return exactMatch.rows[0].id;

    // 2. Try ILIKE match
    const { rows } = await client.query(
        `SELECT id FROM chart_of_accounts
         WHERE company_id = $1 AND (account_name ILIKE $2 OR account_code = $3)
         LIMIT 1`,
        [companyId, `%${search}%`, search]
    );
    return rows[0]?.id || null;
}

/**
 * Unified helper to process standard business vouchers (Receipt, Payment, Contra, Return)
 */
async function processVoucher(client, {
    companyId,
    voucherType,    // 'Receipt', 'Payment', 'Contra', 'Sales Return', 'Purchase Return'
    voucherNo,
    voucherDate,
    partyId = null,
    drAccountId,
    crAccountId,
    amount,
    narration = '',
    createdBy
}) {
    try {
        // 1. Create the Master Voucher record
        const { rows: voucherRows } = await client.query(
            `INSERT INTO journal_vouchers (
                id, company_id, party_id, voucher_type, voucher_no, voucher_date,
                narration, total_debit, total_credit, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Posted', $10) RETURNING id`,
            [uuidv4(), companyId, partyId, voucherType, voucherNo, voucherDate, narration, amount, amount, createdBy]
        );
        const voucherId = voucherRows[0].id;

        // FIX 4: Also create journal_voucher_entries so the JV is fully visible
        // in the Day Book, JV Manager, and any entry-level report.
        await client.query(
            `INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration)
             VALUES ($1, $2, $3, $4, $5)`,
            [voucherId, drAccountId, amount, 0, `${narration} [DR]`]
        );
        await client.query(
            `INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration)
             VALUES ($1, $2, $3, $4, $5)`,
            [voucherId, crAccountId, 0, amount, `${narration} [CR]`]
        );

        // 2. Post Debit Entry to General Ledger (FIX 8: narration included)
        await postToGeneralLedger(client, {
            accountId: drAccountId,
            partyId: (voucherType === 'Payment' || voucherType === 'Purchase' || voucherType === 'Sales Return') ? partyId : null,
            voucherId,
            voucherType,
            transactionDate: voucherDate,
            debit: amount,
            credit: 0,
            narration
        });

        // 3. Post Credit Entry to General Ledger
        await postToGeneralLedger(client, {
            accountId: crAccountId,
            partyId: (voucherType === 'Receipt' || voucherType === 'Sales' || voucherType === 'Purchase Return') ? partyId : null,
            voucherId,
            voucherType,
            transactionDate: voucherDate,
            debit: 0,
            credit: amount,
            narration
        });

        // FIX 2: Keep chart_of_accounts.current_balance in sync
        await client.query(
            `UPDATE chart_of_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2`,
            [amount, drAccountId]
        );
        await client.query(
            `UPDATE chart_of_accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2`,
            [amount, crAccountId]
        );

        return voucherId;
    } catch (error) {
        console.error(' processVoucher Error:', error);
        throw error;
    }
}

/**
 * Clear GL and Stock Ledger entries for a given voucher
 * Also handles party balance reversal for GL entries
 */
async function clearLedgerEntries(client, voucherId, voucherType, options = {}) {
    try {
        // Use specific IDs for stock clearing if provided, otherwise fall back to main voucher IDs
        const stockRefId = options.stockRefId || voucherId;
        const stockRefType = options.stockRefType || voucherType;

        // 1. Revert Party Balances before deleting GL entries
        const { rows: glEntries } = await client.query(
            'SELECT party_id, debit, credit FROM general_ledger WHERE voucher_id = $1 AND voucher_type = $2 AND party_id IS NOT NULL',
            [voucherId, voucherType]
        );

        for (const entry of glEntries) {
            await client.query(
                'UPDATE parties SET current_balance = current_balance - ($1::numeric - $2::numeric) WHERE id = $3',
                [entry.debit, entry.credit, entry.party_id]
            );
        }

        // 2. Delete GL entries
        await client.query(
            'DELETE FROM general_ledger WHERE voucher_id = $1 AND voucher_type = $2',
            [voucherId, voucherType]
        );

        // 3. Delete Stock Ledger entries using exact cross-mapped identifiers
        await client.query(
            'DELETE FROM stock_ledger_entries WHERE reference_id = $1 AND reference_type = $2',
            [stockRefId, stockRefType]
        );
    } catch (error) {
        console.error(' clearLedgerEntries Error:', error);
        throw error;
    }
}

module.exports = {
    postToGeneralLedger,
    postToStockLedger,
    findAccount,
    processVoucher,
    clearLedgerEntries
};
