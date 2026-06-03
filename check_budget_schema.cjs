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
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%budget%'");
    console.log('Budget Tables:', tables.rows.map(r => r.table_name));

    for (const table of tables.rows.map(r => r.table_name)) {
      const columns = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
      console.log(`Columns in ${table}:`, columns.rows.map(r => `${r.column_name} (${r.data_type})`));
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
