-- 1. Cost Centers
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- Department, Project, Region
    budget_limit NUMERIC(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Budgets
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    cost_center_id UUID REFERENCES cost_centers(id),
    financial_year VARCHAR(20) NOT NULL,
    budget_amount NUMERIC(15, 2) NOT NULL,
    actual_amount NUMERIC(15, 2) DEFAULT 0,
    variance NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Fixed Assets
CREATE TABLE IF NOT EXISTS fixed_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    asset_name VARCHAR(255) NOT NULL,
    asset_code VARCHAR(100) UNIQUE,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_value NUMERIC(15, 2) NOT NULL,
    current_value NUMERIC(15, 2) NOT NULL,
    depreciation_method VARCHAR(50) DEFAULT 'Straight Line',
    depreciation_rate_percent NUMERIC(5, 2) NOT NULL,
    accumulated_depreciation NUMERIC(15, 2) DEFAULT 0,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bank Reconciliations
CREATE TABLE IF NOT EXISTS bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    statement_date DATE NOT NULL,
    closing_balance_per_bank NUMERIC(15, 2) NOT NULL,
    closing_balance_per_books NUMERIC(15, 2) NOT NULL,
    unreconciled_difference NUMERIC(15, 2) NOT NULL,
    reconciliation_status VARCHAR(50) DEFAULT 'Pending',
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. GST / TDS Tax Ledgers
CREATE TABLE IF NOT EXISTS tax_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_type VARCHAR(20) NOT NULL, -- GST, TDS
    tax_name VARCHAR(100) NOT NULL, -- SGST 9%, CGST 9%, TDS Sec 194J
    rate NUMERIC(5, 2) NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Forex Rates
CREATE TABLE IF NOT EXISTS forex_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_code VARCHAR(10) NOT NULL,
    base_currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate NUMERIC(15, 6) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Trail (Strict Immutable)
CREATE TABLE IF NOT EXISTS financial_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    user_id UUID, -- Removed NOT NULL temporarily for simpler insertions if user is system
    action_type VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, POST, REVERSE
    entity_type VARCHAR(50) NOT NULL, -- JOURNAL_VOUCHER, LEDGER, ACCOUNT
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
