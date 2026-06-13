-- Fix missing Foreign Keys for Core Financials (Phase 1)

ALTER TABLE chart_of_accounts
ADD CONSTRAINT fk_coa_parent 
FOREIGN KEY (parent_account_id) 
REFERENCES chart_of_accounts(id) 
ON DELETE SET NULL;

ALTER TABLE chart_of_accounts
ADD CONSTRAINT fk_coa_cost_center 
FOREIGN KEY (cost_center_id) 
REFERENCES cost_centers(id) 
ON DELETE SET NULL;

-- Ensure general ledger cascades or restricts appropriately
-- Currently gl doesn't have ON DELETE CASCADE for voucher_id, which can cause orphans
ALTER TABLE general_ledger
DROP CONSTRAINT IF EXISTS general_ledger_voucher_id_fkey,
ADD CONSTRAINT general_ledger_voucher_id_fkey 
FOREIGN KEY (voucher_id) 
REFERENCES journal_vouchers(id) 
ON DELETE CASCADE;

-- Ensure general ledger cascades or restricts for account_id
ALTER TABLE general_ledger
DROP CONSTRAINT IF EXISTS general_ledger_account_id_fkey,
ADD CONSTRAINT general_ledger_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES chart_of_accounts(id) 
ON DELETE CASCADE;

-- Same for budgets
ALTER TABLE budgets
DROP CONSTRAINT IF EXISTS budgets_account_id_fkey,
ADD CONSTRAINT budgets_account_id_fkey
FOREIGN KEY (account_id)
REFERENCES chart_of_accounts(id)
ON DELETE CASCADE;

ALTER TABLE budgets
DROP CONSTRAINT IF EXISTS budgets_cost_center_id_fkey,
ADD CONSTRAINT budgets_cost_center_id_fkey
FOREIGN KEY (cost_center_id)
REFERENCES cost_centers(id)
ON DELETE CASCADE;
