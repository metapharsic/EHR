const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', database:'metapharsic_erp', user:'erp_user', password:'Metapharsic@ERP2026!' });

async function main() {
  const checks = [
    { label: 'users (seeded roles)', sql: `SELECT COUNT(*) FROM users WHERE username IN ('sales_manager','inventory_mgr','accountant2','hr_manager','compliance_officer','pharmacist2')` },
    { label: 'godowns (total)', sql: `SELECT COUNT(*) FROM godowns` },
    { label: 'products (total)', sql: `SELECT COUNT(*) FROM products` },
    { label: 'batches (total)', sql: `SELECT COUNT(*) FROM batches` },
    { label: 'parties - Debtor (total)', sql: `SELECT COUNT(*) FROM parties WHERE type='Debtor'` },
    { label: 'parties - Creditor (total)', sql: `SELECT COUNT(*) FROM parties WHERE type='Creditor'` },
    { label: 'cost_centers (total)', sql: `SELECT COUNT(*) FROM cost_centers` },
    { label: 'employees (total)', sql: `SELECT COUNT(*) FROM employees` },
    { label: 'chart_of_accounts (total)', sql: `SELECT COUNT(*) FROM chart_of_accounts` },
  ];
  for (const c of checks) {
    const r = await pool.query(c.sql);
    console.log(`  ${c.label.padEnd(40)}: ${r.rows[0].count}`);
  }
  // Sample batch check
  const sample = await pool.query(`SELECT p.name, b.batch_number, b.stock, b.mrp, b.expiry_date, b.location FROM batches b JOIN products p ON p.id=b.product_id ORDER BY p.name, b.batch_number LIMIT 6`);
  console.log('\nSample batches:');
  sample.rows.forEach(r => console.log(`  ${r.name} | ${r.batch_number} | stock:${r.stock} | mrp:${r.mrp} | exp:${r.expiry_date?.toISOString().substring(0,10)} | ${r.location}`));
  await pool.end();
}
main().catch(console.error);
