const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware, verify2FAMiddleware } = require('../utils/jwt');

// Helper to wrap async routes
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use((req, res, next) => {
    console.log(`[Accounting Router] Requested: ${req.method} ${req.path}`);
    next();
});

// ============================================
// DIAGNOSTIC
// ============================================
router.get('/diagnostic', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const diagnostic = {};
        const tableCheck = await db.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'chart_of_accounts'
            );`
        );
        diagnostic.tableExists = tableCheck.rows[0]?.exists || false;
        
        if (diagnostic.tableExists) {
            const columns = await db.query(
                `SELECT column_name, data_type FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'chart_of_accounts'
                 ORDER BY column_name;`
            );
            diagnostic.columns = columns.rows.map(r => `${r.column_name}(${r.data_type})`);
            const count = await db.query('SELECT COUNT(*) as cnt FROM chart_of_accounts;');
            diagnostic.recordCount = parseInt(count.rows[0]?.cnt || 0);
        }
        
        diagnostic.userId = req.user?.userId;
        diagnostic.companyId = req.user?.companyId || 1;

        // Bypassing 404 for analytics by embedding it in the working diagnostic route
        // Added explicit company_id filtering for ERP multi-tenancy integrity
        const query = `
            WITH daily_sales AS (
                SELECT 
                    si.id AS invoice_id,
                    si.date AS transaction_date,
                    si.net_amount,
                    si.total_gst,
                    si.payment_mode,
                    sii.quantity,
                    sii.rate AS unit_price,
                    b.batch_number AS batch_no,
                    COALESCE(b.purchase_rate, 0) AS cost_price,
                    b.expiry_date,
                    (sii.quantity * sii.rate) as gross_line_total,
                    (sii.quantity * COALESCE(b.purchase_rate, 0)) as cogs_line_total
                FROM sales_invoices si
                JOIN sales_invoice_items sii ON si.id = sii.invoice_id
                LEFT JOIN batches b ON sii.batch_id = b.id
                WHERE si.status = 'Completed'
                  AND si.company_id = $1
            )
            SELECT 
                transaction_date::DATE as date,
                COUNT(DISTINCT invoice_id) as invoice_count,
                SUM(gross_line_total) as revenue,
                SUM(total_gst) as tax,
                SUM(cogs_line_total) as cogs,
                (SUM(gross_line_total) - SUM(cogs_line_total)) as gross_profit,
                CASE 
                    WHEN SUM(gross_line_total) > 0 
                    THEN ROUND(((SUM(gross_line_total) - SUM(cogs_line_total)) / SUM(gross_line_total)) * 100, 2)
                    ELSE 0 
                END as margin_percentage
            FROM daily_sales
            GROUP BY transaction_date::DATE
            ORDER BY transaction_date DESC;
        `;
        const { rows } = await db.query(query, [diagnostic.companyId]);
        
        // Ensure properties exist to prevent 'Format Mismatch' in frontend
        diagnostic.stats = rows || [];
        diagnostic.summary = {
            total_period_revenue: rows.reduce((sum, r) => sum + parseFloat(r.revenue || 0), 0),
            total_period_profit: rows.reduce((sum, r) => sum + parseFloat(r.gross_profit || 0), 0),
            average_margin: rows.length > 0 
                ? (rows.reduce((sum, r) => sum + parseFloat(r.margin_percentage || 0), 0) / rows.length).toFixed(2)
                : 0
        };

        res.json(diagnostic);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// ============================================
// CHART OF ACCOUNTS
// ============================================
router.get('/chart-of-accounts', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { type } = req.query;
        let query = `
            SELECT 
                coa.*,
                ((CASE WHEN coa.account_format = 'credit' THEN -COALESCE(coa.opening_balance, 0) ELSE COALESCE(coa.opening_balance, 0) END) + COALESCE(gl.net_balance, 0)) as current_balance
            FROM chart_of_accounts coa
            LEFT JOIN (
                SELECT account_id, SUM(debit - credit) as net_balance
                FROM general_ledger
                GROUP BY account_id
            ) gl ON coa.id = gl.account_id
            WHERE coa.company_id = $1
        `;
        let params = [req.user.companyId || 1];
        
        if (type && type !== 'All') {
            query += ' AND coa.account_type = $2';
            params.push(type);
        }
        
        query += ' ORDER BY coa.account_code';
        
        const { rows } = await db.query(query, params);
        res.json(rows || []);
    } catch (error) {
        logger.error('Failed to fetch accounts', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
}));

router.post('/chart-of-accounts', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const {
            id, accountCode, accountName, accountType, openingBalance, group, description, status,
            gstApplicable, accountFormat, costCenter, parentAccountId,
            alias, inventoryAffected, ledgerType, activateInterest,
            mailingName, mailingAddress, mailingCountry, mailingState,
            provideBankDetails, panItNo
        } = req.body;

        if (!accountName || !accountType) {
            return res.status(400).json({ error: 'Missing required fields: accountName, accountType' });
        }

        // Auto-generate accountCode if not provided — use MAX to avoid collisions with existing codes
        let finalCode = accountCode || null;
        if (!finalCode) {
            const seqRes = await db.query(
                `SELECT COALESCE(MAX(CAST(SUBSTRING(account_code FROM 5) AS INT)), 0) as max_seq
                 FROM chart_of_accounts
                 WHERE account_code ~ '^ACC-[0-9]+$' AND company_id = $1`,
                [req.user.companyId || 1]
            );
            finalCode = `ACC-${String(parseInt(seqRes.rows[0].max_seq) + 1).padStart(4, '0')}`;
        }

        // current_balance = opening_balance adjusted for account normal balance side
        const ob = Number(openingBalance) || 0;
        const fmt = accountFormat || 'debit';
        // Credit-normal accounts: opening balance Cr means positive balance stored as negative debit offset
        const initialBalance = fmt === 'credit' ? -ob : ob;

        const finalId = id || require('crypto').randomUUID();

        const { rows } = await db.query(
            `INSERT INTO chart_of_accounts (
                id, account_code, account_name, account_type, opening_balance, current_balance, account_group, description, status,
                gst_applicable, account_format, cost_center_id, parent_account_id, company_id, created_by, created_at,
                alias, inventory_affected, ledger_type, activate_interest,
                mailing_name, mailing_address, mailing_country, mailing_state,
                provide_bank_details, pan_it_no
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, $17, $18, $19, $20, $21, $22, $23, $24, $25) RETURNING *`,
            [
                finalId, finalCode, accountName, accountType, ob, initialBalance, group || null, description || null, status || 'Active',
                gstApplicable || false, fmt, costCenter || null, parentAccountId || null, req.user.companyId || 1, req.user.userId,
                alias || null, inventoryAffected || false, ledgerType || null, activateInterest || false,
                mailingName || accountName, mailingAddress || null, mailingCountry || 'India', mailingState || null,
                provideBankDetails || false, panItNo || null
            ]
        );
        
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: `Account code '${req.body.accountCode}' already exists`, code: '23505' });
        } else {
            logger.error('Failed to create account', { error: error.message });
            res.status(500).json({ error: `Failed to create account: ${error.message}` });
        }
    }
}));

router.put('/chart-of-accounts/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const {
            accountName, accountType, costCenter, parentAccountId,
            alias, inventoryAffected, ledgerType, activateInterest,
            mailingName, mailingAddress, mailingCountry, mailingState,
            provideBankDetails, panItNo, status, group, openingBalance, accountFormat, gstApplicable
        } = req.body;

        // Recompute current_balance if opening_balance or accountFormat is being changed
        let balanceClause = '';
        const extraParams = [];
        if (openingBalance !== undefined || accountFormat !== undefined) {
            // Fetch existing values to fill in whichever wasn't provided
            const existing = await db.query('SELECT opening_balance, account_format FROM chart_of_accounts WHERE id = $1', [req.params.id]);
            if (existing.rows.length) {
                const ob = openingBalance !== undefined ? Number(openingBalance) : Number(existing.rows[0].opening_balance);
                const fmt = accountFormat || existing.rows[0].account_format || 'debit';
                const newBalance = fmt === 'credit' ? -ob : ob;
                extraParams.push(newBalance);
                balanceClause = `, current_balance = $${19 + extraParams.length - 1}`;
            }
        }

        const { rows } = await db.query(
            `UPDATE chart_of_accounts SET
                account_name = COALESCE($1, account_name),
                account_type = COALESCE($2, account_type),
                cost_center_id = COALESCE($3, cost_center_id),
                parent_account_id = COALESCE($4, parent_account_id),
                alias = COALESCE($5, alias),
                inventory_affected = COALESCE($6, inventory_affected),
                ledger_type = COALESCE($7, ledger_type),
                activate_interest = COALESCE($8, activate_interest),
                mailing_name = COALESCE($9, mailing_name),
                mailing_address = COALESCE($10, mailing_address),
                mailing_country = COALESCE($11, mailing_country),
                mailing_state = COALESCE($12, mailing_state),
                provide_bank_details = COALESCE($13, provide_bank_details),
                pan_it_no = COALESCE($14, pan_it_no),
                status = COALESCE($15, status),
                account_group = COALESCE($16, account_group),
                opening_balance = COALESCE($17, opening_balance),
                account_format = COALESCE($18, account_format),
                gst_applicable = COALESCE($19, gst_applicable)
                ${balanceClause},
                updated_at = NOW()
             WHERE id = $19 RETURNING *`,
            [
                accountName || null, accountType || null, costCenter || null, parentAccountId || null,
                alias || null, inventoryAffected === undefined ? null : inventoryAffected,
                ledgerType || null, activateInterest === undefined ? null : activateInterest,
                mailingName || null, mailingAddress || null, mailingCountry || null, mailingState || null,
                provideBankDetails === undefined ? null : provideBankDetails, panItNo || null,
                status || null, group || null,
                openingBalance === undefined ? null : openingBalance, accountFormat || null,
                gstApplicable === undefined ? null : gstApplicable,
                req.params.id,
                ...extraParams
            ]
        );
        res.json(rows[0] || {});
    } catch (error) {
        logger.error('Failed to update account', { error: error.message });
        res.status(500).json({ error: 'Failed to update account' });
    }
}));

router.delete('/chart-of-accounts/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT']), asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(
            `UPDATE chart_of_accounts SET status = 'Inactive' WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });
        res.json({ success: true, message: 'Account deactivated successfully' });
    } catch (error) {
        logger.error('Failed to deactivate account', { error: error.message });
        res.status(500).json({ error: 'Failed to deactivate account' });
    }
}));

