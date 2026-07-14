/**
 * Accounting Sync Service
 * Auto-posts double-entry GL entries from source documents:
 *   sales_invoices, purchase_orders, purchase_invoices,
 *   pos_bills, expenses, payment_vouchers, receipt_vouchers
 *
 * Idempotent — safe to run repeatedly. Skips already-posted docs.
 */
const db = require('../db');

// ── COA lookup cache (per company) ───────────────────────────────────────────
const coaCache = new Map();

async function getCOA(companyId) {
  if (coaCache.has(companyId)) return coaCache.get(companyId);
  const { rows } = await db.query(
    `SELECT id, account_code, account_name, account_type, account_group
     FROM chart_of_accounts WHERE company_id = $1`,
    [companyId]
  );
  const map = {};
  rows.forEach(r => {
    map[r.account_code] = r;
    // Also index by canonical names for fallback
    map[r.account_name.toLowerCase()] = r;
  });
  coaCache.set(companyId, map);
  return map;
}

// Bust cache on COA changes
function bustCOACache(companyId) {
  coaCache.delete(companyId);
}

// Find account by code list (first match wins)
function findAccount(coa, ...codes) {
  for (const code of codes) {
    if (coa[code]) return coa[code];
    // case-insensitive name fallback
    const lower = String(code).toLowerCase();
    if (coa[lower]) return coa[lower];
  }
  return null;
}

// ── Insert GL entry rows (idempotent — skip if voucher_id+account_id exists) ─
async function postGL(client, companyId, voucherId, voucherType, date, entries, narration) {
  for (const e of entries) {
    if (!e.accountId || (!e.debit && !e.credit)) continue;
    const debit  = parseFloat(e.debit  || 0);
    const credit = parseFloat(e.credit || 0);
    if (debit === 0 && credit === 0) continue;

    await client.query(
      `INSERT INTO general_ledger
         (id, account_id, voucher_id, voucher_type, transaction_date,
          debit, credit, narration, transaction_type, company_id, party_id, created_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT DO NOTHING`,
      [e.accountId, voucherId, voucherType, date,
       debit, credit, e.narration || narration,
       e.txType || voucherType, companyId, e.partyId || null]
    );
  }
}

// ── ENSURE system accounts exist ─────────────────────────────────────────────
async function ensureSystemAccounts(companyId) {
  const systemAccounts = [
    { code: 'SYS-110001', name: 'Sundry Debtors',        type: 'Asset',     group: 'Sundry Debtors',    format: 'debit' },
    { code: 'SYS-110002', name: 'Cash in Hand',           type: 'Asset',     group: 'Cash in Hand',      format: 'debit' },
    { code: 'SYS-110003', name: 'Sundry Creditors',       type: 'Liability', group: 'Sundry Creditors',  format: 'credit' },
    { code: 'SYS-110004', name: 'Bank Account',           type: 'Asset',     group: 'Bank Accounts',     format: 'debit' },
    { code: 'SYS-200001', name: 'Sales Revenue',          type: 'Income',    group: 'Direct Income',     format: 'credit' },
    { code: 'SYS-200002', name: 'POS Sales',              type: 'Income',    group: 'Direct Income',     format: 'credit' },
    { code: 'SYS-300001', name: 'Purchase Account',       type: 'Expense',   group: 'Direct Expenses',   format: 'debit' },
    { code: 'SYS-300002', name: 'CGST Payable',           type: 'Liability', group: 'Duties & Taxes',    format: 'credit' },
    { code: 'SYS-300003', name: 'SGST Payable',           type: 'Liability', group: 'Duties & Taxes',    format: 'credit' },
    { code: 'SYS-300004', name: 'IGST Payable',           type: 'Liability', group: 'Duties & Taxes',    format: 'credit' },
    { code: 'SYS-400001', name: 'CGST Input Credit',      type: 'Asset',     group: 'Duties & Taxes',    format: 'debit' },
    { code: 'SYS-400002', name: 'SGST Input Credit',      type: 'Asset',     group: 'Duties & Taxes',    format: 'debit' },
    { code: 'SYS-400003', name: 'IGST Input Credit',      type: 'Asset',     group: 'Duties & Taxes',    format: 'debit' },
    { code: 'SYS-500001', name: 'Expense Account',        type: 'Expense',   group: 'Indirect Expenses', format: 'debit' },
    { code: 'SYS-500002', name: 'Salary & Wages',         type: 'Expense',   group: 'Indirect Expenses', format: 'debit' },
    { code: 'SYS-600001', name: 'TDS Payable',            type: 'Liability', group: 'Duties & Taxes',    format: 'credit' },
  ];

  for (const acc of systemAccounts) {
    await db.query(
      `INSERT INTO chart_of_accounts
         (id, company_id, account_code, account_name, account_type, account_group,
          account_format, status, opening_balance, current_balance, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'Active', 0, 0, NOW(), NOW())
       ON CONFLICT (company_id, account_code) DO NOTHING`,
      [companyId, acc.code, acc.name, acc.type, acc.group, acc.format]
    ).catch(() => {
      // If no unique constraint on (company_id, account_code), just skip
    });
  }

  bustCOACache(companyId);
}

