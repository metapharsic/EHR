# Metapharsic ERP — LLM Handoff Checkpoint
> Generated: 2026-06-23 | Branch: main | VPS: 187.127.169.217 | Domain: erp.metapharsic.cloud

## Stack
- **Backend**: Node.js/Express → `server/index.js`, routes in `server/routes/`
- **Frontend**: React 18 + Vite + TypeScript → `src/`
- **DB**: PostgreSQL, pool in `server/db.js`
- **VPS path**: `/u01/apps/Metapharsic_ERP`
- **PM2**: cluster mode, workers 14 & 15

## Critical Rules (NEVER break)
- Never hard-DELETE DB rows → soft delete: `status='Cancelled'` or `is_active=false`
- All SQL SELECT aliases must be camelCase (AP-015)
- pg `numeric`/`decimal` returns JS strings → always `::float` cast + `parseFloat()` in reduce
- Never hash passwords without full migration (currently plain text)
- No Docker. PM2 only at deployment
- Run `impact()` before editing any symbol (CLAUDE.md mandate)

## Navigation Map (src/components/Sidebar.tsx)
```
REVENUE:    CRM · PCD · OMS · POS · Sales Register · Wholesale Sales
SUPPLY:     Inventory Hub · Purchase · Logistics · Assets & Maint. · Documents · Godown Master
PRODUCTION: Manufacturing · Quality Control · R&D Lab
PEOPLE:     HRMS
FINANCE:    Accounts · Ledger Creation · Voucher Setup · Compliance · Customer DB
SYSTEM:     Dashboard · Reports · Audit Logs · Enterprise Hub · Settings
```

## Tab Routing (src/App.tsx renderActiveTab)
| Tab enum | Component | Notes |
|---|---|---|
| INVENTORY_HUB | InventoryHub | **canonical** inventory tab |
| INVENTORY | InventoryHub | legacy alias → redirects to INVENTORY_HUB |
| INVENTORY_ANALYTICS | InventoryHub | legacy alias → redirects to INVENTORY_HUB |
| PURCHASE | PurchaseEnhanced | |
| ASSETS | Assets | DB-connected. FixedAssetRegister.tsx was DELETED (hardcoded mock) |
| LEDGER_CREATION | LedgerCreation | Chart of Accounts master |
| GENERAL_LEDGER | (inner tab) | Sub-tab inside Accounts.tsx + StrategicAccounts.tsx |

## Key Files Changed This Session
| File | What changed |
|---|---|
| `src/components/Sales.tsx` | Full rewrite: delete invoice, print+watermark, Revenue Analysis wired to API |
| `server/routes/sales.js` | Soft-delete, GET /analytics |
| `server/routes/purchase.js` | Fix Total Purchases ₹0 (SQL alias conflict), trend fix, reorder default 5 |
| `server/routes/analytics.js` | Capital Locked: use purchase_rate not MRP, ::float cast, parseFloat in reduce |
| `server/routes/customers.js` | NEW: WDL compliance API, multer upload, alerts endpoint |
| `server/index.js` | Mount /api/customers |
| `server/services/complianceCron.js` | Added checkCustomerCompliance() daily 9AM IST |
| `src/App.tsx` | ComplianceAlertBanner, legacy tab redirects (INVENTORY→INVENTORY_HUB) |
| `src/components/CustomerDatabasePage.tsx` | Entity types, compliance form, CustomerDocuments component, file upload/view |
| `src/components/Dashboard.tsx` | Fix nav buttons: Tab.INVENTORY → Tab.INVENTORY_HUB |
| `src/constants/shortcuts.ts` | Ctrl+I now maps to INVENTORY_HUB (was dead INVENTORY); removed duplicate INVENTORY_ANALYTICS shortcut (Ctrl+Y conflict with TALLY_VOUCHER_ENTRY) |
| `src/constants.ts` | Removed dead Tab.INVENTORY + Tab.INVENTORY_ANALYTICS role rows (INVENTORY_HUB row covers them) |
| `src/context/NotificationContext.tsx` | Stock alerts now route to INVENTORY_HUB |
| `src/components/Login.tsx` | Inventory quick-start card → INVENTORY_HUB |
| `src/components/FixedAssetRegister.tsx` | **DELETED** — 451-line hardcoded mock, was never imported anywhere |

