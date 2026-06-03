const db = require('../db');

/**
 * Seed Order Management System (OMS) demo data across the full lifecycle.
 * Populates orders + order_items + order_status_history. order_number is assigned
 * automatically by the fn_assign_order_number trigger (migration 20260602).
 */
async function seedOMS() {
  try {
    console.log('🌱 Seeding Order Management System (OMS) data...');

    // 1. Distributors (Debtors)
    const distRes = await db.query("SELECT id, name, credit_limit, current_balance FROM parties WHERE type = 'Debtor' LIMIT 5");
    let distributors = distRes.rows;
    if (distributors.length === 0) {
      console.log('⚠️ No distributors found. Creating mock distributor...');
      const np = await db.query(
        "INSERT INTO parties (name, type, gstin, status, credit_limit) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, credit_limit, current_balance",
        ['Global Health Distributors', 'Debtor', '27ABCDE1234F1Z5', 'Active', 500000]
      );
      distributors = [np.rows[0]];
    }

    // 2. Products
    const prodRes = await db.query('SELECT id, name, gst FROM products LIMIT 6');
    const products = prodRes.rows;
    if (products.length === 0) {
      console.log('❌ No products found. Please seed inventory first.');
      return process.exit(0);
    }
    const pick = (i) => products[i % products.length];

    // 3. Orders across the lifecycle
    const today = new Date();
    const dStr = (offset) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);

    const blueprints = [
      { status: 'Pending Approval', priority: 'Normal', fulfillment: 'Unfulfilled', risk: null,
        items: [{ p: pick(0), qty: 100, rate: 150 }, { p: pick(1), qty: 50, rate: 85 }] },
      { status: 'Approved', priority: 'High', fulfillment: 'Reserved',
        risk: { score: 38, level: 'Medium', rec: 'Review', insight: 'Heuristic: credit utilization at 72%.' },
        items: [{ p: pick(2), qty: 200, rate: 120 }] },
      { status: 'Shipped', priority: 'Urgent', fulfillment: 'Fulfilled',
        risk: { score: 22, level: 'Low', rec: 'Approve', insight: 'Heuristic: healthy credit position and stock available.' },
        items: [{ p: pick(3), qty: 75, rate: 210 }, { p: pick(0), qty: 40, rate: 150 }] },
      { status: 'Delivered', priority: 'Normal', fulfillment: 'Fulfilled',
        risk: { score: 18, level: 'Low', rec: 'Approve', insight: 'Heuristic: low exposure.' },
        items: [{ p: pick(4), qty: 60, rate: 95 }] },
    ];

    for (const bp of blueprints) {
      const dist = distributors[Math.floor(Math.random() * distributors.length)];
      let subtotal = 0, tax = 0;
      bp.items.forEach((it) => {
        const amt = it.qty * it.rate;
        subtotal += amt;
        tax += amt * (Number(it.p.gst || 0) / 100);
      });
      const total = subtotal + tax;

      const ordRes = await db.query(
        `INSERT INTO orders (
            distributor_id, distributor_name, order_date, subtotal, tax_amount, total_amount,
            status, priority, fulfillment_status, expected_delivery_date,
            ai_risk_score, ai_risk_level, ai_recommendation, ai_insight,
            approved_at, shipped_at, delivered_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id, order_number`,
        [
          dist.id, dist.name, dStr(-5), subtotal, tax, total,
          bp.status, bp.priority, bp.fulfillment, dStr(3),
          bp.risk?.score ?? null, bp.risk?.level ?? null, bp.risk?.rec ?? null, bp.risk?.insight ?? null,
          ['Approved', 'Shipped', 'Delivered'].includes(bp.status) ? dStr(-4) : null,
          ['Shipped', 'Delivered'].includes(bp.status) ? dStr(-2) : null,
          bp.status === 'Delivered' ? dStr(-1) : null,
        ]
      );
      const order = ordRes.rows[0];

      for (const it of bp.items) {
        const amt = it.qty * it.rate;
        await db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, approved_quantity, shipped_quantity, rate, amount, gst_percent)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [order.id, it.p.id, it.p.name, it.qty, it.qty,
           ['Shipped', 'Delivered'].includes(bp.status) ? it.qty : 0, it.rate, amt, it.p.gst || 0]
        );
      }

      // Status history trail
      const trail = ['Pending Approval'];
      if (['Approved', 'Shipped', 'Delivered'].includes(bp.status)) trail.push('Approved');
      if (['Shipped', 'Delivered'].includes(bp.status)) trail.push('Shipped');
      if (bp.status === 'Delivered') trail.push('Delivered');
      let prev = null;
      for (const st of trail) {
        await db.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, note) VALUES ($1,$2,$3,$4)`,
          [order.id, prev, st, 'Seed lifecycle']
        );
        prev = st;
      }
      console.log(`  ✓ ${order.order_number} → ${bp.status}`);
    }

    console.log('✅ OMS Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedOMS();
