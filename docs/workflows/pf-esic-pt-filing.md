# PF / ESIC / PT Filing — Metapharsic Lifesciences ERP

## Overview

Three statutory deductions from employee salaries beyond TDS:

| Statutory | Full Name | Governs | Rate |
|---|---|---|---|
| PF | Provident Fund | EPFO — Employees' Provident Fund Organisation | 12% employee + 13% employer of Basic |
| ESIC | Employees' State Insurance | ESIC Corporation | 0.75% employee + 3.25% employer of Gross |
| PT | Professional Tax | State Government | Slab-based (Rs 0–Rs 2500/year) |

All three are computed during payroll run, deducted from salary, and deposited by specific deadlines.

---

## PROVIDENT FUND (PF)

### Applicability

- Applies to all employees with Basic Salary ≤ Rs 15,000/month (mandatory)
- Optional for Basic Salary > Rs 15,000 (but once enrolled, continues)
- Pharma companies with 20+ employees must register under EPFO

### Contribution Breakdown

```
Employee Contribution:
  12% of Basic Salary → goes to EPF (Employee Provident Fund)

Employer Contribution (13% total):
  3.67% of Basic → EPF
  8.33% of Basic → EPS (Employee Pension Scheme) [capped at Rs 15,000 Basic]
  0.50% of Basic → EDLI (Employee Deposit Linked Insurance)
  0.50%          → Admin charges (EPF)
  0.01%          → Admin charges (EDLI)

Note: EPS wage ceiling = Rs 15,000/month. If Basic > Rs 15,000,
employer EPS contribution = 8.33% × Rs 15,000 = Rs 1,250 (fixed)
```

### DB Tables for PF

```
hr_pf_registers        — monthly PF contribution per employee
employees              — UAN (Universal Account Number) stored here
hr_salary_structures   — defines PF applicability
salary_slips           — source: tds_amount, pf_employee, pf_employer columns
```

### PF Register Schema

```sql
CREATE TABLE IF NOT EXISTS hr_pf_registers (
  id              SERIAL PRIMARY KEY,
  employee_id     UUID NOT NULL REFERENCES employees(id),
  uan             VARCHAR(12),                 -- Universal Account Number
  period_month    INTEGER NOT NULL,
  financial_year  VARCHAR(7) NOT NULL,
  gross_wages     DECIMAL(10,2) NOT NULL,
  basic_wages     DECIMAL(10,2) NOT NULL,
  epf_wages       DECIMAL(10,2) NOT NULL,      -- capped at 15000 if applicable
  eps_wages       DECIMAL(10,2) NOT NULL,      -- capped at 15000
  edli_wages      DECIMAL(10,2) NOT NULL,
  employee_epf    DECIMAL(10,2) NOT NULL,      -- 12% of epf_wages
  employer_epf    DECIMAL(10,2) NOT NULL,      -- 3.67% of epf_wages
  employer_eps    DECIMAL(10,2) NOT NULL,      -- 8.33% of eps_wages
  employer_edli   DECIMAL(10,2) NOT NULL,      -- 0.50% of edli_wages
  total_due       DECIMAL(10,2) NOT NULL,      -- employee + employer total
  challan_id      INTEGER,                     -- references pf_challans
  ecr_status      VARCHAR(20) DEFAULT 'PENDING', -- PENDING, UPLOADED, APPROVED
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Monthly PF Filing Flow

```
STEP 1: Payroll Run (POST /api/hr/payroll/run)
  hrPayrollEngine.computeFullPayslip() calculates:
    employee_pf = 12% of basic (if pf_applicable = true)
    employer_pf = 3.67% of basic
    employer_eps = 8.33% of basic (max 1250 if basic > 15000)
  Stored in salary_slips.pf_employee and salary_slips.pf_employer
  INSERT INTO hr_pf_registers for each employee

STEP 2: Generate PF Register (after payroll approval)
  GET /api/hr/payroll/pf-register?month=6&year=2026
  Returns employee-wise PF contribution

STEP 3: Generate ECR File (Electronic Challan cum Return)
  GET /api/hr/payroll/ecr-file?month=6&year=2026
  Returns .txt file in EPFO ECR 2.0 format:
    Header: EPFO Establishment Code, Wage Month, Wage Year
    Row per employee: UAN, Member Name, Gross Wages, EPF Wages, EPS Wages,
                      EDLI Wages, Employee EPF, Employer EPF, Employer EPS,
                      EDLI, Admin EPF, Admin EDLI, NCP Days, Refund Arrear