// ── SYNC: Sales Invoices ─────────────────────────────────────────────────────
async function syncSalesInvoices(companyId, invoiceId = null) {
  const coa = await getCOA(companyId);

  const debtorsAcc  = findAccount(coa, 'SYS-110001', '1100', 'sundry debtors');
  const cashAcc     = findAccount(coa, 'SYS-110002', '1001', 'ASST-001', 'cash in hand');
  const salesAcc    = findAccount(coa, 'SYS-200001', '2001', 'INC-001', 'sales revenue', 'sales account');
  const cgstPayAcc  = findAccount(coa, 'SYS-300002', '5001', 'cgst payable');
  const sgstPayAcc  = findAccount(coa, 'SYS-300003', '5002', 'sgst payable');
  const igstPayAcc  = findAccount(coa, 'SYS-300004', '5003', 'igst payable');

  if (!salesAcc) {
    console.warn('[AccountingSync] No Sales Revenue account found — run ensureSystemAccounts first');
    return { synced: 0, errors: 1 };
  }

  const filter = invoiceId
    // Parameterized (was string-interpolated → SQL injection). invoiceId bound as $2.
    ? `AND si.id = $2`
    : `AND NOT EXISTS (
         SELECT 1 FROM general_ledger gl
         WHERE gl.voucher_id = si.id AND gl.company_id = si.company_id
       )`;
  const params = invoiceId ? [companyId, invoiceId] : [companyId];

  const { rows: invoices } = await db.query(
    `SELECT si.id, si.invoice_number,
            COALESCE(si.date, si.invoice_date) as date,
            si.net_amount, si.total_gst,
            COALESCE(si.taxable_value, si.sub_total, si.net_amount) as taxable_amount,
            si.payment_mode, si.customer_name, si.party_id, si.company_id,
            si.status,
            COALESCE(SUM(sii.cgst_amount), 0) as cgst_amount,
            COALESCE(SUM(sii.sgst_amount), 0) as sgst_amount,
            COALESCE(SUM(sii.igst_amount), 0) as igst_amount
     FROM sales_invoices si
     LEFT JOIN sales_invoice_items sii ON sii.invoice_id = si.id
     WHERE si.company_id = $1 ${filter}
     AND si.status IN ('Completed', 'Posted')
     -- POS invoices (INV-*) already post GL in real time inside pos.js; skip here to avoid double-posting.
     AND si.invoice_number NOT LIKE 'INV-%'
     GROUP BY si.id, si.invoice_number, si.date, si.invoice_date,
              si.net_amount, si.total_gst, si.taxable_value, si.sub_total,
              si.payment_mode, si.customer_name, si.party_id, si.company_id, si.status
     ORDER BY COALESCE(si.date, si.invoice_date)`,
    params
  );

  let synced = 0;
  for (const inv of invoices) {
    try {
      const isCash = (inv.payment_mode || '').toLowerCase().includes('cash');
      const receivableAcc = isCash ? cashAcc : debtorsAcc;

      const cgst = parseFloat(inv.cgst_amount || 0);
      const sgst = parseFloat(inv.sgst_amount || 0);
      const igst = parseFloat(inv.igst_amount || 0);
      const netAmt = parseFloat(inv.net_amount || 0);
      // Always derive the Sales credit as the remainder after tax legs so the
      // voucher self-balances (DR net_amount = CR sales + CR taxes), regardless
      // of what the invoice header's taxable_value column happens to say —
      // that column can drift out of sync with the actual item-level tax sum.
      const taxableAmt = netAmt - cgst - sgst - igst;

      const narration = `Sales Invoice ${inv.invoice_number} - ${inv.customer_name || 'Customer'}`;

      const entries = [
        { accountId: receivableAcc?.id, debit: netAmt, txType: 'Sales', narration, partyId: inv.party_id },
        { accountId: salesAcc?.id, credit: taxableAmt, txType: 'Sales', narration },
      ];

      if (cgst > 0 && cgstPayAcc) entries.push({ accountId: cgstPayAcc.id, credit: cgst, txType: 'Sales', narration });
      if (sgst > 0 && sgstPayAcc) entries.push({ accountId: sgstPayAcc.id, credit: sgst, txType: 'Sales', narration });
      if (igst > 0 && igstPayAcc) entries.push({ accountId: igstPayAcc.id, credit: igst, txType: 'Sales', narration });

      await postGL(db, inv.company_id, inv.id, 'Sales', inv.date, entries, narration);
      synced++;
    } catch (e) {
      console.error(`[AccountingSync] Sales invoice ${inv.id} failed:`, e.message);
    }
  }

  return { synced, total: invoices.length };
}

