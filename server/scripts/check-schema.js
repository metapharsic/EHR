
const db = require('../db');

async function checkSchema() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'budgets'
        `);
        console.log('Columns in budgets table:');
        res.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
    } catch (e) {
        console.error('Failed to check schema:', e.message);
    } finally {
        process.exit();
    }
}

checkSchema();
