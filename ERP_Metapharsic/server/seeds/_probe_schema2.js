const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', database:'metapharsic_erp', user:'erp_user', password:'Metapharsic@ERP2026!' });

async function main() {
  const tables = ['users','godowns'];
  for (const t of tables) {
    const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [t]);
    console.log(`\n=== TABLE: ${t} ===`);
    r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
  }
  // Check existing COA count
  const coa = await pool.query(`SELECT COUNT(*) FROM chart_of_accounts`);
  console.log('\nCOA count:', coa.rows[0].count);
  // Check constraints on batches
  const btc = await pool.query(`SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name='batches' AND table_schema='public'`);
  console.log('\nBatches constraints:');
  btc.rows.forEach(r=>console.log(' ',r.constraint_name, r.constraint_type));
  // Check constraints on products
  const pc = await pool.query(`SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name='products' AND table_schema='public'`);
  console.log('\nProducts constraints:');
  pc.rows.forEach(r=>console.log(' ',r.constraint_name, r.constraint_type));
  // Check constraints on parties
  const ptc = await pool.query(`SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name='parties' AND table_schema='public'`);
  console.log('\nParties constraints:');
  ptc.rows.forEach(r=>console.log(' ',r.constraint_name, r.constraint_type));
  // Check constraints on cost_centers
  const cc = await pool.query(`SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name='cost_centers' AND table_schema='public'`);
  console.log('\nCost centers constraints:');
  cc.rows.forEach(r=>console.log(' ',r.constraint_name, r.constraint_type));
  await pool.end();
}
main().catch(console.error);