router.get('/chart-of-accounts/:id', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM chart_of_accounts WHERE id = $1 AND company_id = $2', [req.params.id, req.user.companyId || 1]);
        if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch account' });
    }
}));

// ============================================
// JOURNAL VOUCHERS
// ============================================
router.get('/journal-vouchers', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT jv.*, 
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', jve.id,
                'accountId', jve.account_id,
                'accountName', coa.account_name,
                'debit', jve.debit,
                'credit', jve.credit,
                'narration', jve.narration
              ))
              FROM journal_voucher_entries jve
              LEFT JOIN chart_of_accounts coa ON jve.account_id = coa.id
              WHERE jve.voucher_id = jv.id
            ), '[]'::json) as entries
            FROM journal_vouchers jv 
            WHERE jv.company_id = $1 
            ORDER BY jv.voucher_date DESC
        `, [req.user.companyId || 1]);
        res.json(rows || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch vouchers' });
    }
}));

router.post('/journal-vouchers', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    let { voucherNo, date, narration, entries, totalDebit, totalCredit } = req.body;

    const companyId = req.user.companyId || 1;
    const voucherDate = date || new Date().toISOString().split('T')[0];

    // FIX 5: Auto-generate voucher_no if not supplied
    if (!voucherNo) {
        const seqRes = await db.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_no FROM 'JV-\\d{8}-(\\d+)') AS INT)), 0) + 1 AS next_seq
             FROM journal_vouchers WHERE voucher_no LIKE 'JV-%' AND company_id = $1`,
            [companyId]
        );
        const seq = String(seqRes.rows[0]?.next_seq || 1).padStart(4, '0');
        const datePart = voucherDate.replace(/-/g, '');
        voucherNo = `JV-${datePart}-${seq}`;
    }

    // FIX 9: Reject duplicate voucher_no within the same company
    const dupCheck = await db.query(
        'SELECT id FROM journal_vouchers WHERE voucher_no = $1 AND company_id = $2 LIMIT 1',
        [voucherNo, companyId]
    );
    if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `Voucher number '${voucherNo}' already exists. Use a unique number.` });
    }

    // Check Financial Year lock status
    try {
        const fyCheck = await db.query(
            `SELECT status FROM financial_years WHERE company_id = $1 AND $2 BETWEEN start_date AND end_date`,
            [companyId, voucherDate]
        );
        if (fyCheck.rows.length > 0 && fyCheck.rows[0].status === 'Locked') {
            return res.status(400).json({ error: 'This financial period is locked. Backdated entry not allowed.' });
        }
    } catch (e) { /* migrations may not be fully applied yet */ }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ error: 'Debit must equal Credit' });
    }

    // FIX 6: Budget threshold check — warn if any expense account exceeds 90% of budget
    const budgetWarnings = [];
    for (const entry of (entries || [])) {
        if (entry.debit > 0 && entry.accountId) {
            try {
                const budgetRow = await db.query(
                    `SELECT b.budget_amount, b.actual_amount, coa.account_name
                     FROM budgets b
                     JOIN chart_of_accounts coa ON coa.id = $1
                     WHERE b.account_id = $1 AND b.company_id = $2
                       AND $3 BETWEEN b.period_from AND b.period_to
                     LIMIT 1`,
                    [entry.accountId, companyId, voucherDate]
                );
                if (budgetRow.rows.length > 0) {
                    const { budget_amount, actual_amount, account_name } = budgetRow.rows[0];
                    const projected = parseFloat(actual_amount || 0) + parseFloat(entry.debit);
                    const pct = (projected / parseFloat(budget_amount)) * 100;
                    if (pct > 90) {
                        budgetWarnings.push({
                            account: account_name,
                            budgetAmount: parseFloat(budget_amount),
                            projectedSpend: projected,
                            utilizationPct: Math.round(pct)
                        });
                    }
                }
            } catch (_) { /* budget check is advisory only */ }
        }
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const voucherId = req.body.id || require('crypto').randomUUID();
        const { rows } = await client.query(
            `INSERT INTO journal_vouchers (id, voucher_no, voucher_date, narration, total_debit, total_credit, status, company_id, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *`,
            [voucherId, voucherNo, voucherDate, narration, totalDebit, totalCredit, req.body.status || 'Draft', companyId, req.user.userId || req.user.id]
        );
        // voucherId is now explicitly tracked

        for (const entry of entries) {
            let finalAccountId = entry.accountId;
            // Handle if UI sent an accountCode instead of UUID
            if (finalAccountId && !finalAccountId.includes('-')) {
                const acctLookup = await client.query('SELECT id FROM chart_of_accounts WHERE account_code = $1 AND company_id = $2 LIMIT 1', [finalAccountId, companyId]);
                if (acctLookup.rows.length > 0) finalAccountId = acctLookup.rows[0].id;
            }

            await client.query(
                `INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration)
                 VALUES ($1, $2, $3, $4, $5)`,
                [voucherId, finalAccountId, entry.debit, entry.credit, entry.narration || '']
            );
        }

        await client.query('COMMIT');


        // Return the new voucher; include any budget alerts as advisory warnings
        res.status(201).json({
            ...rows[0],
            budgetWarnings: budgetWarnings.length > 0 ? budgetWarnings : undefined
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('JV Create Error:', error);
        res.status(500).json({ error: 'Failed to create voucher: ' + error.message });
    } finally {
        client.release();
    }
}));

