-- 20260506_accounts_staging_schema.sql
-- Migration to create staging schema for accounting data loads.

CREATE SCHEMA IF NOT EXISTS accounts_staging;

-- 1. Staging Table for Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts_staging.stg_chart_of_accounts (
    staging_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    import_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, VALIDATED, ERROR, PROCESSED
    error_message TEXT,
    raw_data JSONB,
    
    -- Raw Data Columns (All VARCHAR to prevent load failures)
    company_id VARCHAR(50),
    account_code VARCHAR(100),
    account_name VARCHAR(255),
    account_type VARCHAR(100),
    account_group VARCHAR(100),
    opening_balance VARCHAR(50),
    current_balance VARCHAR(50),
    currency VARCHAR(20),
    status VARCHAR(50),
    gst_applicable VARCHAR(20),
    tds_applicable VARCHAR(20),
    is_bank_or_cash VARCHAR(20),
    parent_account_code VARCHAR(100), -- Using code for easier mapping during staging
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- 2. Staging Table for Parties (Customers/Suppliers)
CREATE TABLE IF NOT EXISTS accounts_staging.stg_parties (
    staging_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    import_status VARCHAR(50) DEFAULT 'PENDING',
    error_message TEXT,
    raw_data JSONB,
    
    -- Raw Data Columns
    company_id VARCHAR(50),
    party_type VARCHAR(100),
    name VARCHAR(255),
    gstin VARCHAR(50),
    pan VARCHAR(50),
    email VARCHAR(255),
    mobile VARCHAR(50),
    address TEXT,
    state_code VARCHAR(20),
    account_code VARCHAR(100), -- Map to COA
    credit_limit VARCHAR(50),
    credit_days VARCHAR(50),
    opening_balance VARCHAR(50),
    current_balance VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- 3. Staging Table for Journal Vouchers
CREATE TABLE IF NOT EXISTS accounts_staging.stg_vouchers (
    staging_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    import_status VARCHAR(50) DEFAULT 'PENDING',
    error_message TEXT,
    raw_data JSONB,
    
    -- Raw Data Columns
    company_id VARCHAR(50),
    voucher_no VARCHAR(100),
    voucher_date VARCHAR(50),
    voucher_type VARCHAR(100),
    narration TEXT,
    total_debit VARCHAR(50),
    total_credit VARCHAR(50),
    status VARCHAR(50),
    reference_number VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- 4. Staging Table for Journal Voucher Entries
CREATE TABLE IF NOT EXISTS accounts_staging.stg_voucher_entries (
    staging_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    import_status VARCHAR(50) DEFAULT 'PENDING',
    error_message TEXT,
    raw_data JSONB,
    
    -- Raw Data Columns
    voucher_no VARCHAR(100), -- Used to link to stg_vouchers
    account_code VARCHAR(100), -- Map to COA
    party_gstin VARCHAR(50), -- Or party name/code for mapping
    debit VARCHAR(50),
    credit VARCHAR(50),
    narration TEXT,
    cost_center VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- INDEXES for efficient querying and processing

-- Staging Chart of Accounts Indexes
CREATE INDEX IF NOT EXISTS idx_stg_coa_batch ON accounts_staging.stg_chart_of_accounts(batch_id);
CREATE INDEX IF NOT EXISTS idx_stg_coa_status ON accounts_staging.stg_chart_of_accounts(import_status);
CREATE INDEX IF NOT EXISTS idx_stg_coa_code ON accounts_staging.stg_chart_of_accounts(account_code);

-- Staging Parties Indexes
CREATE INDEX IF NOT EXISTS idx_stg_parties_batch ON accounts_staging.stg_parties(batch_id);
CREATE INDEX IF NOT EXISTS idx_stg_parties_status ON accounts_staging.stg_parties(import_status);
CREATE INDEX IF NOT EXISTS idx_stg_parties_gstin ON accounts_staging.stg_parties(gstin);

-- Staging Vouchers Indexes
CREATE INDEX IF NOT EXISTS idx_stg_vouchers_batch ON accounts_staging.stg_vouchers(batch_id);
CREATE INDEX IF NOT EXISTS idx_stg_vouchers_status ON accounts_staging.stg_vouchers(import_status);
CREATE INDEX IF NOT EXISTS idx_stg_vouchers_no ON accounts_staging.stg_vouchers(voucher_no);

-- Staging Voucher Entries Indexes
CREATE INDEX IF NOT EXISTS idx_stg_ventries_batch ON accounts_staging.stg_voucher_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_stg_ventries_status ON accounts_staging.stg_voucher_entries(import_status);
CREATE INDEX IF NOT EXISTS idx_stg_ventries_vno ON accounts_staging.stg_voucher_entries(voucher_no);
