CREATE TABLE IF NOT EXISTS pdc_cheques (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        INTEGER DEFAULT 1,
  party_id          UUID REFERENCES parties(id),
  bank_account_id   UUID REFERENCES chart_of_accounts(id),  -- Bank GL account
  cheque_number     VARCHAR(50) NOT NULL,
  cheque_date       DATE NOT NULL,
  amount            NUMERIC(15,2) NOT NULL,
  cheque_type       VARCHAR(20) NOT NULL,   -- 'Received' | 'Issued'
  status            VARCHAR(30) DEFAULT 'Pending', -- Pending, Cleared, Bounced, Cancelled
  bounce_reason     TEXT,
  narration         TEXT,
  journal_voucher_id UUID REFERENCES journal_vouchers(id), -- Created when cleared/bounced
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pdc_party    ON pdc_cheques(party_id);
CREATE INDEX IF NOT EXISTS idx_pdc_date     ON pdc_cheques(cheque_date);
CREATE INDEX IF NOT EXISTS idx_pdc_status   ON pdc_cheques(status);