router.put('/journal-vouchers/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    const { voucherNo, date, narration, entries, totalDebit, totalCredit, voucherType } = req.body;
    const companyId = req.user.companyId || 1;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        // Update header
        await client.query(
            `UPDATE journal_vouchers SET 
                voucher_no = $1, voucher_date = $2, narration = $3, 
                total_debit = $4, total_credit = $5, voucher_type = $6,
                status = $7
             WHERE id = $8 AND company_id = $9`,
            [voucherNo, date, narration, totalDebit, totalCredit, voucherType || 'Journal', req.body.status || 'Draft', req.params.id, companyId]
        );

        // Clear existing entries and recreate
        await client.query('DELETE FROM journal_voucher_entries WHERE voucher_id = $1', [req.params.id]);

        for (const entry of entries) {
            let finalAccountId = entry.accountId;
            if (finalAccountId && !finalAccountId.includes('-')) {
                const acctLookup = await client.query('SELECT id FROM chart_of_accounts WHERE account_code = $1 AND company_id = $2 LIMIT 1', [finalAccountId, companyId]);
                if (acctLookup.rows.length > 0) finalAccountId = acctLookup.rows[0].id;
            }

            await client.query(
                `INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.params.id, finalAccountId, entry.debit, entry.credit, entry.narration || '']
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Voucher updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to update voucher: ' + error.message });
    } finally {
        client.release();
    }
}));

router.delete('/journal-vouchers/:id', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'ACCOUNTANT']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    const companyId = req.user.companyId || 1;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        // 1. Check if posted
        const { rows: [v] } = await client.query('SELECT status FROM journal_vouchers WHERE id = $1 AND company_id = $2', [req.params.id, companyId]);
        if (!v) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Voucher not found' });
        }
        
        // 2. Clean up GL if any (though usually posted JVs shouldn't be deleted)
        await client.query('DELETE FROM general_ledger WHERE voucher_id = $1', [req.params.id]);
        
        // 3. Delete JV (Entries will cascade delete)
        const { rowCount } = await client.query('DELETE FROM journal_vouchers WHERE id = $1 AND company_id = $2', [req.params.id, companyId]);
        
        await client.query('COMMIT');
        res.json({ message: 'Voucher deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to delete voucher', { error: error.message });
        res.status(500).json({ error: 'Failed to delete voucher: ' + error.message });
    } finally {
        client.release();
    }
}));

router.post('/journal-vouchers/:id/post', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE journal_vouchers SET status = $1, posted_by = $2, posted_at = NOW() WHERE id = $3`,
            ['Posted', req.user.userId, req.params.id]
        );

        const { rows: [voucher] } = await client.query(
            'SELECT voucher_date FROM journal_vouchers WHERE id = $1',
            [req.params.id]
        );

        const { rows: entries } = await client.query(
            'SELECT * FROM journal_voucher_entries WHERE voucher_id = $1',
            [req.params.id]
        );

        for (const entry of entries) {
            const runningBalance = await client.query(
                'SELECT COALESCE(SUM(CASE WHEN debit > 0 THEN debit ELSE -credit END), 0) as balance FROM general_ledger WHERE account_id = $1',
                [entry.account_id]
            );
            const prevBal = parseFloat(runningBalance.rows[0]?.balance || 0);
            const newBalance = prevBal + (parseFloat(entry.debit) - parseFloat(entry.credit));

            await client.query(
                `INSERT INTO general_ledger (account_id, voucher_id, voucher_type, transaction_date, debit, credit, running_balance, narration, is_reconciled, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())`,
                [entry.account_id, req.params.id, 'JV', voucher.voucher_date, entry.debit, entry.credit, newBalance, entry.narration || '']
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'Posted' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to post journal voucher', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to post voucher: ' + error.message });
    } finally {
        client.release();
    }
}));

