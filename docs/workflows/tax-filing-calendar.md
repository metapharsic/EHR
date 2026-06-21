# Monthly Tax Filing Calendar — Metapharsic Lifesciences ERP

## The Golden Rule

No month is "done" until ALL rows in the compliance checklist below are marked complete.
The ERP compliance dashboard (`GET /api/compliance/monthly-status`) reflects this in real time.

---

## Monthly Compliance Master Checklist

Run this checklist every month after the period closes (day 1 of next month).

### WEEK 1 (Days 1–7): CLOSE & DEPOSIT

```
DAY 1-2: PERIOD CLOSE
  [ ] Lock the month in acc_periods (set is_locked = true for previous month)
  [ ] Verify all sales invoices for the month are in status = 'Completed'
  [ ] Verify all purchase invoices for the month are approved
  [ ] Run payroll for all active employees (POST /api/hr/payroll/run)
  [ ] Approve all salary slips (status: Draft → Approved)
  [ ] Confirm TDS amounts on all salary slips are correct

DAY 3-5: COMPUTE
  [ ] Run TDS monthly summary (GET /api/tds/monthly-summary)
  [ ] Generate Section 192 TDS list (salary)
  [ ] Generate Section 194C / 194H / 194J / 194Q TDS list (vendors/commissions)
  [ ] Verify all deductee PANs are present (no null PAN rows in tds_entries)
  [ ] Run GSTR-1 data export (GET /api/gst/gstr1) — verify all invoices captured
  [ ] Check for any credit notes / debit notes not yet linked to original invoices

DAY 7: TDS DEPOSIT DEADLINE  ← HARD DEADLINE
  [ ] Pay TDS challan ITNS 281 for Section 192 (salary TDS)
  [ ] Pay TDS challan ITNS 281 for Section 194C / 194H / 194I / 194J / 194Q
  [ ] Record challan details in ERP (POST /api/tds/challans)
  [ ] Link challan to all tds_entries for this month (POST /api/tds/link-challan)
  [ ] Verify: GET /api/tds/unlinked → should return empty list
  [ ] Pay GL entry: DR TDS Payable / CR Bank
```

---

### WEEK 2 (Days 8–15): GSTR-1 & STATUTORY

```
DAY 10: GSTR-7 (if applicable)
  [ ] Only if company is TDS deductor under GST (rare for pharma)
  [ ] File GSTR-7 on GST portal — TDS deducted on GST payments

DAY 11: GSTR-1 DEADLINE  ← HARD DEADLINE
  [ ] Run GSTR-1 export from ERP (GET /api/gst/gstr1?month=M&year=YYYY)
  [ ] Verify sections:
       B2B invoices (party GSTIN present)
       B2C Large (interstate invoices > Rs 2.5 lakh)
       B2C Small (all other B2C)
       CDNR (credit/debit notes for B2B)
       CDNUR (credit/debit notes for B2C)
       HSN Summary (product-wise tax summary)
       Documents issued (invoice number series)
  [ ] Upload / file on GST portal
  [ ] Record confirmation: update gst_filings table (status = 'Filed')
  [ ] Note: Late filing penalty Rs 50/day (Rs 20/day if nil return)

DAY 13: GSTR-2B AUTO-POPULATED
  [ ] Download GSTR-2B from GST portal
  [ ] Import into ERP or run reconciliation (GET /api/gst/gstr2?recon=true)
  [ ] Match GSTR-2B entries against purchase_invoices in ERP
  [ ] Flag mismatches:
       Supplier filed but ERP has no matching invoice → get invoice copy
       ERP has invoice but supplier not filed → follow up with supplier
       Amount mismatch → verify and correct
  [ ] Finalize eligible ITC (Input Tax Credit)

DAY 15: PF DEPOSIT DEADLINE  ← HARD DEADLINE
  [ ] Generate PF contribution data from ERP:
       GET /api/hr/payroll/pf-register?month=M&year=YYYY
  [ ] Verify: Employee PF = 12% of Basic, Employer PF = 13% of Basic
  [ ] Generate ECR file (Electronic Challan cum Return) for EPFO portal
  [ ] Pay PF challan on EPFO Unified Portal
  [ ] Record payment in ERP (update hr_pf_registers)
  [ ] Generate UAN-wise contribution statement

DAY 15: ESIC DEPOSIT DEADLINE  ← HARD DEADLINE
  [ ] Generate ESIC contribution data:
       GET /api/hr/payroll/esic-register?month=M&year=YYYY
  [ ] Verify: Employee ESIC = 0.75% of gross, Employer ESIC = 3.25% of gross
  [ ] Only for employees with gross salary ≤ Rs 21,000/month
  [ ] Pay ESIC challan on ESIC portal
  [ ] Record payment in ERP (update hr_esic_registers)
  [ ] Download contribution statement
```

