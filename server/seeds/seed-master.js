const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Initialize DB connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('Connecting to database...');
    
    const seedFilePath = path.join(__dirname, 'migrations', '20260507_master_seed_data.sql');
    
    if (!fs.existsSync(seedFilePath)) {
      console.error(`Seed file not found at: ${seedFilePath}`);
      process.exit(1);
    }

    console.log('Reading seed file...');
    const seedSql = fs.readFileSync(seedFilePath, 'utf8');

    console.log('Executing seed script...');
    await client.query('BEGIN');
    
    await client.query(seedSql);
    
    await client.query('COMMIT');
    console.log('✅ Seed data successfully inserted!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error executing seed script:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

runSeed();