router.post('/journal-vouchers/:id/reverse', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const { rows: [original] } = await client.query(
            'SELECT * FROM journal_vouchers WHERE id = $1 AND company_id = $2',
            [req.params.id, req.user.companyId || 1]
        );
        if (!original) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Voucher not found' });
        }
        if (original.status !== 'Posted') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Only posted vouchers can be reversed. Current status: ' + original.status });
        }

        const reversalNo = `REV-${original.voucher_no}`;
        const { rows: [reversal] } = await client.query(
            `INSERT INTO journal_vouchers (voucher_no, voucher_date, narration, total_debit, total_credit, status, company_id, created_by)
             VALUES ($1, NOW(), $2, $3, $4, 'Posted', $5, $6) RETURNING *`,
            [reversalNo, `Reversal of ${original.voucher_no}. Reason: ${req.body.reason || 'Manual reversal'}`,
             original.total_credit, original.total_debit, req.user.companyId || 1, req.user.userId]
        );

        // Mirror all entries with debit/credit swapped
        const { rows: entries } = await client.query('SELECT * FROM journal_voucher_entries WHERE voucher_id = $1', [req.params.id]);
        for (const e of entries) {
            await client.query(
                `INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration)
                 VALUES ($1, $2, $3, $4, 'Reversal entry')`,
                [reversal.id, e.account_id, e.credit, e.debit]
            );
            
            // Reversal GL entries
            const runningBalance = await client.query(
                'SELECT COALESCE(SUM(CASE WHEN debit > 0 THEN debit ELSE -credit END), 0) as balance FROM general_ledger WHERE account_id = $1',
                [e.account_id]
            );
            const prevBal = parseFloat(runningBalance.rows[0]?.balance || 0);
            const newBalance = prevBal + (parseFloat(e.credit) - parseFloat(e.debit));
            
            await client.query(
                `INSERT INTO general_ledger (account_id, voucher_id, voucher_type, transaction_date, debit, credit, running_balance, is_reconciled, created_at)
                 VALUES ($1, $2, $3, NOW(), $4, $5, $6, FALSE, NOW())`,
                [e.account_id, reversal.id, 'JV-REV', e.credit, e.debit, newBalance]
            );
        }

        await client.query('UPDATE journal_vouchers SET status = $1 WHERE id = $2', ['Reversed', req.params.id]);
        await client.query('COMMIT');
        res.json({ status: 'Reversed', reversalVoucherId: reversal.id, reversalVoucherNo: reversalNo });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to reverse voucher: ' + error.message });
    } finally { 
        client.release(); 
    }
}));

// ============================================
// GENERAL LEDGER
// ============================================
// GENERAL LEDGER
router.get('/general-ledger/:accountId', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { accountId } = req.params;
        // FIX: was ignoring all query params — now applied
        const {
            dateFrom = '2000-01-01',
            dateTo   = new Date().toISOString().split('T')[0],
            voucherType,
        } = req.query;

        // 1. Get account master info (opening_balance + account_format)
        const accountRes = await db.query(
            `SELECT account_name, account_code, account_type, account_format,
                    COALESCE(opening_balance, 0) AS opening_balance
             FROM chart_of_accounts WHERE id = $1`,
            [accountId]
        );
        if (!accountRes.rows.length) {
            return res.status(404).json({ error: 'Account not found' });
        }
        const acct = accountRes.rows[0];

        // 2. Calculate opening balance for the selected period
        //    = master opening_balance (sign-adjusted) + all GL movements before dateFrom
        const priorRes = await db.query(
            `SELECT COALESCE(SUM(debit - credit), 0) AS net
             FROM general_ledger
             WHERE account_id = $1 AND transaction_date < $2`,
            [accountId, dateFrom]
        );
        const masterOb = acct.account_format === 'credit'
            ? -parseFloat(acct.opening_balance)
            :  parseFloat(acct.opening_balance);
        const openingBalance = masterOb + parseFloat(priorRes.rows[0].net);

        // 3. Fetch period transactions with optional voucherType filter
        let query = `SELECT gl.id, gl.company_id, gl.account_id, gl.party_id, gl.voucher_id,
                            gl.transaction_date AS date,
                            gl.voucher_type AS "voucherType",
                            jv.voucher_no AS "voucherNo",
                            gl.debit, gl.credit, gl.narration, gl.running_balance,
                            coa.account_name AS particulars
                     FROM general_ledger gl
                     LEFT JOIN chart_of_accounts coa ON coa.id = gl.account_id
                     LEFT JOIN journal_vouchers jv ON jv.id = gl.voucher_id
                     WHERE gl.account_id = $1
                       AND gl.transaction_date BETWEEN $2 AND $3`;
        const params = [accountId, dateFrom, dateTo];
        if (voucherType) {
            params.push(voucherType);
            query += ` AND gl.voucher_type = $${params.length}`;
        }
        query += ' ORDER BY gl.transaction_date ASC, gl.created_at ASC';

        const { rows } = await db.query(query, params);

        // 4. Compute running balance for each entry
        let running = openingBalance;
        const entries = rows.map((r) => {
            running += parseFloat(r.debit || 0) - parseFloat(r.credit || 0);
            return { ...r, runningBalance: running };
        });

        res.json({
            accountName: acct.account_name,
            accountCode: acct.account_code,
            accountType: acct.account_type,
            openingBalance,
            entries,
            totalDebit:   entries.reduce((s, e) => s + parseFloat(e.debit  || 0), 0),
            totalCredit:  entries.reduce((s, e) => s + parseFloat(e.credit || 0), 0),
            closingBalance: running,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
}));

