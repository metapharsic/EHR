const db = require('./server/db');
const table = process.argv[2];
async function run() {
  if (!table) {
    console.error('Please provide a table name');
    process.exit(1);
  }
  const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
  console.log(`Table ${table}:`, res.rows.map(r => r.column_name));
  process.exit(0);
}
run();
