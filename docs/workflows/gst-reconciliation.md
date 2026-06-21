# GST Reconciliation — Metapharsic Lifesciences ERP

## Overview

GST reconciliation has three layers in this ERP:

1. **Internal reconciliation** — verify ERP invoices match what was filed in GSTR-1
2. **GSTR-2B reconciliation** — match ERP purchase invoices against supplier-filed data
3. **Annual reconciliation** — GSTR-1 vs GSTR-9 vs Books of Accounts

---

## DB Tables for GST

```
sales_invoices           — outward supply source (GSTR-1)
purchase_invoices        — inward supply source (GSTR-2 / 2B)
gst_portal_data          — imported GSTR-2B data from portal
gst_reconciliation       — matched/mismatched entries between ERP and portal
gst_filings              — filed return records (GSTR-1, 3B, 9)
tax_configurations       — HSN-wise GST rates
parties                  — GSTIN of customers and suppliers
```

### gst_filings Schema

```sql
CREATE TABLE IF NOT EXISTS gst_filings (
  id              SERIAL PRIMARY KEY,
  return_type     VARCHAR(20) NOT NULL,   -- 'GSTR1', 'GSTR3B', 'GSTR7', 'GSTR9', 'GSTR9C'
  period_month    INTEGER,               -- 1-12
  financial_year  VARCHAR(7) NOT NULL,
  filing_date     DATE,
  status          VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, FILED, NIL, OVERDUE
  acknowledgement_no VARCHAR(100),
  total_tax       DECIMAL(15,2),
  igst_paid       DECIMAL(15,2) DEFAULT 0,
  cgst_paid       DECIMAL(15,2) DEFAULT 0,
  sgst_paid       DECIMAL(15,2) DEFAULT 0,
  itc_utilized    DECIMAL(15,2) DEFAULT 0,
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### gst_reconciliation Schema

```sql
CREATE TABLE IF NOT EXISTS gst_reconciliation (
  id              SERIAL PRIMARY KEY,
  financial_year  VARCHAR(7) NOT NULL,
  period_month    INTEGER NOT NULL,
  recon_type      VARCHAR(20) NOT NULL,  -- 'GSTR2B', 'GSTR1_BOOKS', 'ANNUAL'
  erp_invoice_no  VARCHAR(100),
  erp_gstin       VARCHAR(15),
  erp_amount      DECIMAL(15,2),
  erp_igst        DECIMAL(15,2),
  erp_cgst        DECIMAL(15,2),
  erp_sgst        DECIMAL(15,2),
  portal_invoice_no VARCHAR(100),
  portal_gstin    VARCHAR(15),
  portal_amount   DECIMAL(15,2),
  portal_igst     DECIMAL(15,2),
  portal_cgst     DECIMAL(15,2),
  portal_sgst     DECIMAL(15,2),
  match_status    VARCHAR(30),           -- 'MATCHED', 'MISMATCH_AMOUNT', 'ONLY_IN_ERP', 'ONLY_IN_PORTAL', 'GSTIN_MISMATCH'
  difference      DECIMAL(15,2),
  action_taken    TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  company_id      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## FLOW 1: GSTR-1 (Outward Supplies) — Monthly

### What goes into GSTR-1

```
All sales_invoices WHERE:
  DATE_TRUNC('month', invoice_date) = period
  AND status = 'Completed'
  AND company_id = $companyId

Classified into:
  B2B  → party has GSTIN
  B2C  → party has no GSTIN (or consumer)
  CDNR → credit notes / debit notes for B2B
  CDNUR → credit notes / debit notes for B2C
  EXP  → export invoices (IGST / bond)
  NIL  → nil-rated, exempted, non-GST supplies
```

### GSTR-1 Internal Audit Before Filing

```
GET /api/gst/gstr1?month=6&year=2026&validate=true
  |
  v
Pre-filing validation checks:

1. GSTIN Completeness
   SELECT COUNT(*) FROM sales_invoices si
   JOIN parties p ON p.id = si.party_id
   WHERE p.gstin IS NULL AND si.party_type = 'B2B'
   AND DATE_TRUNC('month', si.invoice_date) = period
   → Flag all B2B invoices with missing GSTIN

2. Invoice Number Sequence
   Verify no gaps in invoice number sequence for the period
   Flag any duplicate invoice numbers

3. HSN Code Coverage
   Every sales_invoice_item must have hsn_code from products table
   Missing HSN → invoice rejected on portal

4. Place of Supply
   Verify supply_state matches party.state for intra-state
   Verify IGST applied correctly for inter-state

5. Tax Amount Verification
   Re-compute GST on each invoice and compare with stored value
   Flag any rounding difference > Rs 1

6. Credit Notes Linkage
   Every credit note must reference original invoice number
   Orphan credit notes (no original invoice) flagged

Output:
{
  "readyToFile": false,
  "errors": [
    { "invoiceNo": "WHO-20260615-0003", "issue": "Missing GSTIN for B2B party 'MedCorp Pharma'" },
    { "invoiceNo": "PCD-20260601-0021", "issue": "HSN code missing for product 'Amoxicillin 500mg'" }
  ],
  "warnings": [
    { "issue": "3 invoices have rounding difference of Re 1 in GST calculation" }
  ],
  "summary": {
    "b2bInvoices": 145, "b2cInvoices": 89, "creditNotes": 4,
    "totalTaxableValue": 2840000, "totalIGST": 45000, "totalCGST": 128000, "totalSGST": 128000
  }
}
```

### GSTR-1 Data Structure (Portal Format)

```
B2B Section (per supplier GSTIN):
  Receiver GSTIN, Invoice No, Invoice Date, Invoice Value,
  Place of Supply, Reverse Charge (Y/N), Invoice Type,
  E-Commerce GSTIN, Taxable Value, IGST, CGST, SGST, Cess

B2C Large (interstate > Rs 2.5 lakh, no GSTIN):
  Place of Supply, Taxable Value, IGST, Cess

B2C Small (aggregate, state-wise):
  State, Taxable Value, IGST, CGST, SGST, Cess

CDNR (Credit/Debit Notes for B2B):
  Receiver GSTIN, Note No, Note Date, Note Type (C/D),
  Place of Supply, Taxable Value, IGST, CGST, SGST, Cess

HSN Summary:
  HSN Code, Description, UQC (Unit), Total Qty,
  Total Value, Taxable Value, IGST, CGST, SGST, Cess
```

---

## FLOW 2: GSTR-2B Reconciliation — Monthly (After 13th)

### Step-by-Step Reconciliation Process

```
STEP 1: Download GSTR-2B from GST portal (after 13th of next month)
  |
  v
STEP 2: Import into ERP
  POST /api/gst/import-2b
  Body: { month: 6, year: 2026, data: [...gstr2bJson] }
  Stored in: gst_portal_data table
  |
  v
STEP 3: Run reconciliation engine
  GET /api/gst/gstr2?recon=true&month=6&year=2026
  |
  v
Matching Algorithm:
  For each entry in gst_portal_data (supplier-filed):
    1. Match by supplier GSTIN + invoice number
    2. If matched → verify amount and tax within tolerance (Rs 1 rounding)
       MATCHED → mark eligible for ITC
    3. If invoice number not found in ERP purchase_invoices:
       ONLY_IN_PORTAL → get invoice from supplier
    4. For each purchase_invoice in ERP not found in GSTR-2B:
       ONLY_IN_ERP → supplier has not filed, ITC cannot be claimed yet
    5. If GSTIN matches but amount differs > Rs 1:
       MISMATCH_AMOUNT → verify correct amount, issue debit/credit note
    6. If invoice found but GSTIN differs:
       GSTIN_MISMATCH → critical — supplier filed under wrong GSTIN
  |
  v
STEP 4: Categorize and act on mismatches

Match Status      ITC Treatment     Action Required
─────────────────────────────────────────────────────────────────
MATCHED           Claim full ITC    None
ONLY_IN_PORTAL    Cannot claim      Contact supplier for invoice copy
ONLY_IN_ERP       Cannot claim yet  Follow up — supplier must file
MISMATCH_AMOUNT   Partial / none    Reconcile with supplier
GSTIN_MISMATCH    Cannot claim      Supplier must amend return
```

### ITC Eligibility Rules (Section 17(5) — Blocked Credits)

```
ITC ELIGIBLE:
  Raw materials (pharma APIs, excipients)
  Packaging materials
  Capital goods (machinery for manufacturing)
  Business travel and accommodation
  Advertising and marketing
  Freight and logistics (for taxable supplies)

ITC BLOCKED (cannot claim):
  Motor vehicles (unless: testing, training, transport of goods)
  Food, beverages, outdoor catering
  Club memberships
  Health services (unless for employee health mandate)
  Construction of immovable property (capex for building)
  Works contract for construction
  Personal use items

ERP Implementation:
  expense_categories table → has itc_eligible BOOLEAN field
  Every purchase_invoice_item must have expense_category_id
  ITC auto-excluded for blocked categories
```

### GSTR-2B Reconciliation Report Output

```
GET /api/gst/reconciliation-report?month=6&year=2026
  |
  v
{
  "period": "June 2026",
  "summary": {
    "totalPortalEntries": 87,
    "matched": 74,
    "onlyInPortal": 5,
    "onlyInErp": 6,
    "amountMismatch": 2,
    "gstinMismatch": 0
  },
  "eligibleITC": {
    "igst": 45000,
    "cgst": 28000,
    "sgst": 28000,
    "total": 101000
  },
  "blockedITC": {
    "reason": "Section 17(5)",
    "amount": 8500
  },
  "pendingITC": {
    "reason": "Supplier not filed",
    "amount": 12000,
    "entries": [...]
  },
  "mismatches": [...]
}
```

---

## FLOW 3: GSTR-3B (Net Tax Payment) — Monthly by 20th

### GSTR-3B Computation

```
GET /api/gst/gstr3b?month=6&year=2026
  |
  v
Table 3.1 — Outward Supplies (from GSTR-1):
  Taxable outward supplies (B2B + B2C)
  Zero-rated supplies (exports)
  Nil-rated supplies
  Exempted supplies
  Non-GST supplies
  → Compute: Total Output Tax (IGST + CGST + SGST)

Table 4 — Eligible ITC (from GSTR-2B reconciliation):
  ITC on inward supplies (other than imports)
  ITC on import of goods
  ITC on import of services
  → Less: ITC reversed (Section 17(5) + other reversals)
  → Net Eligible ITC

Table 5 — Values of exempt / nil rated / non-GST supplies

Table 6 — Payment of Tax:
  Net Tax Payable:
    IGST = Output IGST - ITC IGST
    CGST = Output CGST - ITC CGST - (excess IGST if any)
    SGST = Output SGST - ITC SGST
  Interest (if any late payment at 18% per annum)
  Late fee (if applicable Rs 50/day)
```

### Cash Ledger vs Credit Ledger Logic

```
GST has three electronic ledgers:

1. Electronic Cash Ledger — money deposited by challan
2. Electronic Credit Ledger — ITC accumulated
3. Electronic Liability Ledger — tax payable

Payment logic:
  1. First use ITC to offset liability (IGST > CGST+SGST cross-utilization allowed)
  2. Remaining liability paid from Cash Ledger
  3. If Cash Ledger insufficient → deposit via challan first

Cross-utilization order:
  IGST liability → First from IGST ITC, then from CGST ITC, then from SGST ITC
  CGST liability → Only from CGST ITC or Cash (not SGST ITC)
  SGST liability → Only from SGST ITC or Cash (not CGST ITC)

ERP GL Accounts Required:
  IGST Payable (Liability)
  CGST Payable (Liability)
  SGST Payable (Liability)
  IGST ITC Receivable (Asset)
  CGST ITC Receivable (Asset)
  SGST ITC Receivable (Asset)
```

### GSTR-3B Filing and Payment Flow

```
Step 1: Compute 3B from ERP (GET /api/gst/gstr3b)
Step 2: Verify ITC from GSTR-2B reconciliation is finalized
Step 3: Compute net payable per head (IGST / CGST / SGST)
Step 4: If payable > 0 → deposit challan (PMT-06 on GST portal)
Step 5: Record challan in ERP:
  POST /api/accounting/journal-vouchers
  {
    "entries": [
      { "accountId": <CGST_Payable_id>, "debit": 128000, "credit": 0 },
      { "accountId": <SGST_Payable_id>, "debit": 128000, "credit": 0 },
      { "accountId": <Bank_id>, "debit": 0, "credit": 256000 }
    ]
  }
Step 6: File GSTR-3B on portal (use ERP data)
Step 7: Record filing:
  POST /api/gst/filings
  { "returnType": "GSTR3B", "periodMonth": 6, "financialYear": "2025-26", "acknowledgementNo": "..." }
```

---

## FLOW 4: Annual GST Reconciliation (GSTR-9)

### Books vs Returns Comparison

```
GET /api/gst/annual-reconciliation?financial_year=2025-26
  |
  v
For each month April to March:
  Compare:
    Monthly GSTR-1 filed → vs → ERP sales_invoices (books)
    Monthly GSTR-3B filed → vs → ERP actual tax paid
    ITC claimed in GSTR-3B → vs → GSTR-2B eligible ITC

Flags:
  Invoices in books not reported in GSTR-1 → must be included in GSTR-9
  ITC claimed in 3B but not in GSTR-2B → reversal required in GSTR-9
  ITC reversed in 3B incorrectly → may be reclaimed in GSTR-9 (up to Nov filing)

GSTR-9 Table mapping:
  Table 4  → Outward supplies (from GSTR-1 data)
  Table 5  → Outward supplies on which tax not paid
  Table 6  → ITC availed (from 3B data)
  Table 7  → ITC reversed / ineligible
  Table 8  → ITC comparison (2A/2B vs availed in 3B)
  Table 9  → Tax paid (from 3B data)
  Table 10/11 → Amendments (previous year invoices in current year)
  Table 12/13 → Demand / refund
```

---

## Common GST Errors and Prevention

| Error | Impact | Prevention Rule |
|---|---|---|
| Missing GSTIN on B2B invoice | Invoice treated as B2C; buyer loses ITC | Mandatory GSTIN validation on party save |
| Wrong Place of Supply | Wrong IGST vs CGST+SGST | Auto-detect from company.state vs party.state |
| Missing HSN code | Invoice rejected on portal | Mandatory HSN on every product |
| Supplier not filing | ITC blocked for buyer | Monthly supplier filing status report |
| ITC claimed beyond 2B | Reversal with 18% interest | Never claim ITC not in GSTR-2B |
| Invoice date wrong month | Period mismatch | Validate invoice_date against open period |
| Credit note without original | Rejected on portal | Mandatory original invoice reference |
| Filing after deadline | Late fee Rs 50/day | ERP alerts 3 days before deadline |
| Reverse charge not declared | Demand + penalty | Flag RCM applicable purchases (advocate fees, GTA) |
| Export invoice as local supply | Wrong tax treatment | Party.country flag for export detection |

---

## API Routes Summary

```
GET  /api/gst/gstr1                → GSTR-1 data export
GET  /api/gst/gstr1?validate=true  → Pre-filing audit
POST /api/gst/import-2b            → Import GSTR-2B from portal
GET  /api/gst/gstr2?recon=true     → GSTR-2B reconciliation
GET  /api/gst/gstr3b               → GSTR-3B computation
GET  /api/gst/reconciliation-report → Detailed mismatch report
GET  /api/gst/annual-reconciliation → GSTR-9 preparation
POST /api/gst/filings              → Record filed return
GET  /api/gst/filings              → Filing history
GET  /api/gst/itc-summary          → ITC ledger by month
GET  /api/gst/itc-blocked          → Blocked ITC under 17(5)
GET  /api/gst/supplier-filing-status → Which suppliers have not filed
GET  /api/gst/hsn-summary          → HSN-wise supply summary
GET  /api/gst/compliance-score     → Overall GST compliance health
```
