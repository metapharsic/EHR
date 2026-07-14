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
    console.log('🌱 Seeding RnD data...');
    
    // Clear existing data
    await client.query('DELETE FROM rnd_experiments');
    await client.query('DELETE FROM rnd_formulations');
    
    const formulations = [
      {
        product_name: 'MetaMol 1000',
        dosage_form: 'Tablet',
        version: '1.0',
        stage: 'Lab Scale',
        start_date: '2023-10-01',
        target_cost: 0.1250,
        ingredients: JSON.stringify([
          { materialName: 'Paracetamol', quantity: 1000, costPerUnit: 450 },
          { materialName: 'Starch', quantity: 50, costPerUnit: 80 }
        ])
      },
      {
        product_name: 'MetaClav Oral Drop',
        dosage_form: 'Syrup',
        version: '0.8',
        stage: 'Ideation',
        start_date: '2023-10-15',
        target_cost: 12.5000,
        ingredients: JSON.stringify([])
      }
    ];
    
    for (const f of formulations) {
      const res = await client.query(`
        INSERT INTO rnd_formulations (product_name, dosage_form, version, stage, start_date, target_cost, ingredients)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [f.product_name, f.dosage_form, f.version, f.stage, f.start_date, f.target_cost, f.ingredients]);
      
      const formulationId = res.rows[0].id;
      
      if (f.product_name === 'MetaMol 1000') {
        await client.query(`
          INSERT INTO rnd_experiments (formulation_id, test_name, start_date, status, assigned_to, result_data)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [formulationId, 'Dissolution Test', '2023-10-05', 'Completed', 'Dr. Smith', 'Passed (92.5%)']);
      }
    }
    
    console.log('✅ RnD data seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
