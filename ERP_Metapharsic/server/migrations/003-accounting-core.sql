CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Chart Of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    account_code VARCHAR(50) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Income, Expense
    account_group VARCHAR(100),
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'Active',
    gst_applicable BOOLEAN DEFAULT FALSE,
    tds_applicable BOOLEAN DEFAULT FALSE,
    is_bank_or_cash BOOLEAN DEFAULT FALSE,
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Parties (Customer/Supplier)
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    party_type VARCHAR(50) NOT NULL, -- Customer, Supplier
    name VARCHAR(255) NOT NULL,
    gstin VARCHAR(20),
    pan VARCHAR(20),
    email VARCHAR(255),
    mobile VARCHAR(20),
    address TEXT,
    state_code VARCHAR(10),
    account_id UUID REFERENCES chart_of_accounts(id), -- Linked to AP/AR account
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    credit_days INTEGER DEFAULT 0,
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Journal Vouchers
CREATE TABLE IF NOT EXISTS journal_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    voucher_no VARCHAR(50) UNIQUE NOT NULL,
    voucher_date DATE NOT NULL,
    voucher_type VARCHAR(50) NOT NULL, -- JV, Receipt, Payment, Contra, Sales, Purchase
    narration TEXT,
    total_debit NUMERIC(15, 2) NOT NULL,
    total_credit NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Posted, Cancelled
    reference_number VARCHAR(100), -- Bill no, Check no
    created_by UUID,
    posted_by UUID,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Journal Voucher Entries
CREATE TABLE IF NOT EXISTS journal_voucher_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID REFERENCES journal_vouchers(id) ON DELETE CASCADE,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    party_id UUID REFERENCES parties(id), -- If applicable
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    narration TEXT,
    cost_center_id UUID, -- We'll define cost_centers in the next script
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. General Ledger (Immutable transactional log)
CREATE TABLE IF NOT EXISTS general_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    party_id UUID REFERENCES parties(id),
    voucher_id UUID REFERENCES journal_vouchers(id) NOT NULL,
    voucher_type VARCHAR(50) NOT NULL,
    transaction_date DATE NOT NULL,
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    running_balance NUMERIC(15, 2) NOT NULL,
    narration TEXT,
    is_reconciled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast lookups & analytical reports
CREATE INDEX IF NOT EXISTS idx_gl_account_date on general_ledger(account_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_jve_voucher on journal_voucher_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_jv_date on journal_vouchers(voucher_date);