## DB Migration (run on both local + VPS)
```sql
-- parties table: 25 new compliance columns
ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS dl_20a VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dl_20a_expiry DATE,
  ADD COLUMN IF NOT EXISTS dl_20b VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dl_20b_expiry DATE,
  ADD COLUMN IF NOT EXISTS dl_20c VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dl_20c_expiry DATE,
  ADD COLUMN IF NOT EXISTS dl_20d VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dl_20d_expiry DATE,
  ADD COLUMN IF NOT EXISTS dl_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS pharmacist_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS pharmacist_reg_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pharmacist_reg_expiry DATE,
  ADD COLUMN IF NOT EXISTS doctor_reg_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS doctor_degree VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hospital_reg_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hospital_reg_expiry DATE,
  ADD COLUMN IF NOT EXISTS fssai_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fssai_expiry DATE,
  ADD COLUMN IF NOT EXISTS firm_reg_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS firm_reg_expiry DATE,
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20) DEFAULT 'INCOMPLETE',
  ADD COLUMN IF NOT EXISTS compliance_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_compliance_check TIMESTAMP;

-- customer_documents table
CREATE TABLE IF NOT EXISTS customer_documents (
  id SERIAL PRIMARY KEY,
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,
  doc_number VARCHAR(200),
  expiry_date DATE,
  file_path TEXT,
  file_name VARCHAR(500),
  notes TEXT,
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_docs_party ON customer_documents(party_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_expiry ON customer_documents(expiry_date);
```
> Local: run as `postgres` superuser. VPS: run as `erp_user` (owns tables on VPS).

## WDL Compliance Entity Types
| Entity | Required Fields |
|---|---|
| Retail Chemist | dl_20a, dl_20a_expiry, dl_20b, dl_20b_expiry, pharmacist_name, pharmacist_reg_no, gstin, mobile |
| Wholesale Dealer | dl_20c, dl_20c_expiry, dl_20d, dl_20d_expiry, gstin, mobile |
| Hospital | hospital_reg_no, hospital_reg_expiry, gstin, mobile |
| Clinic/Doctor | doctor_reg_no, doctor_degree, mobile |
| Government | firm_reg_no, mobile |
| Other | mobile |

## Compliance Alert Banner (src/App.tsx)
- Polls `/api/customers/alerts` every 5 min
- Red+pulse if expired+critical > 0; amber if expiring/incomplete
- `useDataFetch` → response shape: `{ success, data: [], summary: { expired, critical, expiring, incomplete, total } }`
- **IMPORTANT**: use `fullResponse?.summary` not `data?.summary` (summary is at root, not inside `data`)

## Common Bug Patterns
1. **pg numeric→string**: Any SUM/AVG of numeric columns → add `::float` in SQL + `parseFloat()` in JS reduce
2. **SQL alias conflict**: `SUM(poi.total_amount) as total_amount` overwrites `po.total_amount` in same query → rename alias
3. **isStandardWrapper**: `useDataFetch` extracts `response.data` when `{ success, data }` shape → top-level fields only via `fullResponse`
4. **Compliance null entity_type**: Always check `if (!p.entity_type) return INCOMPLETE` before looking up REQUIRED_DOCS map

## Pending Backlog
- Employee CTC data entry (6 employees, ctc=0)
- PT slab state fix (2 PT_SLAB rows with state=NULL)
- TDS frontend wiring to real API (backend exists at /api/tds)
- Deploy to VPS (build + PM2 restart — not done yet)
