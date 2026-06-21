# Dependency Map — Metapharsic Lifesciences ERP

## Cross-Module Dependencies

Before any change, evaluate impact on these cross-cutting concerns:

| Concern | Where It Lives | Who Writes To It |
|---|---|---|
| Audit Logging | `audit_logs`, `crm_audit_log`, `dms_audit_trail`, `financial_audit_log` | Every module on every mutation |
| Stock Ledger | `stock_ledger_entries` via `ledgerHelper.postToStockLedger()` | OMS (ship), Purchase (GRN), POS (bill), Inventory (adjust), Manufacturing (production) |
| General Ledger | `general_ledger` via `ledgerHelper.postToLedger()` / `postToGeneralLedger()` | Accounting (JV), POS (bill), Sales (invoice), Purchase (invoice), Payroll (run) |
| Party Balance | `parties.current_balance` (denormalized) | POS, Sales, Accounting (receipt/payment vouchers) |
| QC Gate | `qc_records` | Purchase (GRN creates pending QC), Manufacturing (production creates batch in QC_Pending) |
| H1 Register | `h1_register` | POS, Wholesale Sales (mandatory for Schedule H1 drugs) |
| DeerFlow Triggers | `audit_logs` + optional HTTP to DeerFlow | HR (onboarding), Accounting (JV posted), OMS (SLA breach), Manufacturing (production complete) |
| Notifications | `compliance_notification_settings` + email | Compliance module (license expiry, temp breach) |
| Report Jobs | `report_jobs` (PostgreSQL) | Analytics (intelligence reports) — PM2 cluster-safe queue |

## Module Inter-Dependencies

```
CRM Lead Conversion
  --> parties (INSERT Debtor)
  --> pcd_partners (INSERT if pharma lead)
  --> lead_activities (LOG)

Purchase GRN
  --> goods_received_notes (INSERT)
  --> batches (UPDATE stock IN)
  --> stock_ledger_entries (via ledgerHelper)
  --> qc_records (CREATE Pending)

QC Pass
  --> batches (UPDATE status='Active')
  --> audit_logs (LOG)

QC Fail
  --> batches (UPDATE status='Rejected', stock=0)
  --> audit_logs (LOG)
  --> DeerFlow: INVENTORY_SYNC

OMS Order Approved
  --> reserved_stock (INSERT FIFO reservations)
  --> batches (UPDATE reserved_qty, SELECT FOR UPDATE)

OMS Order Shipped
  --> stock_ledger_entries (OUT via ledgerHelper)
  --> reserved_stock (DELETE)
  --> batches (UPDATE stock)
  --> order_status_history (INSERT)

OMS Order Cancelled (after Approved/Processing)
  --> reserved_stock (DELETE)
  --> batches (RESTORE reserved_qty)

POS Bill Created
  --> pos_bills + pos_bill_items (INSERT)
  --> batches (DEDUCT stock, SELECT FOR UPDATE)
  --> stock_ledger_entries (OUT via ledgerHelper)
  --> h1_register (INSERT if Schedule H1)
  --> general_ledger (via ledgerHelper)

Sales Invoice Created
  --> sales_invoices + sales_invoice_items (INSERT)
  --> stock_ledger_entries (OUT)
  --> general_ledger (debit/credit)
  --> parties.current_balance (UPDATE)

Payroll Run
  --> salary_slips (INSERT per employee)
  --> general_ledger (via ledgerHelper)
  --> DeerFlow: PAYROLL_RUN

Manufacturing Production Complete
  --> batches (INSERT new batch, status='QC_Pending')
  --> stock_ledger_entries (IN)
  --> raw_materials (DEDUCT consumed materials)
  --> DeerFlow: PRODUCTION_COMPLETE

Employee Created
  --> employees (INSERT)
  --> DeerFlow: EMPLOYEE_ONBOARDING_INITIATED
```

## Shared Utilities — Mandatory Usage

| Utility | Location | Must Be Used For |
|---|---|---|
| `ledgerHelper.postToStockLedger()` | `server/utils/ledgerHelper.js` | ALL stock IN/OUT movements |
| `ledgerHelper.postToLedger()` | `server/utils/ledgerHelper.js` | ALL financial GL entries |
| `ledgerHelper.findAccount()` | `server/utils/ledgerHelper.js` | Resolving account names to IDs |
| `hrPayrollEngine.computeFullPayslip()` | `server/utils/hrPayrollEngine.js` | Payroll computation |
| `triggerWorkflow()` | `server/services/deerflowClient.js` | All DeerFlow triggers (non-blocking) |
| `syncPartnerToParty()` | Used in PCD routes | PCD partner -> parties conversion |
| `verify2FAMiddleware` | Auth middleware | All inventory + accounting write routes |
| `asyncRoute()` | Defined in each route file | ALL Express handlers |

## GST Engine Rules

```
company.state === party.state  -->  CGST (50%) + SGST (50%)
company.state !== party.state  -->  IGST (100%)

Rates: from tax_configurations table by HSN code
Company state: from erp_settings key='company' -> state field
```

## Credit Limit Enforcement Points

Credit limit is enforced in THREE places — any change to credit check must be updated in all three:

1. `server/routes/pos.js` — POS billing
2. `server/routes/sales.js` — Wholesale sales
3. `server/routes/oms.js` — OMS order approval

Rule: `parties.current_balance + new_invoice_amount > parties.credit_limit` -> 400 error
