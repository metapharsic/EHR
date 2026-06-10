const db = require('../server/db');

async function main() {
  try {
    // Check hr_asset_allocations columns
    const r1 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='hr_asset_allocations'");
    console.log('hr_asset_allocations columns:', r1.rows.map(c => c.column_name).join(', '));

    // Check boms table 
    const r2 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='boms'");
    console.log('boms columns:', r2.rows.map(c => c.column_name).join(', '));

    // Check production_orders table
    const r3 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='production_orders'");
    console.log('production_orders columns:', r3.rows.map(c => c.column_name).join(', '));

    // Check asset_categories table
    const r4 = await db.query("SELECT * FROM asset_categories LIMIT 5");
    console.log('asset_categories rows:', JSON.stringify(r4.rows));

    // Check fixed_assets table columns
    const r5 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='fixed_assets'");
    console.log('fixed_assets columns:', r5.rows.map(c => c.column_name).join(', '));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}
main();