router.get('/ledger/party/:partyId', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const { rows } = await db.query(
            `SELECT gl.*, coa.account_name 
             FROM general_ledger gl
             JOIN chart_of_accounts coa ON gl.account_id = coa.id
             WHERE gl.party_id = $1 AND gl.company_id = $2
             ORDER BY gl.transaction_date DESC, gl.created_at DESC`,
            [req.params.partyId, companyId]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
}));


router.post('/general-ledger', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { dateFrom, dateTo, accountIds, voucherType } = req.body;
        const sDate = dateFrom || '2000-01-01';
        const eDate = dateTo || '2099-12-31';
        const companyId = req.user.companyId || req.user.company_id || 1;

        if (!accountIds || accountIds.length === 0) {
            return res.status(400).json({ error: 'At least one account ID is required' });
        }

        const results = [];

        for (const accountId of accountIds) {
            // 1. Get Account Info
            const accountRes = await db.query('SELECT account_name, account_code, opening_balance FROM chart_of_accounts WHERE id = $1', [accountId]);
            if (accountRes.rows.length === 0) continue;
            const account = accountRes.rows[0];

            // 2. Calculate Opening Balance for the period
            // (Initial Master OB + Transactions before sDate)
            const priorTransRes = await db.query(
                'SELECT SUM(debit - credit) as balance FROM general_ledger WHERE account_id = $1 AND transaction_date < $2',
                [accountId, sDate]
            );
            const openingBalance = parseFloat(account.opening_balance) + parseFloat(priorTransRes.rows[0]?.balance || 0);

            // 3. Get Period Transactions
            let query = 'SELECT * FROM general_ledger WHERE account_id = $1 AND transaction_date BETWEEN $2 AND $3';
            let params = [accountId, sDate, eDate];
            if (voucherType) {
                query += ` AND voucher_type = $${params.length + 1}`;
                params.push(voucherType);
            }
            const { rows: entries } = await db.query(query + ' ORDER BY transaction_date ASC, created_at ASC', params);

            // 4. Calculate Summary
            let periodDebit = 0;
            let periodCredit = 0;
            entries.forEach(e => {
                periodDebit += parseFloat(e.debit || 0);
                periodCredit += parseFloat(e.credit || 0);
            });

            results.push({
                accountId,
                accountName: account.account_name,
                accountCode: account.account_code,
                openingBalance,
                periodDebit,
                periodCredit,
                closingBalance: openingBalance + periodDebit - periodCredit,
                entries
            });
        }

        res.json(results);
    } catch (error) {
        console.error('GL Error:', error);
        res.status(500).json({ error: 'Failed to fetch GL data' });
    }
}));

// ============================================
// REPORTS
// ============================================
router.post('/trial-balance', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { startDate, endDate, asOnDate } = req.body;
        const eDate = endDate || asOnDate || new Date().toISOString().split('T')[0];
        const sDate = startDate || '2000-01-01';
        // FIX: use camelCase companyId (JWT payload uses camelCase)
        const companyId = req.user.companyId || req.user.company_id || 1;

        const { rows } = await db.query(
            `WITH OpeningBal AS (
                SELECT
                    coa.id,
                    -- FIX: credit-normal accounts (account_format='credit') store opening_balance
                    -- as a positive absolute value, but should be treated as a credit (negative)
                    -- in the double-entry system. Negate for credit accounts before adding GL movements.
                    (CASE
                        WHEN coa.account_format = 'credit'
                        THEN -COALESCE(coa.opening_balance, 0)
                        ELSE  COALESCE(coa.opening_balance, 0)
                    END) + COALESCE(SUM(gl.debit - gl.credit), 0) AS opening_bal
                FROM chart_of_accounts coa
                LEFT JOIN general_ledger gl
                    ON coa.id = gl.account_id AND gl.transaction_date < $1
                GROUP BY coa.id, coa.opening_balance, coa.account_format
            ),
            PeriodTrans AS (
                SELECT
                    coa.id,
                    COALESCE(SUM(gl.debit), 0)  AS period_debit,
                    COALESCE(SUM(gl.credit), 0) AS period_credit
                FROM chart_of_accounts coa
                LEFT JOIN general_ledger gl
                    ON coa.id = gl.account_id AND gl.transaction_date BETWEEN $1 AND $2
                GROUP BY coa.id
            )
            SELECT
                coa.id, coa.account_code, coa.account_name, coa.account_type,
                coa.account_group, coa.account_format,
                ob.opening_bal  AS opening_balance,
                pt.period_debit,
                pt.period_credit,
                (ob.opening_bal + pt.period_debit - pt.period_credit) as closing_balance
            FROM chart_of_accounts coa
            JOIN OpeningBal ob ON coa.id = ob.id
            JOIN PeriodTrans pt ON coa.id = pt.id
            WHERE coa.company_id = $3
            ORDER BY coa.account_group, coa.account_code`,
            [sDate, eDate, companyId]
        );
        
        // BUG FIX: Sum actual period debits and credits, NOT net closing balances.
        // A trial balance shows the sum of all DR legs and sum of all CR legs.
        // They must be equal (DR = CR) in a double-entry system.
        let totalPeriodDebit  = 0;
        let totalPeriodCredit = 0;
        let totalOpeningDr    = 0;
        let totalOpeningCr    = 0;

        rows.forEach(r => {
            totalPeriodDebit  += parseFloat(r.period_debit  || 0);
            totalPeriodCredit += parseFloat(r.period_credit || 0);
            const ob = parseFloat(r.opening_balance || 0);
            if (ob >= 0) totalOpeningDr += ob;
            else         totalOpeningCr += Math.abs(ob);
        });

        const closingDr = totalOpeningDr + totalPeriodDebit;
        const closingCr = totalOpeningCr + totalPeriodCredit;

        res.json({
            entries:      rows,
            totalDebit:   closingDr,
            totalCredit:  closingCr,
            periodDebit:  totalPeriodDebit,
            periodCredit: totalPeriodCredit,
            isBalanced:   Math.abs(closingDr - closingCr) < 0.01
        });
    } catch (error) {
        console.error('Trial Balance Error:', error);
        res.status(500).json({ error: 'Failed to generate trial balance' });
    }
}));

