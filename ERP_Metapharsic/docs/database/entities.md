# Database Entities — Metapharsic Lifesciences ERP

> Source of truth: `server/schema.sql`

## Mandatory Column Rules

Every entity MUST have:
- `id` (PK — INTEGER SERIAL or UUID depending on module)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `company_id INTEGER` (for multi-tenant tables)

Financial/audit entities also require:
- `created_by` (user reference)
- Soft delete field (`deleted_at TIMESTAMPTZ` or `status` with 'Deleted' value)

## Core Entities

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR | |
| email | VARCHAR | UNIQUE |
| password | TEXT | Plain text (no hashing without full migration) |
| role | VARCHAR | See roles.md |
| risk_score | INTEGER | MANDATORY |
| two_factor_enabled | BOOLEAN | MANDATORY |
| company_id | INTEGER | FK -> companies |

### companies
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| name | VARCHAR | |
| gstin | VARCHAR | |
| state | VARCHAR | Used for GST engine |

### products
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| name | VARCHAR | |
| generic_name | VARCHAR | |
| selling_rate | DECIMAL | MANDATORY |
| mrp | DECIMAL | MANDATORY |
| ptr | DECIMAL | |
| pts | DECIMAL | |
| gst | DECIMAL | GST % |
| reorder_level | INTEGER | MANDATORY |
| is_active | BOOLEAN | MANDATORY |
| current_stock | INTEGER | DENORMALIZED cache — recompute from batches.stock for accurate reads |
| schedule | VARCHAR | e.g. 'H1' for Schedule H drugs |
| company_id | INTEGER | FK -> companies |

### batches
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| product_id | INTEGER | FK -> products |
| batch_number | VARCHAR | |
| stock | INTEGER | MANDATORY — live qty |
| reserved_qty | INTEGER | MANDATORY — from OMS reservations |
| available_qty | COMPUTED | stock - reserved_qty |
| expiry_date | DATE | MANDATORY |
| cost_price | DECIMAL | MANDATORY |
| status | VARCHAR | Active, QC_Pending, Rejected, Expired |

### parties
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| name | VARCHAR | |
| type | VARCHAR | MANDATORY: Debtor, Creditor, Both |
| gstin | VARCHAR | |
| state | VARCHAR | Used for GST engine |
| current_balance | DECIMAL | MANDATORY — DENORMALIZED, updated on every transaction |
| credit_limit | DECIMAL | MANDATORY |
| company_id | INTEGER | MANDATORY |

### sales_invoices
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| invoice_number | VARCHAR | MANDATORY — unique, prefixed by type |
| net_amount | DECIMAL | MANDATORY |
| sub_total | DECIMAL | MANDATORY |
| total_gst | DECIMAL | MANDATORY |
| party_id | INTEGER | MANDATORY |
| company_id | INTEGER | MANDATORY |
| status | VARCHAR | Draft, Completed, Cancelled |

### general_ledger
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| account_id | INTEGER | FK -> chart_of_accounts |
| debit_amount | DECIMAL | |
| credit_amount | DECIMAL | |
| voucher_id | INTEGER | FK -> journal_vouchers |
| party_id | INTEGER | Optional — for party ledger |
| cost_center_id | INTEGER | Optional |
| company_id | INTEGER | MANDATORY |
| financial_year | VARCHAR | |
| transaction_date | DATE | |

### chart_of_accounts
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| account_code | VARCHAR | Convention: 1xxx=Assets, 2xxx=Liabilities, 3xxx=Equity, 4xxx=Income, 5xxx=Expenses |
| account_name | VARCHAR | |
| account_type | VARCHAR | Asset, Liability, Equity, Income, Expense |
| parent_id | INTEGER | Self-referencing tree |
| company_id | INTEGER | |

## HR Entities

### employees
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK — use uuidv4() always |
| name | VARCHAR | |
| email | VARCHAR | |
| department_id | INTEGER | FK -> hr_departments |
| designation_id | INTEGER | FK -> hr_designations |
| status | VARCHAR | Active, On Leave, Terminated, Resigned |
| joining_date | DATE | |
| exit_date | DATE | Set on Terminated/Resigned |
| target_achievement | DECIMAL | For performance stats |
| company_id | INTEGER | |

### hr_departments
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| name | VARCHAR | |
| parent_dept_id | INTEGER | Self-referencing — use WITH RECURSIVE for tree queries |

## Intelligence / Analytics Entities

### report_jobs
| Column | Type | Notes |
|---|---|---|
| id | TEXT | PK — prefix `dbj-` for DB-backed jobs |
| report_id | TEXT | |
| type | TEXT | demand_forecast, financial_health, inventory_intelligence |
| user_id | TEXT | UUID as text |
| state | TEXT | active, completed, failed |
| progress | INTEGER | 0-100 |
| result | JSONB | Nested: { success, reportId, result: { summary, recommendations } } |
| error | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

## Compliance Entities

### drug_licenses
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| license_number | VARCHAR | |
| expiry_date | DATE | |
| status | VARCHAR | valid, expiring, expired, suspended, Revoked |
| company_id | INTEGER | |

### h1_register
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| drug_name | VARCHAR | MANDATORY |
| batch_number | VARCHAR | MANDATORY |
| patient_name | VARCHAR | MANDATORY |
| doctor_name | VARCHAR | MANDATORY |
| quantity | DECIMAL | MANDATORY |
| entry_date | DATE | MANDATORY |

## Audit Entities

### audit_logs
| Column | Type | Notes |
|---|---|---|
| id | INTEGER SERIAL | PK |
| user_id | UUID | FK -> users (nullable for system actions) |
| action | VARCHAR | VERB_NOUN format e.g. INVOICE_CREATED |
| module | VARCHAR | CRM, OMS, POS, etc. |
| table_name | VARCHAR | |
| record_id | VARCHAR | |
| old_value | JSONB | |
| new_value | JSONB | |
| status | VARCHAR | SUCCESS, FAILED, IN_PROGRESS |
| ip_address | VARCHAR | from req.ip |
| details | JSONB | |
| created_at | TIMESTAMPTZ | IMMUTABLE — never update or delete |
