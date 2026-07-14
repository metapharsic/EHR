# TDS Filing — Metapharsic Lifesciences ERP

## What is TDS in This ERP Context

Tax Deducted at Source (TDS) applies at two levels in this system:

1. **Salary TDS (Section 192)** — deducted monthly from employee salary during payroll run
2. **Vendor TDS (Sections 194C / 194H / 194I / 194J / 194Q)** — deducted at time of vendor payment

Both flow through the ERP. Salary TDS originates from HR Payroll. Vendor TDS originates from Purchase and Accounting vouchers.

---

## TDS Section Reference (Pharma Context)

| Section | Nature of Payment | Threshold | Rate (PAN) | Rate (No PAN) | ERP Source |
|---|---|---|---|---|---|
| 192 | Salary | As per slab | Slab rate | 20% | hr_payroll → salary_slips |
| 194C (Individual) | Contractor / sub-contractor | Rs 30,000 single / Rs 1,00,000 annual | 1% | 20% | purchase_orders, payment_vouchers |
| 194C (Company) | Contractor / sub-contractor | Same | 2% | 20% | purchase_orders, payment_vouchers |
| 194H | Commission / brokerage | Rs 15,000 | 5% | 20% | pcd_commissions |
| 194I(a) | Rent — plant & machinery | Rs 2,40,000 annual | 2% | 20% | payment_vouchers (rent) |
| 194I(b) | Rent — land / building | Rs 2,40,000 annual | 10% | 20% | payment_vouchers (rent) |
| 194J | Professional / technical fees | Rs 30,000 | 10% (Prof) / 2% (Tech) | 20% | payment_vouchers |
| 194Q | Purchase of goods | Rs 50,00,000 annual from one seller | 0.1% | 5% | purchase_orders (if applicable) |

**194Q Applicability Rule**: Only if the buyer's turnover > Rs 10 Crore in the previous FY AND total purchases from a single seller exceed Rs 50 lakh in the current FY.

---

## DB Tables for TDS

```
tds_entries              — every TDS deduction record (salary + vendor)
tds_challans             — challan payments made to government (ITNS 281)
hr_tds_workings          — salary TDS working sheet per employee per month
salary_slips             — source for Section 192 TDS amounts
pcd_commissions          — source for Section 194H TDS on partner commissions
purchase_invoices        — source for 194C / 194J / 194Q TDS on vendor payments
payment_vouchers         — triggers TDS deduction on vendor payments
parties                  — vendor PAN, TAN verification
```

### tds_entries Schema

