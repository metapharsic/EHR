const db = require('./server/db');

async function checkHRTables() {
  const hrTables = [
    'employees',
    'hr_departments',
    'hr_designations',
    'hr_attendance',
    'hr_leave_requests',
    'hr_payroll',
    'hr_recruitment_leads',
    'hr_onboarding_tasks'
  ];

  console.log('--- HR Tables Check ---');
  for (const table of hrTables) {
    try {
      const res = await db.query(`SELECT count(*) FROM information_schema.tables WHERE table_name = $1`, [table]);
      const exists = parseInt(res.rows[0].count) > 0;
      if (exists) {
        const rowCount = await db.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
        console.log(`[✓] Table "${table}": ${rowCount.rows[0].cnt} rows`);
      } else {
        console.log(`[✗] Table "${table}": NOT FOUND`);
      }
    } catch (err) {
      console.log(`[!] Error checking "${table}": ${err.message}`);
    }
  }
  process.exit(0);
}

checkHRTables();