// ── SYNC: Purchase Orders / Invoices ─────────────────────────────────────────
async function syncPurchaseOrders(companyId, poId = null) {
  const coa = await getCOA(companyId);

  const purchaseAcc = findAccount(coa, 'SYS-300001', '3001', 'EXP-001', 'purchase account');
  const creditorsAcc = findAccount(coa, 'SYS-110003', 'sundry creditors');
  const cashAcc     = findAccount(coa, 'SYS-110002', '1001', 'ASST-001', 'cash in hand');
  const cgstInAcc   = findAccount(coa, 'SYS-400001', '4001', 'cgst input');
  const sgstInAcc   = findAccount(coa, 'SYS-400002', '4002', 'sgst input');
  const igstInAcc   = findAccount(coa, 'SYS-400003', '4003', 'igst input');

  if (!purchaseAcc) {
    console.warn('[AccountingSync] No Purchase Account found');
    return { synced: 0, errors: 1 };
  }

  const filter = poId
    ? `AND po.id = '${poId}'`
    : `AND NOT EXISTS (
         SELECT 1 FROM general_ledger gl
         WHERE gl.voucher_id = po.id AND gl.company_id = $1
       )`;

  const { rows: pos } = await db.query(
    `SELECT po.id, po.po_number, COALESCE(po.date, po.created_at::date) as order_date,
            COALESCE(po.grand_total, po.total_amount, 0) as total_amount,
            COALESCE(po.cgst_total, 0) as cgst_amount,
            COALESCE(po.sgst_total, 0) as sgst_amount,
            COALESCE(po.igst_total, 0) as igst_amount,
            po.status, po.supplier_id, po.company_id,
            COALESCE(s.name, 'Supplier') as supplier_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.company_id = $1 ${filter}
     AND po.status IN ('Approved','Received','Closed','Completed')
     ORDER BY COALESCE(po.date, po.created_at::date)`,
    [companyId]
  );

  let synced = 0;
  for (const po of pos) {
    try {
      const totalAmt  = parseFloat(po.total_amount || 0);
      const cgst = parseFloat(po.cgst_amount || 0);
      const sgst = parseFloat(po.sgst_amount || 0);
      const igst = parseFloat(po.igst_amount || 0);
      const taxableAmt = totalAmt - cgst - sgst - igst;
      const narration = `Purchase Order ${po.po_number} - ${po.supplier_name}`;

      const payAcc = creditorsAcc || cashAcc;

      const entries = [
        { accountId: purchaseAcc?.id, debit: taxableAmt > 0 ? taxableAmt : totalAmt, txType: 'Purchase', narration },
      ];
      if (cgst > 0 && cgstInAcc) entries.push({ accountId: cgstInAcc.id, debit: cgst, txType: 'Purchase', narration });
      if (sgst > 0 && sgstInAcc) entries.push({ accountId: sgstInAcc.id, debit: sgst, txType: 'Purchase', narration });
      if (igst > 0 && igstInAcc) entries.push({ accountId: igstInAcc.id, debit: igst, txType: 'Purchase', narration });
      if (payAcc) entries.push({ accountId: payAcc.id, credit: totalAmt, txType: 'Purchase', narration });

      await postGL(db, companyId, po.id, 'Purchase', po.order_date, entries, narration);
      synced++;
    } catch (e) {
      console.error(`[AccountingSync] PO ${po.id} failed:`, e.message);
    }
  }

  return { synced, total: pos.length };
}