```sql
CREATE TABLE IF NOT EXISTS tds_entries (
  id              SERIAL PRIMARY KEY,
  financial_year  VARCHAR(7) NOT NULL,        -- e.g. '2025-26'
  month           INTEGER NOT NULL,            -- 1-12
  section         VARCHAR(10) NOT NULL,        -- '192', '194C', '194H', etc.
  deductee_type   VARCHAR(20),                 -- 'Individual', 'Company', 'HUF'
  deductee_name   VARCHAR(255) NOT NULL,
  deductee_pan    VARCHAR(10),
  payment_date    DATE NOT NULL,
  payment_amount  DECIMAL(15,2) NOT NULL,      -- gross payment before TDS
  tds_rate        DECIMAL(5,2) NOT NULL,
  tds_amount      DECIMAL(15,2) NOT NULL,      -- computed: payment_amount * tds_rate / 100
  surcharge       DECIMAL(15,2) DEFAULT 0,
  cess            DECIMAL(15,2) DEFAULT 0,
  total_tds       DECIMAL(15,2) NOT NULL,      -- tds_amount + surcharge + cess
  challan_id      INTEGER REFERENCES tds_challans(id),
  source_type     VARCHAR(20) NOT NULL,        -- 'SALARY', 'VENDOR', 'COMMISSION'
  source_id       INTEGER,                     -- salary_slip.id or purchase_invoice.id
  nature_of_payment VARCHAR(255),
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### tds_challans Schema

```sql
CREATE TABLE IF NOT EXISTS tds_challans (
  id              SERIAL PRIMARY KEY,
  challan_number  VARCHAR(50) NOT NULL,        -- BSR code + challan number
  bsr_code        VARCHAR(7) NOT NULL,
  challan_date    DATE NOT NULL,
  section         VARCHAR(10) NOT NULL,
  financial_year  VARCHAR(7) NOT NULL,
  month           INTEGER NOT NULL,
  amount_paid     DECIMAL(15,2) NOT NULL,
  bank_name       VARCHAR(100),
  acknowledgement_no VARCHAR(50),
  status          VARCHAR(20) DEFAULT 'Paid',  -- Paid, Pending
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Monthly TDS Workflow — Step by Step

### STEP 1: Identify Deductions for the Month

**Salary TDS (Section 192)**
```
POST /api/hr/payroll/run  (payroll for the month)
  |
  v
hrPayrollEngine.computeTDS(employee, { regime, financial_year })
  |
  v
Result stored in:
  salary_slips.tds_amount
  hr_tds_workings (detailed workings per employee)
  |
  v
Aggregate: SELECT SUM(tds_amount) FROM salary_slips
           WHERE month=$month AND year=$year AND status != 'Draft'
```

**Vendor TDS (194C / 194H / 194J / 194Q)**
```
On every payment_voucher POST or purchase_invoice approval:
  |
  v
Check: does this payment cross the TDS threshold for this section?
  |
  YES → compute TDS:
        tds_amount = payment_amount * tds_rate / 100
        INSERT INTO tds_entries (section, deductee_name, deductee_pan, ...)
  |
  v
Net payment to vendor = payment_amount - tds_amount
Journal Entry:
  DR  Vendor Ledger (Creditors)        [gross amount]
  CR  Cash/Bank                        [net after TDS]
  CR  TDS Payable (Liability account)  [TDS amount]
```

**Commission TDS (194H — PCD Partners)**
```
On pcd_commissions approval:
  |
  v
If commission_amount > Rs 15,000 in the year:
  tds_amount = commission_amount * 0.05
  INSERT INTO tds_entries (section='194H', source_type='COMMISSION', source_id=commission_id)
  Net commission paid = commission_amount - tds_amount
```

---

### STEP 2: Monthly TDS Computation Report

```
GET /api/tds/monthly-summary?month=6&year=2026&financial_year=2025-26
  |
  v
Returns:
{
  "section192": {
    "employees": 12,
    "grossSalary": 450000,
    "tdsDeducted": 28000
  },
  "section194C": {
    "transactions": 3,
    "grossPayment": 120000,
    "tdsDeducted": 2400
  },
  "section194H": {
    "commissions": 5,
    "grossCommission": 85000,
    "tdsDeducted": 4250
  },
  "totalTds": 34650,
  "challansRequired": [
    { "section": "192", "amount": 28000, "dueDate": "2026-07-07" },
    { "section": "194C/H/J", "amount": 6650, "dueDate": "2026-07-07" }
  ]
}
```

---

### STEP 3: Pay TDS Challan (by 7th of next month)

```
POST /api/tds/challans
Body:
{
  "challanNumber": "0280123456",
  "bsrCode": "0280123",
  "challanDate": "2026-07-05",
  "section": "192",
  "financialYear": "2025-26",
  "month": 6,
  "amountPaid": 28000,
  "bankName": "HDFC Bank",
  "acknowledgementNo": "2026070512345"
}
  |
  v
ACID Transaction:
  INSERT INTO tds_challans
  UPDATE tds_entries SET challan_id = $challanId
         WHERE section='192' AND month=6 AND year=2026
  POST GL entry:
    DR  TDS Payable (Liability)   28000
    CR  Bank                      28000
  COMMIT
```

**Challan Verification**: After paying, link challan to all `tds_entries` for that section/month.
Unlinked entries show up in `GET /api/tds/unlinked` — must be cleared before return filing.

---

### STEP 4: TDS Return Filing

**Quarterly deadlines for return filing**:

| Quarter | Period | Salary (24Q) | Non-Salary (26Q) |
|---|---|---|---|
| Q1 | April – June | 31 July | 31 July |
| Q2 | July – September | 31 October | 31 October |
| Q3 | October – December | 31 January | 31 January |
| Q4 | January – March | 31 May | 15 May |

**Return preparation flow**:
```
GET /api/tds/return-data?quarter=Q1&financial_year=2025-26&form=26Q
  |
  v
Generates FVU-compatible data:
  - Deductor details (TAN, PAN, company name, address)
  - Challan details (BSR code, date, amount, challan number)
  - Deductee details (PAN, name, amount paid, TDS amount, section)
  |
  v
Export as .txt file → upload to TRACES portal / TDS FVU software
```

---

### STEP 5: Form 16 / 16A Generation

**Form 16** (Salary — Section 192):
```
GET /api/tds/form16?employee_id=UUID&financial_year=2025-26
  |
  v
Consolidates from:
  salary_slips (12 months of salary breakdown)
  hr_tds_workings (monthly TDS computation)
  tds_challans (challan details for verification)
  |
  v
Returns PDF-ready data:
  - Employee details (name, PAN, designation)
  - Employer details (TAN, PAN, address)
  - Salary breakup (Basic, HRA, allowances)
  - Deductions (80C, 80D, HRA exemption, LTA)
  - Tax computation (gross income, deductions, taxable income, tax)
  - Monthly TDS schedule with challan references
```

**Form 16A** (Non-Salary — 194C/194H/194I/194J):
```
GET /api/tds/form16a?party_id=$id&quarter=Q1&financial_year=2025-26
  |
  v
Consolidates from:
  tds_entries for the party for the quarter
  tds_challans linked to those entries
  |
  v
Returns certificate: deductee PAN, amount paid, TDS deducted, challan details
```

---

## TDS Reconciliation with 26AS / AIS

After filing returns, reconcile deductee's 26AS data:
```
GET /api/tds/reconciliation?financial_year=2025-26
  |
  v
Compares:
  tds_entries (what ERP deducted)
  vs
  26AS data (what TRACES shows as credited to deductee)

Flags:
  - PAN mismatch → deductee won't get credit
  - Amount mismatch → short deduction risk
  - Missing challan → unmatched TDS
  - Quarter mismatch → wrong period booking
```

---

## TDS Late Filing Penalties

| Violation | Penalty |
|---|---|
| Late deduction | 1% per month from deduction date to actual deduction |
| Late deposit | 1.5% per month from deduction date to deposit date |
| Late return filing | Rs 200 per day (max = TDS amount) |
| Non-filing | Rs 10,000 to Rs 1,00,000 |
| Wrong PAN | 20% TDS rate applies instead of normal rate |

**ERP Alert Rule**: Flag in dashboard if:
- Challan not paid by 7th of next month
- Return due within 15 days and not yet filed
- Any `tds_entries` with `deductee_pan IS NULL` (wrong PAN risk)

---

## API Routes Summary

```
GET  /api/tds/monthly-summary          → TDS computation summary for month
GET  /api/tds/entries                  → All TDS deduction records (filterable)
POST /api/tds/entries                  → Manual TDS entry (for adjustment)
GET  /api/tds/challans                 → All challan payments
POST /api/tds/challans                 → Record challan payment
PUT  /api/tds/challans/:id             → Update challan (add acknowledgement no)
GET  /api/tds/unlinked                 → Entries not yet linked to a challan
POST /api/tds/link-challan             → Link multiple entries to a challan
GET  /api/tds/return-data              → Generate return data (24Q / 26Q)
GET  /api/tds/form16/:employeeId       → Form 16 data for employee
GET  /api/tds/form16a/:partyId         → Form 16A data for vendor/partner
GET  /api/tds/reconciliation           → Compare ERP deductions vs 26AS
GET  /api/tds/compliance-status        → Current month compliance dashboard
GET  /api/tds/alerts                   → Overdue challans, missing PANs, upcoming deadlines
```

---

## Integration Points

| Module | TDS Integration |
|---|---|
| HR Payroll | `salary_slips.tds_amount` feeds Section 192 entries on payroll run |
| Purchase | Vendor payments trigger 194C / 194J / 194Q computation |
| PCD Network | Commission payments trigger 194H computation |
| Accounting | TDS Payable is a liability account; challan payment clears it |
| Compliance | TDS alerts (missing PAN, overdue challan) feed compliance dashboard |
| Audit Logs | Every TDS deduction and challan payment writes to `audit_logs` |
