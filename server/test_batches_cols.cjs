const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_definition LIKE '%0-1000%'
    `);
    console.log('Matching routines:');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
