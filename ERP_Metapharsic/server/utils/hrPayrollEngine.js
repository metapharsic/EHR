/**
 * server/utils/hrPayrollEngine.js
 * Pure payroll computation functions for Metapharsic ERP HRMS.
 * ALL statutory calculations live here — zero DB calls, fully testable.
 *
 * Covers: Salary breakdown, PF, ESIC, PT, TDS (Sec 192 Old+New regime),
 *         LOP deduction, OT pay, leave encashment, gratuity provision.
 */

'use strict';

const num = (v, d = 0) => (isNaN(parseFloat(v)) ? d : parseFloat(v));
const round2 = (v) => Math.round(num(v) * 100) / 100;

// ============================================
// 1. SALARY STRUCTURE BREAKDOWN
// ============================================

/**
 * Compute gross salary components from CTC and a salary structure config.
 * @param {number} ctc - Annual CTC
 * @param {object} structure - { basic_pct, hra_pct, da_pct, special_allowance }
 * @returns {object} Monthly salary components
 */
function computeSalaryBreakdown(ctc, structure = {}) {
    const monthlyGross = round2(ctc / 12);
    const basicPct = num(structure.basic_pct, 50) / 100;
    const hraPct = num(structure.hra_pct, 20) / 100;
    const daPct = num(structure.da_pct, 10) / 100;

    const basic = round2(monthlyGross * basicPct);
    const hra = round2(basic * hraPct);
    const da = round2(basic * daPct);
    const specialAllowance = num(structure.special_allowance, 0);
    const fixedAllowance = round2(monthlyGross - basic - hra - da - specialAllowance);

    return {
        gross: monthlyGross,
        basic,
        hra,
        da,
        specialAllowance,
        fixedAllowance: Math.max(fixedAllowance, 0),
    };
}

// ============================================
// 2. LOP DEDUCTION
// ============================================

/**
 * Compute Loss of Pay deduction.
 * Formula: (gross / working_days) × lop_days
 */
function computeLOP(grossSalary, workingDays, presentDays, approvedLeaveDays) {
    const lopDays = Math.max(workingDays - presentDays - num(approvedLeaveDays), 0);
    const lopDeduction = workingDays > 0 ? round2((num(grossSalary) / workingDays) * lopDays) : 0;
    return { lopDays, lopDeduction };
}

// ============================================
// 3. OVERTIME PAY (Factories Act — 2× rate)
// ============================================

/**
 * OT pay = overtime_hours × (basic / 208) × 2
 * 208 = standard monthly hours (26 days × 8 hrs)
 */
function computeOvertimePay(basicSalary, overtimeHours) {
    const hourlyRate = num(basicSalary) / 208;
    return round2(hourlyRate * num(overtimeHours) * 2);
}

// ============================================
// 4. LEAVE ENCASHMENT
// ============================================

/**
 * Leave encashment = (basic / 30) × encash_days
 */
function computeLeaveEncashment(basicSalary, daysToEncash) {
    return round2((num(basicSalary) / 30) * num(daysToEncash));
}

// ============================================
// 5. PROVIDENT FUND (EPF Act)
// ============================================

/**
 * PF ceiling: contribution is on min(gross, wage_ceiling).
 * EE: 12% of capped wages
 * ER: 3.67% EPF + 8.33% EPS of capped wages
 * EDLI: 0.5% of capped wages (employer)
 */
function computePF(grossSalary, pfConfig = {}) {
    const ceiling = num(pfConfig.wage_ceiling, 15000);
    const wages = Math.min(num(grossSalary), ceiling);
    const eeRate = num(pfConfig.ee_rate, 12) / 100;
    const erEpfRate = num(pfConfig.er_epf_rate, 3.67) / 100;
    const erEpsRate = num(pfConfig.er_eps_rate, 8.33) / 100;
    const edliRate = num(pfConfig.edli_rate, 0.5) / 100;

    const eeEpf = round2(wages * eeRate);
    const erEpf = round2(wages * erEpfRate);
    const erEps = round2(wages * erEpsRate);
    const edli = round2(wages * edliRate);

    return {
        wages,
        eeContribution: eeEpf,
        erEpfContribution: erEpf,
        erEpsContribution: erEps,
        edliContribution: edli,
        totalEmployer: round2(erEpf + erEps + edli),
    };
}

// ============================================
// 6. ESIC (ESI Act)
// ============================================

/**
 * ESIC applies only when gross_salary ≤ 21,000/month.
 * EE: 0.75% | ER: 3.25%
 */
