const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding compliance data...');
    
    // Clear existing data
    await client.query('DELETE FROM temperature_logs');
    await client.query('DELETE FROM h1_register');
    await client.query('DELETE FROM drug_licenses');
    
    // Seed Licenses
    await client.query(`
      INSERT INTO drug_licenses (name, license_number, expiry_date, category, status)
      VALUES 
      ('Drug License (20B)', 'MH-PUN-2023001', '2025-12-31', 'Retail', 'Valid'),
      ('Drug License (21B)', 'MH-PUN-2023002', '2025-12-31', 'Retail', 'Valid'),
      ('FSSAI License', '11522000000123', '2023-11-30', 'Food Safety', 'Expiring Soon')
    `);

    // Seed H1 Register
    await client.query(`
      INSERT INTO h1_register (entry_date, invoice_no, patient_name, doctor_name, drug_name, batch_number, quantity)
      VALUES 
      ('2023-10-26', 'INV-001', 'John Doe', 'Dr. Smith', 'MetaClav 625', 'MC-202', 10),
      ('2023-10-26', 'INV-002', 'Jane Roe', 'Dr. Adams', 'Azithral 500', 'AZ-55', 5)
    `);

    // Seed Temperature Logs
    await client.query(`
      INSERT INTO temperature_logs (log_date, log_time, temperature, checked_by, status)
      VALUES 
      ('2023-10-26', '09:00:00', 4.2, 'Priya S', 'OK'),
      ('2023-10-26', '14:00:00', 5.1, 'Rahul V', 'OK')
    `);
    
    console.log('✅ Compliance data seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
