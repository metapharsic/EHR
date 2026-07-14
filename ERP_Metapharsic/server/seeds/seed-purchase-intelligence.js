/**
 * Purchase Intelligence Hub — Complete Database Seeder
 * Seeds ALL purchase intelligence tables with realistic pharmaceutical data:
 * - purchase_budgets (6 categories)
 * - vendor_ratings (all active suppliers)
 * - three_way_matches (linked PO → GRN → Invoice)
 * - approval_workflows (pending approvals)
 * - goods_received_notes + grn_items
 * - supplier_invoices
 */

const db = require('./db');

async function seedPurchaseIntelligence() {
  const client = await db.getClient();

  try {
    console.log('🧠 Purchase Intelligence Hub — Full Seeder');
    console.log('═'.repeat(50));

    await client.query('BEGIN');

    // ─── 1. Prerequisites Check ───────────────────────────────
    const { rows: suppliers } = await client.query('SELECT id, name FROM suppliers WHERE active = true ORDER BY name');
    const { rows: products } = await client.query('SELECT id, name, code FROM products WHERE is_active = true ORDER BY name LIMIT 20');
    const { rows: users } = await client.query('SELECT id, name FROM users LIMIT 3');
    const { rows: existingPOs } = await client.query(
      `SELECT po.id, po.invoice_no, po.supplier_id, po.status, 
              COALESCE(SUM(poi.quantity * poi.purchase_rate), 0) as total_amount
       FROM purchase_orders po
       LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
       GROUP BY po.id
       ORDER BY po.created_at DESC LIMIT 20`
    );

    if (!suppliers.length) {
      console.log('❌ No suppliers found. Seed suppliers first.');
      await client.query('ROLLBACK');
      process.exit(1);
    }
    if (!users.length) {
      console.log('❌ No users found. Seed users first.');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const userId = users[0].id;
    console.log(`✅ Found ${suppliers.length} suppliers, ${products.length} products, ${existingPOs.length} POs`);

    // ─── 2. PURCHASE BUDGETS ──────────────────────────────────
    console.log('\n📊 Seeding Purchase Budgets...');
    
    const budgetData = [
      { category: 'RAW_MATERIALS', period: 'FY2025-Q1', budgeted: 7500000, spent: 3250000, committed: 850000, status: 'Under' },
      { category: 'RAW_MATERIALS', period: 'FY2025-Q2', budgeted: 8000000, spent: 1200000, committed: 2100000, status: 'Under' },
      { category: 'PACKAGING', period: 'FY2025-Q1', budgeted: 2000000, spent: 1750000, committed: 180000, status: 'Near' },
      { category: 'PACKAGING', period: 'FY2025-Q2', budgeted: 2500000, spent: 450000, committed: 300000, status: 'Under' },
      { category: 'LAB_EQUIPMENT', period: 'FY2025-Q1', budgeted: 3000000, spent: 2800000, committed: 350000, status: 'Over' },
      { category: 'QUALITY_TESTING', period: 'FY2025-Q1', budgeted: 1500000, spent: 600000, committed: 200000, status: 'Under' },
      { category: 'EXCIPIENTS', period: 'FY2025-Q1', budgeted: 4000000, spent: 2100000, committed: 900000, status: 'Under' },
      { category: 'API_CHEMICALS', period: 'FY2025-Q1', budgeted: 12000000, spent: 8500000, committed: 2200000, status: 'Near' },
    ];

    for (const b of budgetData) {
      await client.query(`
        INSERT INTO purchase_budgets (category_id, period_name, budgeted_amount, spent_amount, committed_amount, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (category_id, period_name) DO UPDATE SET
          budgeted_amount = EXCLUDED.budgeted_amount,
          spent_amount = EXCLUDED.spent_amount,
          committed_amount = EXCLUDED.committed_amount,
          status = EXCLUDED.status
      `, [b.category, b.period, b.budgeted, b.spent, b.committed, b.status]);
    }
    console.log(`   ✅ ${budgetData.length} budget records seeded`);

    // ─── 3. VENDOR RATINGS ────────────────────────────────────
    console.log('\n⭐ Seeding Vendor Ratings...');

    const ratingProfiles = [
      { quality: 4.8, delivery: 4.5, price: 4.2, service: 4.6, overall: 4.5, onTime: 92.5, txns: 45 },
      { quality: 4.2, delivery: 3.8, price: 4.5, service: 4.0, overall: 4.1, onTime: 78.0, txns: 32 },
      { quality: 4.9, delivery: 4.7, price: 3.5, service: 4.8, overall: 4.5, onTime: 96.0, txns: 67 },
      { quality: 3.5, delivery: 3.2, price: 4.8, service: 3.7, overall: 3.8, onTime: 65.0, txns: 18 },
      { quality: 4.6, delivery: 4.4, price: 4.0, service: 4.3, overall: 4.3, onTime: 88.0, txns: 54 },
      { quality: 4.0, delivery: 4.6, price: 3.8, service: 4.2, overall: 4.2, onTime: 90.0, txns: 29 },
      { quality: 3.8, delivery: 3.5, price: 4.3, service: 3.9, overall: 3.9, onTime: 72.0, txns: 21 },
      { quality: 4.7, delivery: 4.3, price: 4.1, service: 4.5, overall: 4.4, onTime: 91.0, txns: 38 },
    ];

    let vendorCount = 0;
    for (let i = 0; i < Math.min(suppliers.length, ratingProfiles.length); i++) {
      const s = suppliers[i];
      const r = ratingProfiles[i];
      await client.query(`
        INSERT INTO vendor_ratings (supplier_id, quality_score, delivery_score, price_score, service_score, overall_rating, on_time_delivery_rate, total_transactions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (supplier_id) DO UPDATE SET
          quality_score = EXCLUDED.quality_score,
          delivery_score = EXCLUDED.delivery_score,
          price_score = EXCLUDED.price_score,
          service_score = EXCLUDED.service_score,
          overall_rating = EXCLUDED.overall_rating,
          on_time_delivery_rate = EXCLUDED.on_time_delivery_rate,
          total_transactions = EXCLUDED.total_transactions,
          last_evaluated_at = NOW()
      `, [s.id, r.quality, r.delivery, r.price, r.service, r.overall, r.onTime, r.txns]);
      vendorCount++;
    }
    console.log(`   ✅ ${vendorCount} vendor ratings seeded`);

    // ─── 4. GRNs, INVOICES & 3-WAY MATCHING ──────────────────
    console.log('\n🔀 Seeding 3-Way Matching Data...');

    let matchCount = 0;
    const matchStatuses = ['Matched', 'Mismatch', 'Partial', 'Pending'];
    const varianceAmounts = [0, 0, 2500, 0, -1800, 0, 5000, 0, 0, 3200];

    for (let i = 0; i < Math.min(existingPOs.length, 10); i++) {
      const po = existingPOs[i];
      const poTotal = parseFloat(po.total_amount) || 10000;
      const status = matchStatuses[i % matchStatuses.length];
      const variance = varianceAmounts[i % varianceAmounts.length];

      // Create GRN
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`;
      const { rows: existingGrn } = await client.query(
        'SELECT id FROM goods_received_notes WHERE grn_number = $1', [grnNumber]
      );

      let grnId;
      if (existingGrn.length) {
        grnId = existingGrn[0].id;
      } else {
        const grnRes = await client.query(`
          INSERT INTO goods_received_notes (purchase_order_id, grn_number, status, received_by, remarks)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [po.id, grnNumber, i % 3 === 0 ? 'Inspected' : 'Completed', userId, `Auto-seeded GRN for PO: ${po.invoice_no}`]);
        grnId = grnRes.rows[0].id;
      }

      // Create Supplier Invoice
      const invNumber = `SINV-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`;
      const { rows: existingInv } = await client.query(
        'SELECT id FROM supplier_invoices WHERE invoice_number = $1 AND supplier_id = $2', [invNumber, po.supplier_id]
      );

      let invId;
      const invoiceAmount = poTotal + variance;
      if (existingInv.length) {
        invId = existingInv[0].id;
      } else {
        const invRes = await client.query(`
          INSERT INTO supplier_invoices (supplier_id, invoice_number, invoice_date, due_date, total_amount, tax_amount, status)
          VALUES ($1, $2, CURRENT_DATE - INTERVAL '${i * 3} days', CURRENT_DATE + INTERVAL '${30 - i * 2} days', $3, $4, $5)
          RETURNING id
        `, [po.supplier_id, invNumber, invoiceAmount, invoiceAmount * 0.18, variance === 0 ? 'Verified' : 'Pending']);
        invId = invRes.rows[0].id;
      }

      // Create 3-Way Match
      const { rows: existingMatch } = await client.query(
        'SELECT id FROM three_way_matches WHERE purchase_order_id = $1', [po.id]
      );

      if (!existingMatch.length) {
        await client.query(`
          INSERT INTO three_way_matches (purchase_order_id, grn_id, invoice_id, match_status, variance_amount, remarks)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [po.id, grnId, invId, status, variance, variance !== 0 ? `Variance of ₹${Math.abs(variance)} detected` : 'All amounts matched']);
        matchCount++;
      }
    }
    console.log(`   ✅ ${matchCount} three-way match records seeded`);

    // ─── 5. APPROVAL WORKFLOWS ────────────────────────────────
    console.log('\n✅ Seeding Approval Workflows...');

    let approvalCount = 0;
    const approvalStatuses = ['Pending', 'Pending', 'Approved', 'Pending', 'Rejected'];
    const approvalLevels = [
      { current: 1, total: 3 },
      { current: 2, total: 3 },
      { current: 3, total: 3 },
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ];

    for (let i = 0; i < Math.min(existingPOs.length, 5); i++) {
      const po = existingPOs[i];
      const approvalStatus = approvalStatuses[i];
      const level = approvalLevels[i];

      const { rows: existingApproval } = await client.query(
        "SELECT id FROM approval_workflows WHERE document_id = $1 AND document_type = 'PO'", [po.id]
      );

      if (!existingApproval.length) {
        await client.query(`
          INSERT INTO approval_workflows (document_type, document_id, current_level, total_levels, status)
          VALUES ('PO', $1, $2, $3, $4)
        `, [po.id, level.current, level.total, approvalStatus]);
        approvalCount++;
      }
    }
    console.log(`   ✅ ${approvalCount} approval workflows seeded`);

    // ─── 6. GRN ITEMS ─────────────────────────────────────────
    console.log('\n📦 Seeding GRN Items...');

    const { rows: grns } = await client.query(
      `SELECT g.id as grn_id, g.purchase_order_id 
       FROM goods_received_notes g
       LEFT JOIN grn_items gi ON g.id = gi.grn_id
       WHERE gi.id IS NULL
       LIMIT 10`
    );

    let grnItemCount = 0;
    for (const grn of grns) {
      // Get PO items for this GRN's PO
      const { rows: poItems } = await client.query(
        `SELECT id, product_id, quantity, purchase_rate FROM purchase_order_items WHERE purchase_order_id = $1`,
        [grn.purchase_order_id]
      );

      for (const item of poItems) {
        const received = Math.max(1, item.quantity - Math.floor(Math.random() * 3));
        const accepted = Math.max(1, received - Math.floor(Math.random() * 2));
        
        await client.query(`
          INSERT INTO grn_items (grn_id, product_id, po_item_id, ordered_qty, received_qty, accepted_qty, rejected_qty, unit_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [grn.grn_id, item.product_id, item.id, item.quantity, received, accepted, received - accepted, item.purchase_rate]);
        grnItemCount++;
      }
    }
    console.log(`   ✅ ${grnItemCount} GRN line items seeded`);

    await client.query('COMMIT');

    // ─── 7. SUMMARY ───────────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log('🎯 PURCHASE INTELLIGENCE HUB — SEEDING COMPLETE!');
    console.log('═'.repeat(50));

    // Verify counts
    const counts = {};
    for (const table of ['purchase_budgets', 'vendor_ratings', 'three_way_matches', 'approval_workflows', 'goods_received_notes', 'grn_items', 'supplier_invoices']) {
      const { rows } = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = rows[0].count;
    }

    // Reorder alerts (calculated, not stored)
    const { rows: reorderRows } = await db.query(`
      SELECT COUNT(*) as count FROM products p
      WHERE COALESCE(p.is_active, true) = true
      AND COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id), 0) <= COALESCE(p.min_stock_level, 0)
    `);

    console.log('\n📈 Final Intelligence Counts:');
    console.log(`   Purchase Budgets:     ${counts.purchase_budgets}`);
    console.log(`   Vendor Ratings:       ${counts.vendor_ratings}`);
    console.log(`   3-Way Matches:        ${counts.three_way_matches}`);
    console.log(`   Approval Workflows:   ${counts.approval_workflows}`);
    console.log(`   GRNs:                 ${counts.goods_received_notes}`);
    console.log(`   GRN Items:            ${counts.grn_items}`);
    console.log(`   Supplier Invoices:    ${counts.supplier_invoices}`);
    console.log(`   Reorder Alerts:       ${reorderRows[0].count} (calculated)`);
    console.log('');

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedPurchaseIntelligence();
