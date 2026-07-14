
const db = require('../db');

async function fixSchema() {
    try {
        console.log('Adding financial_year column to budgets table...');
        await db.query(`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS financial_year VARCHAR(20)`);
        console.log('✅ Column added successfully');
    } catch (e) {
        console.error('❌ Failed to fix schema:', e.message);
    } finally {
        process.exit();
    }
}

fixSchema();