---

### WEEK 3 (Days 16–20): GSTR-3B & TAX PAYMENT

```
DAY 16-19: PREPARE GSTR-3B
  [ ] Finalize output tax from GSTR-1:
       Total IGST, CGST, SGST on outward supplies
  [ ] Finalize ITC from GSTR-2B:
       Eligible IGST, CGST, SGST on inward supplies
       Less: Ineligible ITC (section 17(5) blocked credits)
            - Motor vehicles (unless pharma transport)
            - Food, beverages
            - Club memberships
            - Construction (capex)
  [ ] Compute net tax payable:
       Net IGST = Output IGST - ITC IGST
       Net CGST = Output CGST - ITC CGST
       Net SGST = Output SGST - ITC SGST
  [ ] If ITC > Output tax → carry forward excess (no refund in most cases)

DAY 20: GSTR-3B DEADLINE  ← HARD DEADLINE
  [ ] Pay GST challan for net tax payable (if positive)
  [ ] File GSTR-3B on GST portal
  [ ] Record confirmation in ERP: update gst_filings table (status = 'Filed')
  [ ] Note: Late filing penalty Rs 50/day (Rs 20/day for nil)
  [ ] Note: Interest on late payment = 18% per annum
```

---

### WEEK 4 (Days 21–31): PT, RECONCILIATION & CLOSE

```
DAY 21-25: RECONCILIATION
  [ ] Reconcile TDS payable GL account:
       Opening balance + TDS deducted this month - Challan paid = Closing balance
       Closing balance should = 0 (fully deposited)
  [ ] Reconcile GST payable GL accounts (CGST/SGST/IGST Payable)
  [ ] Reconcile PF Payable and ESIC Payable GL accounts
  [ ] Run trial balance and verify all statutory liabilities are cleared
  [ ] Run debtors aging — flag overdue receivables for follow-up
  [ ] Run creditors aging — confirm all vendor dues are settled

DAY 28-31: PT PAYMENT (state-specific)
  [ ] Maharashtra: due by last day of month
  [ ] Karnataka: due by last day of month
  [ ] Gujarat: due by 15th of next month
  [ ] Generate PT liability from ERP:
       GET /api/hr/payroll/pt-register?month=M&year=YYYY
  [ ] PT slab (Maharashtra example):
       Salary Rs 10,001-15,000 → PT Rs 150/month
       Salary > Rs 15,000 → PT Rs 200/month (Rs 300 in Feb)
  [ ] Pay PT challan at respective state treasury / online
  [ ] Record payment in ERP

MONTH-END: FINAL SIGN-OFF
  [ ] All challans paid and recorded in ERP
  [ ] All returns filed (GSTR-1, GSTR-3B, TDS — if quarter-end)
  [ ] All GL accounts for statutory liabilities show zero balance
  [ ] Compliance dashboard shows 100% for this month
  [ ] Lock the period in acc_periods (if not already done)
  [ ] Archive: save all filed return acknowledgements in DMS module
```

---

## Annual / Quarterly Filing Calendar

### TDS Returns (Quarterly)

| Quarter | Period | Filing Deadline (24Q) | Filing Deadline (26Q) |
|---|---|---|---|
| Q1 | April – June | 31 July | 31 July |
| Q2 | July – September | 31 October | 31 October |
| Q3 | October – December | 31 January | 31 January |
| Q4 | January – March | 31 May | 15 May |

After filing each quarter:
```
[ ] Generate and issue Form 16A to all vendors (within 15 days of filing)
[ ] Generate Form 16 to all employees (only after Q4 filing, by 15 June)
[ ] Reconcile with TRACES 26AS data
[ ] Download Justification Report from TRACES — check for defaults/short deductions
```

### GST Annual Return

| Return | Due Date | Notes |
|---|---|---|
| GSTR-9 | 31 December (for previous FY) | Annual consolidated return |
| GSTR-9C | 31 December | Reconciliation statement (if turnover > Rs 5 Crore) |

### Income Tax

| Filing | Due Date | Notes |
|---|---|---|
| Advance Tax Q1 | 15 June | 15% of estimated annual tax |
| Advance Tax Q2 | 15 September | 45% cumulative |
| Advance Tax Q3 | 15 December | 75% cumulative |
| Advance Tax Q4 | 15 March | 100% cumulative |
| ITR Filing | 31 October (audit cases) | Corporate tax return |

---

## ERP Compliance Dashboard API

