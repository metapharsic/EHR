/**
 * MIGRATION: Update Products Table with Pricing Matrix & Master Fields
 * Target: products table
 */

const db = require('./db');

async function runMigration() {
    console.log('🚀 Starting Products Master Migration...');
    
    try {
        // Add Pricing columns to products table
        await db.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS selling_rate NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ptr NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS pts NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS opening_stock INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS scheme TEXT,
            ADD COLUMN IF NOT EXISTS maintain_batches BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS track_expiry BOOLEAN DEFAULT TRUE;
        `);

        console.log('✅ Products table updated successfully with Pricing Matrix columns.');

        // Update existing data if needed (optional)
        
        console.log('🏁 Migration complete.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

runMigration();
