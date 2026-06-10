const db = require('../server/db');

async function main() {
  try {
    const r1 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='qc_records'");
    console.log('qc_records columns:', r1.rows.map(c => c.column_name).join(', '));

    const r2 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='qc_parameters'");
    console.log('qc_parameters columns:', r2.rows.map(c => c.column_name).join(', '));

    // Sample data
    const r3 = await db.query("SELECT * FROM qc_records LIMIT 2");
    console.log('qc_records sample:', JSON.stringify(r3.rows[0] || null));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}
main();
