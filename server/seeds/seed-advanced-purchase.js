const db = require('./db');

async function seedAdvancedPurchase() {
  try {
    console.log('🌱 Seeding Advanced Purchase data...');

    // 1. Get initial data
    const supplierRes = await db.query('SELECT id FROM suppliers LIMIT 1');
    const productRes = await db.query('SELECT id FROM products LIMIT 2');
    const userRes = await db.query('SELECT id FROM users LIMIT 1');

    if (!supplierRes.rows.length || !productRes.rows.length) {
      console.log('⚠️ Suppliers or Products missing. Seed those first.');
      return;
    }

    const supplierId = supplierRes.rows[0].id;
    const userId = userRes.rows[0].id;

    // 2. Seed Budgets
    await db.query(`
      INSERT INTO purchase_budgets (category_id, period_name, budgeted_amount, spent_amount, committed_amount, status)
      VALUES 
        ('RAW_MATERIALS', 'FY2024-Q1', 5000000, 1250000, 450000, 'Under'),
        ('PACKAGING', 'FY2024-Q1', 1000000, 850000, 100000, 'Near'),
        ('LAB_EQUIPMENT', 'FY2024-Q1', 2000000, 100000, 50000, 'Under')
      ON CONFLICT (category_id, period_name) DO NOTHING
    `);

    // 3. Seed Vendor Ratings
    await db.query(`
      INSERT INTO vendor_ratings (supplier_id, quality_score, delivery_score, price_score, service_score, overall_rating, on_time_delivery_rate, total_transactions)
      VALUES ($1, 4.8, 4.5, 4.2, 4.6, 4.5, 92.5, 45)
      ON CONFLICT (supplier_id) DO UPDATE SET overall_rating = 4.5
    `, [supplierId]);

    // 4. Seed a Purchase Order for Matching
    const poRes = await db.query(`
      INSERT INTO purchase_orders (invoice_no, supplier_id, order_date, status, created_by)
      VALUES ('PO-MATCH-001', $1, CURRENT_DATE, 'Ordered', $2)
      RETURNING id
    `, [supplierId, userId]);
    const poId = poRes.rows[0].id;

    // 5. Seed GRN for that PO
    const grnRes = await db.query(`
      INSERT INTO goods_received_notes (purchase_order_id, grn_number, status, received_by)
      VALUES ($1, 'GRN-MATCH-001', 'Completed', $2)
      RETURNING id
    `, [poId, userId]);
    const grnId = grnRes.rows[0].id;

    // 6. Seed Supplier Invoice for that PO
    const invRes = await db.query(`
      INSERT INTO supplier_invoices (supplier_id, invoice_number, invoice_date, total_amount, status)
      VALUES ($1, 'INV-MATCH-001', CURRENT_DATE, 150000, 'Pending')
      RETURNING id
    `, [supplierId]);
    const invId = invRes.rows[0].id;

    // 7. Seed 3-Way Match Record
    await db.query(`
      INSERT INTO three_way_matches (purchase_order_id, grn_id, invoice_id, match_status, variance_amount)
      VALUES ($1, $2, $3, 'Matched', 0)
    `, [poId, grnId, invId]);

    console.log('✅ Advanced Purchase seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedAdvancedPurchase();
