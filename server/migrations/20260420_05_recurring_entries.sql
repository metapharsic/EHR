CREATE TABLE IF NOT EXISTS recurring_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      INTEGER DEFAULT 1,
  template_name   VARCHAR(100) NOT NULL,
  frequency       VARCHAR(20) NOT NULL, -- Daily, Weekly, Monthly, Yearly
  next_run_date   DATE NOT NULL,
  end_date        DATE,
  amount          NUMERIC(15,2) NOT NULL,
  debit_account_id  UUID REFERENCES chart_of_accounts(id),
  credit_account_id UUID REFERENCES chart_of_accounts(id),
  narration       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recc_next_run ON recurring_entries(next_run_date) WHERE is_active = true;
