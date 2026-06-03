/**
 * HRMS Unit Tests — Payroll Engine Pure Functions
 * Tests all statutory calculations: TDS, PF, ESIC, PT, LOP, OT, Gratuity
 * Run: npx vitest run src/services/__tests__/hrPayrollEngine.test.ts
 */

import { describe, it, expect } from 'vitest';

// Import from the server utility — we resolve via the relative path
// Note: vitest runs in Node context so we can require CommonJS modules
const engine = await import('../../../server/utils/hrPayrollEngine.js') as any;

const {
  computeSalaryBreakdown,
  computeLOP,
  computeOvertimePay,
  computeLeaveEncashment,
  computePF,
  computeESIC,
  computePT,
  computeTDSNewRegime,
  computeTDSOldRegime,
  computeGratuityProvision,
  computeFullPayslip,
  detectPayrollAnomalies,
} = engine;

// ============================================================
// 1. SALARY BREAKDOWN
// ============================================================

describe('computeSalaryBreakdown', () => {
  it('correctly splits a ₹6,00,000 CTC', () => {
    const result = computeSalaryBreakdown(600000, { basic_pct: 50, hra_pct: 20, da_pct: 10, special_allowance: 0 });
    expect(result.gross).toBe(50000);           // 600000 / 12
    expect(result.basic).toBe(25000);           // 50% of gross
    expect(result.hra).toBe(5000);              // 20% of basic
    expect(result.da).toBe(2500);               // 10% of basic
  });

  it('returns zero components for zero CTC', () => {
    const result = computeSalaryBreakdown(0, {});
    expect(result.gross).toBe(0);
    expect(result.basic).toBe(0);
  });

  it('uses defaults when structure not provided', () => {
    const result = computeSalaryBreakdown(360000, {});
    expect(result.gross).toBe(30000);
    expect(result.basic).toBe(15000);  // 50% default
  });
});

// ============================================================
// 2. LOP DEDUCTION
// ============================================================

describe('computeLOP', () => {
  it('computes LOP for 2 absent days out of 22 working days', () => {
    const { lopDays, lopDeduction } = computeLOP(22000, 22, 20, 0);
    expect(lopDays).toBe(2);
    expect(lopDeduction).toBeCloseTo(2000, 0);   // 22000/22 × 2
  });

  it('no LOP when all days present', () => {
    const { lopDays, lopDeduction } = computeLOP(25000, 26, 26, 0);
    expect(lopDays).toBe(0);
    expect(lopDeduction).toBe(0);
  });

  it('approved leave days reduce LOP', () => {
    const { lopDays } = computeLOP(26000, 26, 23, 2);
    // present=23, leave=2 → lop = 26 - 23 - 2 = 1
    expect(lopDays).toBe(1);
  });

  it('never returns negative LOP', () => {
    const { lopDays } = computeLOP(20000, 22, 25, 0);
    expect(lopDays).toBe(0);
  });
});

// ============================================================
// 3. OVERTIME PAY
// ============================================================

describe('computeOvertimePay', () => {
  it('computes OT at 2× hourly rate', () => {
    // basic=15000, hourly=15000/208=72.12, OT 10hrs=1442.31
    const ot = computeOvertimePay(15000, 10);
    expect(ot).toBeCloseTo(1442.31, 0);
  });

  it('returns 0 for 0 overtime hours', () => {
    expect(computeOvertimePay(20000, 0)).toBe(0);
  });
});

// ============================================================
// 4. LEAVE ENCASHMENT
// ============================================================

describe('computeLeaveEncashment', () => {
  it('encashment = basic/30 × days', () => {
    const amt = computeLeaveEncashment(30000, 5);
    expect(amt).toBeCloseTo(5000, 0);
  });

  it('returns 0 for 0 days', () => {
    expect(computeLeaveEncashment(25000, 0)).toBe(0);
  });
});

// ============================================================
// 5. PF CALCULATIONS
// ============================================================

