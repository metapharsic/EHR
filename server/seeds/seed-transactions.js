'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  user: process.env.DB_USER || 'erp_user',
  password: process.env.DB_PASSWORD || 'Metapharsic@ERP2026!',
  port: process.env.DB_PORT || 5432,
});

// ─── Counters ─────────────────────────────────────────────────────────────────
const counts = {};
const errors = [];

function track(table, n = 1) {
  counts[table] = (counts[table] || 0) + n;
}

async function safeRun(label, fn) {
  try {
    await fn();
  } catch (err) {
    const msg = `[ERROR] ${label}: ${err.message}`;
    console.error(msg);
    errors.push(msg);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  console.log('✅ Connected to database');

  try {
    // ── Fetch reference data ──────────────────────────────────────────────────
    const { rows: debtors } = await client.query(
      `SELECT id, name FROM parties WHERE type='Debtor' LIMIT 8`
    );
    const { rows: products } = await client.query(
      `SELECT id, name, selling_rate, mrp FROM products WHERE is_active = true LIMIT 8`
    );
    const { rows: creditors } = await client.query(
      `SELECT id, name FROM parties WHERE type='Creditor' LIMIT 5`
    );
    const { rows: users } = await client.query(`SELECT id FROM users LIMIT 1`);
    const { rows: batches } = await client.query(`SELECT id FROM batches LIMIT 6`);
    const { rows: godowns } = await client.query(`SELECT id FROM godowns LIMIT 1`);
    const { rows: pcdPartners } = await client.query(`SELECT id FROM pcd_partners LIMIT 5`);

    // COA accounts
    const { rows: coaRows } = await client.query(
      `SELECT id, account_name, account_type FROM chart_of_accounts`
    );
    const salesAcct = coaRows.find(r => r.account_name === 'Sales Revenue') ||
                      coaRows.find(r => r.account_type === 'Income');
    const debtorsAcct = coaRows.find(r => r.account_name === 'Sundry Debtors') ||
                        coaRows.find(r => r.account_type === 'Asset');
    const purchaseAcct = coaRows.find(r => r.account_name === 'Purchase Account') ||
                         coaRows.find(r => r.account_type === 'Expense');
    const cashAcct = coaRows.find(r => r.account_name === 'Cash in Hand') ||
                     coaRows.find(r => r.account_type === 'Asset');
    const bankAcct = coaRows.find(r => r.account_name === 'HDFC Bank C/A') ||
                     coaRows.find(r => r.account_type === 'Asset');
    const pcdCommAcct = coaRows.find(r => r.account_name === 'PCD Commission Expense') ||
                        coaRows.find(r => r.account_type === 'Expense');

    const userId = users[0]?.id || null;
    const godownId = godowns[0]?.id || null;

    console.log(`\n📋 Reference data loaded:`);
    console.log(`   Debtors: ${debtors.length}, Products: ${products.length}, Creditors: ${creditors.length}`);
    console.log(`   Users: ${users.length}, Batches: ${batches.length}, PCD Partners: ${pcdPartners.length}`);
    console.log(`   Sales Account: ${salesAcct?.account_name}, Debtors Account: ${debtorsAcct?.account_name}`);

    if (products.length === 0) throw new Error('No products found – cannot seed orders');
    if (debtors.length === 0) throw new Error('No debtors found – cannot seed orders');

    // ══════════════════════════════════════════════════════════════════════════
    // A. OMS ORDERS (20 orders)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('  A. Seeding OMS Orders (20)');
    console.log('═══════════════════════════════════════');

    const orderDefs = [
      // status, priority, daysAgoOffset, fulfillmentStatus
      { status: 'Pending Approval', priority: 'Normal',  daysAgo: 5,  fulfillment: 'Unfulfilled' },
      { status: 'Pending Approval', priority: 'Normal',  daysAgo: 7,  fulfillment: 'Unfulfilled' },
      { status: 'Pending Approval', priority: 'High',    daysAgo: 3,  fulfillment: 'Unfulfilled' },
      { status: 'Pending Approval', priority: 'Urgent',  daysAgo: 1,  fulfillment: 'Unfulfilled' },
      { status: 'Approved',         priority: 'Normal',  daysAgo: 10, fulfillment: 'Unfulfilled' },
      { status: 'Approved',         priority: 'High',    daysAgo: 12, fulfillment: 'Unfulfilled' },
      { status: 'Approved',         priority: 'Normal',  daysAgo: 14, fulfillment: 'Unfulfilled' },
      { status: 'Processing',       priority: 'Normal',  daysAgo: 15, fulfillment: 'Unfulfilled' },
      { status: 'Processing',       priority: 'High',    daysAgo: 17, fulfillment: 'Unfulfilled' },
      { status: 'Processing',       priority: 'Urgent',  daysAgo: 18, fulfillment: 'Unfulfilled' },
      { status: 'Partially Shipped',priority: 'Normal',  daysAgo: 20, fulfillment: 'Partial' },
      { status: 'Partially Shipped',priority: 'High',    daysAgo: 22, fulfillment: 'Partial' },
      { status: 'Shipped',          priority: 'Normal',  daysAgo: 25, fulfillment: 'Fulfilled' },
      { status: 'Shipped',          priority: 'Normal',  daysAgo: 27, fulfillment: 'Fulfilled' },
      { status: 'Shipped',          priority: 'High',    daysAgo: 30, fulfillment: 'Fulfilled' },
      { status: 'Delivered',        priority: 'Normal',  daysAgo: 35, fulfillment: 'Fulfilled' },
      { status: 'Delivered',        priority: 'Normal',  daysAgo: 38, fulfillment: 'Fulfilled' },
      { status: 'Invoiced',         priority: 'Normal',  daysAgo: 45, fulfillment: 'Fulfilled' },
      { status: 'Invoiced',         priority: 'High',    daysAgo: 50, fulfillment: 'Fulfilled' },
      { status: 'Cancelled',        priority: 'Normal',  daysAgo: 55, fulfillment: 'Unfulfilled' },
    ];

    const isShipped = s => ['Partially Shipped','Shipped','Delivered','Invoiced'].includes(s);
    const invoicedOrderIds = [];

    for (let i = 0; i < orderDefs.length; i++) {
      const def = orderDefs[i];
      const distributor = pick(debtors);
      const orderDate = daysAgo(def.daysAgo);
      const deliveryDate = daysAgo(def.daysAgo - 7);

      // Build line items (2-4 items)
      const itemCount = rand(2, 4);
      const pickedProducts = [];
      const usedIndexes = new Set();
      while (pickedProducts.length < itemCount) {
        const idx = rand(0, products.length - 1);
        if (!usedIndexes.has(idx)) {
          usedIndexes.add(idx);
          pickedProducts.push(products[idx]);
        }
      }

      const lines = pickedProducts.map(p => {
        const qty = rand(10, 200);
        const rate = parseFloat(p.selling_rate) > 0 ? parseFloat(p.selling_rate) : rand(50, 500);
        const shipped = isShipped(def.status) ? qty : 0;
        const amount = parseFloat((qty * rate).toFixed(2));
        return { product: p, qty, rate, shipped, amount };
      });

      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const taxAmount = parseFloat((subtotal * 0.12).toFixed(2));
      const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

      // Insert order
      let orderId, orderNumber;
      await safeRun(`Order ${i + 1} insert`, async () => {
        const res = await client.query(
          `INSERT INTO orders
             (distributor_id, distributor_name, order_date, total_amount, subtotal, tax_amount,
              status, priority, fulfillment_status, expected_delivery_date,
              remarks, created_by, godown_id,
              approved_at, shipped_at, delivered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           RETURNING id, order_number`,
          [
            distributor.id, distributor.name, orderDate, totalAmount, subtotal, taxAmount,
            def.status, def.priority, def.fulfillment, deliveryDate,
            `Seed order ${i + 1} - ${def.status}`,
            userId, godownId,
            ['Approved','Processing','Partially Shipped','Shipped','Delivered','Invoiced'].includes(def.status)
              ? new Date(new Date(orderDate).getTime() + 86400000).toISOString() : null,
            isShipped(def.status)
              ? new Date(new Date(orderDate).getTime() + 2 * 86400000).toISOString() : null,
            ['Delivered','Invoiced'].includes(def.status)
              ? new Date(new Date(orderDate).getTime() + 5 * 86400000).toISOString() : null,
          ]
        );
        orderId = res.rows[0].id;
        orderNumber = res.rows[0].order_number;
        track('orders');
        console.log(`  ✅ Order ${i + 1}: ${orderNumber} [${def.status}/${def.priority}] – ${distributor.name}`);
      });

      if (!orderId) continue;

      if (def.status === 'Invoiced') invoicedOrderIds.push(orderId);

      // Insert order_items
      const insertedItemIds = [];
      for (const line of lines) {
        await safeRun(`Order ${i + 1} item`, async () => {
          const res = await client.query(
            `INSERT INTO order_items
               (order_id, product_id, product_name, quantity, approved_quantity,
                rate, amount, shipped_quantity, gst_percent)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id`,
            [
              orderId, line.product.id, line.product.name,
              line.qty, line.qty,
              line.rate, line.amount, line.shipped,
              12.00,
            ]
          );
          insertedItemIds.push({ id: res.rows[0].id, ...line });
          track('order_items');
        });
      }

      // Insert status history (lifecycle trail)
      const statusChain = buildStatusChain(def.status);
      let prevStatus = null;
      for (let si = 0; si < statusChain.length; si++) {
        const toStatus = statusChain[si];
        await safeRun(`Order ${i + 1} history [${toStatus}]`, async () => {
          await client.query(
            `INSERT INTO order_status_history
               (order_id, from_status, to_status, note, changed_by, changed_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              orderId, prevStatus, toStatus,
              `Status changed to ${toStatus}`,
              userId,
              new Date(new Date(orderDate).getTime() + si * 86400000).toISOString(),
            ]
          );
          track('order_status_history');
        });
        prevStatus = toStatus;
      }

      // reserved_stock for Approved orders (needs a batch)
      if (def.status === 'Approved' && batches.length > 0) {
        const batchId = pick(batches).id;
        await safeRun(`Reserved stock for order ${i + 1}`, async () => {
          await client.query(
            `INSERT INTO reserved_stock
               (batch_id, order_id, order_type, order_number, qty_reserved)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (batch_id, order_id, order_type) DO NOTHING`,
            [batchId, orderId, 'SalesOrder', orderNumber, rand(10, 50)]
          );
          track('reserved_stock');
        });
      }

      // Store items for returns later
      orderDefs[i]._orderId = orderId;
      orderDefs[i]._itemIds = insertedItemIds;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // B. OMS RETURNS (3 returns on Invoiced orders)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('  B. Seeding OMS Returns (3)');
    console.log('═══════════════════════════════════════');

    // Fetch invoiced order items from DB
    const invoicedOrders = orderDefs.filter(o => o.status === 'Invoiced' && o._orderId);
    const returnStatuses = ['Pending', 'Approved', 'Pending'];

    for (let ri = 0; ri < Math.min(3, invoicedOrders.length); ri++) {
      const inv = invoicedOrders[ri];
      const returnDate = daysAgo(rand(1, 10));
      let returnId;

      await safeRun(`Return ${ri + 1} insert`, async () => {
        const res = await client.query(
          `INSERT INTO order_returns
             (order_id, return_date, reason, status, created_by)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, return_number`,
          [
            inv._orderId,
            returnDate,
            'Quality Issue',
            returnStatuses[ri],
            userId,
          ]
        );
        returnId = res.rows[0].id;
        track('order_returns');
        console.log(`  ✅ Return ${ri + 1}: ${res.rows[0].return_number} [${returnStatuses[ri]}] on order`);
      });

      if (!returnId || !inv._itemIds || inv._itemIds.length === 0) continue;

      // Insert 1-2 return items
      const returnItemCount = Math.min(rand(1, 2), inv._itemIds.length);
      for (let rii = 0; rii < returnItemCount; rii++) {
        const item = inv._itemIds[rii];
        await safeRun(`Return ${ri + 1} item ${rii + 1}`, async () => {
          const retQty = rand(1, Math.max(1, Math.floor(item.qty / 3)));
          await client.query(
            `INSERT INTO order_return_items
               (return_id, order_item_id, product_id, product_name, quantity, rate, amount, reason, condition, restock)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              returnId, item.id, item.product.id, item.product.name,
              retQty, item.rate,
              parseFloat((retQty * item.rate).toFixed(2)),
              'Quality Issue',
              pick(['Good', 'Damaged']),
              true,
            ]
          );
          track('order_return_items');
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // C. PURCHASE ORDERS (10 POs)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('  C. Seeding Purchase Orders (10)');
    console.log('═══════════════════════════════════════');

    if (creditors.length === 0) {
      console.warn('  ⚠️  No creditors found – skipping POs');
    } else {
      const poStatuses = [
        'Draft','Draft','Draft','Draft',
        'Sent','Sent','Sent',
        'Received','Received',
        'Cancelled',
      ];

      for (let pi = 0; pi < 10; pi++) {
        const supplier = pick(creditors);
        const poStatus = poStatuses[pi];
        const poDate = daysAgo(rand(5, 55));
        const deliveryDate = daysAgo(rand(1, 4));
        const poNumber = `PO-SEED-${Date.now()}-${pi + 1}`;

        // Build PO items (2-3)
        const poItemCount = rand(2, 3);
        const poLines = [];
        for (let j = 0; j < poItemCount; j++) {
          const prod = pick(products);
          const qty = rand(50, 500);
          const unitPrice = parseFloat(prod.selling_rate) > 0
            ? parseFloat((prod.selling_rate * 0.7).toFixed(2))
            : rand(30, 300);
          poLines.push({ prod, qty, unitPrice, total: parseFloat((qty * unitPrice).toFixed(2)) });
        }
        const totalAmount = poLines.reduce((s, l) => s + l.total, 0);

        let poId;
        await safeRun(`PO ${pi + 1}`, async () => {
          const res = await client.query(
            `INSERT INTO purchase_orders
               (supplier_id, po_number, date, total_amount, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (po_number) DO NOTHING
             RETURNING id`,
            [supplier.id, poNumber, poDate, totalAmount, poStatus, userId]
          );
          if (res.rows.length === 0) return;
          poId = res.rows[0].id;
          track('purchase_orders');
          console.log(`  ✅ PO ${pi + 1}: ${poNumber} [${poStatus}] – ${supplier.name} – ₹${totalAmount.toFixed(2)}`);
        });

        if (!poId) continue;

        for (const line of poLines) {
          await safeRun(`PO ${pi + 1} item`, async () => {
            await client.query(
              `INSERT INTO purchase_order_items
                 (purchase_order_id, product_id, quantity, unit_price, total_amount)
               VALUES ($1,$2,$3,$4,$5)`,
              [poId, line.prod.id, line.qty, line.unitPrice, line.total]
            );
            track('purchase_order_items');
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // D. CRM DATA
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('  D. Seeding CRM Data');
    console.log('═══════════════════════════════════════');

    // D1. leads (15)
    const leadStatuses = ['New','New','New','Contacted','Contacted','Qualified','Qualified','Qualified','Proposal','Proposal','Negotiation','Converted','Converted','Lost','Lost'];
    const leadSources = ['Website','Referral','Cold Call','Trade Show','Social Media','Email Campaign'];
    const territories = ['North Delhi','South Delhi','Mumbai West','Pune Central','Bangalore East','Hyderabad','Chennai North','Kolkata','Ahmedabad','Jaipur'];
    const firstNames = ['Rajesh','Priya','Amit','Sunita','Vikram','Neha','Arun','Deepa','Sanjay','Meena','Kiran','Rahul','Anjali','Mohan','Lakshmi'];
    const lastNames = ['Sharma','Patel','Gupta','Singh','Verma','Kumar','Joshi','Mehta','Nair','Rao','Iyer','Reddy','Chauhan','Bose','Pillai'];
    const companies = ['MedPlus Dist','HealthFirst Co','Apollo Rx','Sunrise Pharma','CureMax','LifeSpring','Wellness Depot','MediCare Dist','PharmaBridge','SciMed Solutions'];

    const insertedLeads = [];

    for (let li = 0; li < 15; li++) {
      const firstName = firstNames[li % firstNames.length];
      const lastName = lastNames[(li + 3) % lastNames.length];
      const status = leadStatuses[li];
      await safeRun(`Lead ${li + 1}`, async () => {
        const res = await client.query(
          `INSERT INTO leads
             (name, company_name, email, contact, location, source, status, lead_score, notes, assigned_to, company_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 1)
           RETURNING id`,
          [
            `${firstName} ${lastName}`,
            companies[li % companies.length],
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}${li}@example.com`,
            `98${rand(10000000, 99999999)}`,
            territories[li % territories.length],
            leadSources[li % leadSources.length],
            status,
            rand(20, 95),
            `Lead ${li + 1}: ${status} stage. Follow-up scheduled.`,
            userId,
          ]
        );
        insertedLeads.push(res.rows[0].id);
        track('leads');
        console.log(`  ✅ Lead ${li + 1}: ${firstName} ${lastName} [${status}]`);
      });
    }

    // D2. crm_contacts (10)
    // Note: crm_contacts table will be created via migration
    const channels = ['WHATSAPP','EMAIL','PHONE','IN_PERSON'];
    const designations = ['Pharmacist','Doctor','Hospital Admin','Purchase Manager','Medical Officer','Director','CEO','Partner'];
    const departments = ['Procurement','Medical','Operations','Sales','Management'];

    for (let ci = 0; ci < 10; ci++) {
      const firstName = firstNames[(ci + 5) % firstNames.length];
      const lastName = lastNames[(ci + 7) % lastNames.length];
      await safeRun(`CRM Contact ${ci + 1}`, async () => {
        await client.query(
          `INSERT INTO crm_contacts
             (first_name, last_name, designation, department, email, phone, whatsapp,
              preferred_channel, is_decision_maker, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            firstName, lastName,
            designations[ci % designations.length],
            departments[ci % departments.length],
            `${firstName.toLowerCase()}${ci}@medcontact.com`,
            `91${rand(10000000, 99999999)}`,
            `91${rand(10000000, 99999999)}`,
            channels[ci % channels.length],
            ci % 3 === 0,
            userId,
          ]
        );
        track('crm_contacts');
        console.log(`  ✅ Contact ${ci + 1}: ${firstName} ${lastName} [${designations[ci % designations.length]}]`);
      });
    }

    // D3. crm_opportunities (5)
    // Note: crm_opportunities table will be created via migration
    const oppStages = ['DISCOVERY','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST'];
    const oppNames = [
      'Q3 Hospital Supply Contract','Bulk Pharma Distribution Deal','Annual Drug Procurement',
      'Emergency Med Supply','Specialty Drug Partnership',
    ];
    const oppSources = ['Referral','Cold Outreach','Conference','Website','Field Visit'];

    for (let oi = 0; oi < 5; oi++) {
      await safeRun(`CRM Opportunity ${oi + 1}`, async () => {
        const value = rand(50000, 500000);
        const prob = [20,40,60,90,10][oi];
        await client.query(
          `INSERT INTO crm_opportunities
             (name, stage, value, probability, expected_close_date, source, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            oppNames[oi],
            oppStages[oi],
            value,
            prob,
            daysAgo(rand(-30, 30)),
            oppSources[oi],
            userId,
          ]
        );
        track('crm_opportunities');
        console.log(`  ✅ Opportunity ${oi + 1}: ${oppNames[oi]} [${oppStages[oi]}] ₹${value}`);
      });
    }

    // D4. lead_activities (8)
    const actTypes = ['Call','Call','Email','Email','Meeting','Meeting','Visit','Call'];
    const subjects = [
      'Initial product introduction call','Follow-up on quotation','Send product catalogue via email',
      'Q3 pricing email campaign','Quarterly business review meeting','Demo meeting at client office',
      'Field visit to pharmacy chain','Status call on pending order',
    ];
    const outcomes = ['Interested','Needs Follow-up','Proposal Requested','No Response','Meeting Scheduled','Demo Completed','Order Placed','Call Back Later'];

    for (let ai = 0; ai < 8; ai++) {
      await safeRun(`Lead Activity ${ai + 1}`, async () => {
        const leadId = pick(insertedLeads);
        const performedAt = new Date();
        performedAt.setDate(performedAt.getDate() - rand(1, 30));
        await client.query(
          `INSERT INTO lead_activities
             (lead_id, type, description, performed_by, performed_at, outcome, duration, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            leadId,
            actTypes[ai],
            subjects[ai],
            userId,
            performedAt.toISOString(),
            outcomes[ai],
            rand(10, 90),
            performedAt.toISOString()
          ]
        );
        track('lead_activities');
        console.log(`  ✅ Lead Activity ${ai + 1}: [${actTypes[ai]}] ${subjects[ai]}`);
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // E. PCD COMMISSIONS & TARGETS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('  E. Seeding PCD Commissions & Targets');
    console.log('═══════════════════════════════════════');

    if (pcdPartners.length === 0) {
      console.warn('  ⚠️  No PCD partners found – skipping');
    } else {
      // Last 3 months commissions
      const months = [
        { period: '2026-03', start: '2026-03-01', end: '2026-03-31' },
        { period: '2026-04', start: '2026-04-01', end: '2026-04-30' },
        { period: '2026-05', start: '2026-05-01', end: '2026-05-31' },
      ];

      for (const partner of pcdPartners) {
        for (const month of months) {
          await safeRun(`PCD Commission ${partner.id} ${month.period}`, async () => {
            const base = rand(5000, 25000);
            const bonus = rand(0, 3000);
            const deductions = rand(0, 500);
            const net = base + bonus - deductions;
            const payStatus = month.period === '2026-05' ? 'PENDING' : pick(['PAID','PENDING']);

            await client.query(
              `INSERT INTO pcd_commissions
                 (partner_id, period, period_start, period_end, base_commission,
                  scheme_bonus, deductions, net_commission, payment_status, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [
                partner.id, month.period, month.start, month.end,
                base, bonus, deductions, net, payStatus,
                `Auto-generated commission for ${month.period}`,
              ]
            );
            track('pcd_commissions');
            console.log(`  ✅ Commission: partner ${partner.id.slice(0,8)}… ${month.period} ₹${net} [${payStatus}]`);
          });
        }

        // Quarterly target for Q1 & Q2 2026
        const quarters = [
          { period: 'Q1-2026', start: '2026-01-01', end: '2026-03-31' },
          { period: 'Q2-2026', start: '2026-04-01', end: '2026-06-30' },
        ];
        for (const q of quarters) {
          await safeRun(`PCD Target ${partner.id} ${q.period}`, async () => {
            const target = rand(100000, 500000);
            const achieved = q.period === 'Q1-2026' ? rand(60000, 500000) : rand(0, 200000);
            const incPct = 5.00;
            const bonus = achieved >= target ? parseFloat(((achieved - target) * incPct / 100).toFixed(2)) : 0;
            const status = achieved >= target ? 'ACHIEVED' : (achieved > target * 0.7 ? 'ON_TRACK' : 'PENDING');

            await client.query(
              `INSERT INTO pcd_targets
                 (partner_id, period, period_start, period_end, target_amount,
                  achieved_amount, incentive_percentage, bonus_amount, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                partner.id, q.period, q.start, q.end,
                target, achieved, incPct, bonus, status,
              ]
            );
            track('pcd_targets');
            console.log(`  ✅ Target: partner ${partner.id.slice(0,8)}… ${q.period} ₹${target} achieved=₹${achieved} [${status}]`);
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // F. JOURNAL VOUCHERS (5 Posted)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('  F. Seeding Journal Vouchers (5)');
    console.log('═══════════════════════════════════════');

    const jvDefs = [
      {
        type: 'Sales',
        narration: 'Sales revenue recognition – Seed Batch A',
        debitAcct: debtorsAcct,
        creditAcct: salesAcct,
        amount: rand(50000, 200000),
        daysAgoVal: 45,
      },
      {
        type: 'Sales',
        narration: 'Sales revenue recognition – Seed Batch B',
        debitAcct: debtorsAcct,
        creditAcct: salesAcct,
        amount: rand(30000, 150000),
        daysAgoVal: 30,
      },
      {
        type: 'Purchase',
        narration: 'Purchase cost entry – supplier invoice batch',
        debitAcct: purchaseAcct,
        creditAcct: bankAcct || cashAcct,
        amount: rand(20000, 100000),
        daysAgoVal: 20,
      },
      {
        type: 'Receipt',
        narration: 'Receipt from distributor – partial payment',
        debitAcct: cashAcct || bankAcct,
        creditAcct: debtorsAcct,
        amount: rand(40000, 180000),
        daysAgoVal: 15,
      },
      {
        type: 'Expense',
        narration: 'PCD Commission expense – Q1 2026',
        debitAcct: pcdCommAcct || purchaseAcct,
        creditAcct: cashAcct || bankAcct,
        amount: rand(10000, 50000),
        daysAgoVal: 10,
      },
    ];

    for (let ji = 0; ji < jvDefs.length; ji++) {
      const jv = jvDefs[ji];

      if (!jv.debitAcct || !jv.creditAcct) {
        console.warn(`  ⚠️  JV ${ji + 1}: missing account – skipping`);
        continue;
      }

      const voucherNo = `JV-SEED-${Date.now()}-${ji + 1}`;
      const voucherDate = daysAgo(jv.daysAgoVal);

      let voucherId;
      await safeRun(`Journal Voucher ${ji + 1}`, async () => {
        const res = await client.query(
          `INSERT INTO journal_vouchers
             (voucher_type, voucher_no, voucher_date, narration,
              total_debit, total_credit, status, created_by, posted_by, posted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (voucher_no) DO NOTHING
           RETURNING id`,
          [
            jv.type, voucherNo, voucherDate, jv.narration,
            jv.amount, jv.amount,
            'Posted',
            userId, userId,
            new Date().toISOString(),
          ]
        );
        if (res.rows.length === 0) return;
        voucherId = res.rows[0].id;
        track('journal_vouchers');
        console.log(`  ✅ JV ${ji + 1}: ${voucherNo} [${jv.type}] ₹${jv.amount} – ${jv.narration}`);
      });

      if (!voucherId) continue;

      // Debit entry
      await safeRun(`JV ${ji + 1} debit entry`, async () => {
        await client.query(
          `INSERT INTO journal_voucher_entries
             (voucher_id, account_id, debit, credit, narration)
           VALUES ($1,$2,$3,$4,$5)`,
          [voucherId, jv.debitAcct.id, jv.amount, 0, `DR: ${jv.narration}`]
        );
        track('journal_voucher_entries');
      });

      // Credit entry
      await safeRun(`JV ${ji + 1} credit entry`, async () => {
        await client.query(
          `INSERT INTO journal_voucher_entries
             (voucher_id, account_id, debit, credit, narration)
           VALUES ($1,$2,$3,$4,$5)`,
          [voucherId, jv.creditAcct.id, 0, jv.amount, `CR: ${jv.narration}`]
        );
        track('journal_voucher_entries');
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║          SEED COMPLETE – SUMMARY REPORT          ║');
    console.log('╠══════════════════════════════════════════════════╣');
    for (const [table, cnt] of Object.entries(counts)) {
      console.log(`║  ${table.padEnd(36)} ${String(cnt).padStart(6)} rows ║`);
    }
    const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  ${'TOTAL ROWS INSERTED'.padEnd(36)} ${String(totalRows).padStart(6)} rows ║`);
    console.log('╚══════════════════════════════════════════════════╝');

    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} error(s) encountered:`);
      errors.forEach(e => console.log('  ' + e));
    } else {
      console.log('\n✅ No errors encountered. Seed ran successfully!');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

// ── Status chain builder ───────────────────────────────────────────────────────
function buildStatusChain(finalStatus) {
  const full = [
    'Pending Approval','Approved','Processing',
    'Partially Shipped','Shipped','Delivered','Invoiced',
  ];
  const cancelledChain = ['Pending Approval','Cancelled'];
  if (finalStatus === 'Cancelled') return cancelledChain;
  const idx = full.indexOf(finalStatus);
  if (idx === -1) return [finalStatus];
  return full.slice(0, idx + 1);
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
