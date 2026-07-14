const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function resetAdmin() {
  const hashedPassword = await bcrypt.hash('admin', 10);
  console.log('Resetting admin password to "admin"...');
  const res = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id',
    [hashedPassword, 'admin']
  );
  if (res.rows.length > 0) {
    console.log('✅ Admin password reset successfully!');
  } else {
    console.log('❌ Admin user not found! Creating it...');
    await pool.query(
        `INSERT INTO users (username, email, password_hash, name, role, created_at, two_factor_enabled)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        ['admin', 'admin@metapharsic.local', hashedPassword, 'Administrator', 'ADMIN', false]
    );
    console.log('✅ Admin user created!');
  }
  pool.end();
}

resetAdmin();
