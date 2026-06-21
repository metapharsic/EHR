# Module Map — Metapharsic Lifesciences ERP

## Module Registry

| Module | Tab Enum | Server Route File | Key Tables |
|---|---|---|---|
| Dashboard | DASHBOARD | `server/routes/reports.js` | sales_invoices, purchase_orders, products |
| CRM | CRM | `server/routes/crm.js` | leads, lead_activities, crm_opportunities |
| PCD Network | PCD_NETWORK | `server/routes/pcd.js` | pcd_partners, pcd_transactions, pcd_schemes |
| OMS | OMS | `server/routes/oms.js` | orders, order_items, reserved_stock |
| POS / Billing | POS | `server/routes/pos.js` | pos_bills, pos_sessions, pos_payments |
| Sales Register | SALES_REGISTER | `server/routes/sales.js` | sales_invoices, invoice_items |
| Wholesale Sales | WHOLESALE_SALES | `server/routes/sales.js` | sales_invoices, parties |
| Inventory Hub | INVENTORY | `server/routes/inventory.js` | products, batches, stock_ledger_entries |
| Purchase | PURCHASE | `server/routes/purchase.js` | purchase_orders, purchase_invoices |
| Logistics | LOGISTICS | `server/routes/logistics.js` | order_shipments, logistics_partners |
| Assets & Maintenance | ASSETS | `server/routes/assets.js` | fixed_assets, asset_maintenance_logs |
| Documents (DMS) | DMS | `server/routes/dms.js` | dms_documents, dms_folders |
| Godown Master | GODOWN_MASTER | `server/routes/godowns.js` | godowns, godown_stock |
| Manufacturing | MANUFACTURING | `server/routes/manufacturing.js` | production_orders, bom_master |
| Quality Control | QC | `server/routes/qc.js` | qc_reports, quality_checks |
| R&D Lab | RD_LAB | `server/routes/rnd.js` | rd_projects, rd_experiments |
| Employees / HR | EMPLOYEES | `server/routes/hr.js` | employees, attendance, payroll |
| Finance / Accounting | ACCOUNTS | `server/routes/accounting.js` | general_ledger, chart_of_accounts |
| GST Reports | GST_REPORTS | `server/routes/gst.js` | sales_invoices, purchase_invoices |
| Intelligence Center | INTELLIGENCE_DASHBOARD | `server/routes/analytics.js` | abc_analysis, forecast_demand |
| Reports | REPORTS | `server/routes/reports.js` | report_jobs, kpi_dashboard_data |
| Audit Logs | AUDIT_LOGS | `server/routes/audit.js` | audit_logs, financial_audit_log |
| Deerflow Control | DEERFLOW_DASHBOARD | `server/routes/deerflow.js` | audit_logs (deerflow entries) |
| Multi-Branch | MULTI_BRANCH | `server/routes/branches.js` | branches |
| Settings | SETTINGS | `server/routes/settings.js` | erp_settings, users, financial_years |
| Enterprise Hub | ENTERPRISE_HUB | `server/routes/enterprise.js` | api_keys, integrations |

## API Route Inventory

### CRM Routes
- `GET /api/crm/stats`
- `GET /api/crm/leads` (supports `?queue=today_and_overdue`)
- `POST /api/crm/leads`
- `PUT /api/crm/leads/:id`
- `DELETE /api/crm/leads/:id`
- `POST /api/crm/convert/:id`
- `GET /api/crm/leads/:id/activities`
- `POST /api/crm/leads/:id/activities`
- `PUT /api/crm/leads/:id/ai-score`

### OMS Routes
- `GET /api/oms/orders` (supports `?sla_breach=true`)
- `POST /api/oms/orders`
- `PUT /api/oms/orders/:id/status`
- `GET /api/oms/orders/:id`
- `POST /api/oms/orders/:id/ship`
- `POST /api/oms/orders/:id/return`

### Inventory Routes
- `GET /api/inventory`
- `POST /api/inventory`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `GET /api/inventory/:id/batches`
- `POST /api/inventory/batch`
- `POST /api/inventory/adjust`
- `GET /api/inventory/valuation`
- `GET /api/inventory/lists/dropdown`

### Purchase Routes
- `GET /api/purchase`
- `POST /api/purchase`
- `GET /api/purchase/:id`
- `PUT /api/purchase/:id`
- `POST /api/purchase/:id/receive` (GRN)
- `GET /api/purchase/3-way-match`
- `PUT /api/purchase/3-way-match/:id`
- `GET /api/purchase/vendor-ratings`
- `GET /api/purchase/reorder-alerts`
- `GET /api/purchase/approvals`

### HR Routes (all under `/api/hr/`)
- `GET/POST /employees`
- `GET/PUT/DELETE /employees/:id`
- `GET/POST /departments`
- `GET /departments/tree`
- `GET/POST /salary-structures`
- `GET/POST /attendance`
- `GET/POST /leaves`
- `POST /payroll/run`
- `GET /payroll/slips`
- `PUT /payroll/slips/:id/mark-paid`

### Accounting Routes (all under `/api/accounting/`)
- `GET/POST/PUT/DELETE /chart-of-accounts`
- `GET/POST/PUT/DELETE /journal-vouchers`
- `POST /journal-vouchers/:id/post`
- `POST /journal-vouchers/:id/reverse`
- `GET /general-ledger/:accountId`
- `GET /ledger/party/:partyId`
- `POST /trial-balance`
- `POST /balance-sheet`
- `POST /profit-loss`
- `POST /cash-flow`
- `POST /aging-analysis`
- `GET /daybook`

### Analytics / Intelligence Routes
- `GET /api/analytics/inventory/comprehensive`
- `GET /api/analytics/financial/summary`
- `GET /api/analytics/customers/drift`
- `POST /api/analytics/inventory/optimize`
- `POST /api/analytics/reports/generate`
- `GET /api/analytics/reports/status/:jobId`
- `GET /api/analytics/reports/status/batch?jobIds=...`

### Dashboard / Reports Routes
- `GET /api/reports/dashboard-summary`
- `GET /api/reports/inventory`
- `GET /api/reports/sales`
- `GET /api/reports/purchase`
- `GET /api/reports/kpi`
- `POST /api/reports/ai-generate`

### GST Routes
- `GET /api/gst/gstr1`
- `GET /api/gst/gstr2` (supports `?recon=true`)
- `GET /api/gst/gstr3b`

### Voucher Routes (under `/api/vouchers/`)
- `POST /receipt`
- `POST /payment`
- `POST /contra`
- `POST /sales-return`
- `POST /purchase-return`
- `GET/POST/PUT /types`

## Invoice Number Conventions

| Type | Format | Source |
|---|---|---|
| POS Retail | `INV-YYYY-NNNN` | `pos_bills` |
| PCD Partner | `PCD-YYYYMMDD-NNNN` | `sales_invoices` |
| Wholesale | `WHO-YYYYMMDD-NNNN` | `sales_invoices` |
| Purchase Order | `PO-YYYYMMDD-NNNN` | `purchase_orders` |
| Sales Order | `SO-YYYYMMDD-NNNN` | `orders` |
| Production Order | `PO-YYYYMMDD-NNNN` | `production_orders` |
