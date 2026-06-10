'use strict';
/**
 * seed-master-comprehensive.js
 * Comprehensive master & transactional mock data for Metapharsic ERP
 * Run from: c:\ERP_3152026\server  =>  node seeds/seed-master-comprehensive.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  user: process.env.DB_USER || 'erp_user',
  password: process.env.DB_PASSWORD || 'Metapharsic@ERP2026!',
  port: process.env.DB_PORT || 5432,
});

// ─── Counters ───────────────────────────────────────────────────────────────
const counts = {};
const errors = [];
function inc(table, n = 1) { counts[table] = (counts[table] || 0) + n; }
function logErr(table, msg) { errors.push({ table, msg }); console.error(`  [ERROR] ${table}: ${msg}`); }

// ─── Safe query wrapper ──────────────────────────────────────────────────────
async function safeQuery(label, sql, params = []) {
  try {
    const res = await pool.query(sql, params);
    return res;
  } catch (e) {
    logErr(label, e.message);
    return null;
  }
}

// ─── 1. USERS ────────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log('\n── [1] Seeding Users ──────────────────────────────────────────');
  const HASH = '$2a$10$tBb8aAsyWlJhZy33b7VNX.XJjBKUharLh8Z8KwbWDNRhVfxzGbOCi'; // Admin@1234

  // Verify email column exists
  const colCheck = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email'`
  );
  const hasEmail = colCheck.rows.length > 0;
  console.log(`  email column exists: ${hasEmail}`);

  const users = [
    { username: 'sales_manager',       name: 'Rajesh Kumar',    role: 'SALES_MANAGER',        email: 'rajesh.kumar@metapharsic.com' },
    { username: 'inventory_mgr',       name: 'Priya Sharma',    role: 'INVENTORY_MANAGER',    email: 'priya.sharma@metapharsic.com' },
    { username: 'accountant2',         name: 'Vikram Nair',     role: 'ACCOUNTANT',           email: 'vikram.nair@metapharsic.com' },
    { username: 'hr_manager',          name: 'Anita Patel',     role: 'HR_MANAGER',           email: 'anita.patel@metapharsic.com' },
    { username: 'compliance_officer',  name: 'Suresh Iyer',     role: 'COMPLIANCE_OFFICER',   email: 'suresh.iyer@metapharsic.com' },
    { username: 'pharmacist2',         name: 'Meena Krishnan',  role: 'PHARMACIST',           email: 'meena.krishnan@metapharsic.com' },
  ];

  for (const u of users) {
    let sql, params;
    if (hasEmail) {
      sql = `INSERT INTO users (id, username, password_hash, name, role, email, created_at)
             VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW())
             ON CONFLICT (username) DO NOTHING`;
      params = [u.username, HASH, u.name, u.role, u.email];
    } else {
      sql = `INSERT INTO users (id, username, password_hash, name, role, created_at)
             VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW())
             ON CONFLICT (username) DO NOTHING`;
      params = [u.username, HASH, u.name, u.role];
    }
    const res = await safeQuery('users', sql, params);
    if (res && res.rowCount > 0) {
      inc('users');
      console.log(`  ✓ User inserted: ${u.username} (${u.role})`);
    } else if (res && res.rowCount === 0) {
      console.log(`  ~ User already exists: ${u.username}`);
    }
  }
}

// ─── 2. GODOWNS ──────────────────────────────────────────────────────────────
async function seedGodowns() {
  console.log('\n── [2] Seeding Godowns ────────────────────────────────────────');
  // godowns: id, company_id, name, address, manager_id, is_default, status, created_at, updated_at
  // No capacity/location columns — use address field; manager_id is FK to users (nullable)
  const godowns = [
    { name: 'Main Warehouse',           address: 'Pune, Maharashtra',        is_default: true },
    { name: 'Cold Storage Unit',        address: 'Pune Cold Chain Hub',       is_default: false },
    { name: 'Mumbai Distribution Hub', address: 'Andheri East, Mumbai',      is_default: false },
  ];

  for (const g of godowns) {
    const exists = await pool.query(`SELECT id FROM godowns WHERE name=$1`, [g.name]);
    if (exists.rows.length > 0) {
      console.log(`  ~ Godown already exists: ${g.name}`);
      continue;
    }
    const sql = `INSERT INTO godowns (id, company_id, name, address, is_default, status, created_at)
                 VALUES (uuid_generate_v4(), 1, $1, $2, $3, 'active', NOW())`;
    const res = await safeQuery('godowns', sql, [g.name, g.address, g.is_default]);
    if (res && res.rowCount > 0) {
      inc('godowns');
      console.log(`  ✓ Godown inserted: ${g.name}`);
    }
  }
}

// ─── 3. PRODUCTS ─────────────────────────────────────────────────────────────
async function seedProducts() {
  console.log('\n── [3] Seeding Products ───────────────────────────────────────');

  const products = [
    { name: 'Amoxicillin 500mg',     generic: 'Amoxicillin',                  mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Antibiotics',      packing: '10 Caps',    uom: 'Strip', hsn: '30049099', gst: 12, min: 100, reorder: 200, rack: 'A1', sched: 'H',   code: 'PROD-001' },
    { name: 'Ciprofloxacin 500mg',   generic: 'Ciprofloxacin',                mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Antibiotics',      packing: '10 Tabs',    uom: 'Strip', hsn: '30049099', gst: 12, min: 100, reorder: 200, rack: 'A2', sched: 'H',   code: 'PROD-002' },
    { name: 'Metformin 500mg',       generic: 'Metformin HCl',                mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Antidiabetic',     packing: '10 Tabs',    uom: 'Strip', hsn: '30043200', gst:  5, min: 200, reorder: 400, rack: 'B1', sched: 'OTC', code: 'PROD-003' },
    { name: 'Atorvastatin 10mg',     generic: 'Atorvastatin',                 mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Cardiovascular',   packing: '10 Tabs',    uom: 'Strip', hsn: '30043200', gst: 12, min: 150, reorder: 300, rack: 'B2', sched: 'H',   code: 'PROD-004' },
    { name: 'Omeprazole 20mg',       generic: 'Omeprazole',                   mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Gastrointestinal', packing: '10 Caps',    uom: 'Strip', hsn: '30045000', gst:  5, min: 200, reorder: 400, rack: 'C1', sched: 'OTC', code: 'PROD-005' },
    { name: 'Azithromycin 500mg',    generic: 'Azithromycin',                 mfr: 'Zydus Healthcare',         source: 'TRADING',           cat: 'Antibiotics',      packing: '3 Tabs',     uom: 'Strip', hsn: '30049099', gst: 12, min:  50, reorder: 100, rack: 'A3', sched: 'H',   code: 'PROD-006' },
    { name: 'Pantoprazole 40mg',     generic: 'Pantoprazole',                 mfr: 'Sun Pharma',               source: 'TRADING',           cat: 'Gastrointestinal', packing: '10 Tabs',    uom: 'Strip', hsn: '30045000', gst: 12, min: 100, reorder: 200, rack: 'C2', sched: 'OTC', code: 'PROD-007' },
    { name: 'Amlodipine 5mg',        generic: 'Amlodipine Besylate',          mfr: 'Cipla',                    source: 'TRADING',           cat: 'Cardiovascular',   packing: '10 Tabs',    uom: 'Strip', hsn: '30043200', gst: 12, min: 150, reorder: 300, rack: 'B3', sched: 'H',   code: 'PROD-008' },
    { name: 'Vitamin D3 60000IU',    generic: 'Cholecalciferol',              mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Vitamins',         packing: '4 Caps',     uom: 'Strip', hsn: '29362990', gst:  5, min: 100, reorder: 200, rack: 'D1', sched: 'OTC', code: 'PROD-009' },
    { name: 'Metronidazole 400mg',   generic: 'Metronidazole',                mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Antibiotics',      packing: '10 Tabs',    uom: 'Strip', hsn: '30049099', gst: 12, min: 100, reorder: 200, rack: 'A4', sched: 'H',   code: 'PROD-010' },
    { name: 'Insulin Glargine 100IU',generic: 'Insulin Glargine',             mfr: 'Biocon',                   source: 'TRADING',           cat: 'Antidiabetic',     packing: '3ml Vial',   uom: 'Vial',  hsn: '30043100', gst: 12, min:  20, reorder:  50, rack: 'E1', sched: 'H',   code: 'PROD-011' },
    { name: 'Cetirizine 10mg',       generic: 'Cetirizine HCl',               mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Antihistamine',    packing: '10 Tabs',    uom: 'Strip', hsn: '30045000', gst:  5, min: 200, reorder: 400, rack: 'F1', sched: 'OTC', code: 'PROD-012' },
    { name: 'Ibuprofen 400mg',       generic: 'Ibuprofen',                    mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'NSAID',            packing: '10 Tabs',    uom: 'Strip', hsn: '30049099', gst: 12, min: 200, reorder: 400, rack: 'F2', sched: 'OTC', code: 'PROD-013' },
    { name: 'Salbutamol Inhaler',    generic: 'Salbutamol Sulfate',           mfr: 'GlaxoSmithKline',          source: 'TRADING',           cat: 'Respiratory',      packing: '200 Doses',  uom: 'Unit',  hsn: '30049099', gst: 12, min:  30, reorder:  60, rack: 'G1', sched: 'H',   code: 'PROD-014' },
    { name: 'Losartan 50mg',         generic: 'Losartan Potassium',           mfr: 'Dr Reddys',                source: 'TRADING',           cat: 'Cardiovascular',   packing: '10 Tabs',    uom: 'Strip', hsn: '30043200', gst: 12, min: 100, reorder: 200, rack: 'B4', sched: 'H',   code: 'PROD-015' },
    { name: 'Clopidogrel 75mg',      generic: 'Clopidogrel Bisulfate',        mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Cardiovascular',   packing: '10 Tabs',    uom: 'Strip', hsn: '30043200', gst: 12, min: 100, reorder: 200, rack: 'B5', sched: 'H',   code: 'PROD-016' },
    { name: 'Folic Acid 5mg',        generic: 'Folic Acid',                   mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Vitamins',         packing: '30 Tabs',    uom: 'Strip', hsn: '29362990', gst:  5, min: 300, reorder: 600, rack: 'D2', sched: 'OTC', code: 'PROD-017' },
    { name: 'Ondansetron 4mg',       generic: 'Ondansetron HCl',              mfr: 'Cipla',                    source: 'TRADING',           cat: 'Antiemetic',       packing: '10 Tabs',    uom: 'Strip', hsn: '30045000', gst: 12, min: 100, reorder: 200, rack: 'H1', sched: 'H',   code: 'PROD-018' },
    { name: 'Montelukast 10mg',      generic: 'Montelukast Sodium',           mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Respiratory',      packing: '10 Tabs',    uom: 'Strip', hsn: '30049099', gst: 12, min: 100, reorder: 200, rack: 'G2', sched: 'H',   code: 'PROD-019' },
    { name: 'Calcium + Vit D3',      generic: 'Calcium Carbonate + Vit D3',  mfr: 'Metapharsic Lifesciences', source: 'OWN_MANUFACTURING', cat: 'Vitamins',         packing: '15 Tabs',    uom: 'Strip', hsn: '29362990', gst:  5, min: 300, reorder: 600, rack: 'D3', sched: 'OTC', code: 'PROD-020' },
  ];

  const productIds = {};

  for (const p of products) {
    // Check if exists
    const exists = await pool.query(`SELECT id FROM products WHERE name=$1 AND manufacturer=$2`, [p.name, p.mfr]);
    if (exists.rows.length > 0) {
      console.log(`  ~ Product already exists: ${p.name}`);
      productIds[p.name] = exists.rows[0].id;
      continue;
    }
    // Generate a unique code
    const codeCheck = await pool.query(`SELECT id FROM products WHERE code=$1`, [p.code]);
    const finalCode = codeCheck.rows.length > 0 ? `${p.code}-${Date.now()}` : p.code;

    const sql = `INSERT INTO products
      (id, code, name, generic_name, manufacturer, source, therapeutic_category,
       packing, uom, hsn, gst, min_stock_level, reorder_level, rack, schedule_type,
       is_active, maintain_batches, track_expiry, enable_batch_tracking,
       current_stock, opening_stock, company_id, created_at, updated_at)
      VALUES
      (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14,
       true, true, true, true, 0, 0, 1, NOW(), NOW())
      RETURNING id`;
    const res = await safeQuery('products', sql, [
      finalCode, p.name, p.generic, p.mfr, p.source, p.cat,
      p.packing, p.uom, p.hsn, p.gst,
      p.min, p.reorder, p.rack, p.sched,
    ]);
    if (res && res.rows.length > 0) {
      inc('products');
      productIds[p.name] = res.rows[0].id;
      console.log(`  ✓ Product inserted: ${p.name} [id: ${res.rows[0].id}]`);
    }
  }
  return productIds;
}

// ─── 4. BATCHES ──────────────────────────────────────────────────────────────
async function seedBatches(productIds) {
  console.log('\n── [4] Seeding Batches ────────────────────────────────────────');

  // Get godown IDs
  const gRes = await pool.query(`SELECT id, name FROM godowns ORDER BY created_at`);
  const mainGodownId = gRes.rows.find(g => g.name === 'Main Warehouse')?.id || gRes.rows[0]?.id;
  const coldGodownId = gRes.rows.find(g => g.name === 'Cold Storage Unit')?.id || gRes.rows[0]?.id;

  console.log(`  Main Warehouse ID: ${mainGodownId}`);
  console.log(`  Cold Storage Unit ID: ${coldGodownId}`);

  const batches = [
    { suffix: '2024A', expiry: '2026-03-31', mfg: '2024-03-01', stock: 500, mrp: 120, purchase: 70, selling: 100, godown: mainGodownId, location: 'Main Warehouse' },
    { suffix: '2025A', expiry: '2027-06-30', mfg: '2025-06-01', stock: 800, mrp: 125, purchase: 72, selling: 104, godown: mainGodownId, location: 'Main Warehouse' },
    { suffix: '2023X', expiry: '2026-07-31', mfg: '2023-07-01', stock: 100, mrp: 110, purchase: 65, selling: 90,  godown: coldGodownId, location: 'Cold Storage Unit' },
  ];

  const PROD_SHORT = {
    'Amoxicillin 500mg': 'AMOX', 'Ciprofloxacin 500mg': 'CIPRO', 'Metformin 500mg': 'METF',
    'Atorvastatin 10mg': 'ATOR', 'Omeprazole 20mg': 'OMEP', 'Azithromycin 500mg': 'AZITH',
    'Pantoprazole 40mg': 'PANTO', 'Amlodipine 5mg': 'AMLO', 'Vitamin D3 60000IU': 'VITD3',
    'Metronidazole 400mg': 'METRO', 'Insulin Glargine 100IU': 'INGLA', 'Cetirizine 10mg': 'CETI',
    'Ibuprofen 400mg': 'IBU', 'Salbutamol Inhaler': 'SALB', 'Losartan 50mg': 'LOSAR',
    'Clopidogrel 75mg': 'CLOP', 'Folic Acid 5mg': 'FOLIC', 'Ondansetron 4mg': 'ONDA',
    'Montelukast 10mg': 'MONT', 'Calcium + Vit D3': 'CALVD',
  };

  for (const [productName, productId] of Object.entries(productIds)) {
    const short = PROD_SHORT[productName] || productName.substring(0, 5).toUpperCase().replace(/\s/g,'');
    for (const b of batches) {
      const batchNumber = `BT-${short}-${b.suffix}`;
      const sql = `INSERT INTO batches
        (id, product_id, batch_number, expiry_date, manufacturing_date,
         stock, mrp, purchase_rate, selling_rate, location, godown_id,
         status, created_at)
        VALUES
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         'ACTIVE', NOW())
        ON CONFLICT (product_id, batch_number) DO NOTHING`;
      const res = await safeQuery('batches', sql, [
        productId, batchNumber, b.expiry, b.mfg, b.stock,
        b.mrp, b.purchase, b.selling, b.location, b.godown,
      ]);
      if (res && res.rowCount > 0) {
        inc('batches');
        console.log(`  ✓ Batch: ${batchNumber} → ${productName}`);
      } else if (res && res.rowCount === 0) {
        console.log(`  ~ Batch already exists: ${batchNumber}`);
      }
    }
  }
}

// ─── 5. PARTIES ──────────────────────────────────────────────────────────────
async function seedParties() {
  console.log('\n── [5] Seeding Parties ────────────────────────────────────────');

  const debtors = [
    { name: 'MedPlus Health Services',      type: 'Debtor', gstin: '27AAACM9685R1ZE', mobile: '9876543210', email: 'medplus@example.com',     city: 'Pune',       state: 'Maharashtra', credit_limit: 1500000, current_balance: 250000 },
    { name: 'Apollo Pharmacy Chain',         type: 'Debtor', gstin: '29AAACP1234A1ZB', mobile: '9988776655', email: 'apollo@example.com',       city: 'Bengaluru',  state: 'Karnataka',   credit_limit: 2000000, current_balance: 180000 },
    { name: 'Sahyadri Hospital Pharmacy',    type: 'Debtor', gstin: '27AABCS5678B1ZC', mobile: '9911223344', email: 'sahyadri@example.com',     city: 'Pune',       state: 'Maharashtra', credit_limit: 800000,  current_balance: 95000  },
    { name: 'Nagpur District Distributors',  type: 'Debtor', gstin: '27AABCN1111C1ZD', mobile: '9922334455', email: 'nagpur@example.com',       city: 'Nagpur',     state: 'Maharashtra', credit_limit: 600000,  current_balance: 45000  },
    { name: 'Sunrise Medical Stores',        type: 'Debtor', gstin: '24AABCS2222D1ZE', mobile: '9933445566', email: 'sunrise@example.com',      city: 'Surat',      state: 'Gujarat',     credit_limit: 500000,  current_balance: 30000  },
    { name: 'HealthFirst Distributors',      type: 'Debtor', gstin: '07AABCH3333E1ZF', mobile: '9944556677', email: 'healthfirst@example.com',  city: 'Delhi',      state: 'Delhi',       credit_limit: 1200000, current_balance: 88000  },
    { name: 'Pharma World Mumbai',           type: 'Debtor', gstin: '27AABCP4444F1ZG', mobile: '9955667788', email: 'pharmaworld@example.com',  city: 'Mumbai',     state: 'Maharashtra', credit_limit: 1000000, current_balance: 120000 },
    { name: 'Lifeline Medical Hub',          type: 'Debtor', gstin: '29AABCL5555G1ZH', mobile: '9966778899', email: 'lifeline@example.com',     city: 'Mysuru',     state: 'Karnataka',   credit_limit: 750000,  current_balance: 60000  },
    { name: 'CureAll Pharmacy Network',      type: 'Debtor', gstin: '27AABCC6666H1ZI', mobile: '9977889900', email: 'cureall@example.com',      city: 'Nashik',     state: 'Maharashtra', credit_limit: 400000,  current_balance: 22000  },
    { name: 'Deccan Drug House',             type: 'Debtor', gstin: '27AABCD7777I1ZJ', mobile: '9988990011', email: 'deccan@example.com',       city: 'Hyderabad',  state: 'Telangana',   credit_limit: 900000,  current_balance: 75000  },
  ];

  const creditors = [
    { name: 'Sun Pharma Laboratories', type: 'Creditor', gstin: '24AAACS1234A1ZA', mobile: '9811234567', email: 'sunpharma@example.com', city: 'Mumbai',    state: 'Maharashtra', credit_limit: 5000000, current_balance: 0 },
    { name: 'Dr Reddys API Division',   type: 'Creditor', gstin: '36AAACD2345B1ZB', mobile: '9822345678', email: 'drreddys@example.com',  city: 'Hyderabad', state: 'Telangana',   credit_limit: 3000000, current_balance: 0 },
    { name: 'Cipla Raw Materials',      type: 'Creditor', gstin: '27AAACC3456C1ZC', mobile: '9833456789', email: 'cipla@example.com',     city: 'Mumbai',    state: 'Maharashtra', credit_limit: 4000000, current_balance: 0 },
    { name: 'Zydus Healthcare Supply',  type: 'Creditor', gstin: '24AAACZ4567D1ZD', mobile: '9844567890', email: 'zydus@example.com',     city: 'Ahmedabad', state: 'Gujarat',     credit_limit: 2500000, current_balance: 0 },
    { name: 'Biocon API Sources',       type: 'Creditor', gstin: '29AAACB5678E1ZE', mobile: '9855678901', email: 'biocon@example.com',    city: 'Bengaluru', state: 'Karnataka',   credit_limit: 2000000, current_balance: 0 },
  ];

  const all = [...debtors, ...creditors];

  for (const p of all) {
    const exists = await pool.query(`SELECT id FROM parties WHERE name=$1 AND type=$2`, [p.name, p.type]);
    if (exists.rows.length > 0) {
      console.log(`  ~ Party already exists: ${p.name} (${p.type})`);
      continue;
    }
    const sql = `INSERT INTO parties
      (id, name, type, gstin, mobile, email, city, state, credit_limit, current_balance, status, company_id, created_at)
      VALUES
      (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', 1, NOW())`;
    const res = await safeQuery('parties', sql, [
      p.name, p.type, p.gstin, p.mobile, p.email,
      p.city, p.state, p.credit_limit, p.current_balance,
    ]);
    if (res && res.rowCount > 0) {
      inc('parties');
      console.log(`  ✓ Party inserted: ${p.name} (${p.type})`);
    }
  }
}

// ─── 6. COST CENTERS ─────────────────────────────────────────────────────────
async function seedCostCenters() {
  console.log('\n── [6] Seeding Cost Centers ───────────────────────────────────');
  // cost_centers: id, company_id, name, type, manager_id, created_by, created_at
  const centers = [
    { name: 'Sales & Marketing',        type: 'Department' },
    { name: 'Manufacturing Operations', type: 'Department' },
    { name: 'Finance & Accounting',     type: 'Department' },
    { name: 'Human Resources',          type: 'Department' },
    { name: 'Research & Development',   type: 'Project'    },
    { name: 'North India Region',       type: 'Region'     },
    { name: 'South India Region',       type: 'Region'     },
    { name: 'West India Region',        type: 'Region'     },
  ];

  for (const c of centers) {
    const exists = await pool.query(`SELECT id FROM cost_centers WHERE name=$1 AND company_id=1`, [c.name]);
    if (exists.rows.length > 0) {
      console.log(`  ~ Cost center already exists: ${c.name}`);
      continue;
    }
    const sql = `INSERT INTO cost_centers (id, company_id, name, type, created_at)
                 VALUES (uuid_generate_v4(), 1, $1, $2, NOW())`;
    const res = await safeQuery('cost_centers', sql, [c.name, c.type]);
    if (res && res.rowCount > 0) {
      inc('cost_centers');
      console.log(`  ✓ Cost center: ${c.name} (${c.type})`);
    }
  }
}

// ─── 7. EMPLOYEES ────────────────────────────────────────────────────────────
async function seedEmployees() {
  console.log('\n── [7] Seeding Employees ──────────────────────────────────────');
  // employees: id, company_id, name, contact, email, headquarters, assigned_area, sales_target, total_sales, target_achievement, base_salary, incentives, deductions, status, join_date, created_by, created_at, updated_at

  const employees = [
    { name: 'Rajesh Kumar',     contact: '9876543210', email: 'rajesh.kumar@metapharsic.com',    hq: 'Pune',       area: 'West Maharashtra', target: 2000000, sales: 1850000, salary: 75000,  inc: 18500, ded: 7500,  join: '2021-04-01' },
    { name: 'Priya Sharma',     contact: '9876543211', email: 'priya.sharma@metapharsic.com',    hq: 'Pune',       area: 'Pune City',         target: 1500000, sales: 1620000, salary: 65000,  inc: 16200, ded: 6500,  join: '2020-07-15' },
    { name: 'Vikram Nair',      contact: '9876543212', email: 'vikram.nair@metapharsic.com',     hq: 'Mumbai',     area: 'Mumbai Metro',      target: 2500000, sales: 2300000, salary: 80000,  inc: 23000, ded: 8000,  join: '2019-10-01' },
    { name: 'Anita Patel',      contact: '9876543213', email: 'anita.patel@metapharsic.com',     hq: 'Ahmedabad',  area: 'Gujarat',           target: 1800000, sales: 1750000, salary: 70000,  inc: 17500, ded: 7000,  join: '2022-01-10' },
    { name: 'Suresh Iyer',      contact: '9876543214', email: 'suresh.iyer@metapharsic.com',     hq: 'Chennai',    area: 'Tamil Nadu',        target: 2200000, sales: 2100000, salary: 78000,  inc: 21000, ded: 7800,  join: '2020-03-01' },
    { name: 'Meena Krishnan',   contact: '9876543215', email: 'meena.krishnan@metapharsic.com',  hq: 'Bengaluru',  area: 'Karnataka',         target: 1600000, sales: 1580000, salary: 68000,  inc: 15800, ded: 6800,  join: '2021-08-20' },
    { name: 'Arjun Desai',      contact: '9876543216', email: 'arjun.desai@metapharsic.com',     hq: 'Pune',       area: 'Konkan Region',     target: 1200000, sales: 1150000, salary: 60000,  inc: 11500, ded: 6000,  join: '2023-02-01' },
    { name: 'Kavita Mehta',     contact: '9876543217', email: 'kavita.mehta@metapharsic.com',    hq: 'Delhi',      area: 'North India',       target: 3000000, sales: 2800000, salary: 90000,  inc: 28000, ded: 9000,  join: '2018-06-15' },
    { name: 'Ravi Shankar',     contact: '9876543218', email: 'ravi.shankar@metapharsic.com',    hq: 'Hyderabad',  area: 'Telangana & AP',    target: 2000000, sales: 1950000, salary: 72000,  inc: 19500, ded: 7200,  join: '2022-09-01' },
    { name: 'Deepa Nambiar',    contact: '9876543219', email: 'deepa.nambiar@metapharsic.com',   hq: 'Kochi',      area: 'Kerala',            target: 1400000, sales: 1380000, salary: 62000,  inc: 13800, ded: 6200,  join: '2023-06-01' },
  ];

  for (const e of employees) {
    const exists = await pool.query(`SELECT id FROM employees WHERE name=$1 AND company_id=1`, [e.name]);
    if (exists.rows.length > 0) {
      console.log(`  ~ Employee already exists: ${e.name}`);
      continue;
    }
    const achievement = e.target > 0 ? ((e.sales / e.target) * 100).toFixed(2) : 0;
    const sql = `INSERT INTO employees
      (id, company_id, name, contact, email, headquarters, assigned_area,
       sales_target, total_sales, target_achievement, base_salary, incentives,
       deductions, status, join_date, created_at, updated_at)
      VALUES
      (uuid_generate_v4(), 1, $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11,
       'active', $12, NOW(), NOW())`;
    const res = await safeQuery('employees', sql, [
      e.name, e.contact, e.email, e.hq, e.area,
      e.target, e.sales, achievement, e.salary, e.inc, e.ded,
      e.join,
    ]);
    if (res && res.rowCount > 0) {
      inc('employees');
      console.log(`  ✓ Employee inserted: ${e.name} (${e.area})`);
    }
  }
}

// ─── 8. CHART OF ACCOUNTS ────────────────────────────────────────────────────
async function seedChartOfAccounts() {
  console.log('\n── [8] Seeding Chart of Accounts ─────────────────────────────');

  const countRes = await pool.query(`SELECT COUNT(*) FROM chart_of_accounts`);
  const currentCount = parseInt(countRes.rows[0].count, 10);
  console.log(`  Current COA count: ${currentCount}`);

  const accounts = [
    // Revenue
    { code: 'REV-001', name: 'Sales Revenue',         type: 'Revenue',   group: 'Direct Income',    desc: 'Revenue from product sales',          ob: 0 },
    { code: 'REV-002', name: 'Service Revenue',        type: 'Revenue',   group: 'Indirect Income',  desc: 'Revenue from services rendered',       ob: 0 },
    // Expenses
    { code: 'EXP-001', name: 'Cost of Goods Sold',     type: 'Expense',   group: 'Direct Expense',   desc: 'Direct cost of products sold',         ob: 0 },
    { code: 'EXP-002', name: 'Salaries & Wages',       type: 'Expense',   group: 'Indirect Expense', desc: 'Employee salaries and wages',           ob: 0 },
    { code: 'EXP-003', name: 'Rent Expense',            type: 'Expense',   group: 'Indirect Expense', desc: 'Office and warehouse rent',             ob: 0 },
    { code: 'EXP-004', name: 'Utilities Expense',       type: 'Expense',   group: 'Indirect Expense', desc: 'Electricity, water, gas',               ob: 0 },
    { code: 'EXP-005', name: 'Advertising & Marketing', type: 'Expense',   group: 'Indirect Expense', desc: 'Marketing and promotional expenses',   ob: 0 },
    { code: 'EXP-006', name: 'R&D Expense',             type: 'Expense',   group: 'Indirect Expense', desc: 'Research and development costs',        ob: 0 },
    // Assets
    { code: 'AST-001', name: 'Accounts Receivable',    type: 'Asset',     group: 'Current Assets',   desc: 'Money owed by customers',              ob: 985000 },
    { code: 'AST-002', name: 'Inventory',               type: 'Asset',     group: 'Current Assets',   desc: 'Stock of pharmaceutical products',     ob: 4500000 },
    { code: 'AST-003', name: 'Fixed Assets',            type: 'Asset',     group: 'Fixed Assets',     desc: 'Machinery, equipment and furniture',   ob: 2000000 },
    { code: 'AST-004', name: 'Cash in Hand',            type: 'Asset',     group: 'Current Assets',   desc: 'Cash available in hand',               ob: 150000,  isBankCash: true },
    { code: 'AST-005', name: 'Bank Account - HDFC',     type: 'Asset',     group: 'Current Assets',   desc: 'HDFC Bank current account',            ob: 3200000, isBankCash: true },
    // Liabilities
    { code: 'LIB-001', name: 'Accounts Payable',        type: 'Liability', group: 'Current Liabilities', desc: 'Money owed to suppliers',           ob: 750000 },
    { code: 'LIB-002', name: 'GST Payable',             type: 'Liability', group: 'Current Liabilities', desc: 'GST liability to be remitted',      ob: 125000, gst: true },
    { code: 'LIB-003', name: 'TDS Payable',             type: 'Liability', group: 'Current Liabilities', desc: 'TDS liability to be remitted',      ob: 45000,  tds: true },
    { code: 'LIB-004', name: 'Term Loan - SBI',         type: 'Liability', group: 'Long Term Liabilities', desc: 'SBI term loan for expansion',    ob: 5000000 },
  ];

  for (const a of accounts) {
    const sql = `INSERT INTO chart_of_accounts
      (id, company_id, account_code, account_name, account_type, account_group,
       opening_balance, current_balance, description, status,
       gst_applicable, tds_applicable, is_bank_or_cash, created_at, updated_at)
      VALUES
      (uuid_generate_v4(), 1, $1, $2, $3, $4, $5, $5, $6, 'active', $7, $8, $9, NOW(), NOW())
      ON CONFLICT (account_code) DO NOTHING`;
    const res = await safeQuery('chart_of_accounts', sql, [
      a.code, a.name, a.type, a.group, a.ob, a.desc,
      a.gst || false, a.tds || false, a.isBankCash || false,
    ]);
    if (res && res.rowCount > 0) {
      inc('chart_of_accounts');
      console.log(`  ✓ COA: ${a.code} - ${a.name} (${a.type})`);
    } else if (res && res.rowCount === 0) {
      console.log(`  ~ COA already exists: ${a.code} - ${a.name}`);
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Metapharsic ERP — Comprehensive Master Data Seed        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    await seedUsers();
    await seedGodowns();
    const productIds = await seedProducts();
    await seedBatches(productIds);
    await seedParties();
    await seedCostCenters();
    await seedEmployees();
    await seedChartOfAccounts();
  } catch (e) {
    console.error('\nFATAL ERROR:', e.message);
    errors.push({ table: 'MAIN', msg: e.message });
  } finally {
    await pool.end();
  }

  // ─── Final Report ──────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    SEED COMPLETION REPORT                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\nRecords Inserted:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(25)} : ${count}`);
  }
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.log(`  [${e.table}] ${e.msg}`));
  } else {
    console.log('\n✅ No errors encountered.');
  }
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

main();
