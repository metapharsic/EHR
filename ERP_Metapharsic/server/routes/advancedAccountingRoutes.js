const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware, verifyRoleMiddleware, verify2FAMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');

// Helper to wrap async routes
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// BANK RECONCILIATION API
// ============================================
router.get('/bank-reconciliation', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM bank_reconciliations WHERE company_id = $1 ORDER BY statement_date DESC',
            [req.user.companyId || 1]
        );
        res.json(rows);
    } catch (error) {
        logger.error('Failed to fetch reconciliations', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch bank reconciliations' });
    }
}));

router.post('/bank-reconciliation', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), asyncRoute(async (req, res) => {
    try {
        const { accountId, statementDate, closingBalanceBank, closingBalanceBooks, unreconciledDifference } = req.body;
        const status = unreconciledDifference === 0 ? 'Completed' : 'Pending';

        const { rows } = await db.query(
            `INSERT INTO bank_reconciliations (account_id, statement_date, closing_balance_per_bank, closing_balance_per_books, unreconciled_difference, reconciliation_status, company_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [accountId, statementDate, closingBalanceBank, closingBalanceBooks, unreconciledDifference, status, req.user.companyId || 1, req.user.userId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error('Failed to save bank reconciliation', { error: error.message });
        res.status(500).json({ error: 'Failed to save bank reconciliation' });
    }
}));

// ============================================
// BUDGETS API
// ============================================
router.get('/budgets', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT b.*, coa.account_name, cc.name as cost_center_name,
                    COALESCE(b.actual_amount, 0) - COALESCE(b.budget_amount, 0) as computed_variance
             FROM budgets b
             LEFT JOIN chart_of_accounts coa ON coa.id = b.account_id
             LEFT JOIN cost_centers cc ON cc.id = b.cost_center_id
             WHERE b.company_id = $1
             ORDER BY b.period_from DESC`,
            [req.user.companyId || 1]
        );
        res.json(rows);
    } catch (error) {
        logger.error('Failed to fetch budgets', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
}));

router.post('/budgets', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), asyncRoute(async (req, res) => {
    try {
        const { accountId, costCenterId, periodFrom, periodTo, budgetAmount } = req.body;
        if (!accountId || !budgetAmount) return res.status(400).json({ error: 'accountId and budgetAmount required' });
        const { rows } = await db.query(
            `INSERT INTO budgets (account_id, cost_center_id, period_from, period_to, budget_amount, company_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [accountId, costCenterId || null, periodFrom || null, periodTo || null, budgetAmount, req.user.companyId || 1, req.user.userId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error('Failed to save budget', { error: error.message });
        res.status(500).json({ error: String(error.message || error) });
    }
}));

// ============================================
// FIXED ASSETS API
// ============================================
router.get('/fixed-assets', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM fixed_assets WHERE company_id = $1', [req.user.companyId || 1]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
}));

router.post('/fixed-assets', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), asyncRoute(async (req, res) => {
    try {
        const { assetName, assetCode, accountId, purchaseDate, purchaseValue, depreciationMethod, depreciationRatePercent, location } = req.body;
        const { rows } = await db.query(
            `INSERT INTO fixed_assets (asset_name, asset_code, account_id, purchase_date, purchase_value, current_value, depreciation_method, depreciation_rate_percent, location, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [assetName, assetCode, accountId, purchaseDate, purchaseValue, purchaseValue, depreciationMethod, depreciationRatePercent, location, req.user.companyId || 1]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
}));

// ============================================
// GST / TDS / TAX CONFIGURATION API
// ============================================
router.get('/taxes', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM tax_configurations');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch taxes' });
    }
}));