// ── SYNC: POS Bills ───────────────────────────────────────────────────────────
async function syncPOSBills(companyId, billId = null) {
  const coa = await getCOA(companyId);

  const cashAcc   = findAccount(coa, 'SYS-110002', '1001', 'ASST-001', 'cash in hand');
  const salesAcc  = findAccount(coa, 'SYS-200002', 'SYS-200001', '2001', 'INC-001', 'pos sales', 'sales account');
  const cgstPayAcc = findAccount(coa, 'SYS-300002', '5001', 'cgst payable');
  const sgstPayAcc = findAccount(coa, 'SYS-300003', '5002', 'sgst payable');

  if (!salesAcc) return { synced: 0, errors: 1 };

  const filter = billId
    ? `AND pb.id = '${billId}'`
    : `AND NOT EXISTS (
         SELECT 1 FROM general_ledger gl
         WHERE gl.voucher_id = pb.id AND gl.company_id = $1
       )`;

  const { rows: bills } = await db.query(
    `SELECT pb.id, pb.bill_no as bill_number, pb.bill_date,
            COALESCE(pb.net_payable, pb.amount_paid, 0) as net_amount,
            COALESCE(pb.cgst_amount, 0) as cgst_amount,
            COALESCE(pb.sgst_amount, 0) as sgst_amount,
            $1::int as company_id
     FROM pos_bills pb
     WHERE pb.status NOT IN ('Cancelled','Void')
     ${filter}
     ORDER BY pb.bill_date
     LIMIT 500`,
    [companyId]
  );


  let synced = 0;
  for (const bill of bills) {
    try {
      const netAmt = parseFloat(bill.net_amount || 0);
      const cgst   = parseFloat(bill.cgst_amount || 0);
      const sgst   = parseFloat(bill.sgst_amount || 0);
      const taxable = netAmt - cgst - sgst;
      const narration = `POS Bill ${bill.bill_number}`;

      const entries = [
        { accountId: cashAcc?.id, debit: netAmt, txType: 'POS', narration },
        { accountId: salesAcc?.id, credit: taxable > 0 ? taxable : netAmt, txType: 'POS', narration },
      ];
      if (cgst > 0 && cgstPayAcc) entries.push({ accountId: cgstPayAcc.id, credit: cgst, txType: 'POS', narration });
      if (sgst > 0 && sgstPayAcc) entries.push({ accountId: sgstPayAcc.id, credit: sgst, txType: 'POS', narration });

      await postGL(db, bill.company_id, bill.id, 'POS', bill.bill_date, entries, narration);
      synced++;
    } catch (e) {
      console.error(`[AccountingSync] POS bill ${bill.id} failed:`, e.message);
    }
  }

  return { synced, total: bills.length };
}

