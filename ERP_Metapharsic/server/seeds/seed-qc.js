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
    console.log('🌱 Seeding QC data...');
    
    // Clear existing data
    await client.query('DELETE FROM qc_parameters');
    await client.query('DELETE FROM qc_records');
    
    const records = [
      {
        batch_number: 'MC-202',
        product_name: 'MetaClav 625',
        test_date: '2023-10-20',
        final_status: 'Approved',
        coa_generated: true,
        remarks: 'Batch complies with specifications.'
      },
      {
        batch_number: 'MM-650-B1',
        product_name: 'MetaMol 650',
        test_date: '2023-10-22',
        final_status: 'Pending',
        coa_generated: false,
        remarks: 'Assay in progress.'
      }
    ];
    
    for (const r of records) {
      const res = await client.query(`
        INSERT INTO qc_records (batch_number, product_name, test_date, final_status, coa_generated, remarks)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [r.batch_number, r.product_name, r.test_date, r.final_status, r.coa_generated, r.remarks]);
      
      const recordId = res.rows[0].id;
      
      if (r.final_status === 'Approved') {
        const params = [
          { parameter: 'Assay (Amoxicillin)', standard: '90-110%', result: '98.5%', status: 'Pass' },
          { parameter: 'Assay (Clavulanic Acid)', standard: '90-110%', result: '102.1%', status: 'Pass' },
          { parameter: 'Dissolution', standard: 'Not less than 80%', result: '92.4%', status: 'Pass' }
        ];
        
        for (const p of params) {
          await client.query(`
            INSERT INTO qc_parameters (record_id, parameter, standard, result, status)
            VALUES ($1, $2, $3, $4, $5)
          `, [recordId, p.parameter, p.standard, p.result, p.status]);
        }
      }
    }
    
    console.log('✅ QC data seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
