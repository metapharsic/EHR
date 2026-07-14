ALTER TABLE general_ledger
DROP CONSTRAINT IF EXISTS general_ledger_account_id_fkey,
ADD CONSTRAINT general_ledger_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES chart_of_accounts(id) 
ON DELETE RESTRICT;

ALTER TABLE journal_voucher_entries
DROP CONSTRAINT IF EXISTS journal_voucher_entries_account_id_fkey,
ADD CONSTRAINT journal_voucher_entries_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES chart_of_accounts(id) 
ON DELETE RESTRICT;
