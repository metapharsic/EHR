const db = require('../server/db');

async function main() {
  try {
    // Check stock_ledger_entries column types
    const r1 = await db.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name='stock_ledger_entries'
    `);
    console.log('stock_ledger_entries types:');
    r1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (${r.udt_name})`));

    // Check godowns table
    const r2 = await db.query(`SELECT id FROM godowns LIMIT 1`);
    console.log('\nSample godown ID:', r2.rows[0]?.id, typeof r2.rows[0]?.id);

    // Check products table
    const r3 = await db.query(`SELECT id FROM products LIMIT 1`);
    console.log('Sample product ID:', r3.rows[0]?.id, typeof r3.rows[0]?.id);

    // Get batches
    const r4 = await db.query(`SELECT id FROM batches LIMIT 1`);
    console.log('Sample batch ID:', r4.rows[0]?.id, typeof r4.rows[0]?.id);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}
main();
