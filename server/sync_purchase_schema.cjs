const db = require('./db');

async function syncSchema() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Adding columns to purchase_orders...');
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS category_id VARCHAR(50);`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS priority VARCHAR(50);`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;`);

    console.log('Adding columns to purchase_order_items...');
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS mrp NUMERIC;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS gst_rate NUMERIC;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100);`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expiry_date DATE;`);

    await client.query('COMMIT');
    console.log('Schema sync completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error syncing schema:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

syncSchema();