function computeESIC(grossSalary, esicConfig = {}) {
    const ceiling = num(esicConfig.gross_ceiling, 21000);
    if (num(grossSalary) > ceiling) {
        return { applicable: false, eeContribution: 0, erContribution: 0 };
    }
    const eeRate = num(esicConfig.ee_rate, 0.75) / 100;
    const erRate = num(esicConfig.er_rate, 3.25) / 100;
    return {
        applicable: true,
        eeContribution: round2(num(grossSalary) * eeRate),
        erContribution: round2(num(grossSalary) * erRate),
    };
}

// ============================================
// 7. PROFESSIONAL TAX (State-wise slabs)
// ============================================

/**
 * PT slabs example (Maharashtra):
 * [{ min:0, max:7500, pt:0 }, { min:7501, max:10000, pt:175 }, { min:10001, max:null, pt:200 }]
 */
function computePT(grossSalary, ptSlabs = []) {
    const gross = num(grossSalary);
    for (const slab of ptSlabs) {
        const min = num(slab.min, 0);
        const max = slab.max === null ? Infinity : num(slab.max, Infinity);
        if (gross >= min && gross <= max) {
            return round2(num(slab.pt, 0));
        }
    }
    return 0;
}

// ============================================
// 8. TDS — SECTION 192 (New Regime FY 2026-27)
// ============================================

/**
 * Compute annual TDS under New Regime.
 * Standard Deduction: ₹75,000
 * Rebate u/s 87A: ₹25,000 if taxable income ≤ ₹7,00,000 (Old) / ₹12,00,000 (New)
 * Education Cess: 4% on tax
 * Surcharge: 10% on tax for income 50L-1Cr, 15% 1Cr-2Cr, 25% 2Cr-5Cr, 37% >5Cr (marginal relief applies)
 */
function computeTDSNewRegime(annualGross, tdsConfig = {}) {
    const standardDeduction = num(tdsConfig.standard_deduction, 75000);
    const slabs = tdsConfig.new_regime || [
        { min: 0, max: 400000, rate: 0 },
        { min: 400001, max: 800000, rate: 5 },
        { min: 800001, max: 1200000, rate: 10 },
        { min: 1200001, max: 1600000, rate: 15 },
        { min: 1600001, max: 2000000, rate: 20 },
        { min: 2000001, max: 2400000, rate: 25 },
        { min: 2400001, max: null, rate: 30 },
    ];

    const gross = num(annualGross);
    const taxableIncome = Math.max(gross - standardDeduction, 0);

    // Compute tax on slabs
    let tax = 0;
    let remaining = taxableIncome;
    for (const slab of slabs) {
        if (remaining <= 0) break;
        const slabMax = slab.max === null ? Infinity : slab.max;
        const slabWidth = slabMax - slab.min + 1;
        const taxable = Math.min(remaining, slabWidth);
        if (taxable > 0) tax += round2(taxable * (slab.rate / 100));
        remaining -= taxable;
    }

    // Rebate u/s 87A — income ≤ 12 lakh gets full rebate (New regime FY2026-27 Budget: rebate raised to ₹60,000)
    const rebate = taxableIncome <= 1200000 ? Math.min(tax, 60000) : 0;
    const taxAfterRebate = Math.max(tax - rebate, 0);

    // Surcharge
    let surcharge = 0;
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) surcharge = round2(taxAfterRebate * 0.10);
    else if (taxableIncome > 10000000 && taxableIncome <= 20000000) surcharge = round2(taxAfterRebate * 0.15);
    else if (taxableIncome > 20000000 && taxableIncome <= 50000000) surcharge = round2(taxAfterRebate * 0.25);
    else if (taxableIncome > 50000000) surcharge = round2(taxAfterRebate * 0.37);

    const taxWithSurcharge = round2(taxAfterRebate + surcharge);
    const educationCess = round2(taxWithSurcharge * 0.04);
    const annualTax = round2(taxWithSurcharge + educationCess);
    const monthlyTDS = round2(annualTax / 12);

    return {
        regime: 'New',
        annualGross: gross,
        standardDeduction,
        taxableIncome,
        taxBeforeRebate: round2(tax),
        rebate,
        surcharge,
        educationCess,
        annualTaxLiability: annualTax,
        monthlyTDS,
    };
}

/**
 * Compute TDS under Old Regime.
 * Deductions: HRA exemption, 80C (max 1.5L), 80D (max 25K), Standard deduction 50K.
 */
