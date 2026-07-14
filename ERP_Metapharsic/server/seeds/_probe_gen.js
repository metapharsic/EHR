const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', database:'metapharsic_erp', user:'erp_user', password:'Metapharsic@ERP2026!' });
async function main() {
  const r = await pool.query(`SELECT column_name, is_generated, generation_expression FROM information_schema.columns WHERE table_name='batches' AND table_schema='public'`);
  r.rows.forEach(x => console.log(x.column_name, '|', x.is_generated, '|', x.generation_expression));
  await pool.end();
}
main().catch(console.error);
