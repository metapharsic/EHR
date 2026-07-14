-- Migration: Extend parties table with all required fields
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS pin_code          VARCHAR(10)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_days       INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category          VARCHAR(50)   DEFAULT 'Regular',
  ADD COLUMN IF NOT EXISTS contact_person    VARCHAR(255)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pan               VARCHAR(20)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS route             VARCHAR(255)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS territory         VARCHAR(255)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remarks           TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name         VARCHAR(255)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS account_number    VARCHAR(50)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ifsc_code         VARCHAR(20)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drug_license_no   VARCHAR(100)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ   DEFAULT NOW();

-- Backfill updated_at for existing rows
UPDATE parties SET updated_at = created_at WHERE updated_at IS NULL;

-- Index for common search patterns
CREATE INDEX IF NOT EXISTS idx_parties_type_status  ON parties (type, status);
CREATE INDEX IF NOT EXISTS idx_parties_mobile        ON parties (mobile);
CREATE INDEX IF NOT EXISTS idx_parties_name_trgm     ON parties USING gin(name gin_trgm_ops) WHERE pg_catalog.pg_get_expr(NULL, NULL) IS NULL;

COMMENT ON TABLE parties IS 'Customer (Debtor) and Supplier (Creditor) master records for Metapharsic ERP';
