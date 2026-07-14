require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function migrate() {
    try {
        console.log('Adding fingerprint and risk_score columns to users table...');
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS last_device_fingerprint VARCHAR(255),
            ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5,2) DEFAULT 0.0;
        `);
        console.log('✅ Migration successful');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        pool.end();
    }
}

migrate();