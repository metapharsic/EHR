const db = require('./server/db');

async function checkHRTables() {
  const hrTables = [
    'employees',
    'hr_departments',
    'hr_designations',
    'hr_salary_structures',
    'hr_employee_timeline',
    'hr_employee_documents',
    'hr_job_requisitions',
    'hr_requisitions',
    'hr_candidates',
    'hr_candidate_stages',
    'hr_offer_letters',
    'hr_onboarding_checklists',
    'hr_onboarding_tasks',
    'hr_onboarding_templates',
    'hr_onboarding_template_tasks',
    'hr_employee_assets',
    'hr_policy_acknowledgments',
    'hr_policies',
    'hr_offboarding_checklists',
    'hr_attendance',
    'hr_leaves',
    'hr_leave_types',
    'hr_leave_balances',
    'hr_shifts',
    'hr_employee_shifts',
    'hr_holidays',
    'hr_timesheet_entries',
    'hr_overtime_requests',
    'hr_compensatory_off',
    'salary_slips',
    'hr_pf_registers',
    'hr_esic_registers',
    'hr_pt_registers',
    'hr_tds_workings',
    'hr_employee_bonuses',
    'hr_reimbursements',
    'hr_incidents',
    'hr_rewards',
    'hr_statutory_config'
  ];

  console.log('--- Comprehensive HR Tables Check ---');
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
