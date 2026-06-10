const db = require('../server/db');

async function main() {
  try {
    // Check column types
    const r1 = await db.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name='hr_asset_allocations'
    `);
    console.log('hr_asset_allocations types:');
    r1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (${r.udt_name})`));

    // Check employees table employee_id
    const r2 = await db.query(`SELECT id FROM employees LIMIT 3`);
    console.log('\nSample employee IDs:', r2.rows.map(r => `${r.id} (${typeof r.id})`));

    // Check if the column is uuid
    const r3 = await db.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name='employees' AND column_name='id'
    `);
    console.log('\nEmployees.id type:', r3.rows[0]);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}
main();
