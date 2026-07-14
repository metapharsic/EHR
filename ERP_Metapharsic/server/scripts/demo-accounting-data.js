/**
 * Demo Accounting Data Seeder
 * Populates all accounting tables with sample data for testing
 */

const db = require('./db');
const { v4: uuidv4 } = require('uuid');

// Admin user ID (from database)
const ADMIN_USER_ID = '027bf305-1ca5-460a-94b2-71da6289896d';

const seedAccountingData = async () => {
  try {
    console.log('🌱 Starting accounting data seed...');

    // ========================================
    // 1. CHART OF ACCOUNTS (Master)
    // ========================================
    console.log('📊 Creating Chart of Accounts...');
    
    const accountsData = [
      // Assets
      { code: '1001', name: 'Cash', type: 'Asset', balance: 500000 },
      { code: '1002', name: 'Bank Account', type: 'Asset', balance: 2500000 },
      { code: '1003', name: 'Receivables', type: 'Asset', balance: 750000 },
      { code: '1004', name: 'Inventory', type: 'Asset', balance: 1500000 },
      { code: '1005', name: 'Property & Equipment', type: 'Asset', balance: 5000000 },
      
      // Liabilities
      { code: '2001', name: 'Payables', type: 'Liability', balance: 300000 },
      { code: '2002', name: 'Loan - Bank', type: 'Liability', balance: 1000000 },
      { code: '2003', name: 'GST Payable', type: 'Liability', balance: 150000 },
      
      // Equity
      { code: '3001', name: 'Capital', type: 'Equity', balance: 3000000 },
      { code: '3002', name: 'Retained Earnings', type: 'Equity', balance: 2500000 },
      
      // Income
      { code: '4001', name: 'Sales Revenue', type: 'Income', balance: 10000000 },
      { code: '4002', name: 'Other Income', type: 'Income', balance: 250000 },
      
      // Expenses
      { code: '5001', name: 'Cost of Goods Sold', type: 'Expense', balance: 5000000 },
      { code: '5002', name: 'Salaries & Wages', type: 'Expense', balance: 1200000 },
      { code: '5003', name: 'Rent', type: 'Expense', balance: 300000 },
      { code: '5004', name: 'Utilities', type: 'Expense', balance: 150000 },
      { code: '5005', name: 'Marketing', type: 'Expense', balance: 200000 }
    ];

    const chartOfAccounts = {};
    for (const acc of accountsData) {
      const accountId = uuidv4();
      chartOfAccounts[acc.code] = accountId;
      
      await db.query(
        `INSERT INTO chart_of_accounts (id, company_id, account_code, account_name, account_type, opening_balance, reconciliation_status, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [accountId, 1, acc.code, acc.name, acc.type, acc.balance, 'Balanced', ADMIN_USER_ID]
      );
    }
    console.log('✅ Chart of Accounts created: ' + Object.keys(chartOfAccounts).length + ' accounts');

    // ========================================
    // 2. COST CENTERS
    // ========================================
    console.log('💼 Creating Cost Centers...');
    
    const costCentersData = [
      { name: 'Sales', type: 'Department' },
      { name: 'Operations', type: 'Department' },
      { name: 'Administration', type: 'Department' },
      { name: 'Finance', type: 'Department' },
      { name: 'Warehouse - Mumbai', type: 'Location' },
      { name: 'Warehouse - Delhi', type: 'Location' }
    ];

    const costCenters = {};
    for (const cc of costCentersData) {
      const id = uuidv4();
      costCenters[cc.name] = id;
      
      await db.query(
        `INSERT INTO cost_centers (id, company_id, name, type, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, 1, cc.name, cc.type, ADMIN_USER_ID]
      );
    }
    console.log('✅ Cost Centers created: ' + Object.keys(costCenters).length + ' centers');

    // ========================================
    // 3. JOURNAL VOUCHERS (Opening Entry)
    // ========================================
    console.log('📝 Creating Journal Vouchers...');
    
    const jvData = [
      {
        no: 'JV/2024/001',
        date: '2024-04-01',
        narration: 'Opening Entry',
        entries: [
          { account: '1001', debit: 500000, credit: 0 },
          { account: '1002', debit: 2500000, credit: 0 },
          { account: '1003', debit: 750000, credit: 0 },
          { account: '1004', debit: 1500000, credit: 0 },
          { account: '1005', debit: 5000000, credit: 0 },
          { account: '2001', debit: 0, credit: 300000 },
          { account: '2002', debit: 0, credit: 1000000 },
          { account: '3001', debit: 0, credit: 3000000 },
          { account: '3002', debit: 0, credit: 2500000 }
        ]
      },
      {
        no: 'JV/2024/002',
        date: '2024-05-15',
        narration: 'Sales Transaction',
        entries: [
          { account: '1002', debit: 50000, credit: 0 },
          { account: '4001', debit: 0, credit: 50000 }
        ]
      },
      {
        no: 'JV/2024/003',
        date: '2024-05-20',
        narration: 'Purchase on Credit',
        entries: [
          { account: '1004', debit: 100000, credit: 0 },
          { account: '2001', debit: 0, credit: 100000 }
        ]
      },
      {
        no: 'JV/2024/004',
        date: '2024-06-01',
        narration: 'Salary Payment',
        entries: [
          { account: '5002', debit: 60000, credit: 0 },
          { account: '1002', debit: 0, credit: 60000 }
        ]
      },
      {
        no: 'JV/2024/005',
        date: '2024-06-05',
        narration: 'Rent Payment',
        entries: [
          { account: '5003', debit: 15000, credit: 0 },
          { account: '1002', debit: 0, credit: 15000 }
        ]
      },
      {
        no: 'JV/2024/006',
        date: '2024-06-10',
        narration: 'GST Payable',
        entries: [
          { account: '4001', debit: 0, credit: 200000 },
          { account: '2003', debit: 0, credit: 200000 },
          { account: '1002', debit: 200000, credit: 0 }
        ]
      }
    ];

    const journalVouchers = [];
    for (const jv of jvData) {
      const jvId = uuidv4();
      const totalDebit = jv.entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = jv.entries.reduce((sum, e) => sum + e.credit, 0);

      const { rows } = await db.query(
        `INSERT INTO journal_vouchers (id, company_id, voucher_no, voucher_date, narration, total_debit, total_credit, status, created_by, posted_by, posted_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`,
        [jvId, 1, jv.no, jv.date, jv.narration, totalDebit, totalCredit, 'Posted', ADMIN_USER_ID, ADMIN_USER_ID]
      );
      journalVouchers.push(rows[0]);

      // Create JV entries
      for (const entry of jv.entries) {
        await db.query(
          `INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [jvId, chartOfAccounts[entry.account], entry.debit, entry.credit, jv.narration]
        );
      }

      // Create GL entries
      for (const entry of jv.entries) {
        await db.query(
          `INSERT INTO general_ledger (account_id, voucher_id, voucher_type, transaction_date, debit, credit, running_balance, is_reconciled, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [chartOfAccounts[entry.account], jvId, 'JV', jv.date, entry.debit, entry.credit, 0, false]
        );
      }
    }
    console.log('✅ Journal Vouchers created: ' + journalVouchers.length + ' vouchers');

    // ========================================
    // 4. BANK RECONCILIATION
    // ========================================
    console.log('🏦 Creating Bank Reconciliation...');
    
    const bankRecId = uuidv4();
    await db.query(
      `INSERT INTO bank_reconciliation (id, company_id, bank_account_id, bank_statement_date, bank_balance, gl_balance, variance, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [bankRecId, 1, chartOfAccounts['1002'], '2024-06-30', 2625000, 2625000, 0, 'Completed', ADMIN_USER_ID]
    );
    console.log('✅ Bank Reconciliation created');

    // ========================================
    // 5. BUDGETS
    // ========================================
    console.log('💰 Creating Budgets...');
    
    const budgetsData = [
      { account: '5001', amount: 5500000, costCenter: 'Sales', period: 'Q1-2024' },
      { account: '5002', amount: 1500000, costCenter: 'Operations', period: 'Q1-2024' },
      { account: '5003', amount: 400000, costCenter: 'Administration', period: 'Q1-2024' },
      { account: '5004', amount: 200000, costCenter: 'Operations', period: 'Q1-2024' }
    ];

    for (const budget of budgetsData) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO budgets (id, company_id, cost_center_id, account_id, budget_amount, period_from, period_to, actual_amount, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [id, 1, costCenters[budget.costCenter] || null, chartOfAccounts[budget.account], budget.amount, '2024-04-01', '2024-06-30', 0, ADMIN_USER_ID]
      );
    }
    console.log('✅ Budgets created: ' + budgetsData.length + ' budgets');

    // ========================================
    // 6. TDS ENTRIES (Tax Deduction)
    // ========================================
    console.log('🔖 Creating TDS Entries...');
    
    const tdsData = [
      { section: '194C', rate: 2, amount: 10000, date: '2024-05-01' },
      { section: '194H', rate: 5, amount: 25000, date: '2024-05-15' }
    ];

    for (const tds of tdsData) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO tds_entries (id, company_id, tds_section, tds_rate, tds_amount, payment_date, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [id, 1, tds.section, tds.rate, tds.amount, tds.date, ADMIN_USER_ID]
      );
    }
    console.log('✅ TDS Entries created: ' + tdsData.length + ' entries');

    // ========================================
    // 7. E-INVOICES (GST)
    // ========================================
    console.log('📄 Creating E-Invoices...');
    
    const einvoiceData = [
      { irn: 'IRN20240515001', ack: 'ACK20240515001', status: 'Acknowledged' },
      { irn: 'IRN20240520001', ack: 'ACK20240520001', status: 'Acknowledged' }
    ];

    for (const ei of einvoiceData) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO e_invoices (id, company_id, irn, ack_no, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [id, 1, ei.irn, ei.ack, ei.status, ADMIN_USER_ID]
      );
    }
    console.log('✅ E-Invoices created: ' + einvoiceData.length + ' invoices');

    // ========================================
    // 8. AUDIT LOG
    // ========================================
    console.log('📋 Creating Audit Trail...');
    
    const auditData = [
      { table: 'journal_vouchers', action: 'Insert', record: journalVouchers[0]?.id },
      { table: 'journal_vouchers', action: 'Update', record: journalVouchers[0]?.id, old: 'Draft', new: 'Posted' },
      { table: 'chart_of_accounts', action: 'Insert', record: Object.values(chartOfAccounts)[0] }
    ];

    for (const audit of auditData) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO audit_log_accounting (id, company_id, table_name, record_id, action, old_value, new_value, user_id, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [id, 1, audit.table, audit.record, audit.action, audit.old || '', audit.new || '', ADMIN_USER_ID]
      );
    }
    console.log('✅ Audit Trail created');

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ Accounting Demo Data Seeded!      ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║                                        ║');
    console.log('║  📊 Chart of Accounts:  ' + String(Object.keys(chartOfAccounts).length).padEnd(4) + '        ║');
    console.log('║  💼 Cost Centers:       ' + String(Object.keys(costCenters).length).padEnd(4) + '        ║');
    console.log('║  📝 Journal Vouchers:   ' + String(journalVouchers.length).padEnd(4) + '        ║');
    console.log('║  🏦 Bank Reconciliation: 1           ║');
    console.log('║  💰 Budgets:           ' + String(budgetsData.length).padEnd(4) + '        ║');
    console.log('║  🔖 TDS Entries:       ' + String(tdsData.length).padEnd(4) + '        ║');
    console.log('║  📄 E-Invoices:        ' + String(einvoiceData.length).padEnd(4) + '        ║');
    console.log('║                                        ║');
    console.log('║  Ready to view all features!          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

// Run seeder
seedAccountingData();