STEP 4: Upload ECR to EPFO Unified Portal (by 15th)
  After upload → EPFO generates challan with:
    TRRN (Temporary Return Reference Number)
    Amount breakup: EPF, EPS, EDLI, Admin

STEP 5: Pay PF Challan (by 15th)
  Pay online via EPFO portal / net banking
  Note TRRN and payment reference

STEP 6: Record in ERP
  POST /api/hr/payroll/pf-payment
  { "month": 6, "year": 2026, "trrn": "TRRN123456",
    "paymentDate": "2026-07-14", "amountPaid": 85000,
    "bankRef": "HDFC2026071400123" }
  |
  v
  UPDATE hr_pf_registers SET challan_id = $id, ecr_status = 'APPROVED'
  POST GL entry:
    DR  PF Payable — Employee (Liability)
    DR  PF Payable — Employer (Liability)
    CR  Bank
```

### PF Annual Filing

```
Quarterly PF Return: Filed via ECR uploads only (no separate quarterly return needed)

Annual PF:
  March ECR → upload by April 15
  Annual PF passbook available to employees via EPFO portal
  Form 3A (member-wise annual contribution) — generated from hr_pf_registers
  Form 6A (establishment annual return) — aggregate of Form 3A

PF Withdrawal / Transfer:
  Employee leaving → PF transfer to new UAN (Form 13 online)
  PF withdrawal → Form 31 / 19 / 10C (partial / full / pension)
  ERP tracks in employees.pf_status field
```

---

## ESIC (EMPLOYEES' STATE INSURANCE)

### Applicability

- Applies to employees with Gross Salary ≤ Rs 21,000/month (Rs 25,000 for disabled)
- Pharma companies with 10+ employees in applicable areas
- Once covered, employee remains covered even if salary crosses Rs 21,000 during the contribution period

### Contribution Rates

```
Employee ESIC = 0.75% of Gross Wages
Employer ESIC = 3.25% of Gross Wages
Total          = 4.00% of Gross Wages

