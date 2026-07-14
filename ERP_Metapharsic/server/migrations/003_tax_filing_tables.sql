-- Migration 003: Tax Filing Tables
-- Run once on VPS: psql -U postgres -d metapharsic_todo_db -f server/migrations/003_tax_filing_tables.sql

BEGIN;

-- ── 1. DROP and RECREATE tds_entries with full schema ────────────────────────
-- The existing table is a minimal stub (8 cols). We rename it and create fresh.
ALTER TABLE tds_entries RENAME TO tds_entries_old;

CREATE TABLE tds_entries (
  id               SERIAL PRIMARY KEY,
  financial_year   VARCHAR(7)    NOT NULL,
  month            INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  section          VARCHAR(10)   NOT NULL,
  deductee_type    VARCHAR(20),
  deductee_name    VARCHAR(255)  NOT NULL,
  deductee_pan     VARCHAR(10),
  payment_date     DATE          NOT NULL,
  payment_amount   NUMERIC(15,2) NOT NULL,
  tds_rate         NUMERIC(5,2)  NOT NULL,
  tds_amount       NUMERIC(15,2) NOT NULL,
  surcharge        NUMERIC(15,2) DEFAULT 0,
  cess             NUMERIC(15,2) DEFAULT 0,
  total_tds        NUMERIC(15,2) NOT NULL,
  challan_id       INTEGER,
  source_type      VARCHAR(20)   NOT NULL DEFAULT 'VENDOR',
  source_id        VARCHAR(100),
  nature_of_payment VARCHAR(255),
  company_id       INTEGER       NOT NULL DEFAULT 1,
  created_by       UUID          REFERENCES users(id),
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_tds_entries_company_month ON tds_entries(company_id, financial_year, month);
CREATE INDEX idx_tds_entries_section       ON tds_entries(section);
CREATE INDEX idx_tds_entries_challan       ON tds_entries(challan_id);
CREATE INDEX idx_tds_entries_pan           ON tds_entries(deductee_pan);

-- ── 2. TDS Challans ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tds_challans (
  id                 SERIAL PRIMARY KEY,
  challan_number     VARCHAR(50)   NOT NULL,
  bsr_code           VARCHAR(7)    NOT NULL,
  challan_date       DATE          NOT NULL,
  section            VARCHAR(10)   NOT NULL,
  financial_year     VARCHAR(7)    NOT NULL,
  month              INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount_paid        NUMERIC(15,2) NOT NULL,
  bank_name          VARCHAR(100),
  acknowledgement_no VARCHAR(50),
  status             VARCHAR(20)   DEFAULT 'Paid',
  company_id         INTEGER       NOT NULL DEFAULT 1,
  created_by         UUID          REFERENCES users(id),
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_tds_challans_company ON tds_challans(company_id, financial_year, month);

-- Now add FK from tds_entries to tds_challans
ALTER TABLE tds_entries
  ADD CONSTRAINT fk_tds_entries_challan FOREIGN KEY (challan_id) REFERENCES tds_challans(id);

-- ── 3. GST Filings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_filings (
  id                 SERIAL PRIMARY KEY,
  return_type        VARCHAR(20)   NOT NULL,
  period_month       INTEGER       CHECK (period_month BETWEEN 1 AND 12),
  financial_year     VARCHAR(7)    NOT NULL,
  filing_date        DATE,
  status             VARCHAR(20)   DEFAULT 'PENDING',
  acknowledgement_no VARCHAR(100),
  total_tax          NUMERIC(15,2),
  igst_paid          NUMERIC(15,2) DEFAULT 0,
  cgst_paid          NUMERIC(15,2) DEFAULT 0,
  sgst_paid          NUMERIC(15,2) DEFAULT 0,
  itc_utilized       NUMERIC(15,2) DEFAULT 0,
  company_id         INTEGER       NOT NULL DEFAULT 1,
  created_by         UUID          REFERENCES users(id),
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_gst_filings_company ON gst_filings(company_id, financial_year, period_month);

-- ── 4. GST Reconciliation ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_reconciliation (
  id                SERIAL PRIMARY KEY,
  financial_year    VARCHAR(7)    NOT NULL,
  period_month      INTEGER       NOT NULL,
  recon_type        VARCHAR(20)   NOT NULL,
  erp_invoice_no    VARCHAR(100),
  erp_gstin         VARCHAR(15),
  erp_amount        NUMERIC(15,2),
  erp_igst          NUMERIC(15,2),
  erp_cgst          NUMERIC(15,2),
  erp_sgst          NUMERIC(15,2),
  portal_invoice_no VARCHAR(100),
  portal_gstin      VARCHAR(15),
  portal_amount     NUMERIC(15,2),
  portal_igst       NUMERIC(15,2),
  portal_cgst       NUMERIC(15,2),
  portal_sgst       NUMERIC(15,2),
  match_status      VARCHAR(30),
  difference        NUMERIC(15,2),
  action_taken      TEXT,
  resolved          BOOLEAN       DEFAULT FALSE,
  company_id        INTEGER       NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_gst_recon_company ON gst_reconciliation(company_id, financial_year, period_month);

-- ── 5. Compliance Filings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_filings (
  id                 SERIAL PRIMARY KEY,
  filing_type        VARCHAR(50)   NOT NULL,
  period_month       INTEGER       CHECK (period_month BETWEEN 1 AND 12),
  period_quarter     VARCHAR(5),
  financial_year     VARCHAR(7)    NOT NULL,
  due_date           DATE          NOT NULL,
  filed_date         DATE,
  status             VARCHAR(20)   DEFAULT 'PENDING',
  acknowledgement_no VARCHAR(100),
  amount_paid        NUMERIC(15,2),
  penalty_paid       NUMERIC(15,2) DEFAULT 0,
  notes              TEXT,
  filed_by           UUID          REFERENCES users(id),
  company_id         INTEGER       NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ   DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_compliance_filings_company ON compliance_filings(company_id, financial_year, period_month);

COMMIT;
