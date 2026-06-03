const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function run() {
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'metapharsic_erp',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    await client.connect();
    console.log("CONNECTED TO DATABASE");

    // List all tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("\nTABLES IN DATABASE:");
    for (let row of tablesRes.rows) {
      console.log(`- ${row.table_name}`);
    }

    // List columns for specific tables of interest
    const interest = [
      'hr_onboarding_templates',
      'hr_onboarding_checklists',
      'hr_onboarding_tasks',
      'hr_asset_allocations',
      'hr_employee_assets',
      'hr_policy_acknowledgments',
      'hr_offboarding_checklists',
      'employees'
    ];

    for (let table of interest) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      if (colRes.rows.length > 0) {
        console.log(`\nCOLUMNS FOR ${table.toUpperCase()}:`);
        for (let col of colRes.rows) {
          console.log(`  ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
        }
      } else {
        console.log(`\nTABLE ${table.toUpperCase()} DOES NOT EXIST`);
      }
    }

  } catch (err) {
    console.error("Error connecting or querying database:", err);
  } finally {
    await client.end();
  }
}

run();
