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
    const jvEntriesCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'journal_voucher_entries'");
    console.log('\njournal_voucher_entries columns:');
    jvEntriesCols.rows.forEach(row => console.log(` - ${row.column_name} (${row.data_type})`));

    const glCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'general_ledger'");
    console.log('\ngeneral_ledger columns:');
    glCols.rows.forEach(row => console.log(` - ${row.column_name} (${row.data_type})`));

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