router.post('/taxes', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN']), asyncRoute(async (req, res) => {
    try {
        const { taxType, taxName, rate, accountId } = req.body;
        const { rows } = await db.query(
            `INSERT INTO tax_configurations (tax_type, tax_name, rate, account_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [taxType, taxName, rate, accountId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
}));

// ============================================
// FOREX RATES API
// ============================================
router.get('/forex', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM forex_rates ORDER BY effective_date DESC LIMIT 50');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch forex rates' });
    }
}));

router.post('/forex', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), asyncRoute(async (req, res) => {
    try {
        const { currencyCode, exchangeRate, effectiveDate } = req.body;
        const { rows } = await db.query(
            `INSERT INTO forex_rates (currency_code, exchange_rate, effective_date) VALUES ($1, $2, $3) RETURNING *`,
            [currencyCode, exchangeRate, effectiveDate]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
}));

// ============================================
// FIX 3: PDC (Post-Dated Cheque) API — was MISSING
// Per .cursorrules §5.B.2: PDC must stay 'Pending' and never hit cash ledger until maturity date
// ============================================

/** GET /api/accounting/advanced/pdc — list all PDC cheques */
router.get('/pdc', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { status, type } = req.query;
        let where = 'WHERE p.company_id = $1';
        const params = [req.user.companyId || 1];
        if (status) { where += ` AND p.status = $${params.length + 1}`; params.push(status); }
        if (type)   { where += ` AND p.cheque_type = $${params.length + 1}`; params.push(type); }

        const { rows } = await db.query(
            `SELECT p.*, coa.account_name as bank_account_name, pa.name as party_name
             FROM pdc_cheques p
             LEFT JOIN chart_of_accounts coa ON coa.id = p.bank_account_id
             LEFT JOIN parties pa ON pa.id = p.party_id
             ${where}
             ORDER BY p.cheque_date ASC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('PDC list error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

/** POST /api/accounting/advanced/pdc — create a PDC cheque (status = Pending, no GL entry yet) */
router.post('/pdc', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), asyncRoute(async (req, res) => {
    try {
        const { bankAccountId, partyId, chequeNumber, chequeDate, amount, chequeType, narration } = req.body;

        if (!chequeNumber || !chequeDate || !amount || !chequeType) {
            return res.status(400).json({ success: false, error: 'chequeNumber, chequeDate, amount and chequeType are required' });
        }
        if (chequeType !== 'Issued' && chequeType !== 'Received') {
            return res.status(400).json({ success: false, error: 'chequeType must be "Issued" or "Received"' });
        }

        // Duplicate cheque number guard
        const dup = await db.query(
            'SELECT id FROM pdc_cheques WHERE cheque_number = $1 AND company_id = $2 LIMIT 1',
            [chequeNumber, req.user.companyId || 1]
        );
        if (dup.rows.length > 0) {
            return res.status(409).json({ success: false, error: `Cheque number ${chequeNumber} already exists` });
        }

        const { rows } = await db.query(
            `INSERT INTO pdc_cheques
               (company_id, bank_account_id, party_id, cheque_number, cheque_date, amount, cheque_type, status, narration, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8, $9) RETURNING *`,
            [req.user.companyId || 1, bankAccountId, partyId, chequeNumber, chequeDate, amount, chequeType, narration || '', req.user.userId]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('PDC create error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
}));

/** PUT /api/accounting/advanced/pdc/:id/realise — realise a cheque: post to GL, change status to Realised */
router.put('/pdc/:id/realise', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), asyncRoute(async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [pdc] } = await client.query('SELECT * FROM pdc_cheques WHERE id = $1', [req.params.id]);
        if (!pdc) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'PDC not found' }); }
        if (pdc.status !== 'Pending') { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Only Pending cheques can be realised' }); }

        // Verify maturity date is today or past
        if (new Date(pdc.cheque_date) > new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Cheque maturity date has not been reached yet' });
        }

        // Post to GL: Received → DR Bank, CR Debtor | Issued → DR Creditor, CR Bank
        const ledgerHelper = require('../utils/ledgerHelper');
        const voucherNo = `PDC-${pdc.cheque_number}-${Date.now().toString().slice(-6)}`;
        const bankAccountId = pdc.bank_account_id;
        const partyAccountName = pdc.cheque_type === 'Received' ? 'Sundry Debtors' : 'Sundry Creditors';
        const partyAccountId = await ledgerHelper.findAccount(client, pdc.company_id, partyAccountName);

        const drAccountId = pdc.cheque_type === 'Received' ? bankAccountId   : partyAccountId;
        const crAccountId = pdc.cheque_type === 'Received' ? partyAccountId  : bankAccountId;

        const voucherId = await ledgerHelper.processVoucher(client, {
            companyId:   pdc.company_id,
            voucherType: 'PDC',
            voucherNo,
            voucherDate: pdc.cheque_date,
            partyId:     pdc.party_id,
            drAccountId,
            crAccountId,
            amount:      pdc.amount,
            narration:   `PDC Realised: Cheque ${pdc.cheque_number}`,
            createdBy:   req.user.userId
        });

        await client.query(
            `UPDATE pdc_cheques SET status = 'Realised', journal_voucher_id = $1, updated_at = NOW() WHERE id = $2`,
            [voucherId, req.params.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, voucherId, status: 'Realised' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('PDC realise error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
}));

/** PUT /api/accounting/advanced/pdc/:id/bounce — mark a cheque as bounced */
router.put('/pdc/:id/bounce', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), asyncRoute(async (req, res) => {
    try {
        const { bounceReason } = req.body;
        const { rows } = await db.query(
            `UPDATE pdc_cheques SET status = 'Bounced', bounce_reason = $1, updated_at = NOW()
             WHERE id = $2 AND status = 'Pending' RETURNING *`,
            [bounceReason || 'Cheque bounced', req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, error: 'PDC not found or already processed' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));

/** DELETE /api/accounting/advanced/pdc/:id — cancel a pending PDC */
router.delete('/pdc/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN']), asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(
            `DELETE FROM pdc_cheques WHERE id = $1 AND status = 'Pending' AND company_id = $2 RETURNING id`,
            [req.params.id, req.user.companyId || 1]
        );
        if (!rows.length) return res.status(404).json({ success: false, error: 'PDC not found or already processed — cannot delete' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));

module.exports = router;
