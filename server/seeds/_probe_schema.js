const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', database:'metapharsic_erp', user:'erp_user', password:'Metapharsic@ERP2026!' });

async function main() {
  const tables = ['users','godowns','products','batches','parties','cost_centers','employees','accounts','chart_of_accounts','coa'];
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [t]);
      if (r.rows.length) {
        console.log(`\n=== TABLE: ${t} ===`);
        r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
      }
    } catch(e) { /* skip */ }
  }
  // List all tables
  const all = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  console.log('\n=== ALL TABLES ===');
  all.rows.forEach(r => console.log(' ', r.table_name));
  await pool.end();
}
main().catch(console.error);