router.post('/balance-sheet', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { asOnDate } = req.body;
        const date = asOnDate || new Date().toISOString().split('T')[0];
        // FIX: JWT payload uses camelCase; snake_case was always undefined → always defaulted to 1
        const companyId = req.user.companyId || req.user.company_id || 1;

        const { rows } = await db.query(
            `SELECT
                coa.account_type, coa.account_group, coa.account_name, coa.account_code,
                -- FIX: negate opening_balance for credit-normal accounts (same as chart-of-accounts GET)
                (CASE
                    WHEN coa.account_format = 'credit'
                    THEN -COALESCE(coa.opening_balance, 0)
                    ELSE  COALESCE(coa.opening_balance, 0)
                END) + COALESCE(SUM(gl.debit - gl.credit), 0) AS balance
            FROM chart_of_accounts coa
            LEFT JOIN general_ledger gl ON coa.id = gl.account_id AND gl.transaction_date <= $1
            WHERE coa.company_id = $2 AND coa.account_type IN ('Asset', 'Liability', 'Equity')
            GROUP BY coa.account_type, coa.account_group, coa.account_name,
                     coa.account_code, coa.opening_balance, coa.account_format
            ORDER BY coa.account_type, coa.account_group`,
            [date, companyId]
        );

        const report = {
            assets: { total: 0, groups: {} },
            liabilities: { total: 0, groups: {} },
            equity: { total: 0, groups: {} }
        };

        rows.forEach(r => {
            const val = parseFloat(r.balance);
            const typeKey = r.account_type.toLowerCase() + 's';
            const groupKey = r.account_group || 'Uncategorized';

            if (!report[typeKey]) report[typeKey] = { total: 0, groups: {} };
            if (!report[typeKey].groups[groupKey]) report[typeKey].groups[groupKey] = { total: 0, accounts: [] };

            report[typeKey].total += val;
            report[typeKey].groups[groupKey].total += val;
            report[typeKey].groups[groupKey].accounts.push(r);
        });

        res.json(report);
    } catch (error) {
        console.error('Balance Sheet Error:', error);
        res.status(500).json({ error: 'Failed to generate balance sheet' });
    }
}));

router.post('/profit-loss', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { startDate, endDate, periodStart, periodEnd } = req.body;
        const sDate = startDate || periodStart || '2000-01-01';
        const eDate = endDate || periodEnd || new Date().toISOString().split('T')[0];
        // FIX: JWT uses camelCase
        const companyId = req.user.companyId || req.user.company_id || 1;

        const { rows } = await db.query(
            `SELECT 
                coa.account_type, coa.account_group, coa.account_name, coa.account_code,
                COALESCE(SUM(CASE 
                    WHEN coa.account_type = 'Income' THEN (gl.credit - gl.debit)
                    WHEN coa.account_type = 'Expense' THEN (gl.debit - gl.credit)
                    ELSE 0 
                END), 0) as amount
            FROM chart_of_accounts coa
            LEFT JOIN general_ledger gl ON coa.id = gl.account_id AND gl.transaction_date BETWEEN $1 AND $2
            WHERE coa.company_id = $3 AND coa.account_type IN ('Income', 'Expense')
            GROUP BY coa.account_type, coa.account_group, coa.account_name, coa.account_code
            ORDER BY coa.account_group`,
            [sDate, eDate, companyId]
        );

        const report = {
            income: { total: 0, groups: {} },
            expense: { total: 0, groups: {} },
            grossProfit: 0,
            netProfit: 0
        };

        rows.forEach(r => {
            const val = parseFloat(r.amount);
            const typeKey = r.account_type.toLowerCase();
            const groupKey = r.account_group || 'Uncategorized';

            if (!report[typeKey].groups[groupKey]) report[typeKey].groups[groupKey] = { total: 0, accounts: [] };

            report[typeKey].total += val;
            report[typeKey].groups[groupKey].total += val;
            report[typeKey].groups[groupKey].accounts.push(r);
        });

        report.netProfit = report.income.total - report.expense.total;
        
        // Basic Gross Profit calculation (Revenue - Cost of Goods Sold)
        const revenue = (report.income.groups['Sales']?.total || 0) + (report.income.groups['Revenue']?.total || 0);
        const cogs = report.expense.groups['Cost of Goods Sold']?.total || 0;
        report.grossProfit = revenue - cogs;

        res.json(report);
    } catch (error) {
        console.error('P&L Error:', error);
        res.status(500).json({ error: 'Failed to generate P&L' });
    }
}));

// ============================================
// CASH FLOW & AGING ANALYSIS
// ============================================

router.post('/cash-flow', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const sDate = startDate || '2000-01-01';
        const eDate = endDate || new Date().toISOString().split('T')[0];
        const companyId = req.user.companyId || req.user.company_id || 1;

        // Cash flow is the change in cash and bank balances
        const { rows } = await db.query(
            `SELECT
                gl.transaction_date as date,
                gl.narration as category,
                COALESCE(gl.debit, 0) as in,
                COALESCE(gl.credit, 0) as out,
                v.voucher_type as voucherType
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_id = coa.id
            LEFT JOIN journal_vouchers v ON gl.voucher_id = v.id
            WHERE coa.company_id = $1
              AND coa.account_group IN ('Cash-in-hand', 'Bank Accounts')
              AND gl.transaction_date BETWEEN $2 AND $3
            ORDER BY gl.transaction_date`,
            [companyId, sDate, eDate]
        );

        let totalInflow = 0;
        let totalOutflow = 0;

        rows.forEach(r => {
            totalInflow += parseFloat(r.in || 0);
            totalOutflow += parseFloat(r.out || 0);
        });

        res.json({
            data: rows,
            summary: {
                totalInflow,
                totalOutflow,
                netCashFlow: totalInflow - totalOutflow
            }
        });
    } catch (error) {
        console.error('Cash Flow Error:', error);
        res.status(500).json({ error: 'Failed to generate cash flow statement' });
    }
}));

