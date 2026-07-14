
const db = require('../db');

async function fix() {
  try {
    console.log('Fixing salary_slips...');
    await db.query(`
      ALTER TABLE salary_slips 
      ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reimbursement_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS leave_encashment_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lop_days NUMERIC(4,1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lop_deduction NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS esic_employer NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS esic_employee NUMERIC(12,2) DEFAULT 0
    `);
    console.log('✓ salary_slips updated');

    console.log('Fixing hr_leaves...');
    // Ensure company_id exists in hr_leaves
    await db.query(`ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS company_id INTEGER DEFAULT 1`);
    
    console.log('✓ All fixes applied');
  } catch (e) {
    console.error('Fix failed:', e.message);
  } finally {
    process.exit();
  }
}

fix();