Wage Ceiling: Rs 21,000/month gross
Below Rs 176/day wage → exempt from employee contribution (employer still pays)
```

### DB Tables for ESIC

```sql
CREATE TABLE IF NOT EXISTS hr_esic_registers (
  id              SERIAL PRIMARY KEY,
  employee_id     UUID NOT NULL REFERENCES employees(id),
  esic_ip_no      VARCHAR(17),                 -- Insurance Person Number
  period_month    INTEGER NOT NULL,
  financial_year  VARCHAR(7) NOT NULL,
  gross_wages     DECIMAL(10,2) NOT NULL,
  employee_esic   DECIMAL(10,2) NOT NULL,      -- 0.75% of gross
  employer_esic   DECIMAL(10,2) NOT NULL,      -- 3.25% of gross
  total_esic      DECIMAL(10,2) NOT NULL,
  contribution_period VARCHAR(10),             -- 'APR-SEP' or 'OCT-MAR'
  challan_id      INTEGER,
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Monthly ESIC Filing Flow

```
STEP 1: Payroll Run computes ESIC
  For each employee WHERE gross_salary <= 21000:
    employee_esic = gross_salary * 0.0075
    employer_esic = gross_salary * 0.0325
  Stored in salary_slips.esic_employee and salary_slips.esic_employer
  INSERT INTO hr_esic_registers

STEP 2: Generate ESIC Register
  GET /api/hr/payroll/esic-register?month=6&year=2026
  Returns IP-number-wise contribution

STEP 3: Upload Monthly Return on ESIC Portal (by 15th)
  ESIC Employer Portal → File Return → Upload contribution data
  System validates: IP numbers, wages, contribution amounts

STEP 4: Generate ESIC Challan
  Portal generates challan with reference number
  Pay online (bank gateway integrated with ESIC portal)

STEP 5: Record in ERP
  POST /api/hr/payroll/esic-payment
  { "month": 6, "year": 2026, "challanNo": "ESIC2026060001",
    "paymentDate": "2026-07-14", "amountPaid": 28000 }
  |
  v
  GL Entry:
    DR  ESIC Payable — Employee (Liability)
    DR  ESIC Payable — Employer (Liability)
    CR  Bank

STEP 6: Half-Yearly ESIC Return
  ESIC contribution period: April-September and October-March
  Half-yearly return filed within 42 days of period end:
    Oct 31 (for April-September period)
    Apr 11 (for October-March period)
  Filed on ESIC employer portal
  Includes: All IPs, contribution months, wages, contributions
```

### ESIC Benefits Tracking

```
Employees covered by ESIC get medical benefits.
ERP tracks:
  employees.esic_ip_no              — Insurance Person Number
  employees.esic_dispensary         — Assigned dispensary
  hr_esic_registers.contribution_period — Current contribution window

ESIC eligibility rules:
  Medical: Requires 3 months contribution in preceding 6 months
  Sickness: Requires 78 days contribution in 6-month period
  Maternity: 80 days contribution in preceding 2 contribution periods
```

---

## PROFESSIONAL TAX (PT)

### Applicability

State-specific tax on employment. Applicable in:
Maharashtra, Karnataka, Gujarat, West Bengal, Andhra Pradesh, Telangana, Tamil Nadu, Madhya Pradesh, Assam, Meghalaya, Odisha, Sikkim, Tripura

### PT Slabs by State

**Maharashtra** (most common for pharma):
```
Monthly Salary     PT Amount
Rs 0 – Rs 7,499    Nil
Rs 7,500 – Rs 9,999  Rs 175/month (Rs 2100/year)
Rs 10,000+         Rs 200/month (Rs 2500/year, Rs 300 in February)
```

**Karnataka**:
```
Rs 0 – Rs 14,999   Nil
Rs 15,000 – Rs 29,999  Rs 200/month
Rs 30,000+         Rs 200/month (Rs 300 in April)
```

**Gujarat**:
```
Rs 0 – Rs 5,999    Nil
Rs 6,000 – Rs 8,999  Rs 80/month
Rs 9,000 – Rs 11,999  Rs 150/month
Rs 12,000+         Rs 200/month
```

### DB Tables for PT

```sql
CREATE TABLE IF NOT EXISTS hr_pt_registers (
  id              SERIAL PRIMARY KEY,
  employee_id     UUID NOT NULL REFERENCES employees(id),
  period_month    INTEGER NOT NULL,
  financial_year  VARCHAR(7) NOT NULL,
  state           VARCHAR(50) NOT NULL,
  gross_salary    DECIMAL(10,2) NOT NULL,
  pt_amount       DECIMAL(10,2) NOT NULL,       -- from state slab
  challan_id      INTEGER,
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PT rates stored in hr_statutory_config (not hardcoded)
-- hr_statutory_config.pt_slabs → JSONB array of { from, to, amount, state }
```

### Monthly PT Flow

```
STEP 1: Payroll Run computes PT
  For each employee:
    state = employee.work_state (or company default state)
    pt_slabs = SELECT pt_slabs FROM hr_statutory_config WHERE state = $state
    pt_amount = lookup slab for employee.gross_salary
    Stored in salary_slips.pt_amount
    INSERT INTO hr_pt_registers

STEP 2: Generate PT Register
  GET /api/hr/payroll/pt-register?month=6&year=2026&state=Maharashtra
  Returns state-wise PT summary

STEP 3: Pay PT Challan (deadline varies by state)
  Maharashtra: Last day of month (or 31st March for annual option)
  Karnataka: Last day of month
  Gujarat: 15th of following month
  |
  v
  Pay at respective State Treasury / MahaVAT / Kar e-Payment portal

STEP 4: Record in ERP
  POST /api/hr/payroll/pt-payment
  { "month": 6, "year": 2026, "state": "Maharashtra",
    "challanNo": "MH2026060001", "paymentDate": "2026-07-29",
    "amountPaid": 4800 }
  |
  v
  GL Entry:
    DR  PT Payable (Liability)
    CR  Bank

STEP 5: Annual PT Return (Maharashtra example)
  Annual return: March 31 every year
  Form III-B (employer return)
  Includes: All employees, monthly wages, PT deducted, PT paid
  File on Mahagst portal
```

---

## Statutory Compliance Dashboard

```
GET /api/hr/statutory/dashboard?month=6&year=2026
  |
  v
{
  "period": "June 2026",
  "pf": {
    "applicableEmployees": 45,
    "totalEmployee": 67500,
    "totalEmployer": 72000,
    "totalDue": 139500,
    "dueDate": "2026-07-15",
    "status": "PENDING",
    "ecrGenerated": false
  },
  "esic": {
    "applicableEmployees": 28,
    "totalEmployee": 8400,
    "totalEmployer": 36400,
    "totalDue": 44800,
    "dueDate": "2026-07-15",
    "status": "PENDING"
  },
  "pt": {
    "state": "Maharashtra",
    "applicableEmployees": 53,
    "totalDue": 10300,
    "dueDate": "2026-07-31",
    "status": "PENDING"
  },
  "alerts": [
    "PF ECR not yet generated for June 2026",
    "5 employees missing UAN — PF cannot be filed for them",
    "3 employees missing ESIC IP number"
  ]
}
```

---

## New Joiner / Exit Handling

### New Employee (Joiner)

```
On POST /api/hr/employees:
  |
  IF gross_salary <= 21000:
    → Register on ESIC portal (get IP Number)
    → Store in employees.esic_ip_no
  IF basic_salary <= 15000 (or opts in):
    → Register on EPFO portal (get UAN or link existing UAN)
    → Store in employees.uan
  |
  PF and ESIC applicable from the month of joining (not prorated if joined mid-month)
  PT applicable from month of joining
```

### Employee Exit

```
On PUT /api/hr/employees/:id (status → Terminated/Resigned):
  |
  → Final settlement payroll: compute PF, ESIC, PT for last month
  → Generate PF withdrawal / transfer form data
  → Issue Form 16 (TDS certificate) for the financial year portion worked
  → Issue ESIC coverage certificate
  → Mark employees.pf_status = 'TRANSFER_PENDING' or 'WITHDRAWAL_PENDING'
  → Stop PF/ESIC deduction from next month
```

---

## API Routes Summary

```
GET  /api/hr/payroll/pf-register        → Monthly PF contribution register
GET  /api/hr/payroll/ecr-file           → ECR 2.0 format file for EPFO
POST /api/hr/payroll/pf-payment         → Record PF challan payment
GET  /api/hr/payroll/esic-register      → Monthly ESIC contribution register
POST /api/hr/payroll/esic-payment       → Record ESIC challan payment
GET  /api/hr/payroll/pt-register        → Monthly PT register (state-wise)
POST /api/hr/payroll/pt-payment         → Record PT challan payment
GET  /api/hr/statutory/dashboard        → All-in-one statutory compliance view
GET  /api/hr/statutory/missing-details  → Employees missing UAN / IP number / PAN
GET  /api/hr/statutory/annual-pf        → Form 3A and 6A data
GET  /api/hr/statutory/annual-esic      → Half-yearly ESIC return data
GET  /api/hr/statutory/annual-pt        → Annual PT return data (state-wise)
```

---

## GL Accounts Required

```
Liabilities (shown on Balance Sheet):
  PF Payable — Employee Contribution      [Credit when deducting from salary]
  PF Payable — Employer Contribution      [Credit when booking employer share]
  ESIC Payable — Employee Contribution    [Credit when deducting from salary]
  ESIC Payable — Employer Contribution    [Credit when booking employer share]
  PT Payable                              [Credit when deducting from salary]
  TDS Payable — Section 192              [Credit when deducting salary TDS]
  TDS Payable — Section 194C/H/J         [Credit when deducting vendor TDS]
  GST Payable — IGST                     [Credit on outward supplies]
  GST Payable — CGST                     [Credit on outward supplies]
  GST Payable — SGST                     [Credit on outward supplies]

Assets:
  ITC Receivable — IGST                  [Debit on eligible purchase]
  ITC Receivable — CGST                  [Debit on eligible purchase]
  ITC Receivable — SGST                  [Debit on eligible purchase]

Expenses (shown on P&L):
  Employer PF Contribution               [Dr on payroll run]
  Employer ESIC Contribution             [Dr on payroll run]
```

---

## Penalties Reference

| Statutory | Violation | Penalty |
|---|---|---|
| PF | Late deposit | 12% per annum interest + up to 25% damages |
| PF | Non-deposit | Criminal prosecution under EPF Act |
| PF | Late ECR filing | Rs 5/day per employee |
| ESIC | Late deposit | 12% interest per annum |
| ESIC | Non-registration | Rs 5,000 fine |
| PT | Late payment | 2% per month (state-specific) |
| PT | Non-filing return | Rs 500 to Rs 2,000 (state-specific) |

**ERP Alert Rule**: Trigger alerts 5 days before each deadline. Color code:
- Green: Filed and paid
- Yellow: Payment due within 5 days
- Red: Overdue (past deadline)
- Black: Not applicable this month
