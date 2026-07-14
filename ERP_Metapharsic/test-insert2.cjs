
const db = require('./server/db');

async function test() {
  const q = `
        INSERT INTO salary_slips (
          id, employee_id, month, year, gross_salary, net_pay, pf_employee,
          pf_employer, esic_employer, professional_tax, tds, bonus_amount, reimbursement_amount, overtime_amount,
          leave_encashment_amount, lop_days, lop_deduction, payment_status, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'Pending',NOW())
        ON CONFLICT (employee_id, month, year) DO UPDATE SET
          gross_salary=$5, net_pay=$6, pf_employee=$7, pf_employer=$8,
          esic_employer=$9, professional_tax=$10, tds=$11, bonus_amount=$12,
          reimbursement_amount=$13, overtime_amount=$14, leave_encashment_amount=$15, lop_days=$16,
          lop_deduction=$17, updated_at=NOW()
        RETURNING id
  `;
  try {
    await db.query(q, [
      'a660bda3-f632-433c-8095-4931f8516437', 'a660bda3-f632-433c-8095-4931f8516437', '6', 2026,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    console.log("Success");
  } catch(e) {
    console.log("ERROR:", e.message);
  } finally {
    process.exit(0);
  }
}
test();
