CREATE OR REPLACE FUNCTION fn_update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chart_of_accounts
  SET 
    current_balance = (
      SELECT COALESCE(opening_balance, 0) + COALESCE(SUM(debit - credit), 0)
      FROM general_ledger
      WHERE account_id = NEW.account_id
    ),
    updated_at = NOW()
  WHERE id = NEW.account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_account_balance ON general_ledger;

CREATE TRIGGER trg_update_account_balance
AFTER INSERT ON general_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_update_account_balance();