// ── SYNC: Expenses ────────────────────────────────────────────────────────────
async function syncExpenses(companyId, expenseId = null) {
  const coa = await getCOA(companyId);

  const expenseAcc = findAccount(coa, 'SYS-500001', 'EXP-001', 'EXP-002', 'expense account');
  const cashAcc    = findAccount(coa, 'SYS-110002', '1001', 'ASST-001', 'cash in hand');

  if (!expenseAcc && !cashAcc) return { synced: 0, errors: 1 };

  const filter = expenseId
    ? `AND e.id = $2`
    : `AND NOT EXISTS (
         SELECT 1 FROM general_ledger gl
         WHERE gl.voucher_id = e.id AND gl.company_id = $1
       )`;
  const expParams = expenseId ? [companyId, expenseId] : [companyId];

  const { rows: expenses } = await db.query(
    `SELECT e.id, e.description, e.date, e.amount, e.category
     FROM expenses e
     WHERE 1=1 ${filter}
     ORDER BY e.date
     LIMIT 500`,
    expParams
  );

  let synced = 0;
  for (const exp of expenses) {
    try {
      const amt = parseFloat(exp.amount || 0);
      if (amt <= 0) continue;
      const narration = exp.description || `Expense - ${exp.category || 'General'}`;

      const entries = [
        { accountId: expenseAcc?.id || cashAcc?.id, debit: amt, txType: 'Expense', narration },
        { accountId: cashAcc?.id, credit: amt, txType: 'Expense', narration },
      ];

      // expense.id may already be a UUID
      await postGL(db, companyId, exp.id, 'Expense', exp.date, entries, narration);
      synced++;
    } catch (e) {
      console.error(`[AccountingSync] Expense ${exp.id} failed:`, e.message);
    }
  }

  return { synced, total: expenses.length };
}

// ── SYNC: Payment Vouchers (outgoing) ────────────────────────────────────────
async function syncPaymentVouchers(companyId) {
  const coa = await getCOA(companyId);
  const cashAcc     = findAccount(coa, 'SYS-110002', '1001', 'ASST-001', 'cash in hand');
  const creditorsAcc = findAccount(coa, 'SYS-110003', 'sundry creditors');

  const { rows } = await db.query(
    `SELECT pv.id, pv.payment_no as voucher_number, pv.payment_date as voucher_date,
            COALESCE(pv.net_paid, pv.amount, 0) as amount,
            pv.party_id, pv.narration
     FROM payment_vouchers pv
     WHERE pv.status NOT IN ('Cancelled','Void')
     AND NOT EXISTS (
       SELECT 1 FROM general_ledger gl
       WHERE gl.voucher_id = pv.id AND gl.company_id = $1
     )
     LIMIT 500`,
    [companyId]
  );

  let synced = 0;
  for (const pv of rows) {
    try {
      const amt = parseFloat(pv.amount || 0);
      if (amt <= 0) continue;
      const narration = pv.narration || `Payment Voucher ${pv.voucher_number}`;
      const entries = [
        { accountId: creditorsAcc?.id, debit: amt,  txType: 'Payment', narration },
        { accountId: cashAcc?.id,      credit: amt, txType: 'Payment', narration },
      ];
      await postGL(db, pv.company_id, pv.id, 'Payment', pv.voucher_date, entries, narration);
      synced++;
    } catch (e) {
      console.error(`[AccountingSync] Payment voucher ${pv.id} failed:`, e.message);
    }
  }
  return { synced, total: rows.length };
}