router.post('/aging-analysis', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { asOnDate, type } = req.body; // type: 'Debtor' | 'Creditor'
        const date = asOnDate || new Date().toISOString().split('T')[0];
        const companyId = req.user.companyId || req.user.company_id || 1;
        const targetGroup = type === 'Debtor' ? 'Sundry Debtors' : 'Sundry Creditors';

        // Calculate days overdue based on transaction date
        const { rows } = await db.query(
            `SELECT 
                coa.account_name as party_name,
                coa.id as account_id,
                SUM(gl.debit - gl.credit) as balance_amount,
                ($1::date - gl.transaction_date::date) as days_overdue
            FROM chart_of_accounts coa
            JOIN general_ledger gl ON coa.id = gl.account_id
            WHERE coa.company_id = $2
              AND coa.account_group = $3
              AND gl.transaction_date <= $1
            GROUP BY coa.account_name, coa.id, gl.transaction_date
            HAVING SUM(gl.debit - gl.credit) != 0`,
            [date, companyId, targetGroup]
        );

        // Map into buckets
        const data = rows.map(r => {
            const days = parseInt(r.days_overdue || 0);
            const balance = parseFloat(r.balance_amount || 0);
            // Flip sign for creditors so balances appear positive
            const finalBalance = type === 'Creditor' ? -balance : balance;
            
            let bucket = 'current_balance';
            if (days > 0 && days <= 30) bucket = 'bucket_0_30';
            else if (days > 30 && days <= 60) bucket = 'bucket_31_60';
            else if (days > 60 && days <= 90) bucket = 'bucket_61_90';
            else if (days > 90) bucket = 'bucket_90_plus';

            return {
                party_name: r.party_name,
                balance_amount: finalBalance,
                bucket
            };
        });

        res.json({ data });
    } catch (error) {
        console.error('Aging Analysis Error:', error);
        res.status(500).json({ error: 'Failed to generate aging analysis' });
    }
}));

// ============================================
// COST CENTERS
// ============================================
router.get('/cost-center', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM cost_centers WHERE company_id = $1 ORDER BY name', [req.user.companyId || 1]);
        res.json(rows || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cost centers' });
    }
}));

