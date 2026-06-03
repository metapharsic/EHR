-- Migration: 20260603_pcd_erp_integration.sql
-- Description: Link PCD module with core ERP Sales and Stock tables

-- 1. Link PCD Transactions to Products and Invoices
ALTER TABLE pcd_transactions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE pcd_transactions ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;
ALTER TABLE pcd_transactions ADD COLUMN IF NOT EXISTS sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL;

-- 2. Link PCD Receivables to Sales Invoices
ALTER TABLE pcd_receivables ADD COLUMN IF NOT EXISTS sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL;

-- 3. Link PCD Commissions to Journal Vouchers (Liability)
ALTER TABLE pcd_commissions ADD COLUMN IF NOT EXISTS journal_voucher_id UUID REFERENCES journal_vouchers(id) ON DELETE SET NULL;

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_pcd_transactions_invoice ON pcd_transactions(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_pcd_receivables_invoice ON pcd_receivables(sales_invoice_id);
