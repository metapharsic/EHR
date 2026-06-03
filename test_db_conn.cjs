const db = require('./server/db');
async function test() {
  try {
    const res = await db.query('SELECT NOW()');
    console.log('Database connection successful:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}
test();
