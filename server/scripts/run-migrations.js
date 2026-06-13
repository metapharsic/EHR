const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Look for server/.env first, fall back to root
const envPath = fs.existsSync(path.join(__dirname, '..', '.env'))
  ? path.join(__dirname, '..', '.env')
  : path.join(__dirname, '..', '..', '.env');
require('dotenv').config({ path: envPath });

const pool = new Pool({
    user: process.env.DB_USER || 'erp_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'metapharsic_erp',
    password: process.env.DB_PASSWORD || 'erp_secure_2026',
    port: process.env.DB_PORT || 5432,
});

async function runSqlFile(filePath) {
    console.log(`[MIGRATE] Running SQL: ${path.basename(filePath)}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
        await pool.query(sql);
        console.log(`[SUCCESS] Completed: ${path.basename(filePath)}`);
    } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('already a member') || err.message.includes('already contains') || err.message.includes('duplicate key value') || err.message.includes('duplicate column')) {
            console.log(`[INFO] Skipping matching element in ${path.basename(filePath)}: ${err.message}`);
        } else {
            console.error(`[ERROR] In ${path.basename(filePath)}:`, err.message);
        }
    }
}

async function main() {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    console.log(`🚀 Found ${files.length} migration files. Applying...`);
    for (const file of files) {
        await runSqlFile(path.join(migrationsDir, file));
    }
    console.log('✅ Migrations check complete.');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
