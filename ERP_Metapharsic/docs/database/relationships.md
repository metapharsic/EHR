# Database Relationships — Metapharsic Lifesciences ERP

## Core Relationship Matrix

| From | Relationship | To | Join Column | Notes |
|---|---|---|---|---|
| batches | many -> one | products | batches.product_id | Available qty = stock - reserved_qty |
| sales_invoices | many -> one | parties | sales_invoices.party_id | |
| sales_invoice_items | many -> one | sales_invoices | sales_invoice_items.invoice_id | |
| sales_invoice_items | many -> one | products | sales_invoice_items.product_id | |
| orders | many -> one | parties | orders.party_id | |
| order_items | many -> one | orders | order_items.order_id | |
| order_items | many -> one | products | order_items.product_id | |
| reserved_stock | many -> one | orders | reserved_stock.order_id | Deleted on shipment/cancel |
| reserved_stock | many -> one | batches | reserved_stock.batch_id | |
| pos_bills | many -> one | parties | pos_bills.party_id | |
| pos_bill_items | many -> one | pos_bills | pos_bill_items.bill_id | |
| pos_bill_items | many -> one | batches | pos_bill_items.batch_id | |
| purchase_orders | many -> one | parties | purchase_orders.supplier_id | parties.type = Creditor |
| purchase_order_items | many -> one | purchase_orders | purchase_order_items.po_id | |
| goods_received_notes | many -> one | purchase_orders | goods_received_notes.po_id | |
| grn_items | many -> one | goods_received_notes | grn_items.grn_id | |
| qc_records | many -> one | batches | qc_records.batch_id | QC controls batch availability |
| stock_ledger_entries | many -> one | products | stock_ledger_entries.product_id | |
| stock_ledger_entries | many -> one | batches | stock_ledger_entries.batch_id | |
| general_ledger | many -> one | chart_of_accounts | general_ledger.account_id | |
| general_ledger | many -> one | journal_vouchers | general_ledger.voucher_id | |
| journal_voucher_entries | many -> one | journal_vouchers | journal_voucher_entries.voucher_id | |
| pcd_partners | many -> one | parties | pcd_partners.converted_party_id | Created by syncPartnerToParty() |
| leads | many -> one | users | leads.assigned_to | |
| employees | many -> one | hr_departments | employees.department_id | |
| employees | many -> one | hr_designations | employees.designation_id | |
| hr_departments | self-ref | hr_departments | hr_departments.parent_dept_id | Tree via WITH RECURSIVE |
| hr_attendance | many -> one | employees | hr_attendance.employee_id | |
| hr_leaves | many -> one | employees | hr_leaves.employee_id | |
| hr_leave_balances | many -> one | employees | hr_leave_balances.employee_id | Denormalized remaining balance |
| salary_slips | many -> one | employees | salary_slips.employee_id | |
| salary_slips | many -> one | hr_salary_structures | salary_slips.structure_id | |
| production_orders | many -> one | boms | production_orders.bom_id | |
| boms | many -> one | products | boms.product_id | One Active BOM per product |
| fixed_assets | many -> one | asset_categories | fixed_assets.category_id | |
| hr_asset_allocations | many -> one | fixed_assets | hr_asset_allocations.asset_id | |
| hr_asset_allocations | many -> one | employees | hr_asset_allocations.employee_id | |
| dms_documents | many -> one | dms_folders | dms_documents.folder_id | |
| dms_versions | many -> one | dms_documents | dms_versions.document_id | Version history |
| report_jobs | standalone | — | — | PM2-safe shared queue |

## Key Invariants

### Stock Availability Chain
```
products.current_stock  (DENORMALIZED — cache only)
       |
       v
batches.stock           (AUTHORITATIVE live qty)
       |
       v
batches.reserved_qty    (from OMS approved orders)
       |
       v
available_qty = stock - COALESCE(reserved_qty, 0)
```
**Rule**: Never sell/reserve more than `available_qty`.

### Party Balance Chain
```
sales_invoices / pos_bills  -->  parties.current_balance (INCREASE)
receipt_vouchers            -->  parties.current_balance (DECREASE)
```
**Rule**: `current_balance` is denormalized. Update on every transaction. Recompute from GL only on party detail view.

### QC Unlock Chain
```
Purchase GRN    -->  qc_records (status='Pending')  -->  batches (status='QC_Pending')
QC Pass         -->  qc_records (status='Passed')   -->  batches (status='Active')
QC Fail         -->  qc_records (status='Failed')   -->  batches (status='Rejected', stock=0)
```
**Rule**: Stock is NOT available until QC passes.

### BOM Version Chain
```
BOM v1.0 (Active)
  |-- Edit -->
BOM v1.0 (Superseded)  +  BOM v1.1 (Active)
```
**Rule**: Only ONE Active BOM per `product_id`.

### 3-Way Match Gate
```
purchase_orders (PO)
  + goods_received_notes (GRN)
  + supplier_invoices (Invoice)
  = 3-Way Match Complete  -->  purchase_orders.status = 'Completed'
```
**Rule**: Missing any one leg blocks completion.

## Soft Delete Patterns by Table

| Table | Soft Delete Column | Hard Delete Allowed? |
|---|---|---|
| products | `is_active = false` OR `deleted_at IS NOT NULL` | No |
| employees | `status = 'Terminated'/'Resigned'` | No |
| dms_documents | `status = 'Deleted'` | No |
| fixed_assets | `status = 'Disposed'` | No |
| qc_records | `status = 'Voided'` | No |
| audit_logs | — | NEVER — append-only |
| financial_audit_log | — | NEVER — append-only |
| journal_vouchers | `status = 'Reversed'` | No |
| pdc_cheques | `status = 'Cleared'/'Bounced'` | No |
| sales_invoices | `status = 'Cancelled'` | No |
