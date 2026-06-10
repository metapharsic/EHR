/**
 * Inventory & POS Data Seeder
 * Populates products, batches, and parties for testing
 */

const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const ADMIN_USER_ID = 'd26d50c6-d597-47a4-8f43-77e80954f329';

const seedInventoryData = async () => {
  try {
    console.log('🌱 Starting inventory data seed...');

    // 1. Create Parties (Suppliers & Customers)
    console.log('👥 Creating Parties (Suppliers & Customers)...');
    const partiesData = [
      { name: 'Cipla Pharmaceuticals Ltd', type: 'Creditor', gstin: '27AAAAA0000A1Z5', mobile: '9876543210', city: 'Mumbai', balance: -50000 },
      { name: 'Sun Pharma Industries', type: 'Creditor', gstin: '27BBBBB1111B1Z5', mobile: '9876543211', city: 'Gujarat', balance: -25000 },
      { name: 'Apollo Pharmacy', type: 'Debtor', gstin: '27CCCCC2222C1Z5', mobile: '9876543212', city: 'Delhi', balance: 15000 },
      { name: 'MedPlus Wellness', type: 'Debtor', gstin: '27DDDDD3333D1Z5', mobile: '9876543213', city: 'Bangalore', balance: 8000 },
      { name: 'Counter Customer', type: 'Debtor', gstin: '', mobile: '0000000000', city: 'Local', balance: 0 }
    ];

    const partyIds = {};
    for (const p of partiesData) {
      const id = uuidv4();
      partyIds[p.name] = id;
      await db.query(
        `INSERT INTO parties (id, name, type, gstin, mobile, city, current_balance, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')`,
        [id, p.name, p.type, p.gstin, p.mobile, p.city, p.balance]
      );
    }

    // 2. Create Products
    console.log('📦 Creating Products...');
    const productsData = [
      { name: 'Metapharsic Paracetamol 500mg', generic: 'Paracetamol', manufacturer: 'Metapharsic', category: 'Analgesic', packing: '10x15 Tablets', hsn: '3004', gst: 12 },
      { name: 'Amoxicillin 250mg Cap', generic: 'Amoxicillin', manufacturer: 'Cipla', category: 'Antibiotic', packing: '10x10 Capsules', hsn: '3004', gst: 12 },
      { name: 'Met-Vitamin C 500mg', generic: 'Ascorbic Acid', manufacturer: 'Metapharsic', category: 'Supplements', packing: '30 Tablets Bottle', hsn: '2106', gst: 18 },
      { name: 'Omeprazole 20mg', generic: 'Omeprazole', manufacturer: 'Sun Pharma', category: 'Antacid', packing: '10x10 Capsules', hsn: '3004', gst: 12 },
      { name: 'Azithromycin 500mg', generic: 'Azithromycin', manufacturer: 'Cipla', category: 'Antibiotic', packing: '1x3 Tablets', hsn: '3004', gst: 12 },
      { name: 'Met-Hand Sanitizer', generic: 'Isopropyl Alcohol', manufacturer: 'Metapharsic', category: 'Hygiene', packing: '500ml Bottle', hsn: '3808', gst: 18 }
    ];

    const productIds = {};
    for (const p of productsData) {
      const id = uuidv4();
      productIds[p.name] = id;
      await db.query(
        `INSERT INTO products (id, name, generic_name, manufacturer, therapeutic_category, packing, hsn, gst, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, p.name, p.generic, p.manufacturer, p.category, p.packing, p.hsn, p.gst, p.manufacturer === 'Metapharsic' ? 'OWN_MANUFACTURING' : 'TRADING']
      );
    }

    // 3. Create Batches for each product
    console.log('🔢 Creating Batches (Stock)...');
    const batchesData = [
      { product: 'Metapharsic Paracetamol 500mg', batch: 'PARA2401', expiry: '2026-12-31', stock: 500, mrp: 45.00, purchase: 22.50, selling: 40.00 },
      { product: 'Metapharsic Paracetamol 500mg', batch: 'PARA2402', expiry: '2027-06-30', stock: 1200, mrp: 45.00, purchase: 22.50, selling: 40.00 },
      { product: 'Amoxicillin 250mg Cap', batch: 'AMOX998', expiry: '2025-08-15', stock: 300, mrp: 120.00, purchase: 65.00, selling: 110.00 },
      { product: 'Met-Vitamin C 500mg', batch: 'VITC-B1', expiry: '2026-01-01', stock: 850, mrp: 180.00, purchase: 90.00, selling: 165.00 },
      { product: 'Omeprazole 20mg', batch: 'OMEP-Z7', expiry: '2025-11-20', stock: 420, mrp: 85.00, purchase: 42.00, selling: 78.00 },
      { product: 'Azithromycin 500mg', batch: 'AZI-001', expiry: '2025-10-10', stock: 150, mrp: 72.00, purchase: 35.00, selling: 65.00 },
      { product: 'Met-Hand Sanitizer', batch: 'SAN-2024', expiry: '2028-12-31', stock: 200, mrp: 250.00, purchase: 110.00, selling: 220.00 }
    ];

    for (const b of batchesData) {
      await db.query(
        `INSERT INTO batches (id, product_id, batch_number, expiry_date, stock, mrp, purchase_rate, selling_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), productIds[b.product], b.batch, b.expiry, b.stock, b.mrp, b.purchase, b.selling]
      );
    }

    console.log('');
    console.log('✅ Inventory Seeding Complete!');
    console.log('-------------------------------');
    console.log(`Parties:  ${partiesData.length}`);
    console.log(`Products: ${productsData.length}`);
    console.log(`Batches:  ${batchesData.length}`);
    console.log('-------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding inventory:', error);
    process.exit(1);
  }
};

seedInventoryData();
