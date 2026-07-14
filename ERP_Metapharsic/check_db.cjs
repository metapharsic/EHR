const { Pool } = require('./server/node_modules/pg');
const fs = require('fs');
const path = require('path');

// Basic env parser since we can't easily use dotenv
const envPath = path.join(__dirname, 'server', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
});

async function check() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables:');
    res.rows.forEach(row => console.log(' - ' + row.table_name));

    const salarySlipsCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'salary_slips'");
    console.log('\nsalary_slips columns:');
    salarySlipsCols.rows.forEach(row => console.log(' - ' + row.column_name));

    const inventoryCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory'");
    console.log('\ninventory columns:');
    inventoryCols.rows.forEach(row => console.log(' - ' + row.column_name));

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
