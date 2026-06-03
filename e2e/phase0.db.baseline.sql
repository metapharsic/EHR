-- ============================================================
-- Phase 0: Database Baseline Verification (CORRECTED TABLE NAMES)
-- Run: psql -U erp_user -d metapharsic_erp -f e2e/phase0.db.baseline.sql
-- All queries should return 0 "MISSING" rows to pass.
-- ============================================================

\echo ''
\echo '=== [0.1] Required Tables Exist (actual DB names) ==='
SELECT t.tablename AS "MISSING_TABLE"
FROM (VALUES
  -- Core
  ('users'), ('products'), ('batches'), ('parties'),
  ('sales_invoices'), ('sales_invoice_items'),
  ('purchase_invoices'), ('purchase_invoice_items'),
  -- Accounts (actual names)
  ('chart_of_accounts'), ('journal_vouchers'), ('journal_voucher_entries'),
  ('financial_years'), ('pdc_cheques'), ('bank_reconciliation'),
  ('budgets'), ('cost_centers'), ('recurring_entries'),
  -- Inventory (actual names)
  ('godowns'), ('stock_ledger_entries'), ('general_ledger'),
  -- Manufacturing (actual names)
  ('boms'), ('production_orders'),
  -- QC (actual names)
  ('qc_records'), ('qc_parameters'),
  -- CRM (actual names)
  ('crm_leads'), ('crm_activities'), ('crm_campaigns'),
  -- OMS (actual names)
  ('orders'), ('order_items'), ('order_shipments'), ('order_returns'),
  -- PCD (actual names)
  ('pcd_partners'), ('pcd_commissions'), ('pcd_targets'), ('pcd_schemes'),
  -- HR/HRMS (actual names)
  ('employees'), ('hr_attendance'), ('hr_leaves'), ('hr_leave_balances'),
  ('salary_slips'),
  -- Compliance (actual names)
  ('compliance_audits'), ('company_documents'),
  -- Assets (actual names)
  ('fixed_assets'), ('hr_asset_allocations'),
  -- Auth
  ('audit_logs'), ('refresh_tokens')
) AS t(tablename)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t.tablename
);

\echo ''
\echo '=== [0.2] Seed Data Sanity ==='
SELECT
  CASE WHEN (SELECT COUNT(*) FROM users)               = 0 THEN 'FAIL: users empty'              ELSE 'OK: users'              END AS users_check,
  CASE WHEN (SELECT COUNT(*) FROM chart_of_accounts)   < 5 THEN 'WARN: chart_of_accounts < 5'    ELSE 'OK: chart_of_accounts'  END AS coa_check,
  CASE WHEN (SELECT COUNT(*) FROM financial_years)     = 0 THEN 'FAIL: no financial_years'       ELSE 'OK: financial_years'    END AS fy_check,
  CASE WHEN (SELECT COUNT(*) FROM products)            = 0 THEN 'WARN: products empty'            ELSE 'OK: products'           END AS products_check,
  CASE WHEN (SELECT COUNT(*) FROM employees)           = 0 THEN 'WARN: employees empty'           ELSE 'OK: employees'          END AS employees_check;

\echo ''
\echo '=== [0.3] Double-Entry Integrity (must return 0 rows) ==='
SELECT jv.id AS "UNBALANCED_VOUCHER_ID",
       SUM(COALESCE(jve.debit,0)) - SUM(COALESCE(jve.credit,0)) AS "NET_IMBALANCE"
FROM journal_vouchers jv
JOIN journal_voucher_entries jve ON jve.voucher_id = jv.id
GROUP BY jv.id
HAVING ABS(SUM(COALESCE(jve.debit,0)) - SUM(COALESCE(jve.credit,0))) > 0.01;

\echo ''
\echo '=== [0.4] Orphaned FK Checks ==='
SELECT COUNT(*) AS "orphan_sales_invoice_items"
FROM sales_invoice_items sii
WHERE NOT EXISTS (SELECT 1 FROM sales_invoices si WHERE si.id = sii.invoice_id);

SELECT COUNT(*) AS "orphan_order_items"
FROM order_items oi
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = oi.order_id);

SELECT COUNT(*) AS "orphan_hr_leaves"
FROM hr_leaves hl
WHERE hl.employee_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = hl.employee_id);

\echo ''
\echo '=== [0.5] Critical Column Presence on users table ==='
SELECT column_name AS "MISSING_COLUMN"
FROM (VALUES
  ('login_attempts'), ('locked_until'), ('risk_score'),
  ('two_factor_enabled'), ('reset_token'), ('reset_token_expires'),
  ('last_login'), ('last_login_ip'), ('last_device_fingerprint')
) AS c(column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = c.column_name
);

\echo ''
\echo '=== [0.6] HRMS Table Structure Checks ==='
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hr_leaves'       AND column_name='status')          THEN 'OK: hr_leaves.status'           ELSE 'FAIL: hr_leaves.status missing'           END,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hr_leave_balances' AND column_name='employee_id')    THEN 'OK: hr_leave_balances.employee_id' ELSE 'FAIL: hr_leave_balances.employee_id missing' END,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='salary_slips'    AND column_name='net_pay')         THEN 'OK: salary_slips.net_pay'        ELSE 'FAIL: salary_slips.net_pay missing'        END,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hr_attendance'   AND column_name='employee_id')     THEN 'OK: hr_attendance.employee_id'   ELSE 'FAIL: hr_attendance.employee_id missing'   END;

\echo ''
\echo '=== Phase 0 Complete: 0 rows in MISSING/UNBALANCED/ORPHAN = PASS ==='