function computeTDSOldRegime(annualGross, deductions = {}) {
    const stdDeduction = 50000;
    const maxDeduction80C = 150000;
    const maxDeduction80D = 25000;

    const d80c = Math.min(num(deductions.deductions_80c, 0), maxDeduction80C);
    const d80d = Math.min(num(deductions.deductions_80d, 0), maxDeduction80D);
    const hraExemption = num(deductions.hra_exemption, 0);

    const taxableIncome = Math.max(
        num(annualGross) - stdDeduction - d80c - d80d - hraExemption,
        0
    );

    // Old regime slabs
    const oldSlabs = [
        { min: 0, max: 250000, rate: 0 },
        { min: 250001, max: 500000, rate: 5 },
        { min: 500001, max: 1000000, rate: 20 },
        { min: 1000001, max: null, rate: 30 },
    ];

    let tax = 0;
    let remaining = taxableIncome;
    for (const slab of oldSlabs) {
        if (remaining <= 0) break;
        const slabMax = slab.max === null ? Infinity : slab.max;
        const slabWidth = slabMax - slab.min + 1;
        const taxable = Math.min(remaining, slabWidth);
        if (taxable > 0) tax += round2(taxable * (slab.rate / 100));
        remaining -= taxable;
    }

    const rebate = taxableIncome <= 500000 ? Math.min(tax, 12500) : 0;
    const taxAfterRebate = Math.max(tax - rebate, 0);
    const educationCess = round2(taxAfterRebate * 0.04);
    const annualTax = round2(taxAfterRebate + educationCess);

    return {
        regime: 'Old',
        annualGross: num(annualGross),
        deductions: { stdDeduction, d80c, d80d, hraExemption },
        taxableIncome,
        annualTaxLiability: annualTax,
        monthlyTDS: round2(annualTax / 12),
    };
}

// ============================================
// 9. GRATUITY PROVISION (Payment of Gratuity Act)
// ============================================

/**
 * Monthly gratuity provision = (basic / 26) × 15 / 12
 * Eligible after 5 years; but companies provision from day 1.
 */
function computeGratuityProvision(basicSalary) {
    return round2((num(basicSalary) / 26) * 15 / 12);
}

// ============================================
// 10. FULL PAYROLL COMPUTATION (Orchestrator)
// ============================================

/**
 * Compute a complete salary slip for one employee for one month.
 * @param {object} employee - { ctc, base_salary, work_location, employment_type, ... }
 * @param {object} structure - Salary structure config from hr_salary_structures
 * @param {object} attendance - { working_days, present_days, approved_leave_days, overtime_hours }
 * @param {object} extras - { performance_incentive, reimbursement, bonus, arrears, leave_encash_days, tds_regime }
 * @param {object} statutory - { pfConfig, esicConfig, ptSlabs, tdsConfig }
 * @returns {object} Complete salary slip data
 */
