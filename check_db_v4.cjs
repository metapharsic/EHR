const { Pool } = require('./server/node_modules/pg');
const fs = require('fs');
const path = require('path');

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
    const res = await pool.query("SELECT * FROM chart_of_accounts WHERE account_code = '0-1000'");
    console.log('Accounts with code 0-1000:', res.rows);

    const jvEntries = await pool.query("SELECT * FROM journal_voucher_entries WHERE debit::text = '0-1000' OR credit::text = '0-1000'");
    console.log('JV entries with 0-1000:', jvEntries.rows);

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
