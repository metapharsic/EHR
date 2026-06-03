const db = require('./server/db');
async function run() {
  const tables = ['hr_leaves', 'hr_attendance', 'hr_candidates', 'hr_job_requisitions', 'hr_reimbursement_claims', 'hr_leave_policies'];
  for (const table of tables) {
    const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
    console.log(`Table ${table}:`, res.rows.map(r => r.column_name));
  }
  process.exit(0);
}
run();
