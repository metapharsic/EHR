const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
(async () => {
  try {
    // 1. Tables
    const tables = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    );
    console.log('=== DB TABLES (' + tables.rows.length + ') ===');
    console.log(tables.rows.map(r=>r.tablename).join(', '));

    // 2. Row counts for key tables
    const counts = await pool.query(`SELECT
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM batches) as batches,
      (SELECT COUNT(*) FROM sales_invoices) as invoices,
      (SELECT COUNT(*) FROM employees) as employees,
      (SELECT COUNT(*) FROM journal_vouchers) as jv,
      (SELECT COUNT(*) FROM chart_of_accounts) as coa,
      (SELECT COUNT(*) FROM purchase_orders) as po,
      (SELECT COUNT(*) FROM crm_leads) as leads,
      (SELECT COUNT(*) FROM drug_licenses) as licenses,
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM parties) as parties,
      (SELECT COUNT(*) FROM production_orders) as prod_orders,
      (SELECT COUNT(*) FROM boms) as boms
    `);
    console.log('\n=== ROW COUNTS ===');
    Object.entries(counts.rows[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

    // 3. Check for missing critical tables
    const criticalTables = [
      'users','products','batches','sales_invoices','purchase_orders',
      'journal_vouchers','chart_of_accounts','parties','employees',
      'crm_leads','drug_licenses','production_orders','boms','raw_materials',
      'godowns','stock_ledger_entries','tax_configurations','payment_vouchers'
    ];
    const missing = criticalTables.filter(t =>
      !tables.rows.some(r => r.tablename === t)
    );
    if (missing.length > 0) {
      console.log('\n=== MISSING CRITICAL TABLES ===');
      console.log(missing.join(', '));
    } else {
      console.log('\n=== ALL CRITICAL TABLES PRESENT ✅ ===');
    }

    // 4. Check for expired batches
    const expired = await pool.query(
      "SELECT COUNT(*) as cnt FROM batches WHERE expiry_date < NOW() AND stock > 0"
    );
    console.log('\n=== EXPIRED BATCHES WITH STOCK > 0: ' + expired.rows[0].cnt + ' ===');

    // 5. Index health
    const idx = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname LIMIT 20"
    );
    console.log('\n=== INDEXES (' + idx.rows.length + ' shown) ===');
    console.log(idx.rows.map(r=>r.indexname).join(', '));

    // 6. Sequence check for invoice numbering
    const seqs = await pool.query(
      "SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public'"
    );
    console.log('\n=== SEQUENCES (' + seqs.rows.length + ') ===');
    seqs.rows.forEach(r => console.log(`  ${r.sequencename}: last=${r.last_value}`));

  } catch(e) {
    console.error('DB ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
