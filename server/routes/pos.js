const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');
const ledgerHelper = require('../utils/ledgerHelper');

// Middleware
router.use(verifyTokenMiddleware);
router.use(verifyRoleMiddleware(['ADMIN', 'PHARMACIST', 'SALES_MANAGER', 'ACCOUNTANT']));

/**
 * GET /api/pos/parties
 * Fetch customers/debtors for POS billing
 */
router.get('/parties', async (req, res) => {
    try {
        const { search = '', status = 'Active', type = 'Debtor' } = req.query;
        const params = [];
        let query = `
            SELECT
              id, name, type, gstin, mobile, email, address, city, state, pin_code as "pinCode",
              status, credit_limit as "creditLimit", current_balance as "currentBalance",
              credit_days as "creditDays", category, contact_person as "contactPerson",
              pan, route, territory, remarks, bank_name as "bankName",
              account_number as "accountNumber", ifsc_code as "ifscCode",
              drug_license_no as "drugLicenseNo", created_at as "createdAt", updated_at as "updatedAt"
            FROM parties
            WHERE type IN ('Debtor', 'Customer')
        `;

        // Status filter ('All' = no filter, else filter by status)
        if (status && status !== 'All') {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR mobile ILIKE $${params.length} OR gstin ILIKE $${params.length} OR email ILIKE $${params.length} OR city ILIKE $${params.length})`;
        }

        query += ' ORDER BY name';
        const { rows } = await db.query(query, params);
        res.json({
            success: true,
            data: rows.map(row => ({
                ...row,
                type: row.type === 'Customer' ? 'Debtor' : row.type,
                ledger: []
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/pos/parties
 * Create a customer/debtor party master record
 */
router.post('/parties', async (req, res) => {
    try {
        const {
            name, gstin = null, mobile = '', email = null, address = null,
            city = null, state = null, pinCode = null,
            creditLimit = 0, currentBalance = 0, creditDays = 0,
            category = 'Regular', contactPerson = null, pan = null,
            route = null, territory = null, remarks = null,
            bankName = null, accountNumber = null, ifscCode = null,
            drugLicenseNo = null, status = 'Active'
        } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({ success: false, error: 'Customer name and mobile are required' });
        }

        const { rows } = await db.query(
            `INSERT INTO parties (
                name, type, gstin, mobile, email, address, city, state, pin_code, status,
                credit_limit, current_balance, credit_days, category, contact_person,
                pan, route, territory, remarks, bank_name, account_number, ifsc_code, drug_license_no
             ) VALUES (
                $1,'Debtor',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
             ) RETURNING
                id, name, type, gstin, mobile, email, address, city, state, pin_code as "pinCode",
                status, credit_limit as "creditLimit", current_balance as "currentBalance",
                credit_days as "creditDays", category, contact_person as "contactPerson",
                pan, route, territory, remarks, bank_name as "bankName",
                account_number as "accountNumber", ifsc_code as "ifscCode",
                drug_license_no as "drugLicenseNo", created_at as "createdAt"`,
            [name, gstin, mobile, email, address, city, state, pinCode, status,
             creditLimit, currentBalance, creditDays, category, contactPerson,
             pan, route, territory, remarks, bankName, accountNumber, ifscCode, drugLicenseNo]
        );

        res.status(201).json({ success: true, data: { ...rows[0], ledger: [] } });
    } catch (error) {
        logger.error('Failed to create party', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/pos/parties/:id
 * Update a customer/debtor party master record
 */
router.put('/parties/:id', async (req, res) => {
    try {
        const {
            name, gstin = null, mobile = '', email = null, address = null,
            city = null, state = null, pinCode = null,
            creditLimit = 0, currentBalance = 0, creditDays = 0,
            category = 'Regular', contactPerson = null, pan = null,
            route = null, territory = null, remarks = null,
            bankName = null, accountNumber = null, ifscCode = null,
            drugLicenseNo = null, status = 'Active'
        } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({ success: false, error: 'Customer name and mobile are required' });
        }

        const { rows } = await db.query(
            `UPDATE parties SET
                name=$1, type='Debtor', gstin=$2, mobile=$3, email=$4,
                address=$5, city=$6, state=$7, pin_code=$8, status=$9,
                credit_limit=$10, current_balance=$11, credit_days=$12,
                category=$13, contact_person=$14, pan=$15,
                route=$16, territory=$17, remarks=$18,
                bank_name=$19, account_number=$20, ifsc_code=$21,
                drug_license_no=$22, updated_at=NOW()
             WHERE id=$23
             RETURNING
                id, name, type, gstin, mobile, email, address, city, state, pin_code as "pinCode",
                status, credit_limit as "creditLimit", current_balance as "currentBalance",
                credit_days as "creditDays", category, contact_person as "contactPerson",
                pan, route, territory, remarks, bank_name as "bankName",
                account_number as "accountNumber", ifsc_code as "ifscCode",
                drug_license_no as "drugLicenseNo", updated_at as "updatedAt"`,
            [name, gstin, mobile, email, address, city, state, pinCode, status,
             creditLimit, currentBalance, creditDays, category, contactPerson, pan,
             route, territory, remarks, bankName, accountNumber, ifscCode, drugLicenseNo, req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        res.json({ success: true, data: { ...rows[0], ledger: [] } });
    } catch (error) {
        logger.error('Failed to update party', { error: error.message, partyId: req.params.id });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/pos/parties/:id
 * Soft-delete a customer/debtor party master record
 */
router.delete('/parties/:id', async (req, res) => {
    try {
        const hard = req.query.hard === 'true' && req.user?.role === 'ADMIN';
        const sql = hard
            ? 'DELETE FROM parties WHERE id = $1'
            : "UPDATE parties SET status = 'Inactive', updated_at = NOW() WHERE id = $1";
        const { rowCount } = await db.query(sql, [req.params.id]);

        if (!rowCount) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        res.json({ success: true, deleted: hard });
    } catch (error) {
        logger.error('Failed to delete party', { error: error.message, partyId: req.params.id });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/parties/:id/ledger
 * Fetch real ledger entries for a party from general_ledger / journal_vouchers
 */
router.get('/parties/:id/ledger', async (req, res) => {
    try {
        const { from, to, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const params = [req.params.id];

        let dateFilter = '';
        if (from) { params.push(from); dateFilter += ` AND gl.transaction_date >= $${params.length}`; }
        if (to)   { params.push(to);   dateFilter += ` AND gl.transaction_date <= $${params.length}`; }

        // Try general_ledger table first
        let rows = [];
        try {
            const result = await db.query(
                `SELECT
                    gl.id, gl.transaction_date as date, jv.voucher_type as "voucherType",
                    jv.voucher_no as "voucherNo", gl.debit, gl.credit,
                    gl.narration,
                    SUM(gl.debit - gl.credit) OVER (ORDER BY gl.transaction_date, gl.id) as balance
                 FROM general_ledger gl
                 JOIN journal_vouchers jv ON gl.voucher_id = jv.id
                 WHERE jv.party_id = $1 ${dateFilter}
                 ORDER BY gl.transaction_date DESC, gl.id DESC
                 LIMIT ${Number(limit)} OFFSET ${offset}`,
                params
            );
            rows = result.rows;
        } catch (ledgerErr) {
            logger.warn('general_ledger query failed, falling back to empty', { error: ledgerErr.message });
        }

        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Ledger fetch error', { error: error.message, partyId: req.params.id });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/invoices/stats
 * KPI summary for Sales Register (total revenue, invoice count, avg order, GST collected)
 * MUST be registered BEFORE /invoices/:id to avoid being captured as an ID lookup.
 */
router.get('/invoices/stats', async (req, res) => {
    try {
        const now = new Date(); // §5A: date computed at request time
        const { date_from, date_to } = req.query;

        const params = [];
        let where = "WHERE si.invoice_number NOT LIKE 'PCD-%'";
        if (date_from) { params.push(date_from); where += ` AND si.date::date >= $${params.length}`; }
        if (date_to)   { params.push(date_to);   where += ` AND si.date::date <= $${params.length}`; }

        const [totals, monthly, paymentBreakdown] = await Promise.all([
            db.query(
                `SELECT
                    COUNT(*)::int                                         AS total_invoices,
                    COALESCE(SUM(net_amount),0)::numeric                  AS total_revenue,
                    COALESCE(AVG(net_amount),0)::numeric                  AS avg_order_value,
                    COALESCE(SUM(total_gst),0)::numeric                   AS total_gst_collected,
                    COALESCE(SUM(CASE WHEN status='Returned' THEN 1 ELSE 0 END),0)::int AS returns_count
                 FROM sales_invoices si ${where}`, params),
            db.query(
                `SELECT
                    TO_CHAR(date::date,'YYYY-MM') AS month,
                    COUNT(*)::int                 AS invoice_count,
                    SUM(net_amount)::numeric      AS revenue
                 FROM sales_invoices si ${where}
                 GROUP BY 1 ORDER BY 1 DESC LIMIT 6`, params),
            db.query(
                `SELECT payment_mode, COUNT(*)::int AS cnt, SUM(net_amount)::numeric AS total
                 FROM sales_invoices si ${where}
                 GROUP BY payment_mode ORDER BY total DESC`, params)
        ]);

        const t = totals.rows[0];
        res.json({
            success: true,
            data: {
                total_invoices:     t.total_invoices,
                total_revenue:      parseFloat(t.total_revenue),
                avg_order_value:    parseFloat(t.avg_order_value),
                total_gst_collected:parseFloat(t.total_gst_collected),
                returns_count:      t.returns_count,
                monthly_trend:      monthly.rows,
                payment_breakdown:  paymentBreakdown.rows,
                generated_at:       now.toISOString()
            }
        });
    } catch (error) {
        logger.error('Invoice stats error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/invoices
 * List invoices with search, date-range, payment mode, status, sort, and pagination
 */
router.get('/invoices', async (req, res) => {
    try {
        const {
            search      = '',
            date_from   = '',
            date_to     = '',
            payment_mode= '',
            status      = '',
            source_type = '',
            sort_by     = 'date',
            sort_order  = 'desc',
            page        = '0',
            limit       = '50'
        } = req.query;

        const safeSortBy    = ['date','invoice_number','net_amount','customer_name','created_at'].includes(sort_by) ? sort_by : 'date';
        const safeSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC';
        const pageLimit     = Math.min(parseInt(limit) || 50, 500);
        const pageOffset    = (parseInt(page) || 0) * pageLimit;

        const params = [];
        // When no source_type filter: show all (POS + PCD + OMS). Legacy rows without source_type excluded by old PCD prefix guard.
        let where = source_type
          ? "WHERE 1=1"
          : "WHERE (si.source_type IS NULL OR si.source_type != 'PCD' OR si.invoice_number NOT LIKE 'PCD-BF-%')";

        if (search) {
            params.push(`%${search}%`);
            where += ` AND (si.invoice_number ILIKE $${params.length} OR si.customer_name ILIKE $${params.length})`;
        }
        if (date_from) { params.push(date_from); where += ` AND si.date::date >= $${params.length}`; }
        if (date_to)   { params.push(date_to);   where += ` AND si.date::date <= $${params.length}`; }
        if (payment_mode) { params.push(payment_mode); where += ` AND si.payment_mode = $${params.length}`; }
        if (status)       { params.push(status);       where += ` AND si.status = $${params.length}`; }
        if (source_type)  { params.push(source_type);  where += ` AND si.source_type = $${params.length}`; }

        const countParams = [...params];
        params.push(pageLimit, pageOffset);

        const [countResult, dataResult] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS total FROM sales_invoices si ${where}`, countParams),
            db.query(
                `SELECT si.*, u.name AS created_by_name
                 FROM sales_invoices si
                 LEFT JOIN users u ON si.created_by = u.id
                 ${where}
                 ORDER BY si.${safeSortBy} ${safeSortOrder}, si.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params)
        ]);

        res.json({
            success:   true,
            data:      dataResult.rows,
            total:     countResult.rows[0].total,
            page:      parseInt(page) || 0,
            limit:     pageLimit
        });
    } catch (error) {
        logger.error('Invoice list error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/next-invoice-number
 * Generate the next sequence number for an invoice
 */
router.get('/next-invoice-number', async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const prefix = `INV-${year}-`;
        const { rows } = await db.query(
            "SELECT invoice_number FROM sales_invoices WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1",
            [`${prefix}%`]
        );
        let nextNum = 1;
        if (rows.length > 0) {
            const lastNo = rows[0].invoice_number;
            const parts = lastNo.split('-');
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) {
                nextNum = lastSeq + 1;
            }
        }
        const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;
        res.json({ success: true, data: { invoiceNumber } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/invoices/:id
 * Fetch single invoice with items (Robust lookup)
 */
router.get('/invoices/:id', async (req, res) => {
    try {
        const id = req.params.id ? req.params.id.trim() : null;
        if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

        let invoice;

        // 1. Try direct ID lookup (handles UUID or string ID)
        try {
            const { rows } = await db.query(
                `SELECT si.*, u.name as created_by_name 
                 FROM sales_invoices si 
                 LEFT JOIN users u ON si.created_by = u.id 
                 WHERE si.id::text = $1`,
                [id]
            );
            if (rows.length > 0) invoice = rows[0];
        } catch (e) {
            // Likely invalid UUID format error, ignore and try next
            logger.debug('ID lookup failed, trying invoice_number');
        }

        // 2. If not found by ID, try lookup by invoice_number or invoice_no
        if (!invoice) {
            const { rows } = await db.query(
                `SELECT si.*, u.name as created_by_name 
                 FROM sales_invoices si 
                 LEFT JOIN users u ON si.created_by = u.id 
                 WHERE si.invoice_number = $1 OR si.invoice_no = $1 OR si.id::text = $1`,
                [id]
            );
            if (rows.length > 0) invoice = rows[0];
        }

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        // Fetch items with product and batch details (Flexible column naming)
        const { rows: items } = await db.query(
            `SELECT sii.*, p.name as product_name, p.generic_name, 
             b.id as batch_id, b.expiry_date
             FROM sales_invoice_items sii
             LEFT JOIN products p ON sii.product_id = p.id
             LEFT JOIN batches b ON sii.batch_id = b.id
             WHERE sii.invoice_id = $1`,
            [invoice.id]
        );

        // Map items to include batch number regardless of column name
        const fullItems = await Promise.all(items.map(async (item) => {
            if (item.batch_id) {
                const { rows: [batch] } = await db.query('SELECT * FROM batches WHERE id = $1', [item.batch_id]);
                if (batch) {
                    return {
                        ...item,
                        batch_number: batch.batch_number || batch.batch_no || '-',
                        batch_no: batch.batch_number || batch.batch_no || '-'
                    };
                }
            }
            return { ...item, batch_number: '-', batch_no: '-' };
        }));

        invoice.items = fullItems;
        res.json({ success: true, data: invoice });
    } catch (error) {
        logger.error('POS Invoice Details Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/pos/invoices
 * Create a new Sales Invoice with Transactional Integrity
 */
router.post('/invoices', async (req, res) => {
    const client = await db.pool.connect();
    try {
        // Hardened parameter extraction protecting against varying property naming conventions
        const invoice_number = req.body.invoice_number || req.body.invoice_no;
        const date = req.body.date || req.body.invoice_date || new Date();
        const customer_name = req.body.customer_name || req.body.party_name || req.body.patient_name || 'Counter Customer';
        const customer_mobile = req.body.customer_mobile || '';
        const doctor_name = req.body.doctor_name || '';
        const payment_mode = req.body.payment_mode || 'Cash';
        const sub_total = Number(req.body.sub_total || req.body.net_payable || req.body.net_amount || 0);
        const taxable_value = Number(req.body.taxable_value || req.body.total_taxable || sub_total);
        const total_gst = Number(req.body.total_gst || (sub_total - taxable_value) || 0);
        const total_discount = Number(req.body.total_discount || 0);
        const round_off = Number(req.body.round_off || 0);
        const net_amount = Number(req.body.net_amount || req.body.net_payable || sub_total);
        const items = req.body.items || [];
        const party_id = req.body.party_id || null;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'No items provided' });
        }

        await client.query('BEGIN');
        
        // DEBUG: Intercept query method to find out exactly which one causes the "stock" error
        const originalQuery = client.query.bind(client);
        client.query = async function(...args) {
            console.log(`[POS DB DEBUG] Executing SQL: ${args[0]}`);
            try {
                return await originalQuery(...args);
            } catch (e) {
                console.error(`[POS DB DEBUG] FAILED SQL: ${args[0]}`);
                console.error(`[POS DB DEBUG] ERROR DETAIL:`, e);
                throw e;
            }
        };

        const companyId = req.user?.companyId || 1;
        const userId = req.user?.userId || req.user?.id;

        // 1. Create Invoice Header
        const invoiceResult = await client.query(
            `INSERT INTO sales_invoices (
                invoice_number, date, customer_name, customer_mobile, doctor_name,
                payment_mode, sub_total, taxable_value, total_gst, total_discount,
                round_off, net_amount, status, created_by, party_id, source_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'POS')
            RETURNING id`,
            [
                invoice_number, date, customer_name, customer_mobile, doctor_name,
                payment_mode, sub_total, taxable_value, total_gst, total_discount,
                round_off, net_amount, 'Completed', userId, party_id
            ]
        );
        const invoiceId = invoiceResult.rows[0].id;

        // 2. Create Journal Voucher record for Sales
        const voucherId = uuidv4();
        await client.query(
            `INSERT INTO journal_vouchers (
                id, company_id, party_id, voucher_type, voucher_no, voucher_date, 
                narration, total_debit, total_credit, status, created_by
            ) VALUES ($1, $2, $3, 'Sales', $4, $5, $6, $7, $8, 'Posted', $9)`,
            [voucherId, companyId, party_id, invoice_number, date, `Sales Invoice ${invoice_number}`, net_amount, net_amount, userId]
        );

        // 3. Process Items & Stock Ledger
        for (const item of items) {
            // Apply defensive property extraction to shield from property-casing mismatches
            const itemRate = Number(item.rate || item.selling_rate || 0);
            const itemTaxable = Number(item.taxable_value || item.amount || item.total_amount || (item.quantity * itemRate) || 0);
            const itemTotal = Number(item.total_amount || item.totalAmount || (item.quantity * itemRate) || 0);
            const itemGst = Number(item.gst_percent || item.gstPercent || 0);
            const dbProductId = (item.product_id && item.product_id !== 'manual' && item.product_id !== 'undefined') ? item.product_id : null;
            const dbBatchId = (item.batch_id && item.batch_id !== 'undefined') ? item.batch_id : null;

            await client.query(
                `INSERT INTO sales_invoice_items (
                    invoice_id, product_id, batch_id, quantity, mrp, rate, 
                    discount_percent, discount_amount, taxable_value, gst_percent, total_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    invoiceId, 
                    dbProductId, 
                    dbBatchId, 
                    Number(item.quantity || 0), 
                    Number(item.mrp || itemRate), 
                    itemRate,
                    Number(item.discount_percent || 0), 
                    Number(item.discount_amount || item.discount || 0), 
                    itemTaxable, 
                    itemGst, 
                    itemTotal
                ]
            );

            // Post to Stock Ledger IF verified product is present
            if (dbProductId) {
                await ledgerHelper.postToStockLedger(client, {
                    companyId,
                    productId: dbProductId,
                    batchId: dbBatchId,
                    movementType: 'OUT',
                    referenceType: 'Sale',
                    referenceId: invoiceId,
                    referenceNumber: invoice_number,
                    quantity: Number(item.quantity || 0),
                    movementDate: date,
                    narration: `POS Sale: ${invoice_number}`,
                    createdBy: userId
                });
            }
        }

        // 4. General Ledger Postings
        const salesAcct = await ledgerHelper.findAccount(client, companyId, 'Sales');
        const taxAcct = await ledgerHelper.findAccount(client, companyId, 'GST Payable');
        let debitAcct;
        
        if (payment_mode === 'Cash') debitAcct = await ledgerHelper.findAccount(client, companyId, 'Cash in Hand');
        else if (payment_mode === 'Credit') debitAcct = await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors');
        else debitAcct = await ledgerHelper.findAccount(client, companyId, 'Bank Accounts');

        // A. Debit Party/Cash/Bank
        await ledgerHelper.postToGeneralLedger(client, {
            accountId: debitAcct,
            partyId: payment_mode === 'Credit' ? party_id : null,
            voucherId: voucherId,
            voucherType: 'Sales',
            transactionDate: date,
            debit: net_amount,
            credit: 0,
            narration: `Invoice ${invoice_number}`
        });

        // B. Credit Sales
        await ledgerHelper.postToGeneralLedger(client, {
            accountId: salesAcct,
            voucherId: voucherId,
            voucherType: 'Sales',
            transactionDate: date,
            debit: 0,
            credit: taxable_value,
            narration: `Taxable Sales: ${invoice_number}`
        });

        // C. Credit GST
        if (total_gst > 0) {
            await ledgerHelper.postToGeneralLedger(client, {
                accountId: taxAcct,
                voucherId: voucherId,
                voucherType: 'Sales',
                transactionDate: date,
                debit: 0,
                credit: total_gst,
                narration: `GST on Sales: ${invoice_number}`
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, invoiceId, invoice_number });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('POS Invoice Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

/**
 * POST /api/pos/returns
 * Create a Sales Return with Stock Reversal
 */
router.post('/returns', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const {
            invoice_no, // Return memo number
            invoice_date,
            party_name,
            items,
            net_payable,
            total_taxable,
            party_id
        } = req.body;

        await client.query('BEGIN');
        const companyId = req.user?.companyId || 1;
        const userId = req.user?.userId || req.user?.id;

        const voucherId = uuidv4();
        // 1. Create Return Voucher Header
        await client.query(
            `INSERT INTO journal_vouchers (
                id, company_id, party_id, voucher_type, voucher_no, voucher_date, 
                narration, total_debit, total_credit, status, created_by
            ) VALUES ($1, $2, $3, 'Sales Return', $4, $5, $6, $7, $8, 'Posted', $9)`,
            [voucherId, companyId, party_id, invoice_no, invoice_date, `Sales Return: ${invoice_no}`, net_payable, net_payable, userId]
        );

        // 2. Process Items & Revert Stock
        for (const item of items) {
            await client.query("UPDATE batches SET stock = stock + $1 WHERE id = $2", [item.quantity, item.batch_id]);
            
            await ledgerHelper.postToStockLedger(client, {
                companyId,
                productId: item.product_id,
                batchId: item.batch_id,
                movementType: 'IN',
                referenceType: 'Return',
                referenceId: voucherId,
                referenceNumber: invoice_no,
                quantity: item.quantity,
                movementDate: invoice_date,
                narration: `Sales Return: ${invoice_no}`,
                createdBy: userId
            });
        }

        // 3. Accounting Entries
        const salesReturnAcct = await ledgerHelper.findAccount(client, companyId, 'Sales Returns') || await ledgerHelper.findAccount(client, companyId, 'Sales');
        const taxAcct = await ledgerHelper.findAccount(client, companyId, 'GST Payable');
        const partyAcct = await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors');

        // A. Debit Sales Return
        await ledgerHelper.postToGeneralLedger(client, {
            accountId: salesReturnAcct,
            voucherId: voucherId,
            voucherType: 'Sales Return',
            transactionDate: invoice_date,
            debit: total_taxable,
            credit: 0,
            narration: `Return taxable: ${invoice_no}`
        });

        // B. Debit GST
        const totalGst = net_payable - total_taxable;
        if (totalGst > 0) {
            await ledgerHelper.postToGeneralLedger(client, {
                accountId: taxAcct,
                voucherId: voucherId,
                voucherType: 'Sales Return',
                transactionDate: invoice_date,
                debit: totalGst,
                credit: 0,
                narration: `Return GST: ${invoice_no}`
            });
        }

        // C. Credit Party
        await ledgerHelper.postToGeneralLedger(client, {
            accountId: partyAcct,
            partyId: party_id,
            voucherId: voucherId,
            voucherType: 'Sales Return',
            transactionDate: invoice_date,
            debit: 0,
            credit: net_payable,
            narration: `Return to Party: ${invoice_no}`
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Return processed successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

/**
 * POST /api/pos/invoices/:id/return
 * Create a sales return / credit note against an existing invoice.
 * Sets original invoice status = 'Returned' and creates a mirror credit-note record.
 */
router.post('/invoices/:id/return', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const now = new Date(); // §5A
        await client.query('BEGIN');

        const { rows: [inv] } = await client.query(
            'SELECT * FROM sales_invoices WHERE id = $1', [req.params.id]);
        if (!inv) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Invoice not found' }); }
        if (inv.status === 'Returned') { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Invoice already returned' }); }

        const { reason = 'Sales Return', items: returnItems } = req.body;
        const { rows: origItems } = await client.query(
            'SELECT * FROM sales_invoice_items WHERE invoice_id = $1', [inv.id]);
        const itemsToReturn = (returnItems && returnItems.length > 0) ? returnItems : origItems;

        // Mark original as Returned
        await client.query(
            "UPDATE sales_invoices SET status = 'Returned', updated_at = $1 WHERE id = $2",
            [now, inv.id]);

        // Create credit-note header
        const cnNumber = `CN-${inv.invoice_number}`;
        const { rows: [cn] } = await client.query(
            `INSERT INTO sales_invoices
             (invoice_number, date, customer_name, customer_mobile, doctor_name,
              payment_mode, sub_total, taxable_value, total_gst, total_discount,
              round_off, net_amount, status, created_by, party_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'CreditNote',$13,$14)
             RETURNING id`,
            [cnNumber, now.toISOString().slice(0,10),
             inv.customer_name, inv.customer_mobile, inv.doctor_name,
             inv.payment_mode,
             -Math.abs(inv.sub_total), -Math.abs(inv.taxable_value),
             -Math.abs(inv.total_gst), -Math.abs(inv.total_discount),
             inv.round_off, -Math.abs(inv.net_amount),
             req.user?.userId || req.user?.id, inv.party_id]);

        // Restore stock for each returned item
        for (const item of itemsToReturn) {
            await client.query(
                `INSERT INTO sales_invoice_items
                 (invoice_id, product_id, batch_id, quantity, mrp, rate, total_amount)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [cn.id, item.product_id, item.batch_id,
                 item.quantity, item.mrp, item.rate,
                 -Math.abs(item.total_amount)]);
            await client.query(
                'UPDATE batches SET stock = COALESCE(stock,0) + $1 WHERE id = $2',
                [item.quantity, item.batch_id]);
        }

        await client.query('COMMIT');
        setImmediate(async () => {
            try {
                logger.info(`[SalesReturn] Credit note ${cnNumber} created for ${inv.invoice_number}`, { reason });
            } catch (e) { logger.error('[SalesReturn] Side-effect error:', e.message); }
        });

        res.status(201).json({ success: true, credit_note_id: cn.id, credit_note_number: cnNumber });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Sales return error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/pos/invoices/:id
 */
router.delete('/invoices/:id', async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Get Invoice Details
        const { rows: [invoice] } = await client.query("SELECT * FROM sales_invoices WHERE id = $1", [req.params.id]);
        if (!invoice) throw new Error('Invoice not found');

        // 2. Find linked Journal Voucher
        const { rows: [jv] } = await client.query("SELECT id FROM journal_vouchers WHERE voucher_no = $1 AND voucher_type = 'Sales'", [invoice.invoice_number]);
        
        // 3. Revert Stock
        const { rows: items } = await client.query("SELECT * FROM sales_invoice_items WHERE invoice_id = $1", [req.params.id]);
        for (const item of items) {
            await client.query("UPDATE batches SET stock = stock + $1 WHERE id = $2", [item.quantity, item.batch_id]);
        }

        // 4. Clear Ledger Entries using helper
        // Pass stock lookup parameters explicitly to guarantee clean deletion of stock records
        await ledgerHelper.clearLedgerEntries(client, jv ? jv.id : null, 'Sales', { 
            stockRefId: req.params.id, 
            stockRefType: 'Sale' 
        });

        if (jv) {
            await client.query("DELETE FROM journal_vouchers WHERE id = $1", [jv.id]);
        }

        // 5. Delete Invoice
        await client.query("DELETE FROM sales_invoices WHERE id = $1", [req.params.id]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Invoice and accounting entries deleted' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

/**
 * GET /api/pos/dashboard-summary
 */
router.get('/dashboard-summary', async (req, res) => {
    try {
        const todayResult = await db.query("SELECT COALESCE(SUM(net_amount), 0) as revenue, COUNT(*) as count FROM sales_invoices WHERE date::date = CURRENT_DATE AND invoice_number NOT LIKE 'PCD-%'");
        const yesterdayResult = await db.query("SELECT COALESCE(SUM(net_amount), 0) as revenue FROM sales_invoices WHERE date::date = CURRENT_DATE - INTERVAL '1 day' AND invoice_number NOT LIKE 'PCD-%'");
        const monthlyResult = await db.query("SELECT COALESCE(SUM(net_amount), 0) as revenue FROM sales_invoices WHERE date >= date_trunc('month', CURRENT_DATE) AND invoice_number NOT LIKE 'PCD-%'");
        const itemsResult = await db.query(`
            SELECT COALESCE(SUM(quantity), 0) as items 
            FROM sales_invoice_items sii 
            JOIN sales_invoices si ON sii.invoice_id = si.id 
            WHERE si.date::date = CURRENT_DATE AND si.invoice_number NOT LIKE 'PCD-%'
        `);
        const recentResult = await db.query(`
            SELECT si.*, u.name as created_by_name 
            FROM sales_invoices si 
            LEFT JOIN users u ON si.created_by = u.id 
            WHERE si.invoice_number NOT LIKE 'PCD-%'
            ORDER BY si.created_at DESC LIMIT 10
        `);

        const todayRevenue = parseFloat(todayResult.rows[0]?.revenue || 0);
        const yesterdayRevenue = parseFloat(yesterdayResult.rows[0]?.revenue || 0);
        const changePercent = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

        res.json({
            success: true,
            data: {
                todayRevenue,
                yesterdayRevenue,
                revenueChangePercent: changePercent,
                invoicesGenerated: parseInt(todayResult.rows[0]?.count || 0),
                itemsSoldToday: parseInt(itemsResult.rows[0]?.items || 0),
                pendingDrafts: 0,
                monthlyRevenue: parseFloat(monthlyResult.rows[0]?.revenue || 0),
                recentInvoices: recentResult.rows,
                tables: ['sales_invoices', 'sales_invoice_items', 'parties']
            }
        });
    } catch (error) {
        logger.error('POS Dashboard Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/terminal/summary
 * Intelligence Dashboard optimized endpoint
 */
router.get('/terminal/summary', async (req, res) => {
    try {
        const monthlyResult = await db.query(`
            SELECT COALESCE(SUM(net_amount), 0) as revenue 
            FROM sales_invoices 
            WHERE date >= CURRENT_DATE - INTERVAL '30 days' AND invoice_number NOT LIKE 'PCD-%'
        `);
        
        const prevMonthlyResult = await db.query(`
            SELECT COALESCE(SUM(net_amount), 0) as revenue 
            FROM sales_invoices 
            WHERE date BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '30 days' AND invoice_number NOT LIKE 'PCD-%'
        `);

        const monthlyRevenue = parseFloat(monthlyResult.rows[0]?.revenue || 0);
        const prevMonthlyRevenue = parseFloat(prevMonthlyResult.rows[0]?.revenue || 0);
        const growth = prevMonthlyRevenue > 0 
            ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue * 100).toFixed(1) 
            : 0;

        res.json({
            success: true,
            data: {
                monthlyRevenue,
                growth: parseFloat(growth),
                currency: 'INR',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('POS Terminal Summary Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/voucher-types
 */
router.get('/voucher-types', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM voucher_types ORDER BY name");
        if (rows.length === 0) {
            return res.json({
                success: true,
                data: [
                    { name: 'Sales', type_of_voucher: 'Sales', abbreviation: 'Sales' },
                    { name: 'Payment', type_of_voucher: 'Payment', abbreviation: 'Pymt' },
                    { name: 'Receipt', type_of_voucher: 'Receipt', abbreviation: 'Rcpt' },
                    { name: 'Contra', type_of_voucher: 'Contra', abbreviation: 'Cont' },
                    { name: 'Journal', type_of_voucher: 'Journal', abbreviation: 'Jv' }
                ]
            });
        }
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('POS VoucherTypes Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pos/products
 * Fetches all active products with nested available stock batches for integration
 */
router.get('/products', async (req, res) => {
    try {
        const { rows: products } = await db.query('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name');
        const fullProducts = await Promise.all(products.map(async (p) => {
            // Use SELECT * to be flexible with column names (stock vs quantity vs available_qty)
            const { rows: batches } = await db.query(
                'SELECT * FROM batches WHERE product_id = $1 ORDER BY expiry_date ASC',
                [p.id]
            );

            // Filter available batches in memory to be schema-agnostic
            const availableBatches = batches.filter(b => (b.stock || b.quantity || b.available_qty || 0) > 0);

            return {
                id: p.id,
                name: p.name,
                genericName: p.generic_name,
                packing: p.packing,
                uom: p.uom,
                hsn: p.hsn,
                gst: parseFloat(p.gst || 12),
                scheduleType: p.schedule_type,
                totalStock: parseInt(p.current_stock || 0),
                batches: availableBatches.map(b => ({
                    id: b.id,
                    batchNumber: b.batch_number || b.batch_no,
                    expiryDate: b.expiry_date,
                    stock: parseInt(b.stock || b.available_qty || b.quantity || 0),
                    mrp: parseFloat(b.mrp || 0),
                    purchaseRate: parseFloat(b.purchase_rate || 0),
                    sellingRate: parseFloat(b.selling_rate || 0)
                }))
            };
        }));
        res.json({ success: true, data: fullProducts });
    } catch (error) {
        logger.error('POS Products Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
