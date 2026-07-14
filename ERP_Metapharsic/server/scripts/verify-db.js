const db = require('../db');

async function verifyDatabase() {
  console.log('=== METAPHARSIC ERP DATABASE DIAGNOSTIC ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    // 1. Connection & Version Check
    const versionRes = await db.query('SELECT version()');
    console.log(`\n[✓] Database Connection: SUCCESS`);
    console.log(`PostgreSQL Version: ${versionRes.rows[0].version}`);

    // 2. Database Name and Current User Check
    const dbInfoRes = await db.query('SELECT current_database(), current_user');
    const { current_database, current_user } = dbInfoRes.rows[0];
    console.log(`Current Database: ${current_database}`);
    console.log(`Current User: ${current_user}`);

    // 3. Count Total Tables
    const tablesRes = await db.query(`
      SELECT count(*) as total_tables 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`Total public tables: ${tablesRes.rows[0].total_tables}`);

    // 4. Detailed Table Diagnostics
    const coreTables = [
      'users',
      'parties',
      'products',
      'batches',
      'orders',
      'order_items',
      'sales_invoices',
      'audit_logs',
      'order_returns',
      'oms_sla_rules'
    ];

    console.log('\n--- Core Tables & Row Counts ---');
    for (const table of coreTables) {
      try {
        const countRes = await db.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
        console.log(`[✓] Table "${table}": ${countRes.rows[0].cnt} rows`);
      } catch (err) {
        console.log(`[✗] Table "${table}": NOT FOUND or ERROR (${err.message})`);
      }
    }

    // 5. Active Connections
    const connRes = await db.query(`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    console.log(`\nActive DB Connections: ${connRes.rows[0].active_connections}`);

  } catch (error) {
    console.error(`\n[✗] Database Connection FAILED:`, error.message);
  } finally {
    process.exit(0);
  }
}

verifyDatabase();