```
GET /api/compliance/monthly-status?month=6&year=2026
  |
  v
Returns:
{
  "month": "June 2026",
  "overallStatus": "IN_PROGRESS",  // PENDING / IN_PROGRESS / COMPLETED / OVERDUE
  "items": [
    { "task": "Payroll Run", "dueDate": "2026-06-30", "status": "DONE", "reference": "PR-202606" },
    { "task": "TDS Deposit", "dueDate": "2026-07-07", "status": "DONE", "challans": ["ITNS281-001", "ITNS281-002"] },
    { "task": "GSTR-1 Filing", "dueDate": "2026-07-11", "status": "PENDING", "invoiceCount": 234 },
    { "task": "PF Deposit", "dueDate": "2026-07-15", "status": "PENDING", "amount": 45000 },
    { "task": "ESIC Deposit", "dueDate": "2026-07-15", "status": "PENDING", "amount": 12000 },
    { "task": "GSTR-3B Filing", "dueDate": "2026-07-20", "status": "PENDING", "netTax": 85000 },
    { "task": "PT Payment", "dueDate": "2026-07-31", "status": "PENDING", "amount": 4800 }
  ],
  "alerts": [
    "3 purchase invoices missing supplier GSTIN — will not appear in GSTR-2B",
    "2 employees missing PAN — TDS rate will be 20% instead of slab rate",
    "GSTR-1 due in 3 days — 234 invoices pending upload"
  ]
}
```

---

## Penalty Prevention Rules

The ERP MUST proactively alert (not just report) on these conditions:

| Condition | Alert Timing | Alert Channel |
|---|---|---|
| TDS challan not paid | 3 days before 7th | Dashboard + Email |
| GSTR-1 not filed | 3 days before 11th | Dashboard + Email |
| PF/ESIC not paid | 3 days before 15th | Dashboard + Email |
| GSTR-3B not filed | 3 days before 20th | Dashboard + Email |
| Missing deductee PAN | Immediately on payment | Dashboard warning |
| Missing supplier GSTIN | On purchase invoice save | Form validation warning |
| GSTR-2B mismatch | After 13th of each month | Reconciliation report |
| TDS return due (quarterly) | 15 days before deadline | Dashboard + Email |
| Form 16 not issued | After Q4 TDS return filing | HR dashboard |
| Advance tax due | 7 days before each due date | Finance dashboard |

---

## Filing Status DB Table

```sql
CREATE TABLE IF NOT EXISTS compliance_filings (
  id              SERIAL PRIMARY KEY,
  filing_type     VARCHAR(50) NOT NULL,       -- 'GSTR1', 'GSTR3B', 'TDS_26Q', 'TDS_24Q', 'PF', 'ESIC', 'PT', 'GSTR9'
  period_month    INTEGER,                    -- 1-12 (null for annual)
  period_quarter  VARCHAR(5),                 -- 'Q1', 'Q2', 'Q3', 'Q4' (for TDS returns)
  financial_year  VARCHAR(7) NOT NULL,        -- '2025-26'
  due_date        DATE NOT NULL,
  filed_date      DATE,
  status          VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, FILED, OVERDUE, NIL
  acknowledgement_no VARCHAR(100),
  amount_paid     DECIMAL(15,2),
  penalty_paid    DECIMAL(15,2) DEFAULT 0,
  notes           TEXT,
  filed_by        UUID REFERENCES users(id),
  document_id     INTEGER REFERENCES dms_documents(id),  -- archived acknowledgement
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Month-End Close Sequence (Ordered)

This is the EXACT order operations must happen. Never run out of sequence.

```
1. Run Payroll                        (HR module)
2. Approve Salary Slips               (HR module)
3. Compute TDS on Salary              (automatic on payroll run)
4. Compute TDS on Vendor Payments     (automatic on payment vouchers)
5. Pay TDS Challan                    (by 7th)
6. Record Challan in ERP              (POST /api/tds/challans)
7. Link Challan to Entries            (POST /api/tds/link-challan)
8. Export GSTR-1 Data                 (GET /api/gst/gstr1)
9. File GSTR-1 on Portal              (by 11th)
10. Download GSTR-2B                  (after 13th)
11. Reconcile GSTR-2B with ERP        (GET /api/gst/gstr2?recon=true)
12. Pay PF Challan                    (by 15th)
13. Record PF in ERP                  (update hr_pf_registers)
14. Pay ESIC Challan                  (by 15th)
15. Record ESIC in ERP                (update hr_esic_registers)
16. Compute Net GST Payable           (GSTR-3B computation)
17. Pay GST Challan                   (before 20th)
18. File GSTR-3B on Portal            (by 20th)
19. Record GST Filing in ERP          (update compliance_filings)
20. Pay PT Challan                    (by last day / state rule)
21. Record PT in ERP                  (update hr_pt_registers)
22. Reconcile All Statutory GL Accounts
23. Lock Period in acc_periods
24. Archive All Acknowledgements in DMS
25. Mark Month as Closed in compliance_filings
```