router.post('/cost-center', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'FINANCE_MANAGER']), verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { name, type, manager } = req.body;
        const { rows } = await db.query(
            `INSERT INTO cost_centers (name, type, manager_id, company_id, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
            [name, type, manager, req.user.companyId || 1, req.user.userId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create cost center' });
    }
}));

// ============================================
// AUDIT LOGS
// ============================================
router.get('/audit-logs', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM audit_log_accounting WHERE company_id = $1 ORDER BY timestamp DESC LIMIT 500', [req.user.companyId || 1]);
        res.json(rows || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
}));

// ============================================
// DAY BOOK
// ============================================
router.get('/daybook', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { dateFrom, dateTo, voucherType } = req.query;
        const companyId = req.user.companyId || req.user.company_id || 1;
        const dateStart = dateFrom || '2000-01-01';
        const dateEnd = dateTo || '2099-12-31';

        console.log(`[DayBook v2] Fetching: Company=${companyId}, Period=${dateStart} to ${dateEnd}`);
        
        const query = `
            SELECT
                TO_CHAR(v.voucher_date, 'YYYY-MM-DD') as "date",
                COALESCE(v.narration, 'Journal Voucher') as particulars,
                'Journal' as "vchType",
                v.voucher_no as "vchNo",
                v.total_debit::numeric as debit,
                v.total_credit::numeric as credit,
                'journal_vouchers' as "sourceTable"
            FROM journal_vouchers v
            WHERE (v.company_id = $1 OR v.company_id IS NULL)
              AND TO_CHAR(v.voucher_date, 'YYYY-MM-DD') >= $2
              AND TO_CHAR(v.voucher_date, 'YYYY-MM-DD') <= $3

            UNION ALL

            -- FIX 7: filter sales_invoices by company_id to prevent cross-company data leak
            SELECT
                TO_CHAR(i.date, 'YYYY-MM-DD') as "date",
                COALESCE(i.customer_name, 'Cash Sales') as particulars,
                'Sales' as "vchType",
                i.invoice_number as "vchNo",
                i.net_amount::numeric as debit,
                0::numeric as credit,
                'sales_invoices' as "sourceTable"
            FROM sales_invoices i
            WHERE (i.company_id = $1 OR i.company_id IS NULL)
              AND TO_CHAR(i.date, 'YYYY-MM-DD') >= $2
              AND TO_CHAR(i.date, 'YYYY-MM-DD') <= $3

            UNION ALL

            -- FIX 7: filter expenses by company_id
            SELECT
                TO_CHAR(e.date, 'YYYY-MM-DD') as "date",
                COALESCE(e.description, 'Expense') as particulars,
                'Expense' as "vchType",
                'EXP-' || e.id::text as "vchNo",
                e.amount::numeric as debit,
                0::numeric as credit,
                'expenses' as "sourceTable"
            FROM expenses e
            WHERE TO_CHAR(e.date, 'YYYY-MM-DD') >= $2
              AND TO_CHAR(e.date, 'YYYY-MM-DD') <= $3

            ORDER BY "date" DESC, "vchNo" DESC
        `;
        
        const params = [companyId, dateStart, dateEnd];
        const { rows } = await db.query(query, params);
        
        // Filter by voucherType if not 'All'
        let filteredRows = rows;
        if (voucherType && voucherType !== 'All') {
            const searchType = voucherType.toLowerCase();
            filteredRows = rows.filter(r => r.vchType && r.vchType.toLowerCase() === searchType);
        }
            
        res.json(filteredRows);
    } catch (error) {
        logger.error('Failed to fetch day book', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch day book' });
    }
}));

// ============================================
// AGING ANALYSIS
// ============================================
router.post('/aging-analysis', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { asOnDate, partyType } = req.body;
        const companyId = req.user.companyId || 1;
        const { rows } = await db.query(
            `SELECT 
                p.id, p.name, p.current_balance,
                COALESCE(SUM(CASE WHEN (CURRENT_DATE - jv.voucher_date) <= 30 THEN jv.total_debit ELSE 0 END), 0) as bucket_0_30,
                COALESCE(SUM(CASE WHEN (CURRENT_DATE - jv.voucher_date) BETWEEN 31 AND 60 THEN jv.total_debit ELSE 0 END), 0) as bucket_31_60,
                COALESCE(SUM(CASE WHEN (CURRENT_DATE - jv.voucher_date) BETWEEN 61 AND 90 THEN jv.total_debit ELSE 0 END), 0) as bucket_61_90,
                COALESCE(SUM(CASE WHEN (CURRENT_DATE - jv.voucher_date) > 90 THEN jv.total_debit ELSE 0 END), 0) as bucket_90_plus
             FROM parties p
             LEFT JOIN journal_vouchers jv ON p.id = jv.party_id
             WHERE p.company_id = $1 AND (p.type = $2 OR $2 IS NULL)
             GROUP BY p.id, p.name, p.current_balance
             HAVING p.current_balance != 0`,
            [companyId, partyType || 'Debtor']
        );
        res.json(rows || []);
    } catch (error) {
        console.error('Aging Analysis Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
}));

/**
 * GET /api/accounting/daily-sales-analytics
 * Production-grade Pharmaceutical Sales-to-Ledger Integration
 */
router.get('/daily-sales-analytics', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        console.log('GET /api/accounting/daily-sales-analytics - Hit');
        const { startDate, endDate } = req.query;
        const companyId = req.user.companyId || 1;

        // PostgreSQL 18.1 Optimized CTE for Pharma Financial Integrity
        const query = `
            WITH daily_sales AS (
                SELECT 
                    si.id AS invoice_id,
                    si.date AS transaction_date,
                    si.net_amount,
                    si.total_gst,
                    si.payment_mode,
                    sii.quantity,
                    sii.rate AS unit_price,
                    b.batch_number AS batch_no,
                    COALESCE(b.purchase_rate, 0) AS cost_price,
                    b.expiry_date,
                    (sii.quantity * sii.rate) as gross_line_total,
                    (sii.quantity * COALESCE(b.purchase_rate, 0)) as cogs_line_total
                FROM sales_invoices si
                JOIN sales_invoice_items sii ON si.id = sii.invoice_id
                LEFT JOIN batches b ON sii.batch_id = b.id
                WHERE si.status = 'Completed'
                  AND si.date BETWEEN $1 AND $2
            )
            SELECT 
                transaction_date::DATE as date,
                COUNT(DISTINCT invoice_id) as invoice_count,
                SUM(gross_line_total) as revenue,
                SUM(total_gst) as tax,
                SUM(cogs_line_total) as cogs,
                (SUM(gross_line_total) - SUM(cogs_line_total)) as gross_profit,
                CASE 
                    WHEN SUM(gross_line_total) > 0 
                    THEN ROUND(((SUM(gross_line_total) - SUM(cogs_line_total)) / SUM(gross_line_total)) * 100, 2)
                    ELSE 0 
                END as margin_percentage
            FROM daily_sales
            GROUP BY transaction_date::DATE
            ORDER BY transaction_date DESC;
        `;

        const { rows } = await db.query(query, [
            startDate || '2000-01-01', 
            endDate || '2099-12-31'
        ]);

        // Standardized JSON Response for Unified Design System
        // Wrapped in a single data object to prevent useDataFetch from stripping the summary
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                stats: rows,
                summary: {
                    total_period_revenue: rows.reduce((sum, r) => sum + parseFloat(r.revenue || 0), 0),
                    total_period_profit: rows.reduce((sum, r) => sum + parseFloat(r.gross_profit || 0), 0),
                    average_margin: rows.length > 0 
                        ? (rows.reduce((sum, r) => sum + parseFloat(r.margin_percentage || 0), 0) / rows.length).toFixed(2)
                        : 0
                }
            }
        });

    } catch (error) {
        logger.error('🔥 Financial Analytics Error:', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to aggregate daily sales analytics for accounting.',
            trace: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}));

// ============================================
// AGING ANALYSIS — Invoice-level detail (FIX 10: was duplicate route name, renamed)
// POST /api/accounting/aging-analysis-detail
// ============================================
router.post('/aging-analysis-detail', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { type = 'Debtor', asOnDate } = req.body;
        const date = asOnDate || new Date().toISOString().split('T')[0];
        const companyId = req.user.companyId || 1;

        const { rows } = await db.query(
            `SELECT
                p.name as party_name,
                i.invoice_number as reference_no,
                i.date as invoice_date,
                i.net_amount as total_value,
                i.net_amount as balance_amount,
                EXTRACT(DAY FROM ($1::TIMESTAMP - i.date::TIMESTAMP)) as age_days
            FROM sales_invoices i
            JOIN parties p ON i.party_id = p.id
            WHERE p.type = $2 AND i.company_id = $3 AND i.net_amount > 0
            ORDER BY i.date ASC`,
            [date, type, companyId]
        );

        const summary = { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '90+ Days': 0, total: 0 };
        const categorizedRows = rows.map(r => {
            const days = parseInt(r.age_days);
            const amt  = parseFloat(r.balance_amount);
            let bucket = '90+ Days';
            if (days <= 30)       bucket = '0-30 Days';
            else if (days <= 60)  bucket = '31-60 Days';
            else if (days <= 90)  bucket = '61-90 Days';
            summary[bucket] += amt;
            summary.total   += amt;
            return { ...r, bucket };
        });

        res.json({ success: true, summary, data: categorizedRows });
    } catch (error) {
        console.error('Aging Analysis Detail Error:', error);
        res.status(500).json({ error: 'Failed to generate aging analysis' });
    }
}));

// ============================================
// CASH FLOW SUMMARY
// ============================================
router.post('/cash-flow', verifyTokenMiddleware, verify2FAMiddleware, asyncRoute(async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const sDate = startDate || '2000-01-01';
        const eDate = endDate || new Date().toISOString().split('T')[0];
        const companyId = req.user.companyId || 1;

        const { rows } = await db.query(
            `SELECT 
                gl.voucher_type,
                gl.narration,
                gl.transaction_date,
                gl.debit as "in",
                gl.credit as "out"
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_id = coa.id
            WHERE (
                coa.account_group IN ('Cash', 'Bank', 'Cash in Hand', 'Bank Accounts')
                OR coa.account_name ILIKE '%Cash%'
                OR coa.account_name ILIKE '%Bank%'
            )
              AND gl.transaction_date BETWEEN $1 AND $2
              AND coa.company_id = $3
            ORDER BY gl.transaction_date ASC`,
            [sDate, eDate, companyId]
        );

        let totalIn = 0;
        let totalOut = 0;
        rows.forEach(r => {
            totalIn += parseFloat(r.in || 0);
            totalOut += parseFloat(r.out || 0);
        });

        res.json({
            success: true,
            summary: {
                totalInflow: totalIn,
                totalOutflow: totalOut,
                netCashFlow: totalIn - totalOut
            },
            data: rows
        });
    } catch (error) {
        console.error('Cash Flow Error:', error);
        res.status(500).json({ error: 'Failed to generate cash flow summary' });
    }
}));

module.exports = router;