function computeFullPayslip(employee, structure, attendance, extras = {}, statutory = {}) {
    // 1. Salary breakdown
    const parsedCtc = num(employee.ctc);
    const ctc = parsedCtc > 0 ? parsedCtc : num(employee.base_salary, 0) * 12;
    const breakdown = computeSalaryBreakdown(ctc, structure);

    // 2. LOP
    const { lopDays, lopDeduction } = computeLOP(
        breakdown.gross,
        num(attendance.working_days, 26),
        num(attendance.present_days, 26),
        num(attendance.approved_leave_days, 0)
    );

    // 3. OT
    const overtimePay = computeOvertimePay(breakdown.basic, num(extras.overtime_hours, 0));

    // 4. Leave encashment
    const leaveEncashmentAmt = computeLeaveEncashment(breakdown.basic, num(extras.leave_encash_days, 0));

    // 5. Gross before deductions
    const grossEarnings = round2(
        breakdown.gross
        - lopDeduction
        + overtimePay
        + num(extras.performance_incentive, 0)
        + num(extras.arrears, 0)
        + leaveEncashmentAmt
        + num(extras.bonus, 0)
        + num(extras.reimbursement, 0)
    );

    // 6. PF
    const pf = computePF(breakdown.basic, statutory.pfConfig); // PF on basic only

    // 7. ESIC
    const esic = computeESIC(grossEarnings, statutory.esicConfig);

    // 8. PT
    const ptAmount = computePT(grossEarnings, statutory.ptSlabs);

    // 9. TDS
    const annualGross = grossEarnings * 12;
    const tdsResult = (extras.tds_regime || 'New') === 'Old'
        ? computeTDSOldRegime(annualGross, extras.tdsDeductions || {})
        : computeTDSNewRegime(annualGross, statutory.tdsConfig);

    // 10. Gratuity provision (employer cost — not deducted from salary)
    const gratuityProvision = computeGratuityProvision(breakdown.basic);

    // 11. Total deductions
    const totalDeductions = round2(
        pf.eeContribution
        + (esic.applicable ? esic.eeContribution : 0)
        + ptAmount
        + tdsResult.monthlyTDS
        + num(extras.other_deductions, 0)
    );

    const netPay = round2(grossEarnings - totalDeductions);

    return {
        // Earnings
        basic: breakdown.basic,
        hra: breakdown.hra,
        da: breakdown.da,
        specialAllowance: breakdown.specialAllowance,
        fixedAllowance: breakdown.fixedAllowance,
        performanceIncentive: num(extras.performance_incentive, 0),
        overtimeHours: num(extras.overtime_hours, 0),
        overtimeAmount: overtimePay,
        leaveEncashmentAmount: leaveEncashmentAmt,
        bonusAmount: num(extras.bonus, 0),
        reimbursementAmount: num(extras.reimbursement, 0),
        arrears: num(extras.arrears, 0),
        grossSalary: grossEarnings,

        // Attendance
        workingDays: num(attendance.working_days, 26),
        presentDays: num(attendance.present_days, 26),
        leaveDays: num(attendance.approved_leave_days, 0),
        lopDays,
        lopDeduction,

        // Deductions
        pfEmployee: pf.eeContribution,
        pfEmployer: pf.totalEmployer,
        pfWages: pf.wages,
        esicApplicable: esic.applicable,
        esicEmployee: esic.applicable ? esic.eeContribution : 0,
        esicEmployer: esic.applicable ? esic.erContribution : 0,
        ptAmount,
        tds: tdsResult.monthlyTDS,
        tdsRegime: tdsResult.regime,
        otherDeductions: num(extras.other_deductions, 0),
        totalDeductions,
        netPay,

        // Employer cost (for GL)
        gratuityProvision,
        totalEmployerCost: round2(grossEarnings + pf.totalEmployer + (esic.applicable ? esic.erContribution : 0) + gratuityProvision),

        // TDS detail
        tdsWorking: tdsResult,
        pfDetail: pf,
        esicDetail: esic,
    };
}

// ============================================
// 11. ANOMALY DETECTION (Heuristic)
// ============================================

/**
 * Detect payroll anomalies for a batch of salary slips.
 * Returns flagged items with reason and severity.
 */
function detectPayrollAnomalies(currentSlips, historicalSlips = []) {
    const anomalies = [];
    const histMap = {};
    for (const h of historicalSlips) {
        if (!histMap[h.employee_id]) histMap[h.employee_id] = [];
        histMap[h.employee_id].push(h);
    }

    for (const slip of currentSlips) {
        const history = histMap[slip.employee_id] || [];
        if (history.length > 0) {
            const avgNet = history.reduce((s, h) => s + num(h.net_pay), 0) / history.length;
            const delta = num(slip.net_pay) - avgNet;
            const deltaPct = avgNet > 0 ? (delta / avgNet) * 100 : 0;
            if (Math.abs(deltaPct) > 30) {
                anomalies.push({
                    employee_id: slip.employee_id,
                    employee_name: slip.employee_name,
                    reason: `Net pay changed by ${deltaPct.toFixed(1)}% vs average`,
                    severity: Math.abs(deltaPct) > 50 ? 'High' : 'Medium',
                    current_net: slip.net_pay,
                    avg_net: avgNet.toFixed(2),
                });
            }
        }
        if (num(slip.net_pay) <= 0) {
            anomalies.push({
                employee_id: slip.employee_id,
                employee_name: slip.employee_name,
                reason: 'Zero or negative net pay',
                severity: 'High',
                current_net: slip.net_pay,
            });
        }
        if (num(slip.tds) > num(slip.net_pay) * 0.4) {
            anomalies.push({
                employee_id: slip.employee_id,
                employee_name: slip.employee_name,
                reason: 'TDS exceeds 40% of net pay — possible mis-calculation',
                severity: 'Medium',
                current_net: slip.net_pay,
                tds: slip.tds,
            });
        }
    }
    return anomalies;
}

module.exports = {
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
};
