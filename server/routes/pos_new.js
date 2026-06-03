const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const ledgerHelper = require('../utils/ledgerHelper');

/**
 * GET /api/pos/parties
 * Fetch all parties/customers
 */
router.get('/parties', async (req, res) => {
  try {
    const { search = '' } = req.query;

    let query = "SELECT id, name, gstin, mobile, type, current_balance as \"currentBalance\", status, address, email, city FROM parties WHERE status = 'Active'";
    const params = [];

    if (search) {
      query += ` AND (name ILIKE $${params.length + 1} OR gstin ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name LIMIT 100';

    const { rows } = await db.query(query, params);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    logger.error('Failed to fetch parties', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch parties' });
  }
});

/**
 * POST /api/pos/invoices
 * Create new sales invoice with transaction and ledger integration
 */
router.post('/invoices', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      invoice_no,
      invoice_date,
      invoice_type = 'Retail',
      party_id,
      payment_mode = 'Cash',
      party_name,
      items = [],
      total_taxable = 0,
      total_cgst = 0,
      total_sgst = 0,
      total_igst = 0,
      round_off = 0,
      freight_charges = 0,
      net_payable = 0
    } = req.body;

    if (!invoice_no || !invoice_date || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invoice number, date, and at least one item are required'
      });
    }

    await client.query('BEGIN');

    // 1. Resolve Party
    let finalPartyId = party_id;
    if (!finalPartyId && party_name) {
      const { rows: pSearch } = await client.query('SELECT id FROM parties WHERE name = $1 LIMIT 1', [party_name]);
      if (pSearch.length > 0) {
        finalPartyId = pSearch[0].id;
      } else {
        const { rows: partyResult } = await client.query(
          `INSERT INTO parties (name, mobile, type, status, current_balance)
           VALUES ($1, $2, 'Customer', 'Active', 0)
           RETURNING id`,
          [party_name, '']
        );
        finalPartyId = partyResult[0].id;
      }
    }

    // 2. Insert Header
    const { rows: invoiceResult } = await client.query(
      `INSERT INTO sales_invoices 
       (invoice_number, date, invoice_date, time, party_id, payment_mode, customer_name,
        taxable_value, sub_total, total_gst, round_off, freight_charges,
        net_amount, net_payable, status, created_by, company_id)
       VALUES ($1, $2, $2, CURRENT_TIME, $3, $4, $5, $6, $6, $7, $8, $9, $10, $10, 'Completed', $11, $12)
       RETURNING id, invoice_number`,
      [invoice_no, invoice_date, finalPartyId, payment_mode, party_name,
       total_taxable, (total_cgst + total_sgst + total_igst), round_off, freight_charges,
       net_payable, req.user?.userId || null, req.user?.companyId || 1]
    );

    const invoiceId = invoiceResult[0].id;

    // 3. Line Items & Stock
    for (const item of items) {
      await client.query(
        `INSERT INTO sales_invoice_items 
         (invoice_id, product_id, batch_id, quantity, rate, 
          discount_amount, taxable_value, cgst_amount, sgst_amount, igst_amount, mrp, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [invoiceId, item.product_id === 'manual' ? null : item.product_id, item.batch_id || null, 
         item.quantity, item.selling_rate || item.rate, item.discount || 0, 
         item.taxable_value || (item.quantity * (item.selling_rate || item.rate)), 
         item.cgst_amount || 0, item.sgst_amount || 0, item.igst_amount || 0, 
         item.mrp || item.selling_rate, item.total_amount || (item.quantity * (item.selling_rate || item.rate))]
      );

      if (item.batch_id && item.product_id !== 'manual') {
        await ledgerHelper.postToStockLedger(client, {
          companyId: req.user?.companyId || 1,
          productId: item.product_id,
          batchId: item.batch_id,
          movementType: 'OUT',
          referenceType: 'Sale',
          referenceId: invoiceId,
          referenceNumber: invoice_no,
          quantity: item.quantity,
          movementDate: invoice_date,
          narration: `POS Sale to ${party_name || 'Walk-in'}`,
          createdBy: req.user?.userId
        });
      }
    }

    // 4. Ledger
    const companyId = req.user?.companyId || 1;
    const salesAccountId = await ledgerHelper.findAccount(client, companyId, 'Sales Account');
    const cgstAccountId = await ledgerHelper.findAccount(client, companyId, 'CGST Output');
    const sgstAccountId = await ledgerHelper.findAccount(client, companyId, 'SGST Output');
    
    let paymentAccountId;
    if (payment_mode === 'Cash') {
      paymentAccountId = await ledgerHelper.findAccount(client, companyId, 'Cash in Hand');
    } else if (payment_mode === 'Credit') {
      paymentAccountId = await ledgerHelper.findAccount(client, companyId, 'Sundry Debtors');
    } else {
      paymentAccountId = await ledgerHelper.findAccount(client, companyId, 'Bank Accounts');
    }

    await ledgerHelper.postToGeneralLedger(client, {
      accountId: paymentAccountId,
      partyId: finalPartyId,
      voucherId: invoiceId,
      voucherType: 'Sales',
      transactionDate: invoice_date,
      debit: net_payable,
      credit: 0,
      narration: `POS Sale Inv: ${invoice_no}`
    });

    await ledgerHelper.postToGeneralLedger(client, {
      accountId: salesAccountId,
      voucherId: invoiceId,
      voucherType: 'Sales',
      transactionDate: invoice_date,
      debit: 0,
      credit: total_taxable,
      narration: `POS Sale Inv: ${invoice_no}`
    });

    if (total_cgst > 0) {
      await ledgerHelper.postToGeneralLedger(client, {
        accountId: cgstAccountId,
        voucherId: invoiceId,
        voucherType: 'Sales',
        transactionDate: invoice_date,
        debit: 0,
        credit: total_cgst,
        narration: `CGST on POS Sale`
      });
    }
    if (total_sgst > 0) {
      await ledgerHelper.postToGeneralLedger(client, {
        accountId: sgstAccountId,
        voucherId: invoiceId,
        voucherType: 'Sales',
        transactionDate: invoice_date,
        debit: 0,
        credit: total_sgst,
        narration: `SGST on POS Sale`
      });
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: invoiceResult[0], message: 'Invoice created and posted successfully' });
    logger.http('POST', '/api/pos/invoices', 201, items.length, req.ip, req.user.userId);
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('Failed to create invoice', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create invoice: ' + error.message });
  } finally {
    if (client) client.release();
  }
});

// ... (Rest of the file would go here, but I'll focus on the core user request first)

module.exports = router;