// ── SYNC: Receipt Vouchers (incoming) ────────────────────────────────────────
async function syncReceiptVouchers(companyId) {
  const coa = await getCOA(companyId);
  const cashAcc    = findAccount(coa, 'SYS-110002', '1001', 'ASST-001', 'cash in hand');
  const debtorsAcc = findAccount(coa, 'SYS-110001', 'sundry debtors');

  const { rows } = await db.query(
    `SELECT rv.id, rv.receipt_no as voucher_number, rv.receipt_date as voucher_date,
            COALESCE(rv.net_received, rv.amount, 0) as amount,
            rv.party_id, rv.narration
     FROM receipt_vouchers rv
     WHERE rv.status NOT IN ('Cancelled','Void')
     AND NOT EXISTS (
       SELECT 1 FROM general_ledger gl
       WHERE gl.voucher_id = rv.id AND gl.company_id = $1
     )
     LIMIT 500`,
    [companyId]
  );

  let synced = 0;
  for (const rv of rows) {
    try {
      const amt = parseFloat(rv.amount || 0);
      if (amt <= 0) continue;
      const narration = rv.narration || `Receipt Voucher ${rv.voucher_number}`;
      const entries = [
        { accountId: cashAcc?.id,    debit: amt,  txType: 'Receipt', narration },
        { accountId: debtorsAcc?.id, credit: amt, txType: 'Receipt', narration },
      ];
      await postGL(db, rv.company_id, rv.id, 'Receipt', rv.voucher_date, entries, narration);
      synced++;
    } catch (e) {
      console.error(`[AccountingSync] Receipt voucher ${rv.id} failed:`, e.message);
    }
  }
  return { synced, total: rows.length };
}

// ── SYNC ALL — bulk catch-up ──────────────────────────────────────────────────
async function syncAll(companyId) {
  console.log(`[AccountingSync] Starting full sync for company ${companyId}`);
  await ensureSystemAccounts(companyId);

  const [sales, purchases, pos, expenses, payments, receipts] = await Promise.all([
    syncSalesInvoices(companyId),
    syncPurchaseOrders(companyId),
    syncPOSBills(companyId),
    syncExpenses(companyId),
    syncPaymentVouchers(companyId),
    syncReceiptVouchers(companyId),
  ]);

  const result = { sales, purchases, pos, expenses, payments, receipts };
  const totalSynced = Object.values(result).reduce((s, r) => s + (r.synced || 0), 0);
  console.log(`[AccountingSync] Sync complete — ${totalSynced} GL entries posted`, result);
  return result;
}

// ── SYNC SINGLE DOCUMENT (called from Kafka consumer) ────────────────────────
async function syncDocument(companyId, sourceTable, documentId) {
  await ensureSystemAccounts(companyId);
  switch (sourceTable) {
    case 'sales_invoices':     return syncSalesInvoices(companyId, documentId);
    case 'purchase_orders':    return syncPurchaseOrders(companyId, documentId);
    case 'purchase_invoices':  return syncPurchaseOrders(companyId, documentId);
    case 'pos_bills':          return syncPOSBills(companyId, documentId);
    case 'expenses':           return syncExpenses(companyId, documentId);
    case 'payment_vouchers':   return syncPaymentVouchers(companyId);
    case 'receipt_vouchers':   return syncReceiptVouchers(companyId);
    default:
      console.warn(`[AccountingSync] Unknown source table: ${sourceTable}`);
      return { synced: 0 };
  }
}

module.exports = {
  syncAll,
  syncDocument,
  syncSalesInvoices,
  syncPurchaseOrders,
  syncPOSBills,
  syncExpenses,
  syncPaymentVouchers,
  syncReceiptVouchers,
  ensureSystemAccounts,
  bustCOACache,
};
