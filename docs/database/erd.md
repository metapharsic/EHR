# ERD — Metapharsic Lifesciences ERP

## Domain Clusters

### Sales & Billing Domain
```
companies (1)
  |
  +-- parties (N)            [type: Debtor/Creditor/Both]
  |     |
  |     +-- sales_invoices (N)
  |     |     +-- sales_invoice_items (N) --> products
  |     |                                     |
  |     +-- pos_bills (N)                     +-- batches (N)
  |           +-- pos_bill_items (N) ----------+
  |
  +-- orders (N)             [OMS]
        +-- order_items (N) --> products
        +-- reserved_stock (N) --> batches
        +-- order_shipments (N)
```

### Inventory Domain
```
products (1)
  |
  +-- batches (N)
  |     +-- qc_records (N)       [QC gate controls availability]
  |     +-- reserved_stock (N)   [OMS reservations]
  |
  +-- stock_ledger_entries (N)   [via ledgerHelper only]
  +-- abc_analysis (N)
  +-- inventory_turnover_analysis (N)
  +-- dead_stock_analysis (N)
```

### Purchase Domain
```
parties (1) [type: Creditor]
  |
  +-- purchase_orders (N)
        +-- purchase_order_items (N) --> products
        +-- goods_received_notes (N)
        |     +-- grn_items (N) --> batches
        |     +-- qc_records (N)  [created on GRN]
        +-- supplier_invoices (N)
        +-- three_way_matches (N)
```

### Finance Domain
```
financial_years (1)
  |
  +-- chart_of_accounts (N)   [tree via parent_id]
  |     |
  |     +-- general_ledger (N)
  |           +-- journal_voucher_entries (N)
  |
  +-- journal_vouchers (N)
        +-- journal_voucher_entries (N)
        +-- payment_vouchers (N)
        +-- receipt_vouchers (N)
```

### HR Domain
```
companies (1)
  |
  +-- hr_departments (N)      [tree via parent_dept_id]
  |
  +-- employees (N)
        +-- hr_attendance (N)
        +-- hr_leaves (N)
        +-- hr_leave_balances (N)
        +-- hr_employee_documents (N)
        +-- salary_slips (N)
        |     [computed by hrPayrollEngine]
        +-- hr_asset_allocations (N) --> fixed_assets
        +-- hr_employee_shifts (N) --> hr_shifts
```

### Manufacturing Domain
```
products (1)
  |
  +-- boms (N)               [One Active per product]
  |
  +-- production_orders (N) --> boms
        |
        +-- batches (N)      [created on completion, status='QC_Pending']
        +-- raw_materials (N) [deducted on start]
```

### Compliance Domain
```
companies (1)
  |
  +-- drug_licenses (N)
  +-- h1_register (N)        [created in same ACID tx as Schedule H1 bills]
  +-- temperature_logs (N)
  +-- compliance_audits (N)
        +-- compliance_checklists (N) --> compliance_checklist_templates
```

## Cross-Domain Bridge Tables

| Bridge | Connects | Notes |
|---|---|---|
| `pcd_partners.converted_party_id` | pcd_partners -> parties | Created by syncPartnerToParty() on ACTIVE status |
| `hr_asset_allocations` | employees <-> fixed_assets | Asset cannot be Disposed while Allocated |
| `lead_activities` | leads -> users | Activity log on every CRM status change |
| `order_status_history` | orders -> users | Status change audit trail for OMS |
| `dms_workflows` | dms_documents -> users | Approval chain for regulated documents |
| `pcd_geospatial_insights` | pcd_partners -> visit_schedules (MR Tracker) | Bridge between ERP and MR Tracker |
| `medical_representatives` | ERP <-> MR Tracker | Authoritative source for MR data, never duplicate |