describe('computePF', () => {
  const pfConfig = { wage_ceiling: 15000, ee_rate: 12, er_epf_rate: 3.67, er_eps_rate: 8.33, edli_rate: 0.5 };

  it('caps PF at wage ceiling (₹15,000)', () => {
    const result = computePF(25000, pfConfig);
    expect(result.wages).toBe(15000);
    expect(result.eeContribution).toBe(1800);     // 12% of 15000
  });

  it('EE + ER contributions for salary below ceiling', () => {
    const result = computePF(12000, pfConfig);
    expect(result.wages).toBe(12000);
    expect(result.eeContribution).toBe(1440);     // 12% of 12000
    expect(result.erEpfContribution).toBeCloseTo(440.4, 0);
    expect(result.erEpsContribution).toBeCloseTo(999.6, 0);
  });

  it('total employer = EPF + EPS + EDLI', () => {
    const result = computePF(15000, pfConfig);
    const expected = result.erEpfContribution + result.erEpsContribution + result.edliContribution;
    expect(result.totalEmployer).toBeCloseTo(expected, 2);
  });

  it('works with default config', () => {
    const result = computePF(10000, {});
    expect(result.eeContribution).toBe(1200);
  });
});

// ============================================================
// 6. ESIC
// ============================================================

describe('computeESIC', () => {
  const esicConfig = { gross_ceiling: 21000, ee_rate: 0.75, er_rate: 3.25 };

  it('applies ESIC for salary ≤ ₹21,000', () => {
    const result = computeESIC(20000, esicConfig);
    expect(result.applicable).toBe(true);
    expect(result.eeContribution).toBe(150);      // 0.75% of 20000
    expect(result.erContribution).toBe(650);      // 3.25% of 20000
  });

  it('no ESIC for salary > ₹21,000', () => {
    const result = computeESIC(22000, esicConfig);
    expect(result.applicable).toBe(false);
    expect(result.eeContribution).toBe(0);
    expect(result.erContribution).toBe(0);
  });

  it('exactly at ceiling (₹21,000) — ESIC applicable', () => {
    const result = computeESIC(21000, esicConfig);
    expect(result.applicable).toBe(true);
  });
});

// ============================================================
// 7. PROFESSIONAL TAX
// ============================================================

describe('computePT', () => {
  const maharashtraSlabs = [
    { min: 0, max: 7500, pt: 0 },
    { min: 7501, max: 10000, pt: 175 },
    { min: 10001, max: null, pt: 200 },
  ];

  it('PT = 0 for salary ≤ ₹7,500', () => {
    expect(computePT(5000, maharashtraSlabs)).toBe(0);
  });

  it('PT = ₹175 for salary ₹7,501–₹10,000', () => {
    expect(computePT(9000, maharashtraSlabs)).toBe(175);
  });

  it('PT = ₹200 for salary > ₹10,000', () => {
    expect(computePT(25000, maharashtraSlabs)).toBe(200);
  });

  it('returns 0 for empty slabs', () => {
    expect(computePT(15000, [])).toBe(0);
  });
});

// ============================================================
// 8. TDS — NEW REGIME
// ============================================================

describe('computeTDSNewRegime', () => {
  const tdsConfig = {
    standard_deduction: 75000,
    new_regime: [
      { min: 0, max: 400000, rate: 0 },
      { min: 400001, max: 800000, rate: 5 },
      { min: 800001, max: 1200000, rate: 10 },
      { min: 1200001, max: 1600000, rate: 15 },
      { min: 1600001, max: 2000000, rate: 20 },
      { min: 2000001, max: 2400000, rate: 25 },
      { min: 2400001, max: null, rate: 30 },
    ],
  };

  it('zero tax for income ≤ ₹4,75,000 (within rebate)', () => {
    const result = computeTDSNewRegime(400000, tdsConfig);
    expect(result.monthlyTDS).toBe(0);
  });

  it('rebate u/s 87A applied for income ≤ ₹12,00,000', () => {
    // Annual 10,00,000: taxable = 10,00,000 - 75,000 = 9,25,000
    // Tax before rebate > 0 but ≤ 12L → full rebate
    const result = computeTDSNewRegime(1000000, tdsConfig);
    expect(result.annualTaxLiability).toBe(0);
  });

  it('calculates correct tax for ₹20L income (above rebate threshold)', () => {
    const result = computeTDSNewRegime(2000000, tdsConfig);
    expect(result.taxableIncome).toBe(1925000); // 20L - 75K
    expect(result.annualTaxLiability).toBeGreaterThan(0);
    expect(result.monthlyTDS).toBeGreaterThan(0);
  });

  it('adds education cess at 4%', () => {
    const result = computeTDSNewRegime(2500000, tdsConfig);
    const expectedCess = Math.round((result.annualTaxLiability / 1.04) * 0.04 * 100) / 100;
    expect(result.educationCess).toBeCloseTo(expectedCess, -1);
  });

  it('zero income → zero tax', () => {
    const result = computeTDSNewRegime(0, tdsConfig);
    expect(result.annualTaxLiability).toBe(0);
    expect(result.monthlyTDS).toBe(0);
  });
});

