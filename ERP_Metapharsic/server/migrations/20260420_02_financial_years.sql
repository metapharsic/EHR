CREATE TABLE IF NOT EXISTS financial_years (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  INTEGER DEFAULT 1,
  year_label  VARCHAR(20) NOT NULL,    -- e.g. "2025-26"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      VARCHAR(20) DEFAULT 'Open',  -- Open, Closed, Locked
  closed_by   UUID REFERENCES users(id),
  closed_at   TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, year_label)
);

-- Insert current FY on migration
INSERT INTO financial_years (year_label, start_date, end_date, status)
VALUES ('2025-26', '2025-04-01', '2026-03-31', 'Open')
ON CONFLICT DO NOTHING;
