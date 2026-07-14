const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function runSqlFile(filePath) {
    console.log(`[INIT] Running SQL: ${path.basename(filePath)}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
        await pool.query(sql);
        console.log(`[SUCCESS] Completed: ${path.basename(filePath)}`);
    } catch (err) {
        if (err.message.includes('already exists')) {
            console.log(`[INFO] Some elements in ${path.basename(filePath)} already exist, skipping those.`);
        } else {
            console.error(`[ERROR] In ${path.basename(filePath)}:`, err.message);
        }
    }
}

async function runMigrationFiles() {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    console.log(`[INIT] Found ${files.length} migration files.`);
    for (const file of files) {
        await runSqlFile(path.join(migrationsDir, file));
    }
}

async function runSeedScripts() {
    console.log('[INIT] Running Seed Scripts...');
    const seeds = [
        'seed-master-comprehensive.js',
        'seed-transactions.js',
        'seed-hrms.js',
        'seed-inventory.js',
        'seed-purchase-intelligence.js'
    ];

    for (const seed of seeds) {
        console.log(`[SEED] Running: ${seed}`);
        try {
            // We'll use child_process to run the seed scripts as they are standalone
            const { execSync } = require('child_process');
            execSync(`node ${path.join(__dirname, '..', 'seeds', seed)}`, { stdio: 'inherit', env: process.env });
            console.log(`[SUCCESS] Seeded: ${seed}`);
        } catch (err) {
            console.error(`[ERROR] Seeding ${seed}:`, err.message);
        }
    }
}

async function main() {
    console.log('🚀 Starting Production Database Setup...');
    
    try {
        // 1. Initial Schema
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        await runSqlFile(schemaPath);

        // 2. Migrations
        await runMigrationFiles();

        // 3. Seeds
        await runSeedScripts();

        // 4. Admin User Setup
        console.log('[INIT] Setting up Admin user...');
        const { execSync } = require('child_process');
        execSync(`node ${path.join(__dirname, '..', 'scripts', 'setup-admin.js')}`, { stdio: 'inherit', env: process.env });

        console.log('\n✅ Database Setup Complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Setup failed:', err);
        process.exit(1);
    }
}

main();