// ============================================================
// 9. TDS — OLD REGIME
// ============================================================

describe('computeTDSOldRegime', () => {
  it('zero tax for income ≤ ₹5L (after rebate 87A)', () => {
    const result = computeTDSOldRegime(500000, { deductions_80c: 150000 });
    expect(result.annualTaxLiability).toBe(0);
  });

  it('deductions reduce taxable income', () => {
    const r1 = computeTDSOldRegime(800000, {});
    const r2 = computeTDSOldRegime(800000, { deductions_80c: 150000 });
    expect(r2.taxableIncome).toBeLessThan(r1.taxableIncome);
  });
});

// ============================================================
// 10. GRATUITY
// ============================================================

describe('computeGratuityProvision', () => {
  it('monthly provision = (basic/26) × 15 / 12', () => {
    const provision = computeGratuityProvision(26000);
    expect(provision).toBeCloseTo(1250, 0);  // (26000/26)×15/12 = 1250
  });
});

// ============================================================
// 11. FULL PAYSLIP INTEGRATION
// ============================================================

describe('computeFullPayslip', () => {
  const employee = { ctc: 600000, base_salary: 50000 };
  const structure = { basic_pct: 50, hra_pct: 20, da_pct: 10, special_allowance: 2000, pf_applicable: true };
  const attendance = { working_days: 26, present_days: 24, approved_leave_days: 1 };
  const pfConfig = { wage_ceiling: 15000, ee_rate: 12, er_epf_rate: 3.67, er_eps_rate: 8.33, edli_rate: 0.5 };
  const esicConfig = { gross_ceiling: 21000, ee_rate: 0.75, er_rate: 3.25 };
  const ptSlabs = [{ min: 0, max: 7500, pt: 0 }, { min: 7501, max: 10000, pt: 175 }, { min: 10001, max: null, pt: 200 }];

  it('produces non-negative net pay', () => {
    const slip = computeFullPayslip(employee, structure, attendance, {}, { pfConfig, esicConfig, ptSlabs });
    expect(slip.netPay).toBeGreaterThan(0);
  });

  it('gross = net + total deductions', () => {
    const slip = computeFullPayslip(employee, structure, attendance, {}, { pfConfig, esicConfig, ptSlabs });
    expect(slip.grossSalary).toBeCloseTo(slip.netPay + slip.totalDeductions, 0);
  });

  it('LOP applied for 1 absent day (24 present + 1 leave + 1 LOP = 26)', () => {
    const slip = computeFullPayslip(employee, structure, attendance, {}, { pfConfig, esicConfig, ptSlabs });
    expect(slip.lopDays).toBe(1);
    expect(slip.lopDeduction).toBeGreaterThan(0);
  });

  it('includes employer cost (greater than gross)', () => {
    const slip = computeFullPayslip(employee, structure, attendance, {}, { pfConfig, esicConfig, ptSlabs });
    expect(slip.totalEmployerCost).toBeGreaterThan(slip.grossSalary);
  });
});

// ============================================================
// 12. ANOMALY DETECTION
// ============================================================

describe('detectPayrollAnomalies', () => {
  it('flags an employee with >30% salary spike', () => {
    const current = [{ employee_id: 'e1', employee_name: 'Alice', net_pay: 80000 }];
    const history = [
      { employee_id: 'e1', net_pay: 50000 },
      { employee_id: 'e1', net_pay: 52000 },
    ];
    const anomalies = detectPayrollAnomalies(current, history);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].employee_id).toBe('e1');
  });

  it('flags zero net pay', () => {
    const current = [{ employee_id: 'e2', employee_name: 'Bob', net_pay: 0 }];
    const anomalies = detectPayrollAnomalies(current, []);
    expect(anomalies.find(a => a.employee_id === 'e2')).toBeTruthy();
  });

  it('no anomalies for stable payroll', () => {
    const slips = [{ employee_id: 'e3', employee_name: 'Carol', net_pay: 45000 }];
    const history = [{ employee_id: 'e3', net_pay: 44500 }, { employee_id: 'e3', net_pay: 45200 }];
    const anomalies = detectPayrollAnomalies(slips, history);
    expect(anomalies.length).toBe(0);
  });
});
